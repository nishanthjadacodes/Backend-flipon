import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current directory for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create upload directories if they don't exist
const createUploadDirs = () => {
  const dirs = [
    'uploads',
    'uploads/documents',
    'uploads/kyc',
    'uploads/temp'
  ];

  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, '../../', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`Created directory: ${fullPath}`);
    }
  });
};

// Initialize upload directories
createUploadDirs();

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      let uploadPath = 'uploads/documents';
      
      // Determine upload path based on category or document type
      const docType = req.body.document_type || req.body.documentType;
      if (req.body.category === 'kyc' || docType?.includes('aadhaar') || 
          docType?.includes('pan') || docType?.includes('profile')) {
        uploadPath = 'uploads/kyc';
      }
      
      const fullPath = path.join(__dirname, '../../', uploadPath);
      
      // Ensure directory exists
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${fullPath}`);
      }
      
      console.log(`Upload destination: ${fullPath}`);
      cb(null, fullPath);
    } catch (error) {
      console.error('Upload destination error:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}-${random}${ext}`;
    cb(null, filename);
  }
});

// File filter for allowed file types
const fileFilter = (req, file, cb) => {
  try {
    console.log('=== UPLOAD MIDDLEWARE FILE FILTER ===');
    console.log('File details:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Allowed MIME types
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/pdf'
    ];

    // Allowed file extensions
    const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();

    console.log('Allowed MIME types:', allowedMimes);
    console.log('File MIME type:', file.mimetype);
    console.log('Allowed extensions:', allowedExts);
    console.log('File extension:', ext);

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      console.log('File validation passed');
      cb(null, true);
    } else {
      console.log('File validation failed');
      cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and PDF files are allowed.`), false);
    }
  } catch (error) {
    console.error('File filter error:', error);
    cb(error, false);
  }
};

// Multer configuration
const uploadConfig = {
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files at once
  }
};

// Create upload middleware instances
export const uploadSingle = multer(uploadConfig).single('file');
export const uploadMultiple = multer(uploadConfig).array('files', 10);
export const uploadKYC = multer(uploadConfig).fields([
  { name: 'aadhaar_front', maxCount: 1 },
  { name: 'aadhaar_back', maxCount: 1 },
  { name: 'pan_card', maxCount: 1 },
  { name: 'profile_photo', maxCount: 1 },
  { name: 'address_proof', maxCount: 1 }
]);

// Utility function to delete file
export const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`File deleted: ${filePath}`);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

// Utility function to get file URL
export const getFileUrl = (fileName, category = 'documents') => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${baseUrl}/uploads/${category}/${fileName}`;
};

export default {
  uploadSingle,
  uploadMultiple,
  uploadKYC,
  deleteFile,
  getFileUrl
};
