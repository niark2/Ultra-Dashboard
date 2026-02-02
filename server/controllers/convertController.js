const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { exec } = require('child_process');
const pandoc = require('pandoc-bin');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');

ffmpeg.setFfmpegPath(ffmpegPath);

const FORMATS = {
    image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'bmp', 'ico'],
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

    // If no target format, use original extension (compress-only mode)
    const outputFormat = targetFormat || inputExt;
    const shouldCompress = compress === 'true';
    const compressionQuality = parseInt(quality, 10) || 75;

    const outputFilename = `ultra-${Date.now()}.${outputFormat}`;
    const outputPath = path.join(__dirname, '../../uploads', outputFilename);
    let tempPath = null;

    const cleanUp = () => {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
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
                return sendFile(res, outputPath, outputFilename);
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
                return sendFile(res, outputPath, outputFilename);
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
                // Apply compression based on format
                const qualitySettings = getImageQualitySettings(formatName, compressionQuality);
                sharpInstance = sharpInstance.toFormat(formatName, qualitySettings);
            } else {
                sharpInstance = sharpInstance.toFormat(formatName);
            }

            await sharpInstance.toFile(outputPath);
            cleanUp();
            return sendFile(res, outputPath, outputFilename);
        }

        // --- 3. STRATÉGIE MULTIMÉDIA (FFMPEG) ---
        if (FORMATS.audio.includes(outputFormat) || FORMATS.video.includes(outputFormat)) {
            let ffmpegCommand = ffmpeg(req.file.path).toFormat(outputFormat);

            if (shouldCompress) {
                // Apply compression settings based on type
                if (FORMATS.audio.includes(outputFormat)) {
                    // Audio compression: reduce bitrate
                    const audioBitrate = Math.round(128 * (compressionQuality / 100));
                    ffmpegCommand = ffmpegCommand.audioBitrate(`${Math.max(64, audioBitrate)}k`);
                } else if (FORMATS.video.includes(outputFormat)) {
                    // Video compression: adjust CRF (lower quality = higher CRF)
                    const crf = Math.round(51 - (compressionQuality / 100) * 28); // CRF 23-51 range
                    ffmpegCommand = ffmpegCommand.outputOptions([`-crf ${crf}`]);
                }
            }

            return ffmpegCommand
                .on('end', () => { cleanUp(); sendFile(res, outputPath, outputFilename); })
                .on('error', (err) => {
                    console.error('❌ FFmpeg Error:', err);
                    cleanUp();
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
            return sendFile(res, outputPath, outputFilename);
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

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Pandoc Error:', stderr);
                cleanUp();

                if (stderr.includes('pdflatex') || stderr.includes('pdf-engine')) {
                    return res.status(500).json({ error: 'Pour créer un PDF, veuillez installer un moteur (MikTeX/WeekHtmlToPdf) sur le serveur.' });
                }

                return res.status(500).json({ error: 'Erreur Pandoc: ' + stderr });
            }
            cleanUp();
            sendFile(res, outputPath, outputFilename);
        });

    } catch (error) {
        console.error('❌ Erreur globale:', error);
        cleanUp();
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get quality settings for image compression based on format
 */
function getImageQualitySettings(format, quality) {
    switch (format) {
        case 'jpeg':
            return { quality, mozjpeg: true };
        case 'png':
            // PNG uses compressionLevel (0-9) instead of quality
            return { compressionLevel: Math.round(9 - (quality / 100) * 9) };
        case 'webp':
            return { quality };
        case 'avif':
            return { quality };
        case 'gif':
            return {}; // GIF doesn't support quality settings in sharp
        case 'tiff':
            return { quality };
        default:
            return {};
    }
}

function sendFile(res, filePath, fileName) {
    if (!fs.existsSync(filePath)) {
        return res.status(500).json({ error: 'Fichier non généré' });
    }
    res.download(filePath, fileName, (err) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (err) console.error('Download Error:', err);
    });
}

