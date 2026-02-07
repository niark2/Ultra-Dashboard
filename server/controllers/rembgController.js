const fs = require('fs');
const path = require('path');

// Configuration du serveur Python REMBG
const REMBG_SERVER_URL_ENV = process.env.REMBG_URL || 'http://localhost:5100';
const db = require('../lib/db');

/**
 * Vérifie si le serveur REMBG est disponible
 */
exports.checkHealth = async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user.id : null;
        const serverUrl = userId ? db.getConfigValue('REMBG_URL', userId, REMBG_SERVER_URL_ENV) : REMBG_SERVER_URL_ENV;
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
            error: 'REMBG server not running. Start with: python server/python/rembg_server.py'
        });
    }
};

/**
 * Retourne les informations sur le service REMBG
 */
exports.getInfo = async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user.id : null;
        const serverUrl = userId ? db.getConfigValue('REMBG_URL', userId, REMBG_SERVER_URL_ENV) : REMBG_SERVER_URL_ENV;
        const response = await fetch(`${serverUrl}/info`);
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
    const model = req.body.model || 'u2net';

    const cleanUp = () => {
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }
    };

    // ... (imports)

    // ...

    try {
        console.log(`🔄 REMBG: Traitement de ${req.file.originalname} avec le modele ${model}...`);

        // Créer un FormData pour envoyer au serveur Python
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(inputPath); // read before cleanup
        const blob = new Blob([fileBuffer], { type: req.file.mimetype });
        formData.append('file', blob, req.file.originalname);
        formData.append('model', model);

        const userId = req.session.user ? req.session.user.id : null;
        const serverUrl = userId ? db.getConfigValue('REMBG_URL', userId, REMBG_SERVER_URL_ENV) : REMBG_SERVER_URL_ENV;

        // Envoyer au serveur REMBG
        const response = await fetch(`${serverUrl}/remove`, {
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

        // Dossier de destination permanent (Databank)
        const databankDir = path.join(__dirname, '../../public/databank');
        if (!fs.existsSync(databankDir)) {
            fs.mkdirSync(databankDir, { recursive: true });
        }

        const outputPath = path.join(databankDir, outputFilename);

        // Sauvegarder le fichier
        fs.writeFileSync(outputPath, outputBuffer);

        console.log(`✅ REMBG: Arrière-plan supprimé avec ${model}!`);

        // Ajouter à la Databank
        try {
            const userId = req.session.user ? req.session.user.id : 1;
            db.addDatabankItem('image', `/databank/${outputFilename}`, {
                tool: 'rembg',
                model: model,
                originalName: req.file.originalname,
                timestamp: Date.now()
            }, userId);
            console.log('✅ REMBG: Résultat ajouté à la Databank');
        } catch (dbError) {
            console.error('⚠️ Erreur ajout Databank:', dbError.message);
        }

        // Clean up input file
        cleanUp();

        // Return JSON instead of triggering download
        res.json({
            success: true,
            message: 'Arrière-plan supprimé et enregistré dans la Databank',
            fileName: outputFilename,
            originalName: req.file.originalname
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
