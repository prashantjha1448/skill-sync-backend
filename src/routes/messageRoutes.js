const express = require('express');
const router  = express.Router();
const { sendMessage, getMessages, getConversations } = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);
router.get('/conversations',        getConversations);   // before /:jobId/:otherUserId
router.post('/',                    sendMessage);
router.get('/:jobId/:otherUserId',  getMessages);

module.exports = router;