import cloudinary from "./cloudinary.js";

/**
 * Upload a single Buffer to Cloudinary via upload_stream.
 * Returns secure_url (string).
 */
export function uploadBufferToCloudinary(buffer, folder, publicId) {
  return new Promise((resolve, reject) => {
    const options = {
      folder,
      public_id: publicId,
      resource_type: "image",
      // Optional transformations:
      // fetch_format: "auto",
      // quality: "auto",
    };

    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result.secure_url);
    });

    stream.end(buffer);
  });
}

/**
 * Bulk upload (array of multer files) -> secure_url[]
 */
export async function uploadMultipleBuffers(files, folder) {
  return Promise.all(
    files.map((file, i) => {
      const base = file.originalname?.replace(/\.[^.]+$/, "") || `img_${i}`;
      const safe = base.replace(/\s+/g, "_");
      const publicId = `${Date.now()}_${i}_${safe}`;
      return uploadBufferToCloudinary(file.buffer, folder, publicId);
    })
  );
}

/**
 * Delete one Cloudinary resource by its URL
 */
export async function destroyCloudinaryFileFromUrl(url) {
  const urlObj = new URL(url);
  const parts = urlObj.pathname.split("/");
  const versionIndex = parts.findIndex((p) => /^v\d+$/.test(p));
  if (versionIndex === -1) throw new Error("Invalid Cloudinary URL: missing version segment");

  const publicIdWithExt = parts.slice(versionIndex + 1).join("/");
  const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");

  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}

/**
 * Delete all resources under a folder and then the folder
 * e.g., `${process.env.APP_NAME}/products/123`
 */
export async function deleteFromCloudinaryByFolder(folderPath) {
  await cloudinary.api.delete_resources_by_prefix(folderPath);
  try {
    await cloudinary.api.delete_folder(folderPath);
  } catch (e) {
    // Non-fatal if folder isn't empty yet due to async deletes
    console.warn("Could not delete folder:", e?.message || e);
  }
}
