import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

// Store connected users
const connectedUsers = new Map();

// Socket authentication middleware
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid authentication token'));
  }
};

// Initialize Socket.io server — accepts existing http.Server
export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: [
        'http://localhost:3001',
        'http://10.109.199.253:3001',
        'http://10.156.62.253:3001',
        'exp://localhost:19000',
        'exp://10.109.199.253:19000'
      ],
      methods: ['GET', 'POST']
    }
  });

  // Set io instance for global access
  setIoInstance(io);

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id} (${socket.user.name})`);
    
    // Add user to connected users
    connectedUsers.set(socket.user.id, {
      socketId: socket.id,
      user: socket.user,
      connectedAt: new Date()
    });

    // Join user to their personal room
    socket.join(`user_${socket.user.id}`);
    
    // Join role-based rooms
    socket.join(`role_${socket.user.role}`);
    
    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to FlipOn Digital',
      user: {
        id: socket.user.id,
        name: socket.user.name,
        role: socket.user.role
      },
      timestamp: new Date()
    });

    // Handle booking status updates
    socket.on('booking_update', (data) => {
      console.log(`Booking update from ${socket.user.id}:`, data);
      
      // Broadcast to relevant users
      if (data.bookingId) {
        // Notify specific booking participants
        socket.to(`booking_${data.bookingId}`).emit('booking_status_changed', {
          bookingId: data.bookingId,
          status: data.status,
          updatedBy: socket.user.name,
          timestamp: new Date()
        });
      }
    });

    // Handle location updates
    socket.on('location_update', (data) => {
      console.log(`Location update from ${socket.user.id}:`, data);
      
      // Broadcast location to admin users
      socket.to('role_admin').emit('agent_location_updated', {
        agentId: socket.user.id,
        agentName: socket.user.name,
        location: data,
        timestamp: new Date()
      });
    });

    // Handle document upload notifications
    socket.on('document_uploaded', (data) => {
      console.log(`Document upload from ${socket.user.id}:`, data);
      
      // Notify admin users about new document
      socket.to('role_admin').emit('new_document_uploaded', {
        userId: socket.user.id,
        userName: socket.user.name,
        documentType: data.documentType,
        fileName: data.fileName,
        timestamp: new Date()
      });
    });

    // Handle payment notifications
    socket.on('payment_processed', (data) => {
      console.log(`Payment processed from ${socket.user.id}:`, data);
      
      // Notify relevant users
      socket.to(`booking_${data.bookingId}`).emit('payment_notification', {
        bookingId: data.bookingId,
        status: 'paid',
        amount: data.amount,
        timestamp: new Date()
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id} (${socket.user.name})`);
      
      // Remove user from connected users
      connectedUsers.delete(socket.user.id);
      
      // Notify others about disconnection
      socket.broadcast.emit('user_disconnected', {
        userId: socket.user.id,
        userName: socket.user.name,
        timestamp: new Date()
      });
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user.id}:`, error);
    });
  });

  return io;
};

// Export io instance for use in other modules
let ioInstance = null;

export const getIoInstance = () => {
  return ioInstance;
};

export const setIoInstance = (io) => {
  ioInstance = io;
};

// Helper function to send notifications to specific users
export const sendNotificationToUser = (io, userId, notification) => {
  io.to(`user_${userId}`).emit('notification', {
    ...notification,
    timestamp: new Date()
  });
};

// Helper function to broadcast to all users in a role
export const broadcastToRole = (io, role, event, data) => {
  io.to(`role_${role}`).emit(event, {
    ...data,
    timestamp: new Date()
  });
};

// Helper function to get connected users count
export const getConnectedUsersCount = () => {
  return connectedUsers.size;
};

// Helper function to get user by socket ID
export const getUserBySocketId = (socketId) => {
  for (const [userId, userData] of connectedUsers) {
    if (userData.socketId === socketId) {
      return userData.user;
    }
  }
  return null;
};
