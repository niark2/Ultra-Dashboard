const fs = require('fs');
const path = require('path');

// Configuration du serveur Python REMBG
const REMBG_SERVER_URL = process.env.REMBG_URL || 'http://localhost:5100';

/**
 * Vérifie si le serveur REMBG est disponible
 */
exports.checkHealth = async (req, res) => {
    try {
        const response = await fetch(`${REMBG_SERVER_URL}/health`);
        if (response.ok) {
            const data = await response.json();
            res.json({ available: true, ...data });
        } else {
            res.json({ available: false, error: 'Server not responding' });
        }
    } catch (error) {
        res.json({
            available: false,
            error: 'REMBG server not running. Start with: python server/python/rembg_server.py'
        });
    }
};

/**
 * Retourne les informations sur le service REMBG
 */
exports.getInfo = async (req, res) => {
    try {
        const response = await fetch(`${REMBG_SERVER_URL}/info`);
        if (response.ok) {
            const data = await response.json();
            res.json(data);
        } else {
            res.status(503).json({ error: 'REMBG service unavailable' });
        }
    } catch (error) {
        res.status(503).json({
            error: 'REMBG server not running',
            hint: 'Start the Python server: python server/python/rembg_server.py'
        });
    }
};

/**
 * Supprime l'arrière-plan d'une image
 * Proxy vers le serveur Python REMBG
 */
exports.removeBackground = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const inputPath = req.file.path;

    const cleanUp = () => {
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }
    };

    try {
        console.log(`🔄 REMBG: Traitement de ${req.file.originalname}...`);

        // Créer un FormData pour envoyer au serveur Python
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(inputPath);
        const blob = new Blob([fileBuffer], { type: req.file.mimetype });
        formData.append('file', blob, req.file.originalname);

        // Envoyer au serveur REMBG
        const response = await fetch(`${REMBG_SERVER_URL}/remove`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            cleanUp();
            return res.status(response.status).json(errorData);
        }

        // Récupérer l'image traitée
        const outputBuffer = Buffer.from(await response.arrayBuffer());
        const outputFilename = `nobg-${Date.now()}.png`;
        const outputPath = path.join(__dirname, '../../uploads', outputFilename);

        // Sauvegarder temporairement
        fs.writeFileSync(outputPath, outputBuffer);

        console.log(`✅ REMBG: Arrière-plan supprimé!`);

        // Envoyer le fichier
        res.download(outputPath, outputFilename, (err) => {
            cleanUp();
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            if (err) console.error('Download Error:', err);
        });

    } catch (error) {
        console.error('❌ REMBG Error:', error.message);
        cleanUp();

        if (error.cause?.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Le serveur REMBG n\'est pas démarré',
                hint: 'Exécutez: python server/python/rembg_server.py'
            });
        }

        res.status(500).json({ error: error.message });
    }
};
