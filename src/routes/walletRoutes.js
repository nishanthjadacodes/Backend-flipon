import express from 'express';
import { getWalletBalance, redeemWallet } from '../controllers/walletController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/balance', auth, getWalletBalance);
router.post('/redeem', auth, redeemWallet);

export default router;
