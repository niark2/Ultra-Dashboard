const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const upscaleController = require('../controllers/upscaleController');

// Configuration Multer pour l'upload d'images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `upscale-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non supporté. Utilisez PNG, JPG, WEBP ou BMP.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 30 * 1024 * 1024 } // 30MB max
});

// Routes
router.get('/health', upscaleController.checkHealth);
router.post('/process', upload.single('file'), upscaleController.upscaleImage);

module.exports = router;
