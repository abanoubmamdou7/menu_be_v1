import { asyncHandler } from "../../../utils/errorHandling.js";
import ItemTransferService from "../itemTransferService.js";
import LocationTransferService from "../locationTransferService.js";
import { erpQuery, prisma } from "../../query/controller/query.controller.js";
import logger from "../../../utils/logger.js";
import { connectToDatabase, SqlServerDB } from "../../../../DB/sqlConnection.js";

/** 🔹 Sync branches to restaurant_branches table (optimized with parallel operations) */
const syncBranchesToRestaurantBranches = async (branchesToSync) => {
  try {
    if (!branchesToSync || branchesToSync.length === 0) {
      return { success: true, synced: 0 };
    }

    logger.info(`Syncing ${branchesToSync.length} branches to restaurant_branches table...`);
    
    // Filter valid branches and create upsert promises
    const validBranches = branchesToSync.filter(branch => branch.code && branch.name);
    
    if (validBranches.length === 0) {
      logger.warn("No valid branches to sync");
      return { success: true, synced: 0 };
    }

    // Check if restaurantBranch model exists (graceful fallback with timeout)
    try {
      // Test if model exists by trying a simple query with timeout
      await Promise.race([
        prisma.restaurantBranch.findFirst({ take: 1 }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Model check timeout')), 5000)
        ),
      ]);
    } catch (modelError) {
      // If it's a timeout or connection pool error, skip gracefully
      if (
        modelError.message?.includes('restaurantBranch') || 
        modelError.message?.includes('restaurant_branches') ||
        modelError.message?.includes('timeout') ||
        modelError.message?.includes('connection pool')
      ) {
        logger.warn("restaurant_branches table/model not available or connection issue, skipping branch sync:", modelError.message);
        return { success: true, synced: 0, skipped: true };
      }
      throw modelError;
    }

    // Process in chunks to avoid overwhelming connection pool
    const chunkSize = 50;
    const chunks = [];
    for (let i = 0; i < validBranches.length; i += chunkSize) {
      chunks.push(validBranches.slice(i, i + chunkSize));
    }

    let totalSuccessful = 0;
    let totalFailed = 0;

    // Process chunks sequentially, but operations within chunk in parallel
    for (const chunk of chunks) {
      const upsertPromises = chunk.map((branch) =>
        prisma.restaurantBranch.upsert({
          where: {
            branch_code: branch.code,
          },
          update: {
            branch_name: branch.name,
            updated_at: new Date(),
          },
          create: {
            branch_code: branch.code,
            branch_name: branch.name,
            company: null,
          },
        })
      );

      const results = await Promise.allSettled(upsertPromises);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      totalSuccessful += successful;
      totalFailed += failed;

      if (failed > 0) {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            logger.error(`Error upserting branch ${chunk[index].code}:`, result.reason?.message || result.reason);
          }
        });
      }
    }

    if (totalFailed > 0) {
      logger.warn(`${totalFailed} branch upserts failed out of ${validBranches.length}`);
    }

    logger.info(`✅ Successfully synced ${totalSuccessful} branches to restaurant_branches table`);
    return { success: true, synced: totalSuccessful, failed: totalFailed };
  } catch (error) {
    logger.error("Error syncing branches to restaurant_branches:", error);
    // Don't fail the entire sync if branch sync fails
    return { success: false, error: error.message, skipped: true };
  }
};

export const item = asyncHandler(async (req, res) => {
  try {
    const { branch_code } = req.body;
    if (!branch_code) {
      return res.status(400).json({
        success: false,
        message: "Branch code is required",
      });
    }
    const result = await ItemTransferService.transferItemMaster(branch_code);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to transfer items",
      error: error.message,
    });
  }
});

export const groups = asyncHandler(async (req, res) => {
  try {
    const { branch_code } = req.body;
    if (!branch_code) {
      return res.status(400).json({
        success: false,
        message: "Branch code is required",
      });
    }
    const result = await ItemTransferService.transferItemMainGroups(branch_code);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to transfer item groups",
      error: error.message,
    });
  }
});

export const AllItems = asyncHandler(async (req, res) => {
  try {
    const { branch_code } = req.body;
    if (!branch_code) {
      return res.status(400).json({
        success: false,
        message: "Branch code is required",
      });
    }
    const result = await ItemTransferService.transferAllItems(branch_code);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to transfer all item data",
      error: error.message,
    });
  }
});

export const syncAllBranches = asyncHandler(async (req, res) => {
  let dbPool = SqlServerDB; // Default to the main connection
  try {
    // Check if we need to switch databases based on authenticated user
    if (req.user?.databaseName) {
      logger.info(`Switching to database: ${req.user.databaseName} for sync operation`);
      try {
        dbPool = await connectToDatabase(req.user.databaseName);
      } catch (connError) {
        logger.error(`Failed to connect to database ${req.user.databaseName}:`, connError);
        return res.status(500).json({
          success: false,
          message: `Failed to connect to target database: ${req.user.databaseName}`,
          error: connError.message,
        });
      }
    }

    const requestedBranchCodes = Array.isArray(req.body?.branchCodes)
      ? req.body.branchCodes
          .map((code) =>
            typeof code === "string" ? code.trim().toUpperCase() : ""
          )
          .filter(Boolean)
      : [];

    let branchRecords = [];

    if (requestedBranchCodes.length > 0) {
      branchRecords = requestedBranchCodes.map((code) => ({
        BRANCH_CODE: code,
        BRANCH_NAME: code,
      }));
    } else {
      branchRecords = await erpQuery(`
        SELECT DISTINCT 
          B.BRANCH AS BRANCH_CODE,
          COALESCE(BS.BRANCH_NAME, B.BRANCH) AS BRANCH_NAME
        FROM SYS_COMPANY_BRANCHES_SETUP B
        LEFT JOIN SYS_COMPANY_BRANCHES BS
          ON BS.BRANCH_CODE = B.BRANCH
        WHERE 
          B.TYPE_CODE = 'ITEM_GROUP'
          AND B.BRANCH IS NOT NULL
          AND LTRIM(RTRIM(B.BRANCH)) <> ''
          AND BS.Active = 1           -- ✅ only active branches
        ORDER BY BRANCH_CODE;
      `, {}, dbPool);
      
    }

    const branchesToSync = branchRecords
      .map((branch) => ({
        code:
          branch?.BRANCH_CODE?.trim?.() ||
          branch?.branch_code?.trim?.() ||
          branch?.BRANCH?.trim?.() ||
          "",
        name:
          branch?.BRANCH_NAME?.trim?.() ||
          branch?.branch_name?.trim?.() ||
          branch?.BRANCH?.trim?.() ||
          branch?.BRANCH_CODE?.trim?.() ||
          "",
      }))
      .filter((branch) => branch.code);

    if (branchesToSync.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No branches were found to sync. Please provide branch codes or ensure ERP branch configuration is available.",
      });
    }

    // Process branches sequentially to avoid connection pool exhaustion
    const syncResults = [];
    for (const branch of branchesToSync) {
      try {
        logger.info(`Starting sync for branch ${branch.code} (items + locations)`);
        
        // Items sync - catch errors to prevent crashes
        let itemsResult;
        try {
          itemsResult = await ItemTransferService.transferAllItems(branch.code, dbPool);
          logger.info(`Items sync completed for branch ${branch.code}. Starting location sync...`);
        } catch (itemsError) {
          logger.error(`Items sync failed for branch ${branch.code}:`, itemsError);
          itemsResult = {
            success: false,
            message: `Items sync failed: ${itemsError.message}`,
            error: itemsError.message,
          };
        }
        
        // Location sync - catch errors so they don't crash the whole sync
        let locationResult;
        try {
          locationResult = await LocationTransferService.transferLocations(
            branch.code,
            branch.name,
            dbPool
          );
          logger.info(`Location sync completed for branch ${branch.code}. Result: ${locationResult.success ? 'success' : 'failed'}`);
        } catch (locationError) {
          logger.error(`Location sync failed for branch ${branch.code}:`, locationError);
          locationResult = {
            success: false,
            message: `Location sync failed: ${locationError.message}`,
            error: locationError.message,
          };
        }
        
        syncResults.push({
          status: 'fulfilled',
          value: {
            items: itemsResult,
            location: locationResult,
            // Items sync success is critical, location sync failure should not block overall success
            success: itemsResult?.success ?? false,
          },
        });
      } catch (error) {
        logger.error(`Sync failed for branch ${branch.code}:`, error);
        syncResults.push({
          status: 'rejected',
          reason: error,
        });
      }
    }

    const successes = [];
    const failures = [];

    syncResults.forEach((settledResult, index) => {
      const branch = branchesToSync[index];
      if (settledResult.status === "fulfilled") {
        const result = settledResult.value;
        if (result?.success === false) {
          failures.push({
            branchCode: branch.code,
            branchName: branch.name,
            error: result?.message || "Sync reported failure.",
            details: result,
          });
        } else {
          successes.push({
            branchCode: branch.code,
            branchName: branch.name,
            items: result.items || result,
            location: result.location,
            result: result.items || result,
          });
        }
      } else {
        failures.push({
          branchCode: branch?.code || "UNKNOWN",
          branchName: branch?.name || branch?.code || "UNKNOWN",
          error:
            settledResult.reason?.message ||
            settledResult.reason ||
            "Unknown error",
        });
      }
    });

    // Sync branches to restaurant_branches table
    const branchesSyncResult = await syncBranchesToRestaurantBranches(branchesToSync);
    if (!branchesSyncResult.success) {
      logger.warn("Failed to sync branches to restaurant_branches, but continuing...");
    }

    const totalBranches = branchesToSync.length;
    const responsePayload = {
      success: failures.length === 0,
      message:
        failures.length === 0
          ? `Synced ${successes.length} branches successfully.`
          : failures.length === totalBranches
          ? "Sync failed for all branches."
          : `Synced ${successes.length} branches. ${failures.length} branch(es) failed.`,
      summary: {
        totalBranches,
        syncedBranches: successes.length,
        failedBranches: failures.length,
      },
      successes,
      failures,
    };

    const statusCode =
      failures.length === totalBranches
        ? 500
        : failures.length > 0
        ? 207
        : 200;

    return res.status(statusCode).json(responsePayload);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unexpected error while syncing all branches.",
      error: error.message,
    });
  }
});

/** 🔹 Truncate all Supabase tables and sync from new database */
export const truncateAndSyncAllBranches = asyncHandler(async (req, res) => {
  try {
    logger.info("Starting truncate and sync operation - clearing all Supabase data...");

    let dbPool = SqlServerDB; // Default to the main connection
    
    // Check if we need to switch databases based on authenticated user
    if (req.user?.databaseName) {
      logger.info(`Switching to database: ${req.user.databaseName} for truncate-and-sync operation`);
      try {
        dbPool = await connectToDatabase(req.user.databaseName);
      } catch (connError) {
        logger.error(`Failed to connect to database ${req.user.databaseName}:`, connError);
        return res.status(500).json({
          success: false,
          message: `Failed to connect to target database: ${req.user.databaseName}`,
          error: connError.message,
        });
      }
    }

    // Truncate all Supabase tables (items, categories, locations, restaurant_branches)
    try {
      // Delete in parallel for better performance
      const truncateResults = await Promise.allSettled([
        prisma.itemMaster.deleteMany({}),
        prisma.itemMainGroup.deleteMany({}),
        prisma.location.deleteMany({}),
        prisma.restaurantBranch.deleteMany({}).catch((err) => {
          // If restaurantBranch model doesn't exist yet, log warning but continue
          logger.warn("Could not truncate restaurant_branches (table may not exist):", err.message);
          return { count: 0 };
        }),
      ]);

      // Check for critical failures
      const criticalFailures = truncateResults
        .slice(0, 3) // First 3 are critical (itemMaster, itemMainGroup, location)
        .filter((r) => r.status === "rejected");

      if (criticalFailures.length > 0) {
        const errors = criticalFailures.map((r) => r.reason?.message || r.reason).join("; ");
        logger.error("Error truncating critical Supabase tables:", errors);
        throw new Error(`Failed to truncate critical tables: ${errors}`);
      }

      logger.info("✅ Successfully truncated all Supabase tables");
    } catch (truncateError) {
      logger.error("Error truncating Supabase tables:", truncateError);
      return res.status(500).json({
        success: false,
        message: "Failed to truncate Supabase tables.",
        error: truncateError.message,
      });
    }

    // Now sync fresh data from new database
    const requestedBranchCodes = Array.isArray(req.body?.branchCodes)
      ? req.body.branchCodes
          .map((code) =>
            typeof code === "string" ? code.trim().toUpperCase() : ""
          )
          .filter(Boolean)
      : [];

    let branchRecords = [];

    if (requestedBranchCodes.length > 0) {
      branchRecords = requestedBranchCodes.map((code) => ({
        BRANCH_CODE: code,
        BRANCH_NAME: code,
      }));
    } else {
      branchRecords = await erpQuery(`
        SELECT DISTINCT 
          B.BRANCH AS BRANCH_CODE,
          COALESCE(BS.BRANCH_NAME, B.BRANCH) AS BRANCH_NAME
        FROM SYS_COMPANY_BRANCHES_SETUP B
        LEFT JOIN SYS_COMPANY_BRANCHES BS
          ON BS.BRANCH_CODE = B.BRANCH
        WHERE 
          B.TYPE_CODE = 'ITEM_GROUP'
          AND B.BRANCH IS NOT NULL
          AND LTRIM(RTRIM(B.BRANCH)) <> ''
          AND BS.Active = 1
        ORDER BY BRANCH_CODE;
      `, {}, dbPool);
    }

    const branchesToSync = branchRecords
      .map((branch) => ({
        code:
          branch?.BRANCH_CODE?.trim?.() ||
          branch?.branch_code?.trim?.() ||
          branch?.BRANCH?.trim?.() ||
          "",
        name:
          branch?.BRANCH_NAME?.trim?.() ||
          branch?.branch_name?.trim?.() ||
          branch?.BRANCH?.trim?.() ||
          branch?.BRANCH_CODE?.trim?.() ||
          "",
      }))
      .filter((branch) => branch.code);

    if (branchesToSync.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No branches were found to sync. Please provide branch codes or ensure ERP branch configuration is available.",
      });
    }

    logger.info(`Syncing ${branchesToSync.length} branches from new database...`);

    // Process branches sequentially to avoid connection pool exhaustion
    // This ensures each branch completes fully before starting the next one
    const syncResults = [];
    for (const branch of branchesToSync) {
      try {
        logger.info(`Starting sync for branch ${branch.code} (items + locations)`);
        
        // First sync groups, then items (groups must exist before items due to FK constraint)
        const itemsResult = await ItemTransferService.transferAllItems(branch.code, dbPool);
        logger.info(`Items sync completed for branch ${branch.code}. Starting location sync...`);
        
        // Location sync - catch errors so they don't crash the whole sync
        let locationResult;
        try {
          locationResult = await LocationTransferService.transferLocations(
            branch.code,
            branch.name,
            dbPool
          );
          logger.info(`Location sync completed for branch ${branch.code}. Result: ${locationResult.success ? 'success' : 'failed'}`);
        } catch (locationError) {
          logger.error(`Location sync failed for branch ${branch.code}:`, locationError);
          locationResult = {
            success: false,
            message: `Location sync failed: ${locationError.message}`,
            error: locationError.message,
          };
        }
        
        syncResults.push({
          status: 'fulfilled',
          value: {
            items: itemsResult,
            location: locationResult,
            success: itemsResult.success,
          },
        });
      } catch (error) {
        logger.error(`Sync failed for branch ${branch.code}:`, error);
        syncResults.push({
          status: 'rejected',
          reason: error,
        });
      }
    }

    const successes = [];
    const failures = [];

    syncResults.forEach((settledResult, index) => {
      const branch = branchesToSync[index];
      if (settledResult.status === "fulfilled") {
        const result = settledResult.value;
        if (result?.success === false) {
          failures.push({
            branchCode: branch.code,
            branchName: branch.name,
            error: result?.message || "Sync reported failure.",
            details: result,
          });
        } else {
          successes.push({
            branchCode: branch.code,
            branchName: branch.name,
            items: result.items || result,
            location: result.location,
            result: result.items || result,
          });
        }
      } else {
        failures.push({
          branchCode: branch?.code || "UNKNOWN",
          branchName: branch?.name || branch?.code || "UNKNOWN",
          error:
            settledResult.reason?.message ||
            settledResult.reason ||
            "Unknown error",
        });
      }
    });

    // Sync branches to restaurant_branches table
    const branchesSyncResult = await syncBranchesToRestaurantBranches(branchesToSync);
    if (!branchesSyncResult.success) {
      logger.warn("Failed to sync branches to restaurant_branches, but continuing...");
    }

    const totalBranches = branchesToSync.length;
    const responsePayload = {
      success: failures.length === 0,
      message:
        failures.length === 0
          ? `Truncated and synced ${successes.length} branches successfully from new database.`
          : failures.length === totalBranches
          ? "Truncate and sync failed for all branches."
          : `Truncated and synced ${successes.length} branches. ${failures.length} branch(es) failed.`,
      summary: {
        totalBranches,
        syncedBranches: successes.length,
        failedBranches: failures.length,
        truncated: true,
      },
      successes,
      failures,
    };

    const statusCode =
      failures.length === totalBranches
        ? 500
        : failures.length > 0
        ? 207
        : 200;

    logger.info(`Truncate and sync operation completed: ${successes.length} succeeded, ${failures.length} failed`);
    
    return res.status(statusCode).json(responsePayload);
  } catch (error) {
    logger.error("Unexpected error in truncate and sync operation:", error);
    return res.status(500).json({
      success: false,
      message: "Unexpected error while truncating and syncing.",
      error: error.message,
    });
  }
});