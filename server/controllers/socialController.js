const youtubedl = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const db = require('../lib/db');
const axios = require('axios');


// Store active connections for progress updates
const progressClients = new Map();

// SSE Endpoint for progress
exports.getDownloadEvents = (req, res) => {
    const { downloadId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection
    res.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`);

    progressClients.set(downloadId, res);

    req.on('close', () => {
        progressClients.delete(downloadId);
    });
};

const sendProgress = (downloadId, data) => {
    const client = progressClients.get(downloadId);
    if (client) {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
};

// Récupérer les infos détaillées (Support multi-plateforme)
exports.getMediaInfo = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL manquante' });

        // Build generic options
        const options = {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
        };

        // Platform specific headers if needed
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            options.addHeader = ['referer:youtube.com', 'user-agent:googlebot'];
        }

        const output = await youtubedl(url, options);

        // Deduplicate resolutions for simpler UI
        const resolutions = output.formats && Array.isArray(output.formats)
            ? [...new Set(output.formats
                .filter(f => f.height)
                .map(f => f.height))]
                .sort((a, b) => b - a)
            : [];

        // Detect platform for UI
        let platform = 'generic';
        if (url.includes('tiktok.com')) platform = 'tiktok';
        else if (url.includes('instagram.com')) platform = 'instagram';
        else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'twitter';
        else if (url.includes('facebook.com')) platform = 'facebook';
        else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';

        res.json({
            title: output.title || 'Média sans titre',
            thumbnail: output.thumbnail || '/img/social-placeholder.png',
            duration: output.duration || 0,
            resolutions: resolutions,
            channel: output.uploader || output.webpage_url_domain || 'Inconnu',
            platform: platform
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

// Helper: Find downloaded file
const findDownloadedFile = async (uploadsDir, downloadId, maxRetries = 5, delayMs = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
        const files = fs.readdirSync(uploadsDir);
        const downloadedFile = files.find(f =>
            f.startsWith(downloadId.toString()) &&
            !f.endsWith('.part') &&
            !f.endsWith('.ytdl') &&
            !f.endsWith('.temp.mp4') &&
            !f.endsWith('.webp') &&
            !f.endsWith('.png') &&
            (f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm') ||
                f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav') ||
                f.endsWith('.opus') || f.endsWith('.ogg'))
        );
        if (downloadedFile) return downloadedFile;
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return null;
};

// Télécharger
exports.downloadMedia = async (req, res) => {
    try {
        const {
            url,
            mode, // 'video' | 'audio'
            format,
            quality,
            downloadId: clientDownloadId
        } = req.body;

        if (!url) return res.status(400).json({ error: 'URL manquante' });

        const downloadId = clientDownloadId || Date.now();
        const uploadsDir = path.join(__dirname, '../../uploads');
        const outputTemplate = path.join(uploadsDir, `${downloadId}.%(ext)s`);

        // Get title first
        let mediaTitle = 'media';
        try {
            const info = await youtubedl(url, { dumpSingleJson: true, noCheckCertificates: true, noWarnings: true });
            mediaTitle = info.title.replace(/[<>:"/\\|?*]/g, '').substring(0, 100);
            req.body.thumbnailUrl = info.thumbnail; // Save for databank
        } catch (e) {
            console.log('Could not fetch title, using default');
        }

        const ytDlpPath = path.join(__dirname, '../../node_modules/yt-dlp-exec/bin/yt-dlp.exe');

        // Build generic args
        const args = [
            url,
            '--no-check-certificates',
            '--no-warnings',
            '--output', outputTemplate,
            '--ffmpeg-location', ffmpegPath,
            '--no-mtime',
            '--newline'
        ];

        // Add headers only for YouTube
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            args.push('--add-header', 'referer:youtube.com');
            args.push('--add-header', 'user-agent:googlebot');
        }

        if (mode === 'audio') {
            args.push('--extract-audio');
            args.push('--audio-format', format || 'mp3');
            args.push('--audio-quality', '0');
        } else {
            args.push('--merge-output-format', format || 'mp4');
            if (quality && quality !== 'best') {
                args.push('--format', `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`);
            } else {
                args.push('--format', `bestvideo+bestaudio/best`);
            }
        }

        const cp = spawn(ytDlpPath, args);

        cp.stdout.on('data', (data) => {
            const line = data.toString();
            const progressMatch = line.match(/\[download\]\s+(\d+\.\d+)%/);
            if (progressMatch) {
                sendProgress(downloadId.toString(), {
                    type: 'progress',
                    percent: parseFloat(progressMatch[1]),
                    status: 'Téléchargement...'
                });
            } else if (line.includes('[Merger]')) {
                sendProgress(downloadId.toString(), { type: 'progress', percent: 95, status: 'Finalisation...' });
            }
        });

        await new Promise((resolve, reject) => {
            cp.on('close', code => (code === 0 || code === null) ? resolve() : reject(new Error(`Exit ${code}`)));
        });

        const downloadedFile = await findDownloadedFile(uploadsDir, downloadId);
        if (!downloadedFile) throw new Error('Fichier égaré');

        const filePath = path.join(uploadsDir, downloadedFile);
        await waitForFile(filePath);

        sendProgress(downloadId.toString(), { type: 'complete', percent: 100, status: 'Prêt !' });

        const ext = path.extname(downloadedFile);
        const finalFileName = `${mediaTitle}${ext}`;

        // --- COPIE VERS LA DATABANK ---
        let databankFileName = null;
        try {
            const databankDir = path.join(__dirname, '../../public/databank');
            if (!fs.existsSync(databankDir)) fs.mkdirSync(databankDir, { recursive: true });

            databankFileName = `soc-${downloadId}${ext}`;
            const databankPath = path.join(databankDir, databankFileName);

            fs.copyFileSync(filePath, databankPath);

            // Download Thumbnail if available
            let thumbnailPath = null;
            if (req.body.thumbnailUrl) {
                try {
                    const thumbExt = '.jpg'; // Fallback to jpg for social
                    const thumbFileName = `thumb-soc-${downloadId}${thumbExt}`;
                    const thumbLocalPath = path.join(databankDir, thumbFileName);

                    const response = await axios({
                        url: req.body.thumbnailUrl,
                        method: 'GET',
                        responseType: 'stream'
                    });

                    const writer = fs.createWriteStream(thumbLocalPath);
                    response.data.pipe(writer);

                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    thumbnailPath = `/databank/${thumbFileName}`;
                } catch (thumbErr) {
                    console.error('⚠️ Could not save social thumbnail:', thumbErr.message);
                }
            }

            const userId = req.session.user ? req.session.user.id : 1;
            db.addDatabankItem(mode === 'audio' ? 'audio' : 'video', `/databank/${databankFileName}`, {
                tool: 'social',
                title: mediaTitle,
                url: url,
                thumbnail: thumbnailPath,
                timestamp: Date.now()
            }, userId);
            console.log(`✅ Social: Résultat ajouté à la Databank (${databankFileName})`);
        } catch (dbErr) {
            console.error('⚠️ Erreur Databank Social:', dbErr.message);
        }

        // Clean up temporary file
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
            console.log('Could not delete file after processing:', e.message);
        }

        res.json({
            success: true,
            message: 'Média téléchargé et enregistré dans la Databank',
            title: mediaTitle,
            fileName: databankFileName,
            prettyName: finalFileName
        });


    } catch (error) {
        console.error('Download Error:', error);
        res.status(500).json({ error: error.message });
    }
};
