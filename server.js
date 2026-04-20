import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import multer from 'multer';
import 'dotenv/config';
import { Server } from 'socket.io';
import http from 'http';

import { sequelize } from './src/config/database.js';
import { syncModels, AdminRole } from './src/models/index.js';
import { ROLE_PERMISSIONS } from './src/constants/permissions.js';
import { initializeSocket } from './src/config/socket.js';
import authRoutes from './src/routes/authRoutes.js';
import serviceRoutes from './src/routes/serviceRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import bookingRoutes from './src/routes/bookingRoutes.js';
import documentRoutes from './src/routes/documentRoutes.js';
import kycRoutes from './src/routes/kycRoutes.js';
import profileRoutes from './src/routes/profileRoutes.js';
import earningsRoutes from './src/routes/earningsRoutes.js';
import referralRoutes from './src/routes/referralRoutes.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import geolocationRoutes from './src/routes/geolocationRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import companyProfileRoutes from './src/routes/companyProfileRoutes.js';
import enquiryRoutes from './src/routes/enquiryRoutes.js';

const app = express();

// Middleware
app.use(helmet());
// CORS: allow all origins — the API is accessed by the mobile app (ngrok URL, any LAN IP, emulator)
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 second timeout
  res.setTimeout(30000);
  next();
});

// Enhanced request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  console.log(`IP: ${ip}`);
  console.log(`User-Agent: ${userAgent}`);
  console.log(`Content-Type: ${req.get('Content-Type') || 'None'}`);
  
  // Log body for POST/PUT requests
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Request Body:', req.body);
  }
  
  // Log query parameters
  if (Object.keys(req.query).length > 0) {
    console.log('Query Parameters:', req.query);
  }
  
  console.log('---');
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  if (req.url && req.url.includes('/documents/upload')) {
    console.log('=== DOCUMENT UPLOAD REQUEST ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', {
      'content-type': req.get('Content-Type'),
      'content-length': req.get('Content-Length'),
      'authorization': req.get('Authorization') ? 'Present' : 'Missing'
    });
    console.log('Body keys:', Object.keys(req.body));
    console.log('File present:', !!req.file);
    console.log('Files present:', !!req.files);
  }
  next();
});

// File upload error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer Error:', {
      code: error.code,
      message: error.message,
      field: error.field,
      file: error.file
    });
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({
        success: false,
        message: 'Too many files. Maximum is 10.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error) {
    console.error('General Upload Error:', {
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'File upload error'
    });
  }
  
  next();
});

// Static file serving
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/geolocation', geolocationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/company-profile', companyProfileRoutes);
app.use('/api/enquiries', enquiryRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'FlipOn Digital API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes placeholder
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to FlipOn Digital API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

const PORT = process.env.PORT || 3001;

// Database connection and server start
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    await syncModels();

    // Keep admin_roles.permissions in sync with the code-defined constants so
    // a redeploy is enough to push new permission grants — no manual seed
    // rerun required. Upserts each role; leaves any admin roles not listed
    // in constants untouched.
    try {
      for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
        const [row, created] = await AdminRole.findOrCreate({
          where: { role_name: roleName },
          defaults: { role_name: roleName, permissions: perms },
        });
        if (!created) {
          const current = Array.isArray(row.permissions) ? row.permissions : [];
          const same =
            current.length === perms.length && current.every((p, i) => p === perms[i]);
          if (!same) {
            await row.update({ permissions: perms });
            console.log(`[rbac] refreshed permissions for ${roleName}`);
          }
        } else {
          console.log(`[rbac] created role ${roleName}`);
        }
      }
    } catch (e) {
      console.warn('[rbac] failed to refresh admin roles on boot:', e?.message);
    }

    // Create a single HTTP server shared by Express and Socket.io
    const server = http.createServer(app);
    initializeSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`FlipOn Digital API is running on port ${PORT}`);
      console.log(`Local:   http://localhost:${PORT}`);
      console.log(`Network: http://0.0.0.0:${PORT}`);
      console.log(`Health:  http://localhost:${PORT}/health`);
      console.log(`If using ngrok, run: ngrok http ${PORT}`);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
