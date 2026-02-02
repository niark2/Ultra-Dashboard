const fs = require('fs');
const path = require('path');

// Configuration du serveur Python Upscale
const UPSCALE_SERVER_URL = process.env.UPSCALE_URL || 'http://localhost:5300';

/**
 * Vérifie si le serveur Upscale est disponible
 */
exports.checkHealth = async (req, res) => {
    try {
        const response = await fetch(`${UPSCALE_SERVER_URL}/health`);
        if (response.ok) {
            const data = await response.json();
            res.json({ available: true, ...data });
        } else {
            res.json({ available: false, error: 'Server not responding' });
        }
    } catch (error) {
        res.json({
            available: false,
            error: 'Upscale server not running. Start with: python server/python/upscale_server.py'
        });
    }
};

/**
 * Upscale une image
 * Proxy vers le serveur Python Upscale
 */
exports.upscaleImage = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const inputPath = req.file.path;
    const scale = req.body.scale || 4;
    const denoise = req.body.denoise || 'false';

    const cleanUp = () => {
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }
    };

    try {
        console.log(`🔄 Upscale: Traitement de ${req.file.originalname} (x${scale}, denoise=${denoise})...`);

        // Créer un FormData pour envoyer au serveur Python
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(inputPath);
        const blob = new Blob([fileBuffer], { type: req.file.mimetype });
        formData.append('file', blob, req.file.originalname);
        formData.append('scale', scale);
        formData.append('denoise', denoise);

        // Envoyer au serveur Upscale
        const response = await fetch(`${UPSCALE_SERVER_URL}/upscale`, {
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
        const outputFilename = `upscaled-${Date.now()}.png`;
        const outputPath = path.join(__dirname, '../../uploads', outputFilename);

        // Sauvegarder temporairement
        fs.writeFileSync(outputPath, outputBuffer);

        console.log(`✅ Upscale: Image agrandie avec succès!`);

        // Envoyer le fichier
        res.download(outputPath, outputFilename, (err) => {
            cleanUp();
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            if (err) console.error('Download Error:', err);
        });

    } catch (error) {
        console.error('❌ Upscale Error:', error.message);
        cleanUp();

        if (error.cause?.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Le serveur Upscale n\'est pas démarré',
                hint: 'Exécutez: python server/python/upscale_server.py'
            });
        }

        res.status(500).json({ error: error.message });
    }
};
