import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const AdminRole = sequelize.define('AdminRole', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  role_name: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: false
  }
}, {
  tableName: 'admin_roles',
  timestamps: true
});

export default AdminRole;
