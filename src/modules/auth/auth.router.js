import { Router } from "express";
import * as authController from "./controller/auth.controller.js";
import { auth } from "../../middleware/auth.middleware.js";

const router = Router();
//login
router.post("/login", authController.login);
//connect client
router.post(
  "/connectClient",
  auth(),
  authController.connectClient
);

export default router;
