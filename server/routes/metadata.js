const express = require('express');
const router = express.Router();
const metadataController = require('../controllers/metadataController');

router.post('/scan', (req, res) => metadataController.scanDirectory(req, res));
router.get('/browse', (req, res) => metadataController.browseDirectory(req, res));
router.post('/update', (req, res) => metadataController.updateMetadata(req, res));

module.exports = router;
