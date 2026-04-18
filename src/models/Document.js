import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  booking_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'bookings',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  document_type: {
    type: DataTypes.ENUM(
      'aadhaar_front', 
      'aadhaar_back', 
      'pan_card', 
      'profile_photo', 
      'address_proof', 
      'identity_proof',
      'income_certificate', 
      'caste_certificate', 
      'passport_photo', 
      'passport_sized_photo',
      'signature', 
      'gst_certificate', 
      'company_registration', 
      'other'
    ),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('kyc', 'booking', 'application'),
    defaultValue: 'booking'
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_url: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'File size in bytes'
  },
  mime_type: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verified_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  uploaded_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  uploaded_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'documents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['booking_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['document_type']
    },
    {
      fields: ['category']
    },
    {
      fields: ['uploaded_by']
    }
  ]
});

export default Document;
