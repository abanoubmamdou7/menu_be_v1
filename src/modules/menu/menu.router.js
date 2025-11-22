import { Router } from "express";
import * as MasterController from "./controller/menu.controller.js";
import { auth } from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/items", auth(), MasterController.item);
router.post("/groups", auth(), MasterController.groups);
router.post("/all", auth(), MasterController.AllItems);
router.post("/sync-all", auth(), MasterController.syncAllBranches);
router.post("/truncate-and-sync-all", auth(), MasterController.truncateAndSyncAllBranches);

export default router;
