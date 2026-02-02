const fs = require('fs');
const path = require('path');

// Configuration du serveur Python Whisper
const WHISPER_SERVER_URL = process.env.WHISPER_URL || 'http://localhost:5200';

/**
 * Vérifie si le serveur Whisper est disponible
 */
exports.checkHealth = async (req, res) => {
    try {
        const response = await fetch(`${WHISPER_SERVER_URL}/health`);
        if (response.ok) {
            const data = await response.json();
            res.json({ available: true, ...data });
        } else {
            res.json({ available: false, error: 'Server not responding' });
        }
    } catch (error) {
        res.json({
            available: false,
            error: 'Whisper server not running. Start with: python server/python/whisper_server.py'
        });
    }
};

/**
 * Retourne la liste des modèles disponibles
 */
exports.getModels = async (req, res) => {
    try {
        const response = await fetch(`${WHISPER_SERVER_URL}/models`);
        if (response.ok) {
            const data = await response.json();
            res.json(data);
        } else {
            res.status(503).json({ error: 'Whisper service unavailable' });
        }
    } catch (error) {
        res.status(503).json({
            error: 'Whisper server not running',
            hint: 'Start the Python server: python server/python/whisper_server.py'
        });
    }
};

/**
 * Retourne les informations sur le service
 */
exports.getInfo = async (req, res) => {
    try {
        const response = await fetch(`${WHISPER_SERVER_URL}/info`);
        if (response.ok) {
            const data = await response.json();
            res.json(data);
        } else {
            res.status(503).json({ error: 'Whisper service unavailable' });
        }
    } catch (error) {
        res.status(503).json({
            error: 'Whisper server not running',
            hint: 'Start the Python server: python server/python/whisper_server.py'
        });
    }
};

/**
 * Transcrit un fichier audio
 */
exports.transcribe = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const inputPath = req.file.path;
    const modelName = req.body.model || 'base';
    const language = req.body.language || null;

    const cleanUp = () => {
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }
    };

    try {
        console.log(`🎤 STT: Transcription de ${req.file.originalname} avec modèle '${modelName}'...`);

        // Créer FormData pour envoyer au serveur Python
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(inputPath);
        const blob = new Blob([fileBuffer], { type: req.file.mimetype });
        formData.append('file', blob, req.file.originalname);
        formData.append('model', modelName);
        if (language) {
            formData.append('language', language);
        }

        // Envoyer au serveur Whisper
        const response = await fetch(`${WHISPER_SERVER_URL}/transcribe`, {
            method: 'POST',
            body: formData
        });

        cleanUp();

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json(errorData);
        }

        const result = await response.json();
        console.log(`✅ STT: Transcription terminée!`);

        res.json(result);

    } catch (error) {
        console.error('❌ STT Error:', error.message);
        cleanUp();

        if (error.cause?.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Le serveur Whisper n\'est pas démarré',
                hint: 'Exécutez: python server/python/whisper_server.py'
            });
        }

        res.status(500).json({ error: error.message });
    }
};
