import { sequelize } from '../src/config/database.js';

const fixBookingTypeColumn = async () => {
  try {
    console.log('Fixing booking_type column size...');
    
    // Update the booking_type column to support longer values
    const alterQuery = `
      ALTER TABLE bookings 
        MODIFY COLUMN booking_type ENUM(
          'consumer', 
          'business', 
          'industrial', 
          'both', 
          'individual'
        ) NOT NULL DEFAULT 'consumer'
    `;
    
    await sequelize.query(alterQuery);
    console.log('Booking_type column updated successfully');
    
  } catch (error) {
    console.error('Error fixing booking_type column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

fixBookingTypeColumn();
