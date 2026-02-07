const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');

router.get('/info', socialController.getMediaInfo);
router.post('/download', socialController.downloadMedia);
router.get('/progress/:downloadId', socialController.getDownloadEvents);

module.exports = router;
