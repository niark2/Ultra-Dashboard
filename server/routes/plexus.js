const express = require('express');
const router = express.Router();
const plexusController = require('../controllers/plexusController');

// Health check for SearXNG connection
router.get('/health', plexusController.checkHealth);

// Main AI-powered search endpoint
router.post('/search', plexusController.search);

// Quick search (web results only, no AI)
router.post('/quick-search', plexusController.quickSearch);

module.exports = router;
