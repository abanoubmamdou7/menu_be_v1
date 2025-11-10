import { asyncHandler } from "../../../utils/errorHandling.js";
import ItemTransferService from "../itemTransferService.js";
import { erpQuery } from "../../query/controller/query.controller.js";

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
  try {
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
      `);
      
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

    const syncResults = await Promise.allSettled(
      branchesToSync.map((branch) =>
        ItemTransferService.transferAllItems(branch.code)
      )
    );

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
            result,
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