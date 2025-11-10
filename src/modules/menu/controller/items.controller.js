import MenuService from "../../../utils/menuService.js";
import { asyncHandler } from "../../../utils/errorHandling.js";
import { prisma } from "../../../utils/prismaClient.js";

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : undefined;

// helper to always get branch_code
const getBranchCode = async (req) => {
  const branchCandidates = [
    normalizeString(req?.query?.branchCode),
    normalizeString(req?.query?.branch_code),
    normalizeString(req?.headers?.["x-branch-code"]),
    normalizeString(req?.headers?.["x-branchcode"]),
    normalizeString(process.env.DEFAULT_BRANCH_CODE),
    normalizeString(process.env.BRANCH_CODE),
  ].filter(Boolean);

  if (branchCandidates.length > 0) {
    return branchCandidates[0];
  }

  const restaurant = await prisma.restaurantInfo.findFirst({
    select: { branch_code: true },
  });

  if (restaurant?.branch_code) {
    return restaurant.branch_code;
  }

  throw new Error("No branch_code found in restaurant_info");
};

// generic pagination helper
const getPagination = (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.max(parseInt(query.limit) || 10, 1);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

export const getMenuItems = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const branch_code = await getBranchCode(req);

  // fetch paginated items
  const items = await MenuService.fetchMenuItems(branch_code, limit, offset);

  // total count for frontend pagination
  const total = await MenuService.countMenuItems(branch_code);

  res.json({
    success: true,
    pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    data: items,
  
  });
});

export const getAllCategories = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const branch_code = await getBranchCode(req);

  const categories = await MenuService.fetchAllMenuCategories(
    branch_code,
    limit,
    offset
  );
  const total = await MenuService.countAllMenuCategories(branch_code);

  res.json({
    success: true,
    pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    data: categories,
  
  });
});

export const getParentCategories = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const branch_code = await getBranchCode(req);

  const categories = await MenuService.fetchParentCategories(
    branch_code,
    limit,
    offset
  );
  const total = await MenuService.countParentCategories(branch_code);

  res.json({
    success: true,
    pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    data: categories,
   
  });
});

export const getSubCategories = asyncHandler(async (req, res) => {
  const { parentId } = req.params;
  const { page, limit, offset } = getPagination(req.query);
  const branch_code = await getBranchCode(req);

  const categories = await MenuService.fetchSubCategories(
    branch_code,
    parentId,
    limit,
    offset
  );
  const total = await MenuService.countSubCategories(branch_code, parentId);

  res.json({
    success: true,
    pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    data: categories,
   
  });
});
