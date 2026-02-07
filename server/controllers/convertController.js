const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { exec } = require('child_process');
const pandoc = require('pandoc-bin');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const db = require('../lib/db');


ffmpeg.setFfmpegPath(ffmpegPath);

const FORMATS = {
    image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tiff'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'],
    video: ['mp4', 'webm', 'avi', 'mov', 'mkv'],
    document: ['docx', 'txt', 'md', 'html', 'epub', 'odt', 'rtf', 'pdf']
};

exports.getFormats = (req, res) => {
    res.json(FORMATS);
};

exports.convertFile = async (req, res) => {
    let inputPath = req.file.path;
    const inputExt = path.extname(req.file.originalname).slice(1).toLowerCase();
    const { targetFormat, compress, quality } = req.body;
    const compressionQuality = parseInt(quality) || 75;

    // If no target format, use original extension (compress-only mode)
    const outputFormat = targetFormat || inputExt;
    const shouldCompress = compress === 'true';
    const originalStem = path.parse(req.file.originalname).name;
    const downloadName = `${originalStem}.${outputFormat}`;
    const internalFilename = `ultra-${Date.now()}.${outputFormat}`;
    const outputPath = path.join(__dirname, '../../uploads', internalFilename);

    let tempPath = null;

    const cleanUp = async () => {
        try {
            // Petit délai pour Windows (sharp/ffmpeg handles)
            await new Promise(resolve => setTimeout(resolve, 100));
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch (e) {
            console.warn('⚠️ Erreur mineure lors du nettoyage (fichier peut-être encore utilisé) :', e.message);
        }
    };

    try {
        console.log(`🚀 Traitement : ${inputExt} -> ${outputFormat} | Compression: ${shouldCompress} (${compressionQuality}%)`);

        // --- 1. GESTION SPÉCIALE ENTRÉE PDF ---
        if (inputExt === 'pdf' && outputFormat !== 'pdf') {
            console.log("📄 Extraction du texte du PDF...");
            const dataBuffer = fs.readFileSync(inputPath);
            const data = await pdfParse(dataBuffer);

            tempPath = path.join(__dirname, '../../uploads', `temp-${Date.now()}.txt`);
            fs.writeFileSync(tempPath, data.text);
            const originalInputPath = inputPath;
            inputPath = tempPath;
            console.log("✅ Texte extrait.");

            // Si la cible est TXT, pas besoin de Pandoc
            if (outputFormat === 'txt') {
                fs.copyFileSync(inputPath, outputPath);
                // On nettoie manuellement car on va return
                if (fs.existsSync(originalInputPath)) fs.unlinkSync(originalInputPath);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                return sendFile(req, res, outputPath, downloadName);
            }

            // Pour les autres formats, on nettoie l'original car on continue avec tempPath
            if (fs.existsSync(originalInputPath)) fs.unlinkSync(originalInputPath);
        }

        // --- 1b. PDF → PDF COMPRESSION (Pandoc cannot read PDFs!) ---
        if (inputExt === 'pdf' && outputFormat === 'pdf') {
            console.log("📄 Compression PDF avec pdf-lib...");
            try {
                const pdfBytes = fs.readFileSync(inputPath);
                const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

                // pdf-lib automatically optimizes when saving
                // The useObjectStreams option helps reduce file size
                const compressedBytes = await pdfDoc.save({
                    useObjectStreams: true,
                    addDefaultPage: false,
                });

                fs.writeFileSync(outputPath, compressedBytes);

                const originalSize = pdfBytes.length;
                const compressedSize = compressedBytes.length;
                const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
                console.log(`✅ PDF compressé: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${reduction}% réduction)`);

                cleanUp();
                return sendFile(req, res, outputPath, downloadName);
            } catch (pdfError) {
                console.error('❌ PDF Compression Error:', pdfError);
                cleanUp();
                return res.status(500).json({ error: 'Erreur compression PDF: ' + pdfError.message });
            }
        }

        // --- 2. STRATÉGIE IMAGE (SHARP) ---
        if (FORMATS.image.includes(inputExt) && FORMATS.image.includes(outputFormat) && outputFormat !== 'pdf') {
            let sharpInstance = sharp(req.file.path);
            const formatName = outputFormat === 'jpg' ? 'jpeg' : outputFormat;

            if (shouldCompress) {
                // Optimisation intelligente : Redimensionnement max 2560px (Ultra HD)
                // pour éviter les fichiers inutilement lourds sans sacrifier la qualité visuelle
                sharpInstance = sharpInstance.resize({
                    width: 2560,
                    height: 2560,
                    fit: 'inside',
                    withoutEnlargement: true
                });

                // Apply compression based on format
                const qualitySettings = getImageQualitySettings(formatName, compressionQuality);
                sharpInstance = sharpInstance.toFormat(formatName, qualitySettings);
            } else {
                sharpInstance = sharpInstance.toFormat(formatName);
            }

            await sharpInstance.toFile(outputPath);
            await cleanUp();
            return sendFile(req, res, outputPath, downloadName);
        }

        // --- 3. STRATÉGIE MULTIMÉDIA (FFMPEG) ---
        if (FORMATS.audio.includes(outputFormat) || FORMATS.video.includes(outputFormat)) {
            let ffmpegCommand = ffmpeg(req.file.path);

            // Set codecs based on output format FIRST
            if (FORMATS.video.includes(outputFormat)) {
                switch (outputFormat) {
                    case 'mp4':
                        ffmpegCommand = ffmpegCommand.videoCodec('libx264').audioCodec('aac')
                            .outputOptions(['-pix_fmt yuv420p']);
                        break;
                    case 'webm':
                        ffmpegCommand = ffmpegCommand.videoCodec('libvpx').audioCodec('libvorbis');
                        break;
                    case 'avi':
                        ffmpegCommand = ffmpegCommand.videoCodec('mpeg4').audioCodec('aac');
                        break;
                    case 'mov':
                        ffmpegCommand = ffmpegCommand.videoCodec('libx264').audioCodec('aac');
                        break;
                    case 'mkv':
                        ffmpegCommand = ffmpegCommand.videoCodec('libx264').audioCodec('aac');
                        break;
                }
            }

            ffmpegCommand = ffmpegCommand.toFormat(outputFormat);

            if (shouldCompress) {
                if (FORMATS.audio.includes(outputFormat)) {
                    // Audio compression: bitrate adaptatif
                    const audioBitrate = Math.round(128 * (compressionQuality / 100));
                    ffmpegCommand = ffmpegCommand.audioBitrate(`${Math.max(64, audioBitrate)}k`);
                } else if (FORMATS.video.includes(outputFormat)) {
                    // Video compression: CRF (23 = haute qualité, 51 = très compressé)
                    // On mappe la qualité 1-100 vers CRF 51-18 (plus bas est meilleur)
                    const crf = Math.round(51 - (compressionQuality / 100) * 33);
                    ffmpegCommand = ffmpegCommand.outputOptions([
                        `-crf ${crf}`,
                        '-preset faster', // Meilleur ratio temps/compression
                        '-movflags +faststart' // Optimisation streaming web
                    ]);
                }
            }

            return ffmpegCommand
                .on('end', async () => { await cleanUp(); sendFile(req, res, outputPath, downloadName); })
                .on('error', async (err) => {
                    console.error('❌ FFmpeg Error:', err);
                    await cleanUp();
                    res.status(500).json({ error: 'Erreur FFmpeg: ' + err.message });
                })
                .save(outputPath);
        }

        // --- 4. STRATÉGIE DOCUMENTS (PANDOC) ---
        const effectiveExt = (inputPath === tempPath) ? 'txt' : inputExt;

        // Si source == cible et pas de compression (ou type non compressible), simple copie
        if (effectiveExt === outputFormat && !shouldCompress) {
            fs.copyFileSync(inputPath, outputPath);
            cleanUp();
            return sendFile(req, res, outputPath, downloadName);
        }

        // Documents don't support compression via Pandoc, just convert
        const pandocPath = pandoc.path;

        // Mapping format d'entrée explicite
        const PANDOC_FORMATS = {
            'docx': 'docx', 'doc': 'doc', 'odt': 'odt',
            'md': 'markdown', 'html': 'html', 'txt': 'markdown',
            'rtf': 'rtf', 'epub': 'epub', 'tex': 'latex'
        };

        const inputFmtWithFlag = PANDOC_FORMATS[effectiveExt] ? `-f ${PANDOC_FORMATS[effectiveExt]}` : '';

        const cmd = `"${pandocPath}" "${inputPath}" ${inputFmtWithFlag} -o "${outputPath}"`;

        console.log(`Command: ${cmd}`);

        exec(cmd, async (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Pandoc Error:', stderr);
                await cleanUp();

                if (stderr.includes('pdflatex') || stderr.includes('pdf-engine')) {
                    return res.status(500).json({ error: 'Pour créer un PDF, veuillez installer un moteur (MikTeX/WeekHtmlToPdf) sur le serveur.' });
                }

                return res.status(500).json({ error: 'Erreur Pandoc: ' + stderr });
            }
            await cleanUp();
            sendFile(req, res, outputPath, downloadName);
        });

    } catch (error) {
        console.error('❌ Erreur globale:', error);
        await cleanUp();
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get advanced quality settings for image compression based on format
 */
function getImageQualitySettings(format, quality) {
    switch (format) {
        case 'jpeg':
            return {
                quality: quality,
                mozjpeg: true, // Meilleur algorithme de compression JPG
                progressive: true
            };
        case 'png':
            // Pour PNG, quality active la quantification (palette-based) 
            // C'est ce qui réduit vraiment le poids (type TinyPNG)
            return {
                palette: true,
                quality: quality,
                compressionLevel: 9
            };
        case 'webp':
            return {
                quality: quality,
                smartSubsample: true,
                effort: 6 // Meilleure compression au prix d'un peu plus de CPU
            };
        case 'avif':
            return {
                quality: quality,
                effort: 4 // AVIF est très lent, 4 est un bon compromis
            };
        case 'gif':
            return { colours: Math.round(256 * (quality / 100)) }; // Réduit la palette
        case 'tiff':
            return { quality: quality, compression: 'lzw' };
        default:
            return { quality: quality };
    }
}

function sendFile(req, res, filePath, fileName) {
    if (!fs.existsSync(filePath)) {
        return res.status(500).json({ error: 'Fichier non généré' });
    }

    let databankUrl = null;
    let databankFileName = null;

    // --- COPIE VERS LA DATABANK ---
    try {
        const databankDir = path.join(__dirname, '../../public/databank');
        if (!fs.existsSync(databankDir)) fs.mkdirSync(databankDir, { recursive: true });

        databankFileName = `conv-${Date.now()}-${path.basename(filePath)}`;
        const databankPath = path.join(databankDir, databankFileName);

        fs.copyFileSync(filePath, databankPath);
        databankUrl = `/databank/${databankFileName}`;

        // Déterminer le type
        let type = 'file';
        const ext = path.extname(fileName).slice(1).toLowerCase();
        if (FORMATS.image.includes(ext)) type = 'image';
        else if (FORMATS.audio.includes(ext)) type = 'audio';
        else if (FORMATS.video.includes(ext)) type = 'video';

        const userId = req.session?.user?.id || 1;
        db.addDatabankItem(type, databankUrl, {
            tool: 'converter',
            originalName: fileName,
            timestamp: Date.now()
        }, userId);
        console.log(`✅ Converter: Résultat ajouté à la Databank (${databankFileName})`);
    } catch (dbErr) {
        console.error('⚠️ Erreur Databank Converter:', dbErr.message);
    }

    // Clean up temporary file
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
        console.error('Cleanup Error:', err);
    }

    // Return JSON instead of triggering download
    res.json({
        success: true,
        message: 'Conversion réussie et enregistrée dans la Databank',
        fileName: fileName,
        databankUrl: databankUrl
    });
}


