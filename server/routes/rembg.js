const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const rembgController = require('../controllers/rembgController');

// Configuration Multer pour l'upload d'images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `rembg-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non supporté. Utilisez PNG, JPG, WEBP, GIF ou BMP.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 30 * 1024 * 1024 } // 30MB max
});

// Routes
router.get('/health', rembgController.checkHealth);
router.get('/info', rembgController.getInfo);
router.post('/remove', upload.single('file'), rembgController.removeBackground);

module.exports = router;
