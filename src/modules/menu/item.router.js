import { Router } from "express";
import * as itemsController from "./controller/items.controller.js";

const router = Router();

router.get("/items", itemsController.getMenuItems);
router.get("/categories/all", itemsController.getAllCategories);
router.get("/categories", itemsController.getParentCategories);
router.get("/categories/:parentId", itemsController.getSubCategories);

export default router;
