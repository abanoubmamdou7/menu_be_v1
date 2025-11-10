import multer from "multer";
import { asyncHandler } from "./errorHandling.js";
import { dangerousExtensions } from "./dangerousExtensions.js";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

// Derive __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define allowed MIME types by base field name
export const allowedTypesMap = (() => {
  const baseImageTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/x-icon",
    "image/svg+xml",
  ];

  const baseDocTypes = [
    "application/pdf",
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.rar", // .rar
    "application/zip", // .zip
  ];

  return {
    image: baseImageTypes,
  };
})();

// Get base field name (e.g., "documentFiles" from "documentFiles_0")
const getBaseFieldName = (fieldname) => {
  const match = fieldname.match(/^([a-zA-Z]+)/); // Extract prefix before underscore/digit
  return match ? match[1] : fieldname;
};

// File validation middleware
const fileValidation = (allowedTypesMap = {}) => {
  return asyncHandler(async (req, file, cb) => {
    const fileExtension = file.originalname.split(".").pop().toLowerCase();

    if (dangerousExtensions.includes(fileExtension)) {
      return cb(
        new Error(
          `File type '${fileExtension}' not allowed (dangerous extension)`,
          { cause: 400 }
        ),
        false
      );
    }

    const baseFieldName = getBaseFieldName(file.fieldname);
    const allowedMimesForField = allowedTypesMap[baseFieldName];

    if (!allowedMimesForField) {
      return cb(
        new Error(`Field '${file.fieldname}' is not allowed for file uploads`, {
          cause: 400,
        }),
        false
      );
    }

    if (!allowedMimesForField.includes(file.mimetype)) {
      return cb(
        new Error(
          `MIME type '${file.mimetype}' is not allowed for field '${file.fieldname}'`,
          { cause: 400 }
        ),
        false
      );
    }

    cb(null, true);
  });
};

// File upload config
export function fileUpload(size, allowedTypesMap, destinationPath) {
  return (req, res, next) => {
    // Use provided destinationPath or fall back to default
    const uploadDir = destinationPath || path.join(__dirname, "files");

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    });

    const limits = { fileSize: size * 1024 * 1024 }; // Size in MB
    const fileFilter = fileValidation(allowedTypesMap);
    const upload = multer({ fileFilter, storage, limits });

    upload.fields([{ name: "image", maxCount: 10 }])(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  };
}

// Flexible upload with any() and dynamic field support
export function flexibleFileUpload(size = 5, maxCountFiles = 5) {
  return (req, res, next) => {
    const upload = fileUpload(size, allowedTypesMap, null).any();

    upload(req, res, (err) => {
      if (err) return next(err);

      if (req.files && req.files.length > maxCountFiles) {
        return next(
          new Error(`Maximum of ${maxCountFiles} files allowed`, { cause: 400 })
        );
      }

      const organizedFiles = {};
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          const fieldName = file.fieldname;
          if (!organizedFiles[fieldName]) {
            organizedFiles[fieldName] = [];
          }
          organizedFiles[fieldName].push(file);
        });
      }

      req.files = organizedFiles;
      next();
    });
  };
}