import { User, Document, AgentKyc } from '../models/index.js';
import { uploadKYC, getFileUrl } from '../middleware/upload.js';
import { sequelize } from '../config/database.js';

// Submit KYC documents (Agent only)
const submitKyc = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    if (req.user.role !== 'agent') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only agents can submit KYC documents'
      });
    }

    const files = req.files;
    if (!files || Object.keys(files).length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No documents uploaded'
      });
    }

    // Required documents
    const requiredDocs = ['aadhaar_front', 'aadhaar_back', 'pan_card', 'profile_photo'];
    const uploadedDocs = {};
    const documentIds = {};

    // Upload each document and create records
    for (const [docType, fileArray] of Object.entries(files)) {
      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];
        
        const document = await Document.create({
          user_id: req.user.id,
          document_type: docType,
          category: 'kyc',
          file_name: file.originalname,
          file_url: file.filename,
          file_size: file.size,
          mime_type: file.mimetype,
          uploaded_by: req.user.id
        }, { transaction });

        documentIds[`${docType}_id`] = document.id;
        uploadedDocs[docType] = {
          ...document.toJSON(),
          file_url: getFileUrl(document.file_url, 'kyc')
        };
      }
    }

    // Check if all required documents are uploaded
    const missingDocs = requiredDocs.filter(doc => !uploadedDocs[doc]);
    if (missingDocs.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Missing required documents: ${missingDocs.join(', ')}`
      });
    }

    // Create or update AgentKyc record
    const [agentKyc, created] = await AgentKyc.findOrCreate({
      where: { agent_id: req.user.id },
      defaults: {
        agent_id: req.user.id,
        ...documentIds,
        status: 'submitted',
        submitted_at: new Date()
      },
      transaction
    });

    if (!created) {
      // Update existing record
      await agentKyc.update({
        ...documentIds,
        status: 'submitted',
        submitted_at: new Date(),
        rejection_reason: null
      }, { transaction });
    }

    // Update user record
    await User.update({
      kyc_submitted_at: new Date()
    }, {
      where: { id: req.user.id },
      transaction
    });

    await transaction.commit();

    console.log(`KYC submitted by agent ${req.user.id}`);

    res.status(201).json({
      success: true,
      data: {
        agentKyc: agentKyc,
        uploadedDocuments: uploadedDocs
      },
      message: 'KYC documents submitted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error submitting KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit KYC documents'
    });
  }
};

// Get KYC status (Agent only)
const getMyKycStatus = async (req, res) => {
  try {
    if (req.user.role !== 'agent') {
      return res.status(403).json({
        success: false,
        message: 'Only agents can view KYC status'
      });
    }

    const agentKyc = await AgentKyc.findOne({
      where: { agent_id: req.user.id },
      include: [
        {
          model: Document,
          as: 'aadhaarFront',
          attributes: ['id', 'document_type', 'file_name', 'file_url', 'is_verified', 'uploaded_at']
        },
        {
          model: Document,
          as: 'aadhaarBack', 
          attributes: ['id', 'document_type', 'file_name', 'file_url', 'is_verified', 'uploaded_at']
        },
        {
          model: Document,
          as: 'panCard',
          attributes: ['id', 'document_type', 'file_name', 'file_url', 'is_verified', 'uploaded_at']
        },
        {
          model: Document,
          as: 'profilePhoto',
          attributes: ['id', 'document_type', 'file_name', 'file_url', 'is_verified', 'uploaded_at']
        },
        {
          model: Document,
          as: 'addressProof',
          attributes: ['id', 'document_type', 'file_name', 'file_url', 'is_verified', 'uploaded_at']
        }
      ]
    });

    // Add file URLs to documents
    if (agentKyc) {
      const documents = ['aadhaarFront', 'aadhaarBack', 'panCard', 'profilePhoto', 'addressProof'];
      documents.forEach(doc => {
        if (agentKyc[doc]) {
          agentKyc[doc].file_url = getFileUrl(agentKyc[doc].file_url, 'kyc');
        }
      });
    }

    res.json({
      success: true,
      data: agentKyc || null
    });
  } catch (error) {
    console.error('Error fetching KYC status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch KYC status'
    });
  }
};

// Get pending KYC applications (Admin only)
const getPendingKyc = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const pendingKyc = await AgentKyc.findAll({
      where: {
        status: ['pending', 'submitted']
      },
      include: [
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'name', 'mobile', 'email', 'created_at']
        },
        {
          model: Document,
          as: 'aadhaarFront',
          attributes: ['id', 'document_type', 'file_url', 'is_verified']
        },
        {
          model: Document,
          as: 'aadhaarBack',
          attributes: ['id', 'document_type', 'file_url', 'is_verified']
        },
        {
          model: Document,
          as: 'panCard',
          attributes: ['id', 'document_type', 'file_url', 'is_verified']
        },
        {
          model: Document,
          as: 'profilePhoto',
          attributes: ['id', 'document_type', 'file_url', 'is_verified']
        },
        {
          model: Document,
          as: 'addressProof',
          attributes: ['id', 'document_type', 'file_url', 'is_verified']
        }
      ],
      order: [['submitted_at', 'DESC']]
    });

    // Add file URLs
    pendingKyc.forEach(kyc => {
      const documents = ['aadhaarFront', 'aadhaarBack', 'panCard', 'profilePhoto', 'addressProof'];
      documents.forEach(doc => {
        if (kyc[doc]) {
          kyc[doc].file_url = getFileUrl(kyc[doc].file_url, 'kyc');
        }
      });
    });

    res.json({
      success: true,
      data: pendingKyc
    });
  } catch (error) {
    console.error('Error fetching pending KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending KYC applications'
    });
  }
};

// Get agent KYC details (Admin only)
const getAgentKycDetails = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { agentId } = req.params;

    const agentKyc = await AgentKyc.findOne({
      where: { agent_id: agentId },
      include: [
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'name', 'mobile', 'email', 'is_kyc_verified', 'created_at']
        },
        {
          model: Document,
          as: 'aadhaarFront'
        },
        {
          model: Document,
          as: 'aadhaarBack'
        },
        {
          model: Document,
          as: 'panCard'
        },
        {
          model: Document,
          as: 'profilePhoto'
        },
        {
          model: Document,
          as: 'addressProof'
        }
      ]
    });

    if (!agentKyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC not found for this agent'
      });
    }

    // Add file URLs
    const documents = ['aadhaarFront', 'aadhaarBack', 'panCard', 'profilePhoto', 'addressProof'];
    documents.forEach(doc => {
      if (agentKyc[doc]) {
        agentKyc[doc].file_url = getFileUrl(agentKyc[doc].file_url, 'kyc');
      }
    });

    res.json({
      success: true,
      data: agentKyc
    });
  } catch (error) {
    console.error('Error fetching agent KYC details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agent KYC details'
    });
  }
};

// Verify/Reject KYC (Admin only)
const verifyAgentKyc = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    if (req.user.role !== 'super_admin') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { agentId } = req.params;
    const { status, rejection_reason } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Status must be verified or rejected'
      });
    }

    if (status === 'rejected' && !rejection_reason) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting KYC'
      });
    }

    const agentKyc = await AgentKyc.findOne({
      where: { agent_id: agentId },
      transaction
    });

    if (!agentKyc) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'KYC not found for this agent'
      });
    }

    // Update KYC status
    await agentKyc.update({
      status,
      rejection_reason: status === 'rejected' ? rejection_reason : null,
      verified_at: status === 'verified' ? new Date() : null,
      verified_by: status === 'verified' ? req.user.id : null
    }, { transaction });

    // Update user record
    await User.update({
      is_kyc_verified: status === 'verified',
      kyc_verified_at: status === 'verified' ? new Date() : null,
      is_active: status === 'verified'
    }, {
      where: { id: agentId },
      transaction
    });

    await transaction.commit();

    console.log(`Agent KYC ${status} by admin ${req.user.id} for agent ${agentId}`);

    res.json({
      success: true,
      data: agentKyc,
      message: `KYC ${status} successfully`
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error verifying KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify KYC'
    });
  }
};

export {
  submitKyc,
  getMyKycStatus,
  getPendingKyc,
  getAgentKycDetails,
  verifyAgentKyc
};
