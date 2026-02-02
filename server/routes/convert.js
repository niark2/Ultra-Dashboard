const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const convertController = require('../controllers/convertController');

// Routes
router.get('/formats', convertController.getFormats);
router.post('/', upload.single('file'), convertController.convertFile);

module.exports = router;
