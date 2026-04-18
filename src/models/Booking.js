import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  service_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'services',
      key: 'id'
    }
  },
  agent_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  booking_type: {
    type: DataTypes.ENUM('consumer', 'industrial'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'assigned', 'accepted', 'documents_collected', 'submitted', 'completed', 'cancelled'),
    defaultValue: 'pending'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  customer_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  customer_mobile: {
    type: DataTypes.STRING(15),
    allowNull: false
  },
  customer_email: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  service_address: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Address details for service delivery'
  },
  preferred_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  preferred_time: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  government_documents: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Document types and details for government services'
  },
  home_service_details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Specific requirements for home services'
  },
  industrial_service_details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Industrial service specifications'
  },
  documents_required: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'List of documents required from customer'
  },
  documents_collected: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Documents collected by agent'
  },
  submission_details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Submission tracking details'
  },
  completion_otp: {
    type: DataTypes.STRING(6),
    allowNull: true,
    comment: 'OTP for service completion verification'
  },
  completion_otp_generated_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completion_verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  price_quoted: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  final_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'paid', 'refunded'),
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  agent_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  customer_rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5
    }
  },
  customer_feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  assigned_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  accepted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  documents_collected_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancellation_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'bookings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['customer_id']
    },
    {
      fields: ['agent_id']
    },
    {
      fields: ['service_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['booking_type']
    }
  ]
});

export default Booking;
