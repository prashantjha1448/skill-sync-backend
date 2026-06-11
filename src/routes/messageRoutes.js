const express = require('express');
const router  = express.Router();
const { sendMessage, getMessages, getConversations, uploadChatFile } = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');
const chatUpload = require('../middlewares/chatUploadMiddleware');

router.use(protect);
router.get('/conversations',        getConversations);
router.post('/',                    sendMessage);
router.post('/upload',              chatUpload.single('file'), uploadChatFile);
router.get('/:jobId/:otherUserId',  getMessages);

module.exports = router;