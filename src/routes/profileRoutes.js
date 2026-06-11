const express = require('express');
const router  = express.Router();
const { getProfile, updateProfile, updateKyc, updateBankDetails, uploadProfilePhoto, getPublicProfile, blockUser, unblockUser } = require('../controllers/profileController');
const { protect } = require('../middlewares/authMiddleware');
const upload  = require('../middlewares/uploadMiddleware');

// Public route (before protect middleware)
router.get('/user/:userId', getPublicProfile);

router.use(protect);
router.get('/me',            getProfile);
router.put('/update',        updateProfile);
router.post('/kyc',          updateKyc);
router.post('/bank',         updateBankDetails);
router.post('/photo', upload.single('photo'), uploadProfilePhoto);
router.post('/block/:userId', blockUser);
router.post('/unblock/:userId', unblockUser);

module.exports = router;