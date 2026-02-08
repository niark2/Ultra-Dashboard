const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Get databank items
router.get('/', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const type = req.query.type || null;
        const folderId = req.query.folderId || null;
        const search = req.query.search || null;

        const items = db.getDatabankItems(req.session.user.id, limit, offset, type, folderId, search);
        res.json({ items });
    } catch (error) {
        console.error('Error fetching databank items:', error);
        res.status(500).json({ error: 'Failed to fetch databank items' });
    }
});

// Validate items existence (for sync)
router.post('/validate', (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'IDs must be an array' });
        }

        // Retrieve valid IDs from DB
        const validIds = db.getValidDatabankIds(req.session.user.id, ids);
        res.json({ validIds });
    } catch (error) {
        console.error('Error validating databank items:', error);
        res.status(500).json({ error: 'Failed to validate items' });
    }
});

// Upload file to databank (for notes export)
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = path.join('uploads', req.file.filename);
        const fileSize = req.file.size;
        const fileType = path.extname(req.file.originalname).substring(1).toLowerCase();

        const metadata = {
            originalName: req.file.originalname,
            size: req.file.size
        };

        // Add to databank
        const result = db.addDatabankItem(
            fileType,            // type
            filePath,            // content
            metadata,            // metadata
            req.session.user.id, // userId
            null                 // folderId
        );

        res.json({ success: true, filename: req.file.originalname, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error uploading file to databank:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Update databank item content
router.put('/:id/content', (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        db.updateDatabankItemContent(id, content, req.session.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating databank item content:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// Folders routes
router.get('/folders', (req, res) => {
    try {
        const parentId = req.query.parentId || null;
        const search = req.query.search || null;
        const folders = db.getDatabankFolders(req.session.user.id, parentId, search);
        res.json({ folders });
    } catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

router.post('/folders', (req, res) => {
    try {
        const { name, parentId } = req.body;
        db.createDatabankFolder(req.session.user.id, name, parentId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

router.delete('/folders/:id', (req, res) => {
    try {
        db.deleteDatabankFolder(req.params.id, req.session.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

router.put('/:id/folder', (req, res) => {
    try {
        const { folderId } = req.body;
        db.moveDatabankItemToFolder(req.params.id, folderId, req.session.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error moving item to folder:', error);
        res.status(500).json({ error: 'Failed to move item' });
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
