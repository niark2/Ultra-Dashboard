const youtubedl = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');

// Store active connections for progress updates
const progressClients = new Map();

// SSE Endpoint for progress
exports.getDownloadEvents = (req, res) => {
    const { videoId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection
    res.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`);

    progressClients.set(videoId, res);

    req.on('close', () => {
        progressClients.delete(videoId);
    });
};

const sendProgress = (videoId, data) => {
    const client = progressClients.get(videoId);
    if (client) {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
};

// Récupérer les infos détaillées
exports.getVideoInfo = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL manquante' });

        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });

        // Deduplicate resolutions for simpler UI
        const resolutions = [...new Set(output.formats
            .filter(f => f.height)
            .map(f => f.height))]
            .sort((a, b) => b - a);

        res.json({
            title: output.title,
            thumbnail: output.thumbnail,
            duration: output.duration,
            resolutions: resolutions,
            channel: output.uploader,
            view_count: output.view_count
        });

    } catch (error) {
        console.error('Info Error:', error);
        res.status(500).json({ error: 'Impossible de récupérer les infos: ' + error.message });
    }
};

// Helper: Wait for file to be available (not locked)
const waitForFile = (filePath, maxRetries = 10, delayMs = 500) => {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const tryAccess = () => {
            attempts++;
            try {
                // Try to open file for reading - if locked, this will throw
                const fd = fs.openSync(filePath, 'r');
                fs.closeSync(fd);
                resolve(filePath);
            } catch (err) {
                if (attempts >= maxRetries) {
                    reject(new Error(`File still locked after ${maxRetries} attempts: ${filePath}`));
                } else {
                    setTimeout(tryAccess, delayMs);
                }
            }
        };
        tryAccess();
    });
};

// Helper: Find downloaded file with retry
const findDownloadedFile = async (uploadsDir, videoId, maxRetries = 5, delayMs = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        const files = fs.readdirSync(uploadsDir);
        const downloadedFile = files.find(f =>
            f.startsWith(videoId.toString()) &&
            !f.endsWith('.part') &&
            !f.endsWith('.ytdl') &&
            !f.endsWith('.temp.mp4') &&
            !f.endsWith('.webp') &&
            !f.endsWith('.png') &&
            (f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm') ||
                f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav') ||
                f.endsWith('.opus') || f.endsWith('.ogg'))
        );
        if (downloadedFile) {
            return downloadedFile;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return null;
};

// Télécharger avec options avancées
exports.downloadVideo = async (req, res) => {
    try {
        const {
            url,
            mode, // 'video' | 'audio'
            format, // 'mp4', 'mkv', 'mp3', 'wav', etc.
            quality, // 'best', '1080', '720', etc.
            embedMetadata,
            embedSubs,
            trimStart,
            trimEnd,
            videoId: clientVideoId
        } = req.body;

        if (!url) return res.status(400).json({ error: 'URL manquante' });

        // Récupérer le titre de la vidéo
        let videoTitle = 'video';
        try {
            const info = await youtubedl(url, {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true,
                addHeader: ['referer:youtube.com', 'user-agent:googlebot']
            });
            // Nettoyer le titre pour les noms de fichiers (supprimer caractères invalides)
            videoTitle = info.title.replace(/[<>:"/\\|?*]/g, '').substring(0, 100);
        } catch (e) {
            console.log('Could not fetch video title, using default');
        }

        const videoId = clientVideoId || Date.now();
        const uploadsDir = path.join(__dirname, '../../uploads');
        const outputTemplate = path.join(uploadsDir, `${videoId}.%(ext)s`);

        // Base options - disable thumbnail embedding on Windows (causes file locking issues)
        let options = {
            noCheckCertificates: true,
            noWarnings: true,
            output: outputTemplate,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot'],
            ffmpegLocation: ffmpegPath,
            noMtime: true,
            // Metadata is safe, but thumbnail embedding uses mutagen which locks files on Windows
            addMetadata: embedMetadata === true,
            // DISABLED: embedThumbnail causes WinError 32 file locking issues
            // embedThumbnail: false,
        };

        // Gestion du découpage (Time Range)
        if (trimStart || trimEnd) {
            options.downloadSections = `*${trimStart || ''}-${trimEnd || ''}`;
            options.forceKeyframesAtCuts = true;
        }

        // Configuration Audio vs Vidéo
        if (mode === 'audio') {
            options.extractAudio = true;
            options.audioFormat = format || 'mp3';
            options.audioQuality = '0'; // Meilleure qualité
        } else {
            // Configuration Vidéo
            options.mergeOutputFormat = format || 'mp4';

            if (embedSubs) {
                options.writeAutoSub = true;
                options.embedSubs = true;
                options.subLangs = 'all,-live_chat';
            }

            if (quality && quality !== 'best') {
                options.format = `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`;
            } else {
                options.format = `bestvideo+bestaudio/best`;
            }
        }

        console.log('Starting download with options:', options);

        try {
            // we use the binary path directly to get real-time stdout
            const ytDlpPath = path.join(__dirname, '../../node_modules/yt-dlp-exec/bin/yt-dlp.exe');

            // Build arguments array from options
            const args = [
                url,
                '--no-check-certificates',
                '--no-warnings',
                '--output', outputTemplate,
                '--add-header', 'referer:youtube.com',
                '--add-header', 'user-agent:googlebot',
                '--ffmpeg-location', ffmpegPath,
                '--no-mtime',
                '--newline' // Important for parsing progress
            ];

            if (options.addMetadata) args.push('--add-metadata');
            if (options.downloadSections) {
                args.push('--download-sections', options.downloadSections);
                args.push('--force-keyframes-at-cuts');
            }

            if (mode === 'audio') {
                args.push('--extract-audio');
                args.push('--audio-format', options.audioFormat);
                args.push('--audio-quality', options.audioQuality);
            } else {
                args.push('--merge-output-format', options.mergeOutputFormat);
                if (options.writeAutoSub) {
                    args.push('--write-auto-sub', '--embed-subs', '--sub-langs', options.subLangs);
                }
                args.push('--format', options.format);
            }

            const cp = spawn(ytDlpPath, args);

            cp.stdout.on('data', (data) => {
                const line = data.toString();
                // Parse progress: [download]  10.0% of ...
                const progressMatch = line.match(/\[download\]\s+(\d+\.\d+)%/);
                if (progressMatch) {
                    sendProgress(videoId.toString(), {
                        type: 'progress',
                        percent: parseFloat(progressMatch[1]),
                        status: 'Téléchargement...'
                    });
                } else if (line.includes('[Merger]')) {
                    sendProgress(videoId.toString(), { type: 'progress', percent: 95, status: 'Fusion des fichiers...' });
                } else if (line.includes('[Metadata]')) {
                    sendProgress(videoId.toString(), { type: 'progress', percent: 98, status: 'Ajout des métadonnées...' });
                }
            });

            cp.stderr.on('data', (data) => {
                const line = data.toString();
                if (line.includes('WinError 32')) {
                    console.log('WinError 32 handled in spawn');
                }
            });

            await new Promise((resolve, reject) => {
                cp.on('close', (code) => {
                    if (code === 0 || code === null) resolve();
                    else reject(new Error(`yt-dlp exited with code ${code}`));
                });
            });

        } catch (dlError) {
            // Check if it's the Windows file locking error but file was actually created
            if (dlError.message && dlError.message.includes('WinError 32')) {
                console.log('WinError 32 detected, checking if file was created anyway...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                throw dlError;
            }
        }

        // Find the downloaded file with retries
        const downloadedFile = await findDownloadedFile(uploadsDir, videoId);

        if (!downloadedFile) {
            throw new Error('Fichier introuvable après téléchargement');
        }

        const filePath = path.join(uploadsDir, downloadedFile);

        // Wait for file to be fully released
        await waitForFile(filePath);

        sendProgress(videoId.toString(), { type: 'complete', percent: 100, status: 'Prêt !' });

        // Clean up temporary files
        const allFiles = fs.readdirSync(uploadsDir);
        allFiles.forEach(f => {
            if (f.startsWith(videoId.toString()) && (f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.temp.mp4'))) {
                try {
                    fs.unlinkSync(path.join(uploadsDir, f));
                } catch (e) {
                    console.log('Could not delete temp file:', f);
                }
            }
        });

        // Créer le nom de fichier final avec le titre de la vidéo
        const fileExtension = path.extname(downloadedFile);
        const finalFileName = `${videoTitle}${fileExtension}`;

        res.download(filePath, finalFileName, (err) => {
            // Clean up after download
            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (e) {
                    console.log('Could not delete file after download:', e.message);
                }
            }, 1000);
            if (err) console.error('Download Error:', err);
        });

    } catch (error) {
        console.error('Download Error:', error);
        res.status(500).json({ error: 'Erreur lors du téléchargement: ' + error.message });
    }
};
