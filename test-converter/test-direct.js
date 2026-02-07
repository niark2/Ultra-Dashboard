/**
 * Direct Converter Module Test - Full Suite
 * Tests the conversion functions directly without HTTP/Auth
 * Creates synthetic test files for audio/video
 * Run with: node test-converter/test-direct.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { exec, execSync } = require('child_process');
const pandoc = require('pandoc-bin');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');

ffmpeg.setFfmpegPath(ffmpegPath);

const TEST_DIR = path.join(__dirname, 'files');
const OUTPUT_DIR = path.join(__dirname, 'output');
const RESULTS_FILE = path.join(__dirname, 'results.json');

const FORMATS = {
    image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tiff'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'],
    video: ['mp4', 'webm', 'avi', 'mov', 'mkv'],
    document: ['docx', 'txt', 'md', 'html', 'epub', 'odt', 'rtf', 'pdf']
};

const results = {
    success: [],
    failed: [],
    skipped: []
};

// Ensure directories exist
if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Create test files including audio/video using direct ffmpeg command
async function createTestFiles() {
    console.log('📁 Creating test files...\n');

    // Text files
    fs.writeFileSync(path.join(TEST_DIR, 'sample.txt'),
        'Hello World!\n\nThis is a test document.\n\n- Item 1\n- Item 2\n- Item 3');

    fs.writeFileSync(path.join(TEST_DIR, 'sample.md'),
        '# Test Document\n\nThis is **markdown** with _formatting_.\n\n## Section\n\n- List 1\n- List 2');

    fs.writeFileSync(path.join(TEST_DIR, 'sample.html'),
        '<!DOCTYPE html><html><body><h1>Test</h1><p>Hello <strong>World</strong></p></body></html>');

    // Create a simple test image (100x100 red square)
    await sharp({
        create: {
            width: 100,
            height: 100,
            channels: 3,
            background: { r: 255, g: 0, b: 0 }
        }
    }).png().toFile(path.join(TEST_DIR, 'sample.png'));

    // Create synthetic audio file using direct ffmpeg command
    const audioPath = path.join(TEST_DIR, 'sample.wav');
    if (!fs.existsSync(audioPath)) {
        console.log('   🎵 Generating test audio (1s sine wave)...');
        try {
            execSync(`"${ffmpegPath}" -y -f lavfi -i "sine=frequency=440:duration=1" -acodec pcm_s16le "${audioPath}"`, { stdio: 'pipe' });
            console.log('   ✅ Audio test file created');
        } catch (err) {
            console.log('   ⚠️  Audio generation failed:', err.message);
        }
    }

    // Create synthetic video file using direct ffmpeg command
    const videoPath = path.join(TEST_DIR, 'sample.mp4');
    if (!fs.existsSync(videoPath)) {
        console.log('   🎬 Generating test video (1s color test)...');
        try {
            execSync(`"${ffmpegPath}" -y -f lavfi -i "testsrc=duration=1:size=320x240:rate=30" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 1 -c:v libx264 -pix_fmt yuv420p -c:a aac "${videoPath}"`, { stdio: 'pipe' });
            console.log('   ✅ Video test file created');
        } catch (err) {
            console.log('   ⚠️  Video generation failed:', err.message);
        }
    }

    console.log('   ✅ All test files ready\n');
}

// Test image conversion
async function testImageConversion(srcFile, targetFormat, compress = false) {
    const testId = `${path.basename(srcFile)} → ${targetFormat}${compress ? ' (compress)' : ''}`;
    const outPath = path.join(OUTPUT_DIR, `test.${targetFormat}`);

    try {
        let sharpInstance = sharp(srcFile);
        const formatName = targetFormat === 'jpg' ? 'jpeg' : targetFormat;

        if (compress) {
            sharpInstance = sharpInstance.resize({ width: 80, height: 80, fit: 'inside' });
        }

        let opts = { quality: 75 };
        if (formatName === 'png') opts = { palette: true, quality: 75, compressionLevel: 9 };
        if (formatName === 'gif') opts = { colours: 128 };
        if (formatName === 'tiff') opts = { compression: 'lzw' };

        await sharpInstance.toFormat(formatName, opts).toFile(outPath);

        const size = fs.statSync(outPath).size;
        results.success.push(`${testId} (${Math.round(size / 1024)}KB)`);
        return true;
    } catch (err) {
        results.failed.push(`${testId}: ${err.message}`);
        return false;
    }
}

// Test document conversion via Pandoc
function testDocumentConversion(srcFile, targetFormat) {
    return new Promise((resolve) => {
        const testId = `${path.basename(srcFile)} → ${targetFormat}`;
        const outPath = path.join(OUTPUT_DIR, `test.${targetFormat}`);
        const srcExt = path.extname(srcFile).slice(1).toLowerCase();

        if (srcExt === targetFormat) {
            results.skipped.push(`${testId}: Same format`);
            return resolve(false);
        }

        const PANDOC_FORMATS = {
            'docx': 'docx', 'odt': 'odt',
            'md': 'markdown', 'html': 'html', 'txt': 'markdown',
            'rtf': 'rtf', 'epub': 'epub'
        };

        const inputFmt = PANDOC_FORMATS[srcExt] || 'markdown';
        const cmd = `"${pandoc.path}" "${srcFile}" -f ${inputFmt} -o "${outPath}"`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                if (stderr.includes('pdflatex') || stderr.includes('pdf-engine')) {
                    results.skipped.push(`${testId}: Requires LaTeX for PDF`);
                } else {
                    results.failed.push(`${testId}: ${stderr.substring(0, 100)}`);
                }
                resolve(false);
            } else {
                const size = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
                results.success.push(`${testId} (${Math.round(size / 1024)}KB)`);
                resolve(true);
            }
        });
    });
}

// Test PDF operations
async function testPDFConversion(pdfPath, targetFormat) {
    const testId = `PDF → ${targetFormat}`;
    const outPath = path.join(OUTPUT_DIR, `test.${targetFormat}`);

    try {
        if (targetFormat === 'pdf') {
            const pdfBytes = fs.readFileSync(pdfPath);
            const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
            fs.writeFileSync(outPath, compressedBytes);

            const origSize = pdfBytes.length;
            const newSize = compressedBytes.length;
            const reduction = ((1 - newSize / origSize) * 100).toFixed(1);
            results.success.push(`${testId} compression: ${Math.round(origSize / 1024)}KB → ${Math.round(newSize / 1024)}KB (${reduction}%)`);
            return true;
        } else {
            const dataBuffer = fs.readFileSync(pdfPath);
            const data = await pdfParse(dataBuffer);

            if (targetFormat === 'txt') {
                fs.writeFileSync(outPath, data.text);
                results.success.push(`${testId} (${Math.round(data.text.length / 1024)}KB text)`);
                return true;
            }

            const tempTxt = path.join(OUTPUT_DIR, 'temp-pdf.txt');
            fs.writeFileSync(tempTxt, data.text);
            return testDocumentConversion(tempTxt, targetFormat);
        }
    } catch (err) {
        results.failed.push(`${testId}: ${err.message}`);
        return false;
    }
}

// Test audio conversion
function testAudioConversion(srcFile, targetFormat, compress = false) {
    return new Promise((resolve) => {
        const srcExt = path.extname(srcFile).slice(1).toLowerCase();
        if (srcExt === targetFormat) {
            results.skipped.push(`${path.basename(srcFile)} → ${targetFormat}: Same format`);
            return resolve(false);
        }

        const testId = `${path.basename(srcFile)} → ${targetFormat}${compress ? ' (compress)' : ''}`;
        const outPath = path.join(OUTPUT_DIR, `test-audio.${targetFormat}`);

        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

        let cmd = ffmpeg(srcFile);

        switch (targetFormat) {
            case 'mp3': cmd = cmd.audioCodec('libmp3lame'); break;
            case 'aac': cmd = cmd.audioCodec('aac'); break;
            case 'm4a': cmd = cmd.audioCodec('aac').format('ipod'); break;
            case 'ogg': cmd = cmd.audioCodec('libvorbis'); break;
            case 'flac': cmd = cmd.audioCodec('flac'); break;
            case 'wav': cmd = cmd.audioCodec('pcm_s16le'); break;
        }

        if (compress) {
            cmd = cmd.audioBitrate('64k');
        }

        cmd.on('end', () => {
            const size = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
            results.success.push(`${testId} (${Math.round(size / 1024)}KB)`);
            resolve(true);
        })
            .on('error', (err) => {
                results.failed.push(`${testId}: ${err.message}`);
                resolve(false);
            })
            .save(outPath);
    });
}

// Test video conversion
function testVideoConversion(srcFile, targetFormat, compress = false) {
    return new Promise((resolve) => {
        const srcExt = path.extname(srcFile).slice(1).toLowerCase();
        if (srcExt === targetFormat) {
            results.skipped.push(`${path.basename(srcFile)} → ${targetFormat}: Same format`);
            return resolve(false);
        }

        const testId = `${path.basename(srcFile)} → ${targetFormat}${compress ? ' (compress)' : ''}`;
        const outPath = path.join(OUTPUT_DIR, `test-video.${targetFormat}`);

        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

        let cmd = ffmpeg(srcFile);

        switch (targetFormat) {
            case 'mp4':
                cmd = cmd.videoCodec('libx264').audioCodec('aac').outputOptions(['-pix_fmt yuv420p']);
                break;
            case 'webm':
                cmd = cmd.videoCodec('libvpx').audioCodec('libvorbis');
                break;
            case 'avi':
                cmd = cmd.videoCodec('mpeg4').audioCodec('aac');
                break;
            case 'mov':
                cmd = cmd.videoCodec('libx264').audioCodec('aac');
                break;
            case 'mkv':
                cmd = cmd.videoCodec('libx264').audioCodec('aac');
                break;
        }

        if (compress) {
            cmd = cmd.outputOptions(['-crf 28', '-preset ultrafast']);
        }

        cmd.on('end', () => {
            const size = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
            results.success.push(`${testId} (${Math.round(size / 1024)}KB)`);
            resolve(true);
        })
            .on('error', (err) => {
                results.failed.push(`${testId}: ${err.message}`);
                resolve(false);
            })
            .save(outPath);
    });
}

async function runAllTests() {
    console.log('═'.repeat(60));
    console.log('🧪 CONVERTER MODULE - Complete Test Suite');
    console.log('═'.repeat(60));
    console.log('');

    try {
        await createTestFiles();
    } catch (err) {
        console.error('❌ Failed to create test files:', err.message);
        return;
    }

    // ========== IMAGE TESTS ==========
    console.log('\n🖼️  IMAGE CONVERSIONS');
    console.log('─'.repeat(40));

    const imgSrc = path.join(TEST_DIR, 'sample.png');
    for (const fmt of FORMATS.image) {
        if (fmt === 'png') continue;
        process.stdout.write(`   png → ${fmt}... `);
        const ok = await testImageConversion(imgSrc, fmt);
        console.log(ok ? '✅' : '❌');
    }

    process.stdout.write(`   png → webp (compress)... `);
    const imgCompressOk = await testImageConversion(imgSrc, 'webp', true);
    console.log(imgCompressOk ? '✅' : '❌');

    // ========== DOCUMENT TESTS ==========
    console.log('\n\n📑 DOCUMENT CONVERSIONS');
    console.log('─'.repeat(40));

    const docSources = ['txt', 'md', 'html'];
    const docTargets = ['docx', 'odt', 'rtf', 'epub', 'html', 'md', 'txt'];

    for (const src of docSources) {
        const srcFile = path.join(TEST_DIR, `sample.${src}`);
        for (const target of docTargets) {
            if (src === target) continue;
            process.stdout.write(`   ${src} → ${target}... `);
            const ok = await testDocumentConversion(srcFile, target);
            console.log(ok ? '✅' : '❌');
        }
    }

    // ========== PDF TESTS ==========
    console.log('\n\n📄 PDF TESTS');
    console.log('─'.repeat(40));

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const pdfs = fs.existsSync(uploadsDir)
        ? fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'))
        : [];

    if (pdfs.length > 0) {
        const pdfPath = path.join(uploadsDir, pdfs[0]);

        process.stdout.write(`   PDF → txt... `);
        const pdfTxtOk = await testPDFConversion(pdfPath, 'txt');
        console.log(pdfTxtOk ? '✅' : '❌');

        process.stdout.write(`   PDF compression... `);
        const pdfCompressOk = await testPDFConversion(pdfPath, 'pdf');
        console.log(pdfCompressOk ? '✅' : '❌');
    } else {
        console.log('   ⚠️  No PDF files in uploads/ for testing');
        results.skipped.push('PDF: No test file');
    }

    // ========== AUDIO TESTS ==========
    console.log('\n\n🎵 AUDIO CONVERSIONS');
    console.log('─'.repeat(40));

    const audioSrc = path.join(TEST_DIR, 'sample.wav');
    if (fs.existsSync(audioSrc)) {
        for (const fmt of FORMATS.audio) {
            if (fmt === 'wav') continue;
            process.stdout.write(`   wav → ${fmt}... `);
            const ok = await testAudioConversion(audioSrc, fmt);
            console.log(ok ? '✅' : '❌');
        }

        process.stdout.write(`   wav → mp3 (compress)... `);
        const audioCompressOk = await testAudioConversion(audioSrc, 'mp3', true);
        console.log(audioCompressOk ? '✅' : '❌');
    } else {
        console.log('   ⚠️  Audio test file not found');
        results.skipped.push('Audio: Test file not found');
    }

    // ========== VIDEO TESTS ==========
    console.log('\n\n🎬 VIDEO CONVERSIONS');
    console.log('─'.repeat(40));

    const videoSrc = path.join(TEST_DIR, 'sample.mp4');
    if (fs.existsSync(videoSrc)) {
        for (const fmt of FORMATS.video) {
            if (fmt === 'mp4') continue;
            process.stdout.write(`   mp4 → ${fmt}... `);
            const ok = await testVideoConversion(videoSrc, fmt);
            console.log(ok ? '✅' : '❌');
        }

        process.stdout.write(`   mp4 → webm (compress)... `);
        const videoCompressOk = await testVideoConversion(videoSrc, 'webm', true);
        console.log(videoCompressOk ? '✅' : '❌');
    } else {
        console.log('   ⚠️  Video test file not found');
        results.skipped.push('Video: Test file not found');
    }

    // ========== SUMMARY ==========
    console.log('\n\n' + '═'.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('═'.repeat(60));

    console.log(`\n✅ PASSED: ${results.success.length}`);
    results.success.forEach(s => console.log(`   • ${s}`));

    console.log(`\n❌ FAILED: ${results.failed.length}`);
    results.failed.forEach(f => console.log(`   • ${f}`));

    console.log(`\n⏭️  SKIPPED: ${results.skipped.length}`);
    results.skipped.forEach(s => console.log(`   • ${s}`));

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`\n📝 Results saved to: ${RESULTS_FILE}`);

    const total = results.success.length + results.failed.length;
    const score = total > 0 ? Math.round((results.success.length / total) * 100) : 0;
    console.log(`\n🎯 Score: ${score}% (${results.success.length}/${total} tests passed)`);

    // Cleanup
    console.log('\n🧹 Cleaning up test outputs...');
    fs.readdirSync(OUTPUT_DIR).forEach(f => {
        try { fs.unlinkSync(path.join(OUTPUT_DIR, f)); } catch { }
    });
}

runAllTests().catch(console.error);
