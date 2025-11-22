import { erpQuery, prisma } from "../query/controller/query.controller.js";
import logger from "../../utils/logger.js";

class LocationTransferService {
  constructor() {
    // Location sync uses Prisma (which connects to Supabase PostgreSQL)
    this.prisma = prisma;
  }

  /** 🔹 Transfer locations from ERP branches to Supabase via Prisma */
  async transferLocations(branchCode, branchName, dbPool) {
    try {
      if (!this.prisma) {
        logger.warn(
          `Skipping location sync for branch ${branchCode} - Prisma not initialized`
        );
        return {
          success: true,
          upserted: 0,
          message: `Location sync skipped for branch ${branchCode} - Prisma not configured`,
        };
      }

      logger.info(
        `Starting location synchronization for branch ${branchCode}`
      );

      // Query branch location data from ERP
      // Note: SYS_COMPANY_BRANCHES may not have all location fields
      // We'll query what's available and use defaults for missing fields
      let branchData;
      try {
        branchData = await erpQuery(
          `
          SELECT 
            BS.BRANCH_CODE,
            BS.BRANCH_NAME
          FROM SYS_COMPANY_BRANCHES BS
          WHERE BS.BRANCH_CODE = @branchCode
            AND BS.Active = 1
          `,
          { branchCode },
          dbPool
        );

        // Note: Extended location fields (ADDRESS, CITY, MAP_LINK) are not available
        // in SYS_COMPANY_BRANCHES table, so we use basic branch info only
      } catch (error) {
        logger.warn(
          `Could not query branch data from ERP for ${branchCode}: ${error.message}`
        );
        branchData = null;
      }

      const branch = Array.isArray(branchData) && branchData.length > 0 
        ? branchData[0] 
        : null;

      if (!branch) {
        // If branch not found in SYS_COMPANY_BRANCHES, try to create location with basic info
        logger.warn(
          `Branch ${branchCode} not found in SYS_COMPANY_BRANCHES. Creating location with basic info.`
        );
      }

      // Prepare location data
      const locationData = {
        name: branch?.BRANCH_NAME?.trim() || branchName || `Branch ${branchCode}`,
        address: branch?.ADDRESS?.trim() || `${branchCode} Branch`,
        city: branch?.CITY?.trim() || "Unknown",
        map_link: branch?.MAP_LINK?.trim() || `https://maps.google.com/?q=${encodeURIComponent(branch?.BRANCH_NAME || branchCode)}`,
        location_order: null, // Will be set manually or via admin
        is_open_24_7: null, // Will be set manually or via admin
        working_hours: branch?.WORKING_HOURS || null,
        branch_code: branchCode, // Store branch code for reference
      };

      // Check if location already exists (by name)
      let existingLocation;
      try {
        existingLocation = await this.prisma.location.findFirst({
          where: {
            name: locationData.name,
          },
        });
      } catch (findError) {
        logger.error(`Error finding existing location for branch ${branchCode}:`, findError);
        throw new Error(`Failed to check for existing location: ${findError.message}`);
      }

      let upsertResult;

      if (existingLocation) {
        // Update existing location
        try {
          const updated = await this.prisma.location.update({
            where: { id: existingLocation.id },
            data: {
              name: locationData.name,
              address: locationData.address,
              city: locationData.city,
              map_link: locationData.map_link,
              working_hours: locationData.working_hours || null,
            },
          });
          upsertResult = { data: updated, updated: true };
        } catch (updateError) {
          logger.error(`Error updating location for branch ${branchCode}:`, updateError);
          throw new Error(`Failed to update location: ${updateError.message}`);
        }
      } else {
        // Create new location (let Prisma/DB generate UUID)
        const createData = {
          name: locationData.name,
          address: locationData.address,
          city: locationData.city,
          map_link: locationData.map_link,
          location_order: locationData.location_order,
          is_open_24_7: locationData.is_open_24_7,
          working_hours: locationData.working_hours || null,
        };
        
        const created = await this.prisma.location.create({
          data: createData,
        });
        upsertResult = { data: created, updated: false };
      }

      return {
        success: true,
        upserted: 1,
        updated: upsertResult.updated,
        message: `Location sync done for branch ${branchCode}: ${upsertResult.updated ? 'Updated' : 'Created'}`,
      };
    } catch (error) {
      logger.error(
        `Error in transferLocations for branch ${branchCode}:`,
        {
          error: error.message,
          stack: error.stack,
          branchCode,
        }
      );
      return {
        success: false,
        message: `Failed to transfer location for branch ${branchCode}: ${error.message}`,
        error: error.message ?? String(error),
      };
    }
  }

  /** 🔹 Sync all locations for given branches */
  async syncAllLocations(branches, dbPool) {
    try {
      if (!this.prisma) {
        logger.warn(
          "Skipping location sync - Prisma not initialized"
        );
        return {
          success: true,
          synced: 0,
          message: "Location sync skipped - Prisma not configured",
        };
      }

      const results = await Promise.allSettled(
        branches.map((branch) =>
          this.transferLocations(branch.code, branch.name, dbPool)
        )
      );

      const successes = [];
      const failures = [];

      results.forEach((result, index) => {
        const branch = branches[index];
        if (result.status === "fulfilled" && result.value.success) {
          successes.push({
            branchCode: branch.code,
            branchName: branch.name,
            ...result.value,
          });
        } else {
          failures.push({
            branchCode: branch.code,
            branchName: branch.name,
            error:
              result.status === "rejected"
                ? result.reason?.message || result.reason
                : result.value?.message || "Unknown error",
          });
        }
      });

      return {
        success: failures.length === 0,
        synced: successes.length,
        failed: failures.length,
        successes,
        failures,
        message: `Location sync complete: ${successes.length} succeeded, ${failures.length} failed`,
      };
    } catch (error) {
      logger.error("Error in syncAllLocations:", error);
      return {
        success: false,
        message: `Failed to sync locations: ${error.message}`,
        error: error.message ?? String(error),
      };
    }
  }
}

export default new LocationTransferService();

