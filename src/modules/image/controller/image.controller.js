import { asyncHandler } from "../../../utils/errorHandling.js";
import { fileUpload, allowedTypesMap } from "../../../utils/multer.js";
import { uploadMultipleBuffers } from "../../../utils/uploadHelper.js";


const defaultCloudinaryFolder = process.env.APP_NAME
  ? `${process.env.APP_NAME}/uploads`
  : "uploads";
const CLOUDINARY_IMAGE_FOLDER =
  process.env.CLOUDINARY_IMAGE_FOLDER || defaultCloudinaryFolder;

export const uploadImage = asyncHandler(async (req, res, next) => {
  // memory upload middleware
  const upload = fileUpload(8, allowedTypesMap, 10);
  upload(req, res, async (err) => {
    if (err) return next(err);

    const files = req.files?.image || [];
    if (!files.length) {
      return next(new Error("No file uploaded", { cause: 400 }));
    }

    try {
      const urls = await uploadMultipleBuffers(files, CLOUDINARY_IMAGE_FOLDER);

      return res.status(200).json({
        status: "success",
        message: "File(s) uploaded successfully l0ol",
        fileUrls: urls,
        files: files.map((f, i) => ({ originalName: f.originalname, url: urls[i] })),
      });
    } catch (e) {
      return next(e);
    }
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
