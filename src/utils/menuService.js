import { prisma } from "./prismaClient.js";

class MenuService {
  // ===================== MENU ITEMS =====================
  static async fetchMenuItems(branch_code, limit, offset) {
    const items = await prisma.itemMaster.findMany({
      where: {
        show_in_website: true,
        saleable: true,
        branch_code: branch_code,
      },
      select: {
        itm_code: true,
        itm_name: true,
        item_order: true,
        website_name_en: true,
        website_description_en: true,
        website_name_ar: true,
        website_description_ar: true,
        sales_price: true,
        itm_group_code: true,
        photo_url: true,
        image: true,
        show_in_website: true,
        saleable: true,
      },
      take: limit,
      skip: offset,
      orderBy: { item_order: 'asc' },
    });

    return items.map((item) => ({
      id: item.itm_code,
      name: item.website_name_en || item.itm_name,
      nameAr: item.website_name_ar,
      order: item.item_order,
      itemOrder: item.item_order,
      description: item.website_description_en,
      descriptionAr: item.website_description_ar,
      price:
        item.sales_price != null
          ? `$${Number(item.sales_price).toFixed(2)}`
          : "",
      category: item.itm_group_code,
      image: item.image?.trim() || "",
    photo_url: item.photo_url,
    show_in_website: item.show_in_website,
    saleable: item.saleable,
    }));
  }

  static async countMenuItems(branch_code) {
    const count = await prisma.itemMaster.count({
      where: {
        show_in_website: true,
        saleable: true,
        branch_code: branch_code,
      },
    });
    return count;
  }

  // ===================== ALL CATEGORIES =====================
  static async fetchAllMenuCategories(branch_code, limit, offset) {
    const categories = await prisma.itemMainGroup.findMany({
      where: {
        show_in_website: true,
        saleable: true,
        branch_code: branch_code,
      },
      select: {
        itm_group_code: true,
        itm_group_name: true,
        website_name_en: true,
        website_name_ar: true,
        order_group: true,
        nested_level: true,
        parent_group_code: true,
        path: true,
      },
      take: limit,
      skip: offset,
      orderBy: { order_group: 'asc' },
    });

    return categories.map((cat) => ({
      id: cat.itm_group_code,
      name: cat.website_name_en || cat.itm_group_name,
      nameAr: cat.website_name_ar,
      orderGroup: cat.order_group,
      nested_level: Number(cat.nested_level),
      parent_group_code: cat.parent_group_code,
      path: cat.path,
      children: [],
    }));
  }

  static async countAllMenuCategories(branch_code) {
    const count = await prisma.itemMainGroup.count({
      where: {
        show_in_website: true,
        saleable: true,
        branch_code: branch_code,
      },
    });
    return count;
  }

  // ===================== PARENT CATEGORIES =====================
  static async fetchParentCategories(branch_code, limit, offset) {
    const categories = await prisma.itemMainGroup.findMany({
      where: {
        show_in_website: true,
        saleable: true,
        branch_code: branch_code,
        nested_level: 1,
      },
      select: {
        itm_group_code: true,
        itm_group_name: true,
        website_name_en: true,
        website_name_ar: true,
        order_group: true,
        nested_level: true,
        parent_group_code: true,
        path: true,
      },
      take: limit,
      skip: offset,
      orderBy: { order_group: 'asc' },
    });

    return categories;
  }

  static async countParentCategories(branch_code) {
    const count = await prisma.itemMainGroup.count({
      where: {
        show_in_website: true,
        saleable: true,
        branch_code: branch_code,
        nested_level: 1,
      },
    });
    return count;
  }

  // ===================== SUB CATEGORIES =====================
  static async fetchSubCategories(branch_code, parentId, limit, offset) {
    const categories = await prisma.itemMainGroup.findMany({
      where: {
        show_in_website: true,
        saleable: true,
        branch_code: branch_code,
        parent_group_code: parentId,
        nested_level: 2,
      },
      select: {
        itm_group_code: true,
        itm_group_name: true,
        website_name_en: true,
        website_name_ar: true,
        order_group: true,
        nested_level: true,
        parent_group_code: true,
        path: true,
      },
      take: limit,
      skip: offset,
      orderBy: { order_group: 'asc' },
    });

    return categories;
  }

  static async countSubCategories(branch_code, parentId) {
    const count = await prisma.itemMainGroup.count({
      where: {
        show_in_website: true,
        saleable: true,
        branch_code: branch_code,
        parent_group_code: parentId,
        nested_level: 2,
      },
    });
    return count;
  }
}

export default MenuService;
