import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect if running on Vercel (read-only filesystem, only /tmp is writable)
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

// Get the base upload directory - use /tmp on Vercel, local path otherwise
const getUploadBase = () => {
  if (IS_VERCEL) {
    return '/tmp/uploads';
  }
  return path.join(__dirname, '../../uploads');
};

// Create uploads directory if it doesn't exist
const createUploadDir = (dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    console.warn(`Could not create directory ${dir}:`, error.message);
  }
};

// Local storage configuration for categories
const categoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(getUploadBase(), 'categories');
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = `category_${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

// Local storage configuration for products
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(getUploadBase(), 'products');
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = `variant_${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

// Local storage configuration for profiles
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(getUploadBase(), 'profiles');
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = `profile_${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

// File filter to allow images and videos
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp|svg/;
  const allowedVideoTypes = /mp4|avi|mov|wmv|flv|webm/;
  const extname = path.extname(file.originalname).toLowerCase();
  const isImageExt = allowedImageTypes.test(extname);
  const isVideoExt = allowedVideoTypes.test(extname);
  const isImageMime = /^image\//.test(file.mimetype);
  const isVideoMime = /^video\//.test(file.mimetype);

  if ((isImageExt && isImageMime) || (isVideoExt && isVideoMime) || (isImageExt && !isVideoMime) || (isVideoExt && !isImageMime)) {
    return cb(null, true);
  }
  console.error('File rejected:', file.originalname, file.mimetype, 'Extension:', extname);
  cb(new Error('Only images (jpg, jpeg, png, gif, webp, svg) and videos (mp4, avi, mov, wmv, flv, webm) are allowed'));
};

// Multer instances with increased file size limits
const categoryUpload = multer({
  storage: categoryStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const productUpload = multer({
  storage: productStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const profileUpload = multer({
  storage: profileStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Factory function to create dynamic product image uploads
export const createProductImageUpload = (options = {}) => {
  const { variantCount = 5, maxCount = 10, fieldPrefix = 'variants' } = options;
  const fields = Array.from({ length: variantCount }, (_, i) => ({
    name: `${fieldPrefix}[${i}][image]`,
    maxCount,
  }));
  return productUpload.fields(fields);
};

// Static middleware exports for categories
export const uploadCategoryImages = categoryUpload.fields([
  { name: 'bannerImage', maxCount: 1 },
  { name: 'icon', maxCount: 1 },
]);

// Dynamic product images with default configuration
export const uploadProductImages = createProductImageUpload({
  variantCount: 10,
  maxCount: 10,
  fieldPrefix: 'variants',
});

// Environment-based configuration
const VARIANT_COUNT = parseInt(process.env.MAX_VARIANTS) || 5;
export const uploadProductImagesEnv = createProductImageUpload({
  variantCount: VARIANT_COUNT,
  maxCount: 10,
  fieldPrefix: 'variants',
});

// Middleware for single profile image upload
export const uploadProfileImage = profileUpload.single('image');

// Additional helper functions
export const createUploadFromVariants = (variants, maxCount = 10) => {
  const fields = variants.map((variant, index) => ({
    name: `variants[${index}][image]`,
    maxCount,
  }));
  return productUpload.fields(fields);
};

export const dynamicProductImageUpload = (req, res, next) => {
  const variantCount = req.query.variantCount || req.body.variantCount || req.params.variantCount || 5;
  const uploadMiddleware = createProductImageUpload({
    variantCount: parseInt(variantCount),
    maxCount: 10,
    fieldPrefix: 'variants',
  });
  uploadMiddleware(req, res, next);
};

export const createCustomProductUpload = (variantCount) => {
  return createProductImageUpload({ variantCount, maxCount: 10 });
};

// Helper function to get file URL
export const getFileUrl = (req, filename, folderName) => {
  const host = req.protocol + "://" + req.get("host");
  return `${host}/uploads/${folderName}/${filename}`;
};

// Export the upload base getter for use in other files
export { getUploadBase, IS_VERCEL };

// Helper function to delete local files
export const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
        reject(err);
      } else {
        console.log('File deleted successfully:', filePath);
        resolve(true);
      }
    });
  });
};

export { categoryUpload as upload };