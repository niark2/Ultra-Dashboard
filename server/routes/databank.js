const express = require('express');
const router = express.Router();
const db = require('../lib/db');

// Get databank items
router.get('/', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const type = req.query.type || null;

        const items = db.getDatabankItems(req.session.user.id, limit, offset, type);
        res.json({ items });
    } catch (error) {
        console.error('Error fetching databank items:', error);
        res.status(500).json({ error: 'Failed to fetch databank items' });
    }
});

// Delete item
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.deleteDatabankItem(id, req.session.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting databank item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// Clear all
router.post('/clear', (req, res) => {
    try {
        db.clearDatabank(req.session.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing databank:', error);
        res.status(500).json({ error: 'Failed to clear databank' });
    }
});

module.exports = router;
