import { Router } from "express";
import * as authController from "./controller/auth.controller.js";
import { auth } from "../../middleware/auth.middleware.js";

const router = Router();
//login
router.post("/login", authController.login);
//get current database (lightweight)
router.get(
  "/current-database",
  auth(),
  authController.getCurrentDatabase
);
//connect client
router.post(
  "/connectClient",
  auth(),
  authController.connectClient
);

export default router;
