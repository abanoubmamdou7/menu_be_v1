import { Router } from "express";
import * as healthController from "./controller/health.controller.js";

const router = Router();
//get health
router.get("/",healthController.health)
export default router;
