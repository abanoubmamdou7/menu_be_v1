// import multer from "multer";
// import { asyncHandler } from "./errorHandling.js";
// import { dangerousExtensions } from "./dangerousExtensions.js";
// import fs from "fs";
// import path from "path";
// import os from "os";
// import { fileURLToPath } from "url";

// // Derive __dirname equivalent for ES Modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Define allowed MIME types by base field name
// export const allowedTypesMap = (() => {
//   const baseImageTypes = [
//     "image/png",
//     "image/jpeg",
//     "image/jpg",
//     "image/webp",
//     "image/x-icon",
//     "image/svg+xml",
//   ];

//   const baseDocTypes = [
//     "application/pdf",
//     "application/msword", // .doc
//     "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
//     "application/vnd.rar", // .rar
//     "application/zip", // .zip
//   ];

//   return {
//     image: baseImageTypes,
//   };
// })();

// // Get base field name (e.g., "documentFiles" from "documentFiles_0")
// const getBaseFieldName = (fieldname) => {
//   const match = fieldname.match(/^([a-zA-Z]+)/); // Extract prefix before underscore/digit
//   return match ? match[1] : fieldname;
// };

// // File validation middleware
// const fileValidation = (allowedTypesMap = {}) => {
//   return asyncHandler(async (req, file, cb) => {
//     const fileExtension = file.originalname.split(".").pop().toLowerCase();

//     if (dangerousExtensions.includes(fileExtension)) {
//       return cb(
//         new Error(
//           `File type '${fileExtension}' not allowed (dangerous extension)`,
//           { cause: 400 }
//         ),
//         false
//       );
//     }

//     const baseFieldName = getBaseFieldName(file.fieldname);
//     const allowedMimesForField = allowedTypesMap[baseFieldName];

//     if (!allowedMimesForField) {
//       return cb(
//         new Error(`Field '${file.fieldname}' is not allowed for file uploads`, {
//           cause: 400,
//         }),
//         false
//       );
//     }

//     if (!allowedMimesForField.includes(file.mimetype)) {
//       return cb(
//         new Error(
//           `MIME type '${file.mimetype}' is not allowed for field '${file.fieldname}'`,
//           { cause: 400 }
//         ),
//         false
//       );
//     }

//     cb(null, true);
//   });
// };

// // File upload config
// export function fileUpload(size, allowedTypesMap, destinationPath) {
//   return (req, res, next) => {
//     // Use provided destinationPath or fall back to default
//     const uploadDir =
//       destinationPath || path.join(os.tmpdir(), "mashwiz_uploads");

//     // Create directory if it doesn't exist
//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir, { recursive: true });
//     }

//     const storage = multer.diskStorage({
//       destination: (req, file, cb) => {
//         cb(null, uploadDir);
//       },
//       filename: (req, file, cb) => {
//         const uniqueName = `${Date.now()}-${Math.round(
//           Math.random() * 1e9
//         )}${path.extname(file.originalname)}`;
//         cb(null, uniqueName);
//       },
//     });

//     const limits = { fileSize: size * 1024 * 1024 }; // Size in MB
//     const fileFilter = fileValidation(allowedTypesMap);
//     const upload = multer({ fileFilter, storage, limits });

//     upload.fields([{ name: "image", maxCount: 10 }])(req, res, (err) => {
//       if (err) return next(err);
//       next();
//     });
//   };
// }

// // Flexible upload with any() and dynamic field support
// export function flexibleFileUpload(size = 5, maxCountFiles = 5) {
//   return (req, res, next) => {
//     const upload = fileUpload(size, allowedTypesMap, null).any();

//     upload(req, res, (err) => {
//       if (err) return next(err);

//       if (req.files && req.files.length > maxCountFiles) {
//         return next(
//           new Error(`Maximum of ${maxCountFiles} files allowed`, { cause: 400 })
//         );
//       }

//       const organizedFiles = {};
//       if (req.files && req.files.length > 0) {
//         req.files.forEach((file) => {
//           const fieldName = file.fieldname;
//           if (!organizedFiles[fieldName]) {
//             organizedFiles[fieldName] = [];
//           }
//           organizedFiles[fieldName].push(file);
//         });
//       }

//       req.files = organizedFiles;
//       next();
//     });
//   };
// }
import multer from "multer";
import { asyncHandler } from "./errorHandling.js";
import { dangerousExtensions } from "./dangerousExtensions.js";

/**
 * Allowed MIME types by base field name (you can add more fields later)
 * - mirrors your original structure
 */
export const allowedTypesMap = {
  image: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/x-icon",
    "image/svg+xml",
  ],
  // documentFiles: [ ... ] // example for future fields
};

// Extracts the alphabetic prefix (e.g., "documentFiles" from "documentFiles_0")
const getBaseFieldName = (fieldname) => {
  const match = fieldname.match(/^([a-zA-Z]+)/);
  return match ? match[1] : fieldname;
};

const fileValidation = (allowedMap = {}) =>
  asyncHandler(async (req, file, cb) => {
    const ext = (file.originalname.split(".").pop() || "").toLowerCase();

    if (dangerousExtensions.includes(ext)) {
      return cb(
        new Error(
          `File type '${ext}' not allowed (dangerous extension)`,
          { cause: 400 }
        ),
        false
      );
    }

    const baseField = getBaseFieldName(file.fieldname);
    const allowedMimes = allowedMap[baseField];

    if (!allowedMimes) {
      return cb(
        new Error(`Field '${file.fieldname}' is not allowed for file uploads`, {
          cause: 400,
        }),
        false
      );
    }

    if (!allowedMimes.includes(file.mimetype)) {
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

/**
 * Memory-based uploader for specific fields (no disk writes)
 * @param {number} sizeMB max per-file size
 * @param {object} map allowedTypesMap (by base field)
 * @param {number} maxCount how many files for "image"
 */
export function fileUpload(sizeMB = 8, map = allowedTypesMap, maxCount = 10) {
  const storage = multer.memoryStorage();
  const limits = { fileSize: sizeMB * 1024 * 1024 };
  const fileFilter = fileValidation(map);
  const upload = multer({ storage, limits, fileFilter });

  // Keep your field shape: { name: "image", maxCount }
  return upload.fields([{ name: "image", maxCount }]);
}

/**
 * Flexible memory uploader that accepts any field names but still enforces
 * dangerousExtensions + allowedTypesMap by base field name.
 */
export function flexibleFileUpload(sizeMB = 8, maxCountFiles = 10) {
  const storage = multer.memoryStorage();
  const limits = { fileSize: sizeMB * 1024 * 1024 };
  const fileFilter = fileValidation(allowedTypesMap);
  const upload = multer({ storage, limits, fileFilter }).any();

  // normalize into { fieldName: [files] } like your previous util
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) return next(err);

      if (req.files && req.files.length > maxCountFiles) {
        return next(
          new Error(`Maximum of ${maxCountFiles} files allowed`, { cause: 400 })
        );
      }

      const organized = {};
      if (Array.isArray(req.files)) {
        for (const f of req.files) {
          if (!organized[f.fieldname]) organized[f.fieldname] = [];
          organized[f.fieldname].push(f);
        }
      }
      req.files = organized;
      next();
    });
  };
}
