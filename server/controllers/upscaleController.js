const fs = require('fs');
const path = require('path');

// Configuration du serveur Python Upscale
const UPSCALE_SERVER_URL_ENV = process.env.UPSCALE_URL || 'http://localhost:5300';
const db = require('../lib/db');

/**
 * Vérifie si le serveur Upscale est disponible
 */
exports.checkHealth = async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user.id : null;
        const serverUrl = userId ? db.getConfigValue('UPSCALE_URL', userId, UPSCALE_SERVER_URL_ENV) : UPSCALE_SERVER_URL_ENV;
        const response = await fetch(`${serverUrl}/health`);
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
    const model = req.body.model || 'edsr';
    const denoise = req.body.denoise || 'false';

    const cleanUp = () => {
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }
    };

    // ... (imports)

    // ...

    try {
        console.log(`🔄 Upscale: Traitement de ${req.file.originalname} (x${scale}, model=${model}, denoise=${denoise})...`);

        // Créer un FormData pour envoyer au serveur Python
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(inputPath); // read before cleanup
        const blob = new Blob([fileBuffer], { type: req.file.mimetype });
        formData.append('file', blob, req.file.originalname);
        formData.append('scale', scale);
        formData.append('model', model);
        formData.append('denoise', denoise);

        // Envoyer au serveur Upscale
        const userId = req.session.user ? req.session.user.id : 1;
        const serverUrl = db.getConfigValue('UPSCALE_URL', userId, UPSCALE_SERVER_URL_ENV);

        const response = await fetch(`${serverUrl}/upscale`, {
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

        // Dossier Databank
        const databankDir = path.join(__dirname, '../../public/databank');
        if (!fs.existsSync(databankDir)) {
            fs.mkdirSync(databankDir, { recursive: true });
        }

        const outputPath = path.join(databankDir, outputFilename);

        // Sauvegarder fichier
        fs.writeFileSync(outputPath, outputBuffer);

        console.log(`✅ Upscale: Image agrandie avec succès!`);

        // Ajouter à la Databank
        try {
            const userId = req.session.user ? req.session.user.id : 1;
            db.addDatabankItem('image', `/databank/${outputFilename}`, {
                tool: 'upscale',
                scale: scale,
                denoise: denoise,
                originalName: req.file.originalname,
                timestamp: Date.now()
            }, userId);
        } catch (dbError) {
            console.error('⚠️ Erreur ajout Databank:', dbError.message);
        }

        // Clean up input file
        cleanUp();

        // Return JSON instead of triggering download
        res.json({
            success: true,
            message: 'Image agrandie et enregistrée dans la Databank',
            fileName: outputFilename,
            originalName: req.file.originalname
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
