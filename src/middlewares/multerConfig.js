import multer from 'multer';
import path from 'path';

// Memory storage - files stored as Buffer, no disk writes
const storage = multer.memoryStorage();

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

// Multer instances with memory storage
const categoryUpload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const productUpload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const profileUpload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

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

export { categoryUpload as upload };