// Import required modules and controllers
import express from 'express';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  searchProducts,
  getAndUpdateProductById,
getActiveProductsCount
  // getProductBySlug, // Uncomment if you plan to use slug-based product URLs
} from '../../../controllers/admin/product/product.js';

import { validateResource } from '../../../middlewares/admin/validate/validate.js';
import { uploadProductImages } from '../../../middlewares/multerConfig.js';
import auth from '../../../middlewares/admin/auth/auth.js';

// Initialize Express router
const router = express.Router();


/**
 * @route   GET /api/v1/product/active-count
 * @desc    Get the count of active products
 * @access  Public (or Admin if auth is added)
 */
router.get('/active-count', getActiveProductsCount);
/**
 * @route   DELETE /api/v1/product/:id
 * @desc    Delete a product by ID t
 * @access  Admin (Protected)
 */
router.post('/togal/:id', getAndUpdateProductById);
/**
 * @route   GET /api/v1/product/
 * @desc    Get all products with filters, pagination, etc.
 * @access  Public
 */
router.get('/', getProducts);

router.get('/', searchProducts)

/**
 * @route   GET /api/v1/product/:id
 * @desc    Get a single product by ID
 * @access  Admin (Protected)
 */
router.get('/:id', auth, getProductById);

/**
 * @route   POST /api/v1/product/
 * @desc    Create a new product
 * @access  Admin (Protected)
 */
router.post(
  '/',
  auth,
  uploadProductImages,              // Handles image uploads (single or multiple)
  // validateResource('product'),      // Validates product fields if schema is defined
  createProduct
);




/**
 * @route   PUT /api/v1/product/:id
 * @desc    Update an existing product
 * @access  Admin (Protected)
 */
router.put(
  '/:id',
  auth,
  uploadProductImages,              // Re-upload or update images
  // validateResource('product'),
  updateProduct
);

/**
 * @route   DELETE /api/v1/product/:id
 * @desc    Delete a product by ID
 * @access  Admin (Protected)
 */
router.delete('/:id', auth, deleteProduct);

// Optional route for slug-based fetching
// router.get('/:slug', getProductBySlug);



export default router;
