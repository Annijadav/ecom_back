import Category from '../../../models/category/category.js';
import asyncHandler from 'express-async-handler';
import path from 'path';
import { fileURLToPath } from 'url';
import { CATEGORY_MESSAGES } from '../../../config/constant/category/categoryMessage.js';
import { STATUS } from '../../../config/constant/status/status.js';
import categorySchema from '../../../validation/admin/categoryvalidation/categoryValidation.js';
// import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import Product from '../../../models/product/product.js';
import { getFileUrl, getUploadBase } from '../../../middlewares/multerConfig.js';

import fs from 'fs';
// import path from 'path';
// const __dirname = path.resolve(); 
// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===========================
// 1. Get All Categories
// ===========================

export const getCategories = asyncHandler(async (req, res) => {
  const { search, page = 1, limit, sizes } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  let message = CATEGORY_MESSAGES.CATEGORIES_FETCHED;

  // If search is provided
  if (search?.trim()) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
    message += ` matching "${search}"`;
  }


  try {
    const totalCategories = await Category.countDocuments(query);
    let categories;
    let responseData;

    if (limit) {
      categories = await Category.find(query)
        .sort({ createdAt: -1 }) // Sort by createdAt in descending order (latest first)
        .skip(skip)
        .limit(limitNum)
        .lean();
      const totalPages = Math.ceil(totalCategories / limitNum);

      responseData = {
        statusCode: STATUS.OK,
        message,
        data: {
          categories,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalItems: totalCategories,
            limit: limitNum,
          },
        },
      };
    } else {
      categories = await Category.find(query)
        .sort({ createdAt: -1 }) // Sort by createdAt in descending order (latest first)
        .lean();
      responseData = {
        statusCode: STATUS.OK,
        message: `${message} (all categories)`,
        data: {
          categories,
          totalItems: totalCategories,
        },
      };
    }

    res.status(STATUS.OK).json(responseData);
  } catch (error) {
    console.error('Category fetch/search error:', error);
    res.status(STATUS.SERVER_ERROR);
    throw new Error(`${CATEGORY_MESSAGES.CATEGORY_SEARCH_FAILED}: ${error.message}`);
  }
});

// ===========================
// 2. Middleware - Parse JSON Fields
// ===========================

export const parseJsonFields = (fields) => (req, res, next) => {
  fields.forEach((field) => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Invalid JSON format for ${field}`,
        });
      }
    }
  });
  next();
};

// ===========================
// 3. Create Category
// ===========================

export const createCategory = asyncHandler(async (req, res) => {
  
  const { name, description, isActive } = req.body;

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const existingCategory = await Category.findOne({ slug });
  if (existingCategory) {
    res.status(STATUS.BAD_REQUEST);
    throw new Error(CATEGORY_MESSAGES.CATEGORY_EXISTS);
  }

  let bannerImage = null;
  let bannerImagePublicId = null;


  if (req.files && req.files.bannerImage && req.files.bannerImage[0]) {
    const file = req.files.bannerImage[0];
    bannerImage = getFileUrl(req, file.filename, 'categories'); // Generates http://localhost:4000/uploads/categories/filename.jpg
  }


  const category = new Category({
    name,
    description,
    bannerImage,
    bannerImagePublicId,
    
    isActive: isActive !== undefined ? isActive : true,
    
  });

  try {
    const createdCategory = await category.save();
    res.status(STATUS.CREATED).json({
      statusCode: STATUS.CREATED,
      message: CATEGORY_MESSAGES.CATEGORY_CREATED,
      data: createdCategory,
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(STATUS.SERVER_ERROR);
    throw new Error(`${CATEGORY_MESSAGES.CATEGORY_CREATION_FAILED}: ${error.message}`);
  }
});

// ===========================
// 4. Update Category
// ===========================

// export const updateCategory = asyncHandler(async (req, res) => {
//   const category = await Category.findById(req.params.id);

//   if (!category) {
//     res.status(STATUS.NOT_FOUND);
//     throw new Error(CATEGORY_MESSAGES.CATEGORY_NOT_FOUND);
//   }

//   const { error, value } = categorySchema.validate(req.body, { abortEarly: false });
//   if (error) {
//     res.status(STATUS.BAD_REQUEST);
//     throw new Error(`${CATEGORY_MESSAGES.VALIDATION_ERROR}: ${error.details.map(x => x.message).join(', ')}`);
//   }

//   const { name, description, isActive, sizes } = value;

//   if (name && name !== category.name) {
//     const slug = name
//       .toLowerCase()
//       .replace(/[^a-z0-9]+/g, '-')
//       .replace(/^-+|-+$/g, '');

//     const existingCategory = await Category.findOne({ slug });
//     if (existingCategory && existingCategory._id.toString() !== req.params.id) {
//       res.status(STATUS.BAD_REQUEST);
//       throw new Error(CATEGORY_MESSAGES.CATEGORY_EXISTS);
//     }
//     category.slug = slug;
//   }

//   category.name = name || category.name;
//   category.description = description || category.description;
//   category.isActive = isActive !== undefined ? isActive : category.isActive;
//   // category.sizes = sizes || category.sizes;

//    if (req.files.bannerImage) {
//     const bannerFile = req.files.bannerImage[0];
//     category.bannerImage = getFileUrl(req, bannerFile.filename, 'categories');
//   }

//   try {
//     const updatedCategory = await category.save();
//     res.status(STATUS.OK).json({
//       statusCode: STATUS.OK,
//       message: CATEGORY_MESSAGES.CATEGORY_UPDATED,
//       data: updatedCategory,
//     });
//   } catch (error) {
//     console.error('Save error:', error);
//     res.status(STATUS.SERVER_ERROR);
//     throw new Error(`${CATEGORY_MESSAGES.CATEGORY_UPDATE_FAILED}: ${error.message}`);
//   }
// });

// const UPLOADS_BASE_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads', 'categories');

// const deleteFile = async (filePath) => {
//   try {
//     await fs.promises.unlink(filePath);
//     console.log(`✅ File deleted: ${filePath}`);
//     return true;
//   } catch (err) {
//     console.warn(`❌ Failed to delete file: ${filePath}`, err.message);
//     return false;
//   }
// };

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(STATUS.NOT_FOUND);
    throw new Error(CATEGORY_MESSAGES.CATEGORY_NOT_FOUND);
  }

  const { error, value } = categorySchema.validate(req.body, { abortEarly: false });
  if (error) {
    res.status(STATUS.BAD_REQUEST);
    throw new Error(`${CATEGORY_MESSAGES.VALIDATION_ERROR}: ${error.details.map(x => x.message).join(', ')}`);
  }

  const { name, description, isActive, sizes } = value;

  if (name && name !== category.name) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const existingCategory = await Category.findOne({ slug });
    if (existingCategory && existingCategory._id.toString() !== req.params.id) {
      res.status(STATUS.BAD_REQUEST);
      throw new Error(CATEGORY_MESSAGES.CATEGORY_EXISTS);
    }
    category.slug = slug;
  }

  category.name = name || category.name;
  category.description = description || category.description;
  category.isActive = isActive !== undefined ? isActive : category.isActive;
  // category.sizes = sizes || category.sizes;

  if (req.files && req.files.bannerImage) {
    // જો જૂની બેનર ઇમેજ હોય, તો તેને ડિલીટ કરો
    if (category.bannerImage) {
      const filename = path.basename(category.bannerImage);
      const bannerImagePath = path.join(getCategoryUploadsDir(), filename);
      await deleteFile(bannerImagePath);
    }

    // નવી બેનર ઇમેજ સેટ કરો
    const bannerFile = req.files.bannerImage[0];
    category.bannerImage = getFileUrl(req, bannerFile.filename, 'categories');
  }

  try {
    const updatedCategory = await category.save();
    res.status(STATUS.OK).json({
      statusCode: STATUS.OK,
      message: CATEGORY_MESSAGES.CATEGORY_UPDATED,
      data: updatedCategory,
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(STATUS.SERVER_ERROR);
    throw new Error(`${CATEGORY_MESSAGES.CATEGORY_UPDATE_FAILED}: ${error.message}`);
  }
});


// ===========================
// 5. Delete Category
// ===========================






const getCategoryUploadsDir = () => {
  const dir = path.join(getUploadBase(), 'categories');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    console.warn(`Could not create uploads directory at ${dir}. This is expected in serverless environments like Vercel.`);
  }
  return dir;
};

const deleteFile = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
    // console.log(`✅ File deleted: ${filePath}`);
    return true;
  } catch (err) {
    console.warn(`❌ Failed to delete file: ${filePath}`, err.message);
    return false;
  }
};

export const deleteCategory = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(STATUS.BAD_REQUEST).json({
      statusCode: STATUS.BAD_REQUEST,
      message: 'Invalid category ID',
    });
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(STATUS.NOT_FOUND).json({
      statusCode: STATUS.NOT_FOUND,
      message: CATEGORY_MESSAGES.CATEGORY_NOT_FOUND,
    });
  }

  // Check if there are products associated with this category
  const productCount = await Product.countDocuments({ category: req.params.id });
  if (productCount > 0) {
    return res.status(STATUS.BAD_REQUEST).json({
      statusCode: STATUS.BAD_REQUEST,
      message: `Cannot delete category because it is associated with ${productCount} product(s). Please delete the products first.`,
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Delete associated banner image from local storage
    if (category.bannerImage) {
      const filename = path.basename(category.bannerImage);
      const bannerImagePath = path.join(getCategoryUploadsDir(), filename);
      // console.log(`Deleting image: ${bannerImagePath}`);
      await deleteFile(bannerImagePath);
    }

    // Delete the category
    await Category.deleteOne({ _id: req.params.id }, { session });

    await session.commitTransaction();

    res.status(STATUS.OK).json({
      statusCode: STATUS.OK,
      message: CATEGORY_MESSAGES.CATEGORY_DELETED,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Category deletion error:', error);
    res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      statusCode: STATUS.INTERNAL_SERVER_ERROR,
      message: `Failed to delete category: ${error.message}`,
      error: error.message,
    });
  } finally {
    session.endSession();
  }
});

// ===========================
// 6. Get Category By ID
// ===========================

export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(STATUS.NOT_FOUND);
    throw new Error(CATEGORY_MESSAGES.CATEGORY_ID_NOT_FOUND);
  }

  res.status(STATUS.OK).json({
    statusCode: STATUS.OK,
    message: CATEGORY_MESSAGES.CATEGORY_ID_FETCHED,
    data: category,
  });
});

// ===========================
// 6. Get Category By ID .isActive togal
// ===========================
export const getAndUpdateCategoryById = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return res.status(400).json({
      statusCode: 400,
      message: "Invalid Category ID format",
    });
  }

  let category = await Category.findById(categoryId);

  if (!category) {
    return res.status(STATUS.NOT_FOUND).json({
      statusCode: STATUS.NOT_FOUND,
      message: CATEGORY_MESSAGES.CATEGORY_ID_NOT_FOUND,
    });
  }

  // ✅ Get isActive from query param
  const isActiveQuery = req.query.isActive;

  if (typeof isActiveQuery !== "undefined") {
    const isActiveBool = isActiveQuery === "true";
    category.isActive = isActiveBool;
    await category.save();
  }

  res.status(STATUS.OK).json({
    statusCode: STATUS.OK,
    message: CATEGORY_MESSAGES.CATEGORY_UPDATED,
    data: category,
  });
});

/**
 * @desc    Get the count of active categories
 * @route   GET /api/v1/product/active-categories-count
 * @access  Public (or Admin if auth is added)
 */
export const getActiveCategoriesCount = asyncHandler(async (req, res) => {
  console.log('Active categories count route hit'); // Debug log
  const activeCategoriesCount = await Category.countDocuments({ isActive: true });
  const totalCategoriesCount = await Category.countDocuments();
  res.status(STATUS.OK).json({
    statusCode: STATUS.OK,
    message: CATEGORY_MESSAGES.ACTIVE_CATEGORIES_COUNT || 'Total active and total categories fetched',
    data: {
      activeCount: activeCategoriesCount,
      totalCount: totalCategoriesCount,
    },
  });
});





