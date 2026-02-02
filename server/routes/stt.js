const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const sttController = require('../controllers/sttController');

// Configuration Multer pour l'upload audio
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `stt-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
        'audio/m4a', 'audio/x-m4a', 'audio/mp4',
        'audio/ogg', 'audio/flac', 'audio/webm',
        'video/webm', 'video/mp4'
    ];

    // Allow by extension as fallback
    const allowedExt = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'mp4', 'mpeg', 'mpga'];
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

    if (allowedTypes.includes(file.mimetype) || allowedExt.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non supporté. Utilisez MP3, WAV, M4A, OGG, FLAC ou WebM.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

// Routes
router.get('/health', sttController.checkHealth);
router.get('/models', sttController.getModels);
router.get('/info', sttController.getInfo);
router.post('/transcribe', upload.single('file'), sttController.transcribe);

module.exports = router;
