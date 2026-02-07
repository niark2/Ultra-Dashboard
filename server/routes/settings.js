const express = require('express');
const router = express.Router();
const db = require('../lib/db');

// Get all settings
router.get('/', (req, res) => {
    try {
        const settings = db.getAllSettings(req.session.user.id);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a specific setting with priority and source information
router.get('/:key', (req, res) => {
    try {
        const userId = req.session.user.id;
        const dbValue = db.getSetting(req.params.key, userId);

        if (dbValue !== null && dbValue !== undefined && dbValue !== '') {
            return res.json({ key: req.params.key, value: dbValue, source: 'db' });
        }

        // Fallback to process.env
        const envValue = process.env[req.params.key];
        res.json({
            key: req.params.key,
            value: null, // Return null to the UI so input stays empty
            effectiveValue: envValue,
            source: envValue ? 'env' : 'none'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set a setting
router.post('/', (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });

    try {
        db.setSetting(key, value, req.session.user.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Batch update settings (useful for migration)
router.post('/batch', (req, res) => {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Settings object is required' });
    }

    try {
        Object.entries(settings).forEach(([key, value]) => {
            db.setSetting(key, value, req.session.user.id);
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
