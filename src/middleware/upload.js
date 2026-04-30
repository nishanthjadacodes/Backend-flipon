import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudinary is the durable store. Render's free tier wipes the disk on
// every cold restart, which broke doc previews after a few hours. With
// CLOUDINARY_* env vars set, multer streams uploads straight to Cloudinary
// and we store the secure_url in the DB row.
//
// Required env vars (set on Render → flipon-backend → Environment):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
//
// If any is missing we fall back to local disk storage (good for dev, bad
// for Render free tier — see warning logged at boot).
const CLOUDINARY_ENABLED = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (CLOUDINARY_ENABLED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('[upload] Cloudinary storage active — uploads persist across dyno restarts');
} else {
  console.warn(
    '[upload] Cloudinary not configured — falling back to local disk. ' +
      'On Render free tier this means uploads are lost on every cold-start. ' +
      'Set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET to enable.'
  );
}

// Allowed category folders. Anything else falls back to 'documents'.
const ALLOWED_CATEGORIES = new Set(['documents', 'kyc', 'booking', 'temp', 'enquiry']);

const safeCategoryFor = (req) => {
  const requested = String(
    req.body?.category || req.body?.Category || 'booking'
  ).toLowerCase();
  return ALLOWED_CATEGORIES.has(requested) ? requested : 'documents';
};

// ─── Disk storage (fallback for dev) ──────────────────────────────────────
const createUploadDirs = () => {
  const dirs = [
    'uploads',
    'uploads/documents',
    'uploads/kyc',
    'uploads/booking',
    'uploads/temp',
    'uploads/enquiry',
  ];
  dirs.forEach((dir) => {
    const fullPath = path.join(__dirname, '../../', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`Created directory: ${fullPath}`);
    }
  });
};
if (!CLOUDINARY_ENABLED) createUploadDirs();

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const safeCategory = safeCategoryFor(req);
      const uploadPath = `uploads/${safeCategory}`;
      const fullPath = path.join(__dirname, '../../', uploadPath);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      cb(null, fullPath);
    } catch (error) {
      console.error('Upload destination error:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${random}${ext}`);
  },
});

// ─── Cloudinary storage ───────────────────────────────────────────────────
// Stores under `flipon/<category>/`. resource_type is 'auto' so PDFs,
// images and other files all upload through one config (Cloudinary serves
// PDFs as-is; images get its CDN treatment). public_id is unique per
// upload to avoid name collisions.
const cloudinaryStorage = CLOUDINARY_ENABLED
  ? new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => {
        const safeCategory = safeCategoryFor(req);
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const baseName = path
          .basename(file.originalname, path.extname(file.originalname))
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .substring(0, 40);
        return {
          folder: `flipon/${safeCategory}`,
          public_id: `${timestamp}-${random}-${baseName}`,
          resource_type: 'auto',
        };
      },
    })
  : null;

const storage = CLOUDINARY_ENABLED ? cloudinaryStorage : diskStorage;

// ─── File filter — block executables, accept everything else ──────────────
const BLOCKED_EXTS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.scr', '.com',
  '.msi', '.app', '.apk', '.jar', '.dll', '.so',
]);

const fileFilter = (_req, file, cb) => {
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

const uploadConfig = {
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 10,
  },
};

export const uploadSingle = multer(uploadConfig).single('file');
export const uploadMultiple = multer(uploadConfig).array('files', 10);
export const uploadKYC = multer(uploadConfig).fields([
  { name: 'aadhaar_front', maxCount: 1 },
  { name: 'aadhaar_back', maxCount: 1 },
  { name: 'pan_card', maxCount: 1 },
  { name: 'profile_photo', maxCount: 1 },
  { name: 'address_proof', maxCount: 1 },
]);

// Pull the right "where it lives" value out of the multer File object.
// - Cloudinary: file.path is the secure CDN URL; file.filename is the public_id.
// - Disk:       file.filename is just the basename; file.path is the local disk path.
// Controllers should call this and store the returned value in DB.file_url —
// then getFileUrl will return it as-is on read (idempotent for full URLs).
export const getStoredFileValue = (file) => {
  if (!file) return null;
  if (CLOUDINARY_ENABLED) {
    // multer-storage-cloudinary puts the secure_url on file.path.
    return file.path || file.secure_url || file.filename;
  }
  return file.filename;
};

// ─── Delete (best-effort) ─────────────────────────────────────────────────
export const deleteFile = async (storedValue) => {
  try {
    if (!storedValue) return;
    if (CLOUDINARY_ENABLED && /^https?:\/\//i.test(String(storedValue))) {
      // Extract public_id from the Cloudinary URL: everything after /upload/
      // up to the file extension. Skip any version segment (e.g. /v123456/).
      const m = String(storedValue).match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
      const publicId = m && m[1];
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
        console.log(`Cloudinary file deleted: ${publicId}`);
      }
      return;
    }
    if (fs.existsSync(storedValue)) {
      fs.unlinkSync(storedValue);
      console.log(`File deleted: ${storedValue}`);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

// ─── Disk probe (legacy rows only — Cloudinary URLs skip this) ────────────
const PROBE_CATEGORIES = ['booking', 'documents', 'kyc', 'temp', 'enquiry'];
const resolveActualCategory = (fileName, claimedCategory) => {
  if (!fileName) return claimedCategory;
  const tryOrder = [
    claimedCategory,
    ...PROBE_CATEGORIES.filter((c) => c !== claimedCategory),
  ];
  for (const c of tryOrder) {
    if (!c) continue;
    const filePath = path.join(__dirname, '../../uploads/', c, fileName);
    try {
      if (fs.existsSync(filePath)) return c;
    } catch (_) { /* continue probing */ }
  }
  return claimedCategory;
};

// ─── Read-side URL formation ──────────────────────────────────────────────
// Idempotent: full URLs (http/https) pass through unchanged — covers
// Cloudinary URLs and any legacy rows that stored full URLs.
// Disk rows (basename only) get the BASE_URL → /uploads/<cat>/<file> prefix.
export const getFileUrl = (fileName, category = 'documents', req = null) => {
  if (!fileName) return fileName;

  if (/^https?:\/\//i.test(String(fileName))) {
    return String(fileName);
  }

  let baseUrl = process.env.BASE_URL;
  if (!baseUrl && process.env.RENDER_EXTERNAL_URL) {
    baseUrl = process.env.RENDER_EXTERNAL_URL;
  }
  if (!baseUrl && process.env.RENDER_EXTERNAL_HOSTNAME) {
    baseUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  }
  if (!baseUrl && req && req.headers) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    if (host) baseUrl = `${proto}://${host}`;
  }
  if (!baseUrl) {
    baseUrl = `http://localhost:${process.env.PORT || 3001}`;
  }

  const justName =
    String(fileName)
      .replace(/^\/+/, '')
      .replace(/^uploads\/[^/]+\//i, '')
      .split('/')
      .pop() || '';

  const resolvedCategory = resolveActualCategory(justName, category);
  return `${baseUrl}/uploads/${resolvedCategory}/${justName}`;
};

export default {
  uploadSingle,
  uploadMultiple,
  uploadKYC,
  deleteFile,
  getFileUrl,
  getStoredFileValue,
};
