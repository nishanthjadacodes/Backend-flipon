import { sequelize } from '../src/config/database.js';

const fixDocumentTypeColumn = async () => {
  try {
    console.log('Fixing document_type column size...');
    
    // Update the document_type column to support longer values
    const alterQuery = `
      ALTER TABLE documents 
      MODIFY COLUMN document_type ENUM(
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
      ) NOT NULL
    `;
    
    await sequelize.query(alterQuery);
    console.log('Document_type column updated successfully');
    
  } catch (error) {
    console.error('Error fixing document_type column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

fixDocumentTypeColumn();
