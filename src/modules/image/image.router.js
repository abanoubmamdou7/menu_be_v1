import { Router } from "express";
import * as imageController from "./controller/image.controller.js";
import { allowedTypesMap, fileUpload } from "../../utils/multer.js";

const router = Router();
//upload image
router.post(
  "/uploadImage",
  imageController.uploadImage
);

// Get an uploaded image
router.get("/getImage", imageController.getImage);


export default router;