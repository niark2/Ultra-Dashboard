const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');
const ffmetadata = require('ffmetadata');

// Configurer le chemin ffmpeg pour ffmetadata
const ffmpegStatic = require('ffmpeg-static');
ffmetadata.setFfmpegPath(ffmpegStatic);

const { spawn, exec } = require('child_process');

class MetadataController {
    /**
     * Ouvre une boîte de dialogue native pour sélectionner un dossier (Windows uniquement pour le moment)
     */
    async browseDirectory(req, res) {
        if (process.platform !== 'win32') {
            return res.status(400).json({ error: 'Fonctionnalité disponible uniquement sur Windows' });
        }

        const script = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Sélectionnez un dossier pour ULTRA Metadata Editor'; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }`;

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "& { ${script} }"`, (error, stdout, stderr) => {
            if (error) {
                console.error('Erreur PowerShell:', error);
                return res.status(500).json({ error: 'Erreur lors de l\'ouverture de l\'explorateur' });
            }
            const pathResult = stdout.trim();
            res.json({ path: pathResult });
        });
    }

    /**
     * Scanne un dossier local et extrait les métadonnées des fichiers compatibles
     */
    async scanDirectory(req, res) {
        const { directoryPath } = req.body;

        if (!directoryPath) {
            return res.status(400).json({ error: 'Chemin du dossier manquant' });
        }

        if (!fs.existsSync(directoryPath)) {
            return res.status(404).json({ error: 'Dossier non trouvé' });
        }

        try {
            const files = fs.readdirSync(directoryPath);
            const results = [];

            for (const file of files) {
                const filePath = path.join(directoryPath, file);
                const stats = fs.statSync(filePath);

                if (stats.isFile()) {
                    const ext = path.extname(file).toLowerCase();
                    const supportedAudio = ['.mp3', '.flac', '.m4a', '.wav', '.ogg'];
                    const supportedImages = ['.jpg', '.jpeg', '.png', '.webp'];

                    if (supportedAudio.includes(ext)) {
                        try {
                            const metadata = await mm.parseFile(filePath);
                            results.push({
                                type: 'audio',
                                fileName: file,
                                filePath: filePath,
                                title: metadata.common.title || file,
                                artist: metadata.common.artist || '',
                                album: metadata.common.album || '',
                                genre: metadata.common.genre ? metadata.common.genre.join(', ') : '',
                                year: metadata.common.year || '',
                                track: metadata.common.track?.no || '',
                                duration: metadata.format.duration || 0,
                                format: ext.substring(1).toUpperCase()
                            });
                        } catch (err) {
                            console.error(`Erreur lecture audio ${file}:`, err);
                            // Fallback minimal
                            results.push({
                                type: 'audio',
                                fileName: file,
                                filePath: filePath,
                                title: file,
                                format: ext.substring(1).toUpperCase()
                            });
                        }
                    } else if (supportedImages.includes(ext)) {
                        // Pour les images, on pourrait utiliser sharp pour les EXIF plus tard
                        results.push({
                            type: 'image',
                            fileName: file,
                            filePath: filePath,
                            title: file,
                            format: ext.substring(1).toUpperCase()
                        });
                    }
                }
            }

            res.json({ files: results });
        } catch (error) {
            console.error('Erreur scanDirectory:', error);
            res.status(500).json({ error: 'Erreur lors du scan du dossier' });
        }
    }

    /**
     * Met à jour les métadonnées d'un fichier
     */
    async updateMetadata(req, res) {
        const { filePath, metadata } = req.body;

        if (!filePath || !metadata) {
            return res.status(400).json({ error: 'Données manquantes' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Fichier non trouvé' });
        }

        const ext = path.extname(filePath).toLowerCase();

        try {
            if (['.mp3', '.flac', '.m4a', '.wav', '.ogg'].includes(ext)) {
                // Utilisation de ffmetadata pour l'écriture
                const data = {
                    title: metadata.title,
                    artist: metadata.artist,
                    album: metadata.album,
                    genre: metadata.genre,
                    date: metadata.year,
                    track: metadata.track
                };

                ffmetadata.write(filePath, data, (err) => {
                    if (err) {
                        console.error('Erreur ffmetadata write:', err);
                        return res.status(500).json({ error: 'Erreur lors de l\'écriture des métadonnées' });
                    }
                    res.json({ success: true, message: 'Métadonnées mises à jour' });
                });
            } else {
                res.status(400).json({ error: 'Format non supporté pour l\'écriture pour le moment' });
            }
        } catch (error) {
            console.error('Erreur updateMetadata:', error);
            res.status(500).json({ error: 'Erreur serveur lors de la mise à jour' });
        }
    }
}

module.exports = new MetadataController();
