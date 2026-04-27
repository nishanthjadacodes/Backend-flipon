import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current directory for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowed category folders. Anything else falls back to 'documents'.
const ALLOWED_CATEGORIES = new Set(['documents', 'kyc', 'booking', 'temp', 'enquiry']);

// Create upload directories if they don't exist
const createUploadDirs = () => {
  const dirs = [
    'uploads',
    'uploads/documents',
    'uploads/kyc',
    'uploads/booking',
    'uploads/temp',
    'uploads/enquiry',
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
      // Use the EXPLICIT category from the request body. The disk path must
      // match the DB row's `category` column — otherwise getFileUrl builds
      // a URL pointing at the wrong folder and the image 404s.
      //
      // Previously this auto-routed aadhaar/pan/profile uploads to /kyc/
      // regardless of the body category, which caused the booking flow's
      // doc previews to 404 (DB said /booking/ but file was in /kyc/).
      // Default to 'booking' to match documentController's `category = 'booking'`
      // destructuring default — keeps multer's disk path in sync with the
      // category written to the DB row.
      const requestedCategory = String(
        req.body.category || req.body.Category || 'booking'
      ).toLowerCase();
      const safeCategory = ALLOWED_CATEGORIES.has(requestedCategory)
        ? requestedCategory
        : 'documents';
      const uploadPath = `uploads/${safeCategory}`;

      const fullPath = path.join(__dirname, '../../', uploadPath);

      // Ensure directory exists (also self-heals on Render's ephemeral FS).
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${fullPath}`);
      }

      console.log(`Upload destination: ${fullPath} (category=${safeCategory})`);
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

// File filter — accept any common document, image, or office file type.
// Blocks executable/script extensions for safety. New types added here are
// available immediately to /documents/upload and KYC upload.
const BLOCKED_EXTS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.scr', '.com',
  '.msi', '.app', '.apk', '.jar', '.dll', '.so',
]);

const fileFilter = (req, file, cb) => {
  try {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (BLOCKED_EXTS.has(ext)) {
      return cb(new Error(`File type not allowed for security reasons: ${ext}`), false);
    }
    cb(null, true);
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
    fileSize: 20 * 1024 * 1024, // 20MB — handles scans, multi-page PDFs, slides
    files: 10,
  },
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

// Utility function to get file URL.
//
// Order of precedence for the host:
//   1. BASE_URL                      — explicit override (recommended for prod)
//   2. RENDER_EXTERNAL_URL           — full URL Render auto-injects
//   3. RENDER_EXTERNAL_HOSTNAME      — hostname-only Render fallback
//   4. detected from request (req)   — when caller passes the request object
//   5. localhost:<port>              — local dev fallback
export const getFileUrl = (fileName, category = 'documents', req = null) => {
  let baseUrl = process.env.BASE_URL;

  if (!baseUrl && process.env.RENDER_EXTERNAL_URL) {
    baseUrl = process.env.RENDER_EXTERNAL_URL;
  }

  if (!baseUrl && process.env.RENDER_EXTERNAL_HOSTNAME) {
    baseUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  }

  // Last resort — derive from the incoming request if the caller supplied it.
  if (!baseUrl && req && req.headers) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    if (host) baseUrl = `${proto}://${host}`;
  }

  if (!baseUrl) {
    baseUrl = `http://localhost:${process.env.PORT || 3001}`;
  }

  return `${baseUrl}/uploads/${category}/${fileName}`;
};

export default {
  uploadSingle,
  uploadMultiple,
  uploadKYC,
  deleteFile,
  getFileUrl
};
