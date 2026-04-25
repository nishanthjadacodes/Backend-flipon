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
  // Was a strict ENUM with 14 hardcoded values. The booking flow sends
  // arbitrary types from service.required_documents (voter_id_card,
  // disability_certificate, bank_passbook, additional_document_1, etc.) —
  // any value outside the ENUM list silently failed Sequelize validation
  // and the controller returned a vague "Upload failed". STRING accepts
  // any type the service catalog defines.
  document_type: {
    type: DataTypes.STRING(80),
    allowNull: false,
  },
  // Same problem — kept narrow, made the controller fragile. STRING with
  // a sensible default is enough; admin reports group on this anyway.
  category: {
    type: DataTypes.STRING(40),
    defaultValue: 'booking',
    allowNull: false,
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
