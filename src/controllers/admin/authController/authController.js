// Import dependencies
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Admin from '../../../models/admin/admin.js';
import sendEmail from '../../../utils/sendemail/sendemail.js';
import { successResponse, errorResponse } from '../../../utils/responseHandler/responseHandler.js';
import { STATUS } from '../../../config/constant/status/status.js';
import { MESSAGES } from '../../../config/constant/admin/adminMessage.js';
import {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateProfileValidation,
} from '../../../validation/admin/authValidation/authValidation.js';
import EmailTemplates, {
  getPasswordResetTemplate,
  getPasswordChangeTemplate,
} from '../../../utils/emailTemplates/emailTemplate.js';
import { deleteFile, getFileUrl } from '../../../middlewares/multerConfig.js';

import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcrypt'


// import cloudinary from '../../../config/cloudinary.js';
// ============================
// Helper: Generate JWT Token
// ============================
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// ==================================
// @desc    Register new admin
// @route   POST /api/admin/register
// ==================================
export const register = async (req, res) => {
  try {
    const { error } = registerValidation.validate(req.body);
    if (error) {
      return errorResponse(res, MESSAGES.VALIDATION_ERROR, STATUS.BAD_REQUEST, error.details[0].message);
    }

    const { name, email, password, role } = req.body;

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return errorResponse(res, MESSAGES.EMAIL_EXISTS, STATUS.BAD_REQUEST);
    }

    const admin = await Admin.create({ name, email, password, role: role || 'admin' });

    const token = generateToken(admin._id);

    return successResponse(
      res,
      MESSAGES.REGISTER_SUCCESS,
      {
        token,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          mobileNumber: admin.mobileNumber, // Ensure this is included
          createdAt: admin.createdAt,
        },
      },
      STATUS.CREATED
    );
  } catch (error) {
    console.error('Register error:', error);
    return errorResponse(res, MESSAGES.SERVER_ERROR, STATUS.SERVER_ERROR);
  }
};

// ===============================
// @desc    Admin login
// @route   POST /api/admin/login
// ===============================
export const login = async (req, res) => {
  try {
    // Seed default admin if no admin exists in the database
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      await Admin.create({
        name: 'Anil',
        email: 'anil@gmail.com',
        password: 'Anil@123',
        role: 'admin',
      });
      console.log('Default admin seeded: anil@gmail.com');
    }

    const { error } = loginValidation.validate(req.body);
    if (error) {
      return res.status(STATUS.BAD_REQUEST).json({
        statusCode: STATUS.BAD_REQUEST,
        message: MESSAGES.VALIDATION_ERROR,
        admin: { error: error.details[0].message }
      });
    }

    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).select("+password");
    console.log("admin",admin);
    
    if (!admin || !admin.isActive) {
      return res.status(STATUS.UNAUTHORIZED).json({
        statusCode: STATUS.UNAUTHORIZED,
        message: MESSAGES.INVALID_CREDENTIALS,
        admin: null
      });
    }
  
    const isPasswordMatch = await admin.comparePassword(password);
    console.log("isPasswordMatch",isPasswordMatch);
    
    if (!isPasswordMatch) {
      return res.status(STATUS.UNAUTHORIZED).json({
        statusCode: STATUS.UNAUTHORIZED,
        message: MESSAGES.INVALID_CREDENTIALS,
        admin: null
      });
    }

    const token = generateToken(admin._id);

    return res.status(STATUS.OK).json({
      statusCode: STATUS.OK,
      message: MESSAGES.LOGIN_SUCCESS,
      
        token,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          mobileNumber: admin.mobileNumber,
          createdAt: admin.createdAt,
        }
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    return res.status(STATUS.SERVER_ERROR).json({
      statusCode: STATUS.SERVER_ERROR,
      message: MESSAGES.SERVER_ERROR,
      admin: null
    });
  }
};

// Admin Login Controller
// export const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // 1. Hardcoded check
//     if (email === "misha1@gmail.com" && password === "Mish@123") {
//       return res.status(200).json({
//         statusCode: 200,
//         message: "Hardcoded Login Successful",
//         token: "dummy-token-123", // ya JWT generate kar lo
//         admin: {
//           id: "hardcoded",
//           name: "Misha",
//           email: "misha1@gmail.com",
//           role: "superadmin",
//         }
//       });
//     }

//     // 2. DB check
//     const admin = await Admin.findOne({ email }).select('+password');

//     if (!admin || !admin.isActive) {
//       return res.status(401).json({
//         statusCode: 401,
//         message: "Invalid credentials or account is deactivated.",
//         admin: null
//       });
//     }

//     const isPasswordMatch = await admin.comparePassword(password);
//     if (!isPasswordMatch) {
//       return res.status(401).json({
//         statusCode: 401,
//         message: "Invalid credentials",
//         admin: null
//       });
//     }

//     const token = generateToken(admin._id);

//     return res.status(200).json({
//       statusCode: 200,
//       message: "Login successful!",
//       token,
//       admin: {
//         id: admin._id,
//         name: admin.name,
//         email: admin.email,
//         role: admin.role,
//         mobileNumber: admin.mobileNumber,
//         createdAt: admin.createdAt,
//       }
//     });

//   } catch (error) {
//     console.error('Login error:', error);
//     return res.status(500).json({
//       statusCode: 500,
//       message: "Server Error",
//       admin: null
//     });
//   }
// };


// ============================================
// @desc    Forgot password (send reset link)
// @route   POST /api/admin/forgot-password
// ============================================
export const forgotPassword = async (req, res) => {
  try {
    const { error } = forgotPasswordValidation.validate(req.body);
    if (error) {
      return errorResponse(res, `Validation error: ${error.details[0].message}`, STATUS.BAD_REQUEST);
    }

    const { email } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) {
      // Return success response even if email is not found (security measure)
      return successResponse(res, 'If the email exists, a reset link has been sent', {}, STATUS.OK);
    }

    // Generate and save reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    admin.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    admin.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
    await admin.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.ADMIN_FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

    // Send password reset email
    await EmailTemplates.sendPasswordResetEmail(
      admin.email,
      'Password Reset Request',
      getPasswordResetTemplate(admin.name, resetUrl),
      true
    );

    return successResponse(res, 'Password reset link sent', { email: admin.email }, STATUS.OK);
  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse(res, 'Server error', STATUS.SERVER_ERROR);
  }
};

// ===================================
// @desc    Reset password using token
// @route   POST /api/admin/reset-password
// ===================================
// export const resetPassword = async (req, res) => {
//   try {
//     const { error } = resetPasswordValidation.validate(req.body);
//     if (error) {
//       return errorResponse(res, `Validation error: ${error.details[0].message}`, STATUS.BAD_REQUEST);
//     }

//     const { token, password } = req.body;
//     const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

//     const admin = await Admin.findOne({
//       resetPasswordToken: hashedToken,
//       resetPasswordExpire: { $gt: Date.now() },
//     });

//     if (!admin) {
//       return errorResponse(res, MESSAGES.TOKEN_INVALID, STATUS.BAD_REQUEST);
//     }

//     admin.password = password;
//     admin.resetPasswordToken = undefined;
//     admin.resetPasswordExpire = undefined;
//     await admin.save();

//     // Send confirmation email
//     await EmailTemplates.sendPasswordChangedEmail({ email: admin.email, name: admin.name });

//     const jwtToken = generateToken(admin._id);

//     return successResponse(res, MESSAGES.RESET_SUCCESS, {
//       token: jwtToken,
//       admin: {
//         id: admin._id,
//         name: admin.name,
//         email: admin.email,
//         role: admin.role,
//       },
//     }, STATUS.OK);
//   } catch (error) {
//     console.error('Reset password error:', error);
//     return errorResponse(res, 'Server error', STATUS.SERVER_ERROR);
//   }
// };
export const resetPassword = async (req, res) => {
  try {
    console.log(req.body)


    const { token, password } = req.body; // ✅ ab sirf newPassword lenge
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const admin = await Admin.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!admin) {
      return errorResponse(res, MESSAGES.TOKEN_INVALID, STATUS.BAD_REQUEST);
    }

    // ✅ directly newPassword set hoga (pre-save hook hashing karega)
    admin.password = password;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;

    await admin.save({ validateBeforeSave: true }); // ensure hashing trigger

    // Send confirmation email
    await EmailTemplates.sendPasswordChangedEmail({
      email: admin.email,
      name: admin.name,
    });

    const jwtToken = generateToken(admin._id);

    return successResponse(
      res,
      MESSAGES.RESET_SUCCESS,
      {
        token: jwtToken,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      },
      STATUS.OK
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse(res, "Server error", STATUS.SERVER_ERROR);
  }
};



// =======================================
// @desc    Change password (authenticated)
// @route   PUT /api/admin/change-password
// =======================================
export const changePassword = async (req, res) => {
  try {
    // Validation check
    const { error } = changePasswordValidation.validate(req.body);
    if (error) {
      return errorResponse(res, `Validation error: ${error.details[0].message}`, STATUS.BAD_REQUEST);
    }

    const { currentPassword, newPassword } = req.body;
    
    // Find admin with password field
    const admin = await Admin.findById(req.admin.id).select('+password');

    if (!admin) {
      return errorResponse(res, 'Admin not found', STATUS.NOT_FOUND);
    }

    // Compare current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, MESSAGES.CURRENT_PASSWORD_INCORRECT, STATUS.BAD_REQUEST);
    }

    // Method 1: Direct database update (Recommended)
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await Admin.findByIdAndUpdate(
      req.admin.id,
      { password: hashedPassword },
      { new: true, runValidators: true }
    );

    // Method 2: Alternative approach using save (if you prefer this method)
    // admin.password = newPassword;
    // admin.markModified('password'); // Ensure mongoose knows password is modified
    // await admin.save();

    // Send password changed email
    try {
      await EmailTemplates.sendPasswordChangedEmail({ 
        email: admin.email, 
        name: admin.name 
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the request if email fails
    }

    return successResponse(
      res, 
      MESSAGES.PASSWORD_CHANGED, 
      { email: admin.email }, 
      STATUS.OK
    );

  } catch (error) {
    console.error('Change password error:', error);
    
    // More detailed error logging
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return errorResponse(res, `Validation error: ${validationErrors.join(', ')}`, STATUS.BAD_REQUEST);
    }
    
    if (error.name === 'CastError') {
      return errorResponse(res, 'Invalid admin ID', STATUS.BAD_REQUEST);
    }
    
    return errorResponse(res, 'Server error', STATUS.SERVER_ERROR);
  }
};

// export const changePassword = async (req, res) => {
//   try {
//     // વેલિડેશન ચેક
//     const { error } = changePasswordValidation.validate(req.body);
//     if (error) {
//       return errorResponse(res, `વેલિડેશન એરર: ${error.details[0].message}`, STATUS.BAD_REQUEST);
//     }

//     const { currentPassword, newPassword } = req.body;

//     // એડમિનને ID દ્વારા શોધો અને પાસવર્ડ ફીલ્ડ પસંદ કરો
//     const admin = await Admin.findById(req.admin.id).select('+password');

//     if (!admin) {
//       return errorResponse(res, 'એડમિન મળ્યું નથી', STATUS.NOT_FOUND);
//     }

//     // જૂનો પાસવર્ડ ચકાસો
//     const isMatch = await admin.comparePassword(currentPassword);
//     if (!isMatch) {
//       return errorResponse(res, MESSAGES.CURRENT_PASSWORD_INCORRECT, STATUS.BAD_REQUEST);
//     }

//     // નવો પાસવર્ડ સેટ કરો
//     admin.password = newPassword;

//     // ડોક્યુમેન્ટ સેવ કરો જેથી pre('save') મિડલવેર ચાલે અને પાસવર્ડ હેશ થાય
//     await admin.save();

//     // પાસવર્ડ બદલાયો હોવાનો ઈમેલ મોકલો
//     try {
//       await EmailTemplates.sendPasswordChangedEmail({
//         email: admin.email,
//         name: admin.name,
//       });
//     } catch (emailError) {
//       console.error('ઈમેલ મોકલવામાં એરર:', emailError);
//       // ઈમેલ નિષ્ફળ થાય તો રિક્વેસ્ટ નિષ્ફળ ન કરો
//     }

//     return successResponse(
//       res,
//       MESSAGES.PASSWORD_CHANGED,
//       { email: admin.email },
//       STATUS.OK
//     );
//   } catch (error) {
//     console.error('પાસવર્ડ બદલવામાં એરર:', error);

//     // વધુ વિગતવાર એરર લોગિંગ
//     if (error.name === 'ValidationError') {
//       const validationErrors = Object.values(error.errors).map((err) => err.message);
//       return errorResponse(res, `વેલિડેશન એરર: ${validationErrors.join(', ')}`, STATUS.BAD_REQUEST);
//     }

//     if (error.name === 'CastError') {
//       return errorResponse(res, 'અમાન્ય એડમિન ID', STATUS.BAD_REQUEST);
//     }

//     return errorResponse(res, 'સર્વર એરર', STATUS.SERVER_ERROR);
//   }
// };


// =============================
// @desc    Get admin profile
// @route   GET /api/admin/profile
// =============================
export const getprofile = async (req, res) => {
  try {
    return res.status(STATUS.OK).json({
      statusCode: STATUS.OK,
      success: true,
      admin: {
        id: req.admin._id,
        name: req.admin.name,
        email: req.admin.email,
        role: req.admin.role,
        image: req.admin.image,
        mobileNumber: req.admin.mobileNumber,
        createdAt: req.admin.createdAt,
        updatedAt: req.admin.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse(res, MESSAGES.SERVER_ERROR, STATUS.SERVER_ERROR);
  }
};

// =======================================
// @desc    Update admin profile
// @route   PUT /api/admin/profile
// =======================================


// export const updateProfile = async (req, res) => {
//   try {
//     // Validate request body
//     const { error } = updateProfileValidation.validate(req.body);
//     if (error) {
//       return errorResponse(res, `Validation error: ${error.details[0].message}`, STATUS.BAD_REQUEST);
//     }

//     const { name, email, mobileNumber } = req.body;
//     const admin = await Admin.findById(req.admin._id);
//     if (!admin) {
//       return errorResponse(res, 'Admin not found', STATUS.NOT_FOUND);
//     }

//     // Check if new email is already in use
//     if (email && email !== admin.email) {
//       const existing = await Admin.findOne({ email });
//       if (existing) {
//         return errorResponse(res, MESSAGES.EMAIL_EXISTS, STATUS.BAD_REQUEST);
//       }
//     }

//     // Check if new mobile number is already in use
//     if (mobileNumber && mobileNumber !== admin.mobileNumber) {
//       const existingMobile = await Admin.findOne({ mobileNumber });
//       if (existingMobile) {
//         return errorResponse(res, 'Mobile number already exists', STATUS.BAD_REQUEST);
//       }
//     }

//     // Update values
//     if (name) admin.name = name;
//     if (email) admin.email = email;
//     if (mobileNumber !== undefined) admin.mobileNumber = mobileNumber;

//     // Define the uploads directory
//     const uploadDir = 'D:\\backend\\src\\uploads\\profiles'; // Hardcoded path

//     // Handle local image upload
//     if (req.file?.path) {
//       // Delete old local image if it exists
//       if (admin.image || admin.imagePublicId) {
//         try {
//           // Log stored image data for debugging
//           console.log('Stored image data:', {
//             image: admin.image,
//             imagePublicId: admin.imagePublicId,
//           });

//           // Prefer imagePublicId, fallback to parsing image URL
//           const oldImageFilename = admin.imagePublicId || (admin.image ? path.basename(admin.image) : null);
//           if (oldImageFilename) {
//             const oldImagePath = path.join(uploadDir, oldImageFilename).replace(/\\/g, '\\'); // Normalize path
//             console.log('Attempting to delete old image at:', oldImagePath);

//             // Log directory contents for debugging
//             try {
//               const files = await fs.readdir(uploadDir);
//               console.log('Files in upload directory:', files);
//             } catch (dirError) {
//               console.warn('Failed to read upload directory:', dirError.message);
//             }

//             // Check if the file exists
//             const fileExists = fsSync.existsSync(oldImagePath);
//             console.log('File exists:', fileExists);

//             if (fileExists) {
//               try {
//                 await fs.unlink(oldImagePath);
//                 console.log(`Successfully deleted old image: ${oldImagePath}`);
//               } catch (deleteError) {
//                 if (deleteError.code === 'EACCES') {
//                   console.error('Permission denied when deleting old image:', oldImagePath);
//                 } else {
//                   console.error(`Failed to delete old image: ${deleteError.message}`);
//                 }
//                 // Continue with update even if deletion fails
//               }
//             } else {
//               console.warn(`Old image not found at: ${oldImagePath}`);
//             }
//           } else {
//             console.warn('No valid old image filename found');
//           }
//         } catch (error) {
//           console.error(`Unexpected error in deletion process: ${error.message}`);
//           // Continue with update even if deletion fails
//         }
//       }

//       // Store new image URL
//       try {
//         const imageUrl = getFileUrl(req, req.file.filename, 'profiles');
//         admin.image = imageUrl; // Store URL
//         admin.imagePublicId = req.file.filename; // Store filename for reference
//       } catch (error) {
//         console.error('Error processing local image:', {
//           message: error.message,
//           stack: error.stack,
//           requestFile: req.file,
//         });
//         // Delete temporary file if processing fails
//         try {
//           await fs.unlink(req.file.path);
//           console.log(`Deleted temporary file after error: ${req.file.path}`);
//         } catch (deleteError) {
//           console.error(`Failed to delete temporary file ${req.file.path}:`, deleteError.message);
//         }
//         return errorResponse(res, `Failed to process image: ${error.message}`, STATUS.SERVER_ERROR);
//       }
//     }

//     await admin.save();

//     return successResponse(res, 'Profile updated successfully', {
//       admin: {
//         id: admin._id,
//         name: admin.name,
//         email: admin.email,
//         role: admin.role,
//         image: admin.image,
//         mobileNumber: admin.mobileNumber,
//         createdAt: admin.createdAt,
//         updatedAt: admin.updatedAt,
//       },
//     }, STATUS.OK);
//   } catch (error) {
//     console.error('Update profile error:', {
//       message: error.message,
//       stack: error.stack,
//     });
//     // Attempt to delete the temporary local file if an error occurs
//     if (req.file?.path) {
//       try {
//         await fs.unlink(req.file.path);
//         console.log(`Deleted temporary local file after error: ${req.file.path}`);
//       } catch (deleteError) {
//         console.error(`Failed to delete temporary local file ${req.file.path}:`, deleteError.message);
//       }
//     }
//     return errorResponse(res, `Server error: ${error.message}`, STATUS.SERVER_ERROR);
//   }
// };

export const updateProfile = async (req, res) => {
  try {
    // Validate request body
    const { error } = updateProfileValidation.validate(req.body);
    if (error) {
      return errorResponse(
        res,
        `Validation error: ${error.details[0].message}`,
        STATUS.BAD_REQUEST
      );
    }

    const { name, email, mobileNumber } = req.body;
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return errorResponse(res, 'Admin not found', STATUS.NOT_FOUND);
    }

    // ❌ Commented out email update logic for now
    /*
    // Check if new email is already in use
    if (email && email !== admin.email) {
      const existing = await Admin.findOne({ email });
      if (existing) {
        return errorResponse(res, MESSAGES.EMAIL_EXISTS, STATUS.BAD_REQUEST);
      }
    }
    */

    // Check if new mobile number is already in use
    if (mobileNumber && mobileNumber !== admin.mobileNumber) {
      const existingMobile = await Admin.findOne({ mobileNumber });
      if (existingMobile) {
        return errorResponse(res, 'Mobile number already exists', STATUS.BAD_REQUEST);
      }
    }

    // Update values
    if (name) admin.name = name;
    // ❌ Don't update email for now
    // if (email) admin.email = email;
    if (mobileNumber !== undefined) admin.mobileNumber = mobileNumber;

    // Define the uploads directory - Match with multer config
    const uploadDir = 'D:\\backend\\uploads\\profiles';

    // Handle local image upload
    if (req.file?.path) {
      // Delete old local image if it exists
      if (admin.imagePublicId) {
        const oldImagePath = path.join(uploadDir, admin.imagePublicId);
        try {
          await fs.access(oldImagePath);
          await fs.unlink(oldImagePath);
        } catch (deleteError) {
          if (deleteError.code !== 'ENOENT') {
            console.error('❌ Failed to delete old image:', deleteError.message);
          }
        }
      }

      const imageUrl = getFileUrl(req, req.file.filename, 'profiles');
      admin.image = imageUrl;
      admin.imagePublicId = req.file.filename;
    }

    await admin.save();

    return successResponse(
      res,
      'Profile updated successfully',
      {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          image: admin.image,
          mobileNumber: admin.mobileNumber,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt,
        },
      },
      STATUS.OK
    );
  } catch (error) {
    console.error('Update profile error:', error.message);

    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (deleteError) {
        console.error('Failed to delete temporary file:', deleteError.message);
      }
    }

    return errorResponse(res, `Server error: ${error.message}`, STATUS.SERVER_ERROR);
  }
};


// export const updateProfile = async (req, res) => {
//   try {
//     // Validate request body
//     const { error } = updateProfileValidation.validate(req.body);
//     if (error) {
//       return errorResponse(res, `Validation error: ${error.details[0].message}`, STATUS.BAD_REQUEST);
//     }

//     const { name, email, mobileNumber } = req.body;
//     const admin = await Admin.findById(req.admin._id);
//     if (!admin) {
//       return errorResponse(res, 'Admin not found', STATUS.NOT_FOUND);
//     }

//     // Check if new email is already in use
//     if (email && email !== admin.email) {
//       const existing = await Admin.findOne({ email });
//       if (existing) {
//         return errorResponse(res, MESSAGES.EMAIL_EXISTS, STATUS.BAD_REQUEST);
//       }
//     }

//     // Check if new mobile number is already in use
//     if (mobileNumber && mobileNumber !== admin.mobileNumber) {
//       const existingMobile = await Admin.findOne({ mobileNumber });
//       if (existingMobile) {
//         return errorResponse(res, 'Mobile number already exists', STATUS.BAD_REQUEST);
//       }
//     }

//     // Update values
//     if (name) admin.name = name;
//     if (email) admin.email = email;
//     if (mobileNumber !== undefined) admin.mobileNumber = mobileNumber;

//     // Define the uploads directory
//     const uploadDir = 'D:\\backend\\src\\uploads\\profiles'; // Hardcoded path as specified

//     // Handle local image upload
//     if (req.file?.path) {
//       // Delete old local image if it exists
//       if (admin.image || admin.imagePublicId) {
//         try {
//           // Log stored image data for debugging
//           console.log('Stored image data:', {
//             image: admin.image,
//             imagePublicId: admin.imagePublicId,
//           });

//           // Prefer imagePublicId, fallback to parsing image URL
//           const oldImageFilename = admin.imagePublicId || (admin.image ? path.basename(admin.image) : null);
//           if (oldImageFilename) {
//             const oldImagePath = path.join(uploadDir, oldImageFilename);
//             console.log('Attempting to delete old image at:', oldImagePath);

//             // Check if the file exists
//             const fileExists = require('fs').existsSync(oldImagePath); // Use sync for simplicity
//             console.log('File exists:', fileExists);

//             if (fileExists) {
//               await fs.unlink(oldImagePath); // Use fs.promises.unlink for deletion
//               console.log(`Successfully deleted old image: ${oldImagePath}`);
//             } else {
//               console.warn(`Old image not found at: ${oldImagePath}`);
//             }
//           } else {
//             console.warn('No valid old image filename found');
//           }
//         } catch (error) {
//           console.error(`Failed to delete old image: ${error.message}`);
//           // Continue with update even if deletion fails
//         }
//       }

//       // Store new image URL
//       try {
//         const imageUrl = getFileUrl(req, req.file.filename, 'profiles');
//         admin.image = imageUrl; // Store URL (e.g., http://localhost:3000/uploads/profiles/profile_1234567890.jpg)
//         admin.imagePublicId = req.file.filename; // Store filename for reference
//       } catch (error) {
//         console.error('Error processing local image:', {
//           message: error.message,
//           stack: error.stack,
//           requestFile: req.file,
//         });
//         // Delete temporary file if processing fails
//         try {
//           await fs.unlink(req.file.path);
//           console.log(`Deleted temporary file after error: ${req.file.path}`);
//         } catch (deleteError) {
//           console.error(`Failed to delete temporary file ${req.file.path}:`, deleteError.message);
//         }
//         return errorResponse(res, `Failed to process image: ${error.message}`, STATUS.SERVER_ERROR);
//       }
//     }

//     await admin.save();

//     return successResponse(res, 'Profile updated successfully', {
//       admin: {
//         id: admin._id,
//         name: admin.name,
//         email: admin.email,
//         role: admin.role,
//         image: admin.image,
//         mobileNumber: admin.mobileNumber,
//         createdAt: admin.createdAt,
//         updatedAt: admin.updatedAt,
//       },
//     }, STATUS.OK);
//   } catch (error) {
//     console.error('Update profile error:', {
//       message: error.message,
//       stack: error.stack,
//     });
//     // Attempt to delete the temporary local file if an error occurs
//     if (req.file?.path) {
//       try {
//         await fs.unlink(req.file.path);
//         console.log(`Deleted temporary local file after error: ${req.file.path}`);
//       } catch (deleteError) {
//         console.error(`Failed to delete temporary local file ${req.file.path}:`, deleteError.message);
//       }
//     }
//     return errorResponse(res, `Server error: ${error.message}`, STATUS.SERVER_ERROR);
//   }
// };