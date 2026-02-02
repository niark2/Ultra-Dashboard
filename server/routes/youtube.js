const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtubeController');

router.get('/info', youtubeController.getVideoInfo);
router.post('/download', youtubeController.downloadVideo);
router.get('/progress/:videoId', youtubeController.getDownloadEvents);

module.exports = router;
