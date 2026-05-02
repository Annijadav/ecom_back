// Centralized upload service - swap Cloudinary for S3 here in the future
import cloudinary from '../config/cloudinary.js';

// Upload image buffer to Cloudinary
export const uploadImage = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(fileBuffer);
  });
};

// Delete image from Cloudinary by public_id
export const deleteImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn(`Failed to delete image ${publicId}:`, error.message);
  }
};
