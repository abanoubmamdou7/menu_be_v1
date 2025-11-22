import {
  erpQuery,
  prisma,
} from "../query/controller/query.controller.js";
import logger from "../../utils/logger.js";

class ItemTransferService {
  constructor() {
    this.batchSize = parseInt(process.env.SYNC_BATCH_SIZE, 10) || 100;
    // Chunk size for parallel operations (to avoid overwhelming connection pool)
    this.parallelChunkSize = parseInt(process.env.SYNC_PARALLEL_CHUNK_SIZE, 10) || 50;
  }

  parseBoolean(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "t", "y", "yes"].includes(normalized)) return true;
      if (["0", "false", "f", "n", "no"].includes(normalized)) return false;
    }
    return Boolean(value);
  }
  /** 🔹 Transfer Item Main Groups with hierarchy */
  async transferItemMainGroups(branchCode, dbPool) {
    try {
      logger.info(
        `Starting item main groups synchronization for branch ${branchCode}`
      );

      const erpGroups = await erpQuery(
        `
        SELECT 
          g.ITM_GROUP_CODE, 
          g.ITM_GROUP_NAME, 
          g.SHOW_IN_WEBSITE,
          g.GROUP_ORDER,
          g.WEBSITE_DESCRIPTION_AR,
          g.WEBSITE_DESCRIPTION_EN,
          g.WEBSITE_NAME_AR,
          g.WEBSITE_NAME_EN,
          g.SALEABLE,
          g.MAIN_GROUP AS PARENT_GROUP_CODE,
          b.BRANCH
        FROM INV_ITEM_MAIN_GROUP g
        INNER JOIN SYS_COMPANY_BRANCHES_SETUP b 
          ON g.ITM_GROUP_CODE = b.CODE 
          AND b.TYPE_CODE = 'ITEM_GROUP'
          AND b.BRANCH = @branchCode
        ORDER BY g.GROUP_ORDER
        `,
        { branchCode },
        dbPool
      );

      if (!Array.isArray(erpGroups) || erpGroups.length === 0) {
        logger.warn(
          `No item main groups found in ERP system for branch ${branchCode}`
        );
        return {
          success: true,
          upserted: 0,
          message: `No item main groups found in ERP for branch ${branchCode}`,
        };
      }

      const normalizedGroups = erpGroups.map((g) =>
        this.normalizeGroupData(g, branchCode, erpGroups)
      );

      const insertResult = await this.batchUpsertGroups(
        normalizedGroups,
        branchCode
      );

      return {
        success: true,
        upserted: insertResult.affectedRows ?? normalizedGroups.length,
        message: `Item main group sync done for branch ${branchCode}: Upserted=${normalizedGroups.length}`,
      };
    } catch (error) {
      logger.error(
        `Error in transferItemMainGroups for branch ${branchCode}:`,
        {
          error: error.message,
          stack: error.stack,
          sqlQuery: "INV_ITEM_MAIN_GROUP join SYS_COMPANY_BRANCHES_SETUP",
          branchCode,
        }
      );
      return {
        success: false,
        message: `Failed to transfer item main groups for branch ${branchCode}: ${error.message}`,
        error: error.message ?? String(error),
      };
    }
  }

  /** 🔹 Transfer Items */
  async transferItemMaster(branchCode, dbPool) {
    try {
      const groups = await erpQuery(
        `
        SELECT 
          g.ITM_GROUP_CODE, 
          b.CODE, 
          b.BRANCH
        FROM INV_ITEM_MAIN_GROUP g
        INNER JOIN SYS_COMPANY_BRANCHES_SETUP b 
          ON g.ITM_GROUP_CODE = b.CODE 
          AND b.TYPE_CODE = 'ITEM_GROUP'
        WHERE b.BRANCH = @branchCode
        `,
        { branchCode },
        dbPool
      );

      const validGroupCodes = new Set(
        Array.isArray(groups) ? groups.map((g) => g.ITM_GROUP_CODE) : []
      );

      if (validGroupCodes.size === 0) {
        logger.warn(
          `No valid item group codes found for branch ${branchCode}. Skipping item master transfer.`
        );
        return {
          success: true,
          upserted: 0,
          message: `No valid item group codes for branch ${branchCode}, skipped item sync.`,
        };
      }

      let offset = 0;
      let totalUpserted = 0;

      while (true) {
        // Try to get items with ITEM_PIC if it exists, otherwise without it
        let items;
        try {
          items = await erpQuery(
            `
  SELECT 
      A.ITEM_CODE,
      A.ITEM_NAME,
      A.ITM_GROUP_CODE,
      A.MENU_ORDER,
      ISNULL(A.SALES_PRICE, 0) AS SALES_PRICE,
      A.SHOW_IN_WEBSITE,
      A.WEBSITE_NAME_EN,
      A.WEBSITE_NAME_AR,
      A.WEBSITE_DESCRIPTION_EN,
      A.WEBSITE_DESCRIPTION_AR,
      A.AUTO_NO,
      A.SALEABLE,
      A.FASTING,
      A.VEGETARIAN,
      A.HEALTHY_CHOICE,
      A.SIGNATURE_DISH,
      A.SPICY,
      A.ITEM_PIC,
      B.BRANCH
  FROM INV_ITEM_MASTER A
  INNER JOIN SYS_COMPANY_BRANCHES_SETUP B 
    ON A.ITEM_CODE = B.CODE 
    AND B.TYPE_CODE = 'ITEM'
    AND B.BRANCH = @branchCode
  WHERE A.ITEM_TYPE = 'N'          
  ORDER BY A.MENU_ORDER
  OFFSET ${offset} ROWS FETCH NEXT ${this.batchSize} ROWS ONLY
`,
            { branchCode },
            dbPool
          );
        } catch (picError) {
          // If ITEM_PIC column doesn't exist, query without it
          if (picError.message?.includes("ITEM_PIC") || picError.message?.includes("Invalid column")) {
            logger.debug(`ITEM_PIC column not found, querying without it for branch ${branchCode}`);
            items = await erpQuery(
              `
  SELECT 
      A.ITEM_CODE,
      A.ITEM_NAME,
      A.ITM_GROUP_CODE,
      A.MENU_ORDER,
      ISNULL(A.SALES_PRICE, 0) AS SALES_PRICE,
      A.SHOW_IN_WEBSITE,
      A.WEBSITE_NAME_EN,
      A.WEBSITE_NAME_AR,
      A.WEBSITE_DESCRIPTION_EN,
      A.WEBSITE_DESCRIPTION_AR,
      A.AUTO_NO,
      A.SALEABLE,
      A.FASTING,
      A.VEGETARIAN,
      A.HEALTHY_CHOICE,
      A.SIGNATURE_DISH,
      A.SPICY,            
      B.BRANCH
  FROM INV_ITEM_MASTER A
  INNER JOIN SYS_COMPANY_BRANCHES_SETUP B 
    ON A.ITEM_CODE = B.CODE 
    AND B.TYPE_CODE = 'ITEM'
    AND B.BRANCH = @branchCode
  WHERE A.ITEM_TYPE = 'N'          
  ORDER BY A.MENU_ORDER
  OFFSET ${offset} ROWS FETCH NEXT ${this.batchSize} ROWS ONLY
`,
              { branchCode },
              dbPool
            );
          } else {
            throw picError;
          }
        }

        if (!Array.isArray(items) || items.length === 0) {
          logger.info(
            `No ERP items found at offset ${offset} for branch ${branchCode}. Ending sync.`
          );
          break;
        }

        const filteredItems = items.filter((i) =>
          validGroupCodes.has(i.ITM_GROUP_CODE)
        );

        if (filteredItems.length === 0) {
          logger.warn(
            `No items match valid group codes at offset ${offset} for branch ${branchCode}`
          );
          offset += this.batchSize;
          continue;
        }

        const normalizedItems = filteredItems.map((i) =>
          this.normalizeItemData(i, validGroupCodes, branchCode)
        );

        const upsertResult = await this.batchUpsertItems(normalizedItems);
        totalUpserted += upsertResult?.affectedRows ?? normalizedItems.length;

        offset += this.batchSize;
      }

      return {
        success: true,
        upserted: totalUpserted,
        message: `Item master sync done for branch ${branchCode}: Upserted=${totalUpserted}`,
      };
    } catch (error) {
      logger.error(`Error in transferItemMaster for branch ${branchCode}:`, {
        error: error.message,
        stack: error.stack,
        sqlQuery: "INV_ITEM_MASTER join SYS_COMPANY_BRANCHES_SETUP",
        branchCode,
      });
      return {
        success: false,
        message: `Failed to transfer item master for branch ${branchCode}: ${error.message}`,
        error: error.message ?? String(error),
      };
    }
  }

  /** 🔹 Normalize group data */
  normalizeGroupData(g, branchCode, allGroups) {
    const parent = g.PARENT_GROUP_CODE?.trim();
    const selfCode = g.ITM_GROUP_CODE?.trim() ?? "";
    const parentGroup = parent || selfCode;

    let nestedLevel = 1;
    let currentParent = parentGroup;
    const visited = new Set();
    const pathNodes = [selfCode];

    while (
      currentParent &&
      currentParent !== selfCode &&
      !visited.has(currentParent)
    ) {
      visited.add(currentParent);
      const parentRecord = allGroups.find(
        (x) => x.ITM_GROUP_CODE?.trim() === currentParent
      );
      if (parentRecord && parentRecord.PARENT_GROUP_CODE?.trim()) {
        nestedLevel++;
        pathNodes.unshift(parentRecord.ITM_GROUP_CODE.trim());
        currentParent = parentRecord.PARENT_GROUP_CODE.trim();
      } else {
        break;
      }
    }

    const path = pathNodes.join("->");

    return {
      itm_group_code: selfCode,
      itm_group_name: g.ITM_GROUP_NAME?.trim() ?? "",
      order_group: g.GROUP_ORDER !== null ? Number(g.GROUP_ORDER) : null,
      show_in_website: this.parseBoolean(g.SHOW_IN_WEBSITE),
      saleable: this.parseBoolean(g.SALEABLE),
      website_description_ar: g.WEBSITE_DESCRIPTION_AR?.trim() ?? "",
      website_description_en: g.WEBSITE_DESCRIPTION_EN?.trim() ?? "",
      website_name_ar: g.WEBSITE_NAME_AR?.trim() ?? "",
      website_name_en: g.WEBSITE_NAME_EN?.trim() ?? "",
      branch_code: branchCode,
      parent_group_code: parentGroup,
      nested_level: nestedLevel,
      path,
    };
  }

  /** 🔹 Normalize item data */
  normalizeItemData(i, validGroups, branchCode) {
    const bool = (val) => this.parseBoolean(val);

    return {
      itm_code: i.ITEM_CODE?.trim() ?? null,
      itm_name: i.ITEM_NAME?.trim() ?? "",
      item_order: i.MENU_ORDER !== null ? Number(i.MENU_ORDER) : null,
      itm_group_code: validGroups.has(i.ITM_GROUP_CODE)
        ? i.ITM_GROUP_CODE.trim()
        : null,
      photo_url: i.ITEM_PIC ?? null, // ITEM_PIC may not exist, will be null if not available
      sales_price: i.SALES_PRICE !== null ? Number(i.SALES_PRICE) : null,
      show_in_website: bool(i.SHOW_IN_WEBSITE),
      saleable: bool(i.SALEABLE),
      website_description_ar: i.WEBSITE_DESCRIPTION_AR?.trim() ?? "",
      website_description_en: i.WEBSITE_DESCRIPTION_EN?.trim() ?? "",
      website_name_ar: i.WEBSITE_NAME_AR?.trim() ?? "",
      website_name_en: i.WEBSITE_NAME_EN?.trim() ?? "",
      branch_code: branchCode,
      fasting: bool(i.FASTING),
      vegetarian: bool(i.VEGETARIAN),
      healthy_choice: bool(i.HEALTHY_CHOICE),
      signature_dish: bool(i.SIGNATURE_DISH),
      spicy: bool(i.SPICY),
    };
  }

  /** 🔹 Batch upsert groups using Prisma (optimized with parallel operations) */

  async batchUpsertGroups(groups) {
    try {
      if (!groups || groups.length === 0) {
        return { affectedRows: 0 };
      }

      // Process in chunks to avoid overwhelming the connection pool
      const chunks = [];
      for (let i = 0; i < groups.length; i += this.parallelChunkSize) {
        chunks.push(groups.slice(i, i + this.parallelChunkSize));
      }

      // Process each chunk in parallel, but chunks sequentially to manage connection pool
      for (const chunk of chunks) {
        const upsertPromises = chunk.map((g) =>
          prisma.itemMainGroup.upsert({
            where: {
              item_main_group_code_branch_code_unique: {
                itm_group_code: g.itm_group_code,
                branch_code: g.branch_code,
              },
            },
            update: {
              itm_group_name: g.itm_group_name,
              order_group: g.order_group,
              show_in_website: g.show_in_website,
              saleable: g.saleable,
              website_description_ar: g.website_description_ar,
              website_description_en: g.website_description_en,
              website_name_ar: g.website_name_ar,
              website_name_en: g.website_name_en,
              branch_code: g.branch_code,
              parent_group_code: g.parent_group_code,
              nested_level: g.nested_level,
              path: g.path,
            },
            create: {
              itm_group_code: g.itm_group_code,
              itm_group_name: g.itm_group_name,
              order_group: g.order_group,
              show_in_website: g.show_in_website,
              saleable: g.saleable,
              website_description_ar: g.website_description_ar,
              website_description_en: g.website_description_en,
              website_name_ar: g.website_name_ar,
              website_name_en: g.website_name_en,
              branch_code: g.branch_code,
              parent_group_code: g.parent_group_code,
              nested_level: g.nested_level,
              path: g.path,
            },
          })
        );

        // Execute chunk in a transaction for atomicity and better connection management
        await prisma.$transaction(upsertPromises);
      }
  
      return { affectedRows: groups.length };
    } catch (error) {
      logger.error("Error in batchUpsertGroups:", error);
      throw error;
    }
  }
  
  /** 🔹 Batch upsert items using Prisma (optimized with parallel operations) */

  async batchUpsertItems(items) {
    try {
      if (!items || items.length === 0) {
        return { affectedRows: 0 };
      }

      // Process in chunks to avoid overwhelming the connection pool
      const chunks = [];
      for (let i = 0; i < items.length; i += this.parallelChunkSize) {
        chunks.push(items.slice(i, i + this.parallelChunkSize));
      }

      // Process each chunk in parallel, but chunks sequentially to manage connection pool
      for (const chunk of chunks) {
        const upsertPromises = chunk.map((i) =>
          prisma.itemMaster.upsert({
            where: {
              item_master_code_branch_code_unique: {
                itm_code: i.itm_code,
                branch_code: i.branch_code,
              },
            },
            update: {
              itm_name: i.itm_name,
              item_order: i.item_order,
              itm_group_code: i.itm_group_code,
              photo_url: i.photo_url,
              sales_price: i.sales_price,
              show_in_website: i.show_in_website,
              saleable: i.saleable,
              website_description_ar: i.website_description_ar,
              website_description_en: i.website_description_en,
              website_name_ar: i.website_name_ar,
              website_name_en: i.website_name_en,
              branch_code: i.branch_code,
              fasting: i.fasting,
              vegetarian: i.vegetarian,
              healthy_choice: i.healthy_choice,
              signature_dish: i.signature_dish,
              spicy: i.spicy,
            },
            create: {
              itm_code: i.itm_code,
              itm_name: i.itm_name,
              item_order: i.item_order,
              itm_group_code: i.itm_group_code,
              photo_url: i.photo_url,
              sales_price: i.sales_price,
              show_in_website: i.show_in_website,
              saleable: i.saleable,
              website_description_ar: i.website_description_ar,
              website_description_en: i.website_description_en,
              website_name_ar: i.website_name_ar,
              website_name_en: i.website_name_en,
              branch_code: i.branch_code,
              fasting: i.fasting,
              vegetarian: i.vegetarian,
              healthy_choice: i.healthy_choice,
              signature_dish: i.signature_dish,
              spicy: i.spicy,
            },
          })
        );

        // Execute chunk in a transaction for atomicity and better connection management
        await prisma.$transaction(upsertPromises);
      }
  
      return { affectedRows: items.length };
    } catch (error) {
      logger.error("Error in batchUpsertItems:", error);
      throw error;
    }
  }
  
  /** 🔹 Full transfer */
  async transferAllItems(branchCode, dbPool) {
    const start = Date.now();
    logger.info(`Starting full sync for branch ${branchCode}...`);

    // First sync groups - MUST complete successfully before items (FK constraint)
    const groups = await this.transferItemMainGroups(branchCode, dbPool);
    
    if (!groups.success) {
      logger.error(`Group sync failed for branch ${branchCode}, skipping items sync`);
      return {
        success: false,
        groups,
        items: { success: false, message: "Skipped due to group sync failure" },
        duration: `${((Date.now() - start) / 1000).toFixed(2)} seconds`,
        message: `Group sync failed for branch ${branchCode}`,
      };
    }

    // Groups are committed, now sync items
    // Add a small delay to ensure groups are fully committed to the database
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const items = await this.transferItemMaster(branchCode, dbPool);
    
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    return {
      success: groups.success && items.success,
      groups,
      items,
      duration: `${duration} seconds`,
      message: `Sync complete for branch ${branchCode} in ${duration}s`,
    };
  }
}

export default new ItemTransferService();
