/**
 * Test Script for Converter Module
 * Run with: node test-converter/test-converter.js
 * 
 * Tests all conversion combinations with proper session authentication
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
const TEST_DIR = path.join(__dirname, 'files');
const RESULTS_FILE = path.join(__dirname, 'results.json');

// Formats from controller
const FORMATS = {
    image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'bmp', 'ico'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'],
    video: ['mp4', 'webm', 'avi', 'mov', 'mkv'],
    document: ['docx', 'txt', 'md', 'html', 'epub', 'odt', 'rtf', 'pdf']
};

/** @type {{success: string[], failed: string[], skipped: string[]}} */
const results = {
    success: [],
    failed: [],
    skipped: []
};

let sessionCookie = '';

// HTTP request helper
function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                ...(options.headers || {}),
                'Cookie': sessionCookie
            }
        };

        const req = http.request(reqOptions, (res) => {
            // Save session cookie
            if (res.headers['set-cookie']) {
                sessionCookie = res.headers['set-cookie']
                    .map(c => c.split(';')[0])
                    .join('; ');
            }

            let data = Buffer.alloc(0);
            res.on('data', chunk => { data = Buffer.concat([data, chunk]); });
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    headers: res.headers,
                    buffer: () => Promise.resolve(data),
                    json: () => {
                        try {
                            return Promise.resolve(JSON.parse(data.toString()));
                        } catch {
                            return Promise.reject(new Error('Invalid JSON'));
                        }
                    },
                    text: () => Promise.resolve(data.toString())
                });
            });
        });

        req.on('error', reject);

        if (options.body) {
            if (options.body.pipe) {
                // FormData
                options.body.pipe(req);
            } else {
                req.write(options.body);
                req.end();
            }
        } else {
            req.end();
        }
    });
}

async function authenticate() {
    console.log('🔐 Authenticating...');

    // Check current auth status
    const statusRes = await httpRequest(`${BASE_URL}/api/auth/status`);
    const status = await statusRes.json();

    if (status.authenticated) {
        console.log('✅ Already authenticated');
        return true;
    }

    // Try to login with test credentials
    const loginRes = await httpRequest(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin' })
    });

    if (loginRes.ok) {
        console.log('✅ Logged in as admin');
        return true;
    }

    // Check if needs setup
    if (status.needsSetup) {
        console.log('📝 Creating temp admin account...');
        const setupRes = await httpRequest(`${BASE_URL}/api/auth/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });

        if (setupRes.ok) {
            // Login with new account
            const loginRes2 = await httpRequest(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'admin' })
            });
            if (loginRes2.ok) {
                console.log('✅ Created and logged in as admin');
                return true;
            }
        }
    }

    console.log('⚠️ Could not authenticate. Please login manually in browser first.');
    console.log('   Or create an account via the setup page.');
    return false;
}

function createTestFiles() {
    if (!fs.existsSync(TEST_DIR)) {
        fs.mkdirSync(TEST_DIR, { recursive: true });
    }

    fs.writeFileSync(path.join(TEST_DIR, 'sample.txt'),
        'Hello! This is a test document for conversion testing.\n\nIt contains multiple paragraphs.\n\n- Item 1\n- Item 2\n- Item 3');

    fs.writeFileSync(path.join(TEST_DIR, 'sample.md'),
        '# Test Document\n\nThis is a **markdown** file with _formatting_.\n\n## Section 2\n\n- List item 1\n- List item 2\n\n```javascript\nconsole.log("Hello World");\n```');

    fs.writeFileSync(path.join(TEST_DIR, 'sample.html'),
        '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Test Document</h1><p>This is a <strong>test</strong> HTML file.</p><ul><li>Item 1</li><li>Item 2</li></ul></body></html>');

    console.log('📁 Test files created in:', TEST_DIR);
}

async function testConversion(inputFile, targetFormat, compress = false) {
    const testId = `${path.basename(inputFile)} → ${targetFormat}${compress ? ' (compressed)' : ''}`;

    if (!fs.existsSync(inputFile)) {
        results.skipped.push(`${testId}: Source file not found`);
        return { success: false, skipped: true };
    }

    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(inputFile));
        form.append('targetFormat', targetFormat);
        form.append('compress', compress.toString());
        form.append('quality', '75');

        const response = await httpRequest(`${BASE_URL}/api/convert`, {
            method: 'POST',
            headers: {
                ...form.getHeaders(),
                'Cookie': sessionCookie
            },
            body: form
        });

        if (!response.ok) {
            let errorMsg = `HTTP ${response.status}`;
            try {
                const error = await response.json();
                errorMsg = error.error || errorMsg;
            } catch { }
            results.failed.push(`${testId}: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }

        const buffer = await response.buffer();
        const sizePart = buffer.length > 0 ? `${Math.round(buffer.length / 1024)}KB` : 'OK';
        results.success.push(`${testId} (${sizePart})`);
        return { success: true };

    } catch (err) {
        results.failed.push(`${testId}: ${err.message}`);
        return { success: false, error: err.message };
    }
}

async function testCategoryConversions(category, extensions, testFile) {
    console.log(`\n📂 Testing ${category}...`);

    if (!fs.existsSync(testFile)) {
        console.log(`   ⏭️ Skipping: No test file`);
        results.skipped.push(`${category}: No test file available`);
        return;
    }

    for (const targetExt of extensions) {
        const sourceExt = path.extname(testFile).slice(1).toLowerCase();
        if (sourceExt === targetExt) continue;

        process.stdout.write(`   ${sourceExt} → ${targetExt}... `);
        const result = await testConversion(testFile, targetExt);
        console.log(result.success ? '✅' : (result.skipped ? '⏭️' : `❌ ${result.error || ''}`));

        await new Promise(r => setTimeout(r, 300));
    }
}

async function testCompression(testFile, formatName) {
    console.log(`\n🗜️ Testing compression: ${formatName}...`);

    if (!fs.existsSync(testFile)) {
        console.log(`   ⏭️ Skipping: No test file`);
        results.skipped.push(`Compression ${formatName}: No test file`);
        return;
    }

    const sourceExt = path.extname(testFile).slice(1).toLowerCase();
    process.stdout.write(`   ${sourceExt} compression... `);
    const result = await testConversion(testFile, sourceExt, true);
    console.log(result.success ? '✅' : `❌ ${result.error || ''}`);
}

async function runAllTests() {
    console.log('═'.repeat(60));
    console.log('🧪 ULTRA DASHBOARD - Converter Module Test Suite');
    console.log('═'.repeat(60));

    // Check server
    try {
        await httpRequest(`${BASE_URL}/api/auth/status`);
        console.log('✅ Server is accessible\n');
    } catch (e) {
        console.error(`❌ Cannot connect to server at ${BASE_URL}`);
        console.error('   Make sure the server is running (npm run dev)');
        return;
    }

    // Authenticate
    const authOk = await authenticate();
    if (!authOk) {
        console.error('❌ Authentication failed. Cannot proceed with tests.');
        return;
    }

    createTestFiles();

    // ========== DOCUMENT TESTS ==========
    console.log('\n\n📑 DOCUMENT CONVERSIONS');
    console.log('─'.repeat(40));

    await testCategoryConversions('TXT → others', FORMATS.document, path.join(TEST_DIR, 'sample.txt'));
    await testCategoryConversions('MD → others', FORMATS.document, path.join(TEST_DIR, 'sample.md'));
    await testCategoryConversions('HTML → others', FORMATS.document, path.join(TEST_DIR, 'sample.html'));

    // ========== IMAGE TESTS ==========
    console.log('\n\n🖼️ IMAGE CONVERSIONS');
    console.log('─'.repeat(40));

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const existingImages = fs.existsSync(uploadsDir)
        ? fs.readdirSync(uploadsDir).filter(f => FORMATS.image.some(ext => f.toLowerCase().endsWith('.' + ext)))
        : [];

    if (existingImages.length > 0) {
        const imgTestFile = path.join(uploadsDir, existingImages[0]);
        await testCategoryConversions('Image conversions', FORMATS.image, imgTestFile);
        await testCompression(imgTestFile, 'image');
    } else {
        console.log('   ⚠️ No image files found in uploads/ for testing');
        results.skipped.push('Image conversions: No test files');
    }

    // ========== PDF TESTS ==========
    console.log('\n\n📄 PDF TESTS');
    console.log('─'.repeat(40));

    const existingPDFs = fs.existsSync(uploadsDir)
        ? fs.readdirSync(uploadsDir).filter(f => f.toLowerCase().endsWith('.pdf'))
        : [];

    if (existingPDFs.length > 0) {
        const pdfTestFile = path.join(uploadsDir, existingPDFs[0]);

        for (const targetExt of ['txt', 'md', 'html', 'docx']) {
            process.stdout.write(`   pdf → ${targetExt}... `);
            const result = await testConversion(pdfTestFile, targetExt);
            console.log(result.success ? '✅' : `❌ ${result.error || ''}`);
            await new Promise(r => setTimeout(r, 300));
        }

        await testCompression(pdfTestFile, 'pdf');
    } else {
        console.log('   ⚠️ No PDF files found in uploads/ for testing');
        results.skipped.push('PDF conversions: No test files');
    }

    // ========== AUDIO TESTS ==========
    console.log('\n\n🎵 AUDIO CONVERSIONS');
    console.log('─'.repeat(40));

    const existingAudio = fs.existsSync(uploadsDir)
        ? fs.readdirSync(uploadsDir).filter(f => FORMATS.audio.some(ext => f.toLowerCase().endsWith('.' + ext)))
        : [];

    if (existingAudio.length > 0) {
        const audioTestFile = path.join(uploadsDir, existingAudio[0]);
        await testCategoryConversions('Audio conversions', FORMATS.audio, audioTestFile);
        await testCompression(audioTestFile, 'audio');
    } else {
        console.log('   ⚠️ No audio files found - upload an MP3/WAV to test');
        results.skipped.push('Audio conversions: No test files');
    }

    // ========== VIDEO TESTS ==========
    console.log('\n\n🎬 VIDEO CONVERSIONS');
    console.log('─'.repeat(40));

    const existingVideo = fs.existsSync(uploadsDir)
        ? fs.readdirSync(uploadsDir).filter(f => FORMATS.video.some(ext => f.toLowerCase().endsWith('.' + ext)))
        : [];

    if (existingVideo.length > 0) {
        const videoTestFile = path.join(uploadsDir, existingVideo[0]);
        await testCategoryConversions('Video conversions', FORMATS.video, videoTestFile);
        await testCompression(videoTestFile, 'video');
    } else {
        console.log('   ⚠️ No video files found - upload an MP4 to test');
        results.skipped.push('Video conversions: No test files');
    }

    // ========== SUMMARY ==========
    console.log('\n\n' + '═'.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('═'.repeat(60));

    console.log(`\n✅ PASSED: ${results.success.length}`);
    results.success.forEach(s => console.log(`   • ${s}`));

    console.log(`\n❌ FAILED: ${results.failed.length}`);
    results.failed.forEach(f => console.log(`   • ${f}`));

    console.log(`\n⏭️ SKIPPED: ${results.skipped.length}`);
    results.skipped.forEach(s => console.log(`   • ${s}`));

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`\n📝 Full results saved to: ${RESULTS_FILE}`);

    const total = results.success.length + results.failed.length;
    const score = total > 0 ? Math.round((results.success.length / total) * 100) : 0;
    console.log(`\n🎯 Score: ${score}% (${results.success.length}/${total} tests passed)`);
}

runAllTests().catch(console.error);
