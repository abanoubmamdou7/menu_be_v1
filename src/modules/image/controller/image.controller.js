import { asyncHandler } from "../../../utils/errorHandling.js";
import { fileUpload, allowedTypesMap } from "../../../utils/multer.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ✅ Shared helper: always returns correct upload base path.
 */
function getUploadPath(fileName = "") {
  const uploadRoot =
    process.env.NODE_ENV === "development"
      ? path.resolve(__dirname, "../../../../mashwizfront/public/uploads")
      : "/var/www/mashwizfront/public/uploads";

  return path.join(uploadRoot, fileName);
}

// ================================================================================

/**
 * ✅ Upload Image
 */
export const uploadImage = asyncHandler(async (req, res, next) => {
  const uploadDir = getUploadPath();
  console.log("Upload Dir will be:", uploadDir);

  try {
    if (!fs.existsSync(uploadDir)) {
      console.log("Creating upload dir...");
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (err) {
    console.error("Failed to create upload dir:", err);
    return next(new Error("Failed to create upload dir"));
  }

  console.log("Calling fileUpload middleware...");

  const upload = fileUpload(5, allowedTypesMap, uploadDir);
  upload(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);
      return next(err);
    }

    if (!req.files || !req.files.image || req.files.image.length === 0) {
      console.log("No file uploaded");
      return next(new Error("No file uploaded", { cause: 400 }));
    }

    const fileUrls = req.files.image.map(
      (file) => `${path.basename(file.path)}`
    );
    console.log("File URLs:", fileUrls);

    return res.status(200).json({
      status: "success",
      message: "File(s) uploaded successfully",
      fileUrls,
    });
  });
});
// ================================================================================
/**
 * ✅ Get Image
 */
export const getImage = asyncHandler(async (req, res, next) => {
  const { fileName } = req.query;

  if (!fileName) {
    return next(new Error("fileName query param is required", { cause: 400 }));
  }

  const safeFileName = path.basename(fileName);
  const fullPath = getUploadPath(safeFileName); // Use shared static path function

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "Image not found" });
  }

  // Set proper content type
  const ext = path.extname(safeFileName).toLowerCase();
  const contentTypeMap = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  const contentType = contentTypeMap[ext] || "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.sendFile(fullPath);
  console.log({ fullPath });
});
