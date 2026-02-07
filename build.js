/**
 * Build script for Ultra Dashboard
 * Bundles and minifies CSS + JS for production
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PUBLIC_DIR = path.join(__dirname, 'public');
const CSS_DIR = path.join(PUBLIC_DIR, 'css');
const JS_DIR = path.join(PUBLIC_DIR, 'js');
const DIST_DIR = path.join(PUBLIC_DIR, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
}

// CSS files to bundle (in order)
const CSS_FILES = [
    'base/_variables.css',
    'base/_reset.css',
    'layout/_sidebar.css',
    'layout/_main-content.css',
    'components/_buttons.css',
    'components/_badges.css',
    'components/_forms.css',
    'components/_cards.css',
    'components/_empty-state.css',
    'modules/_home.css',
    'modules/_converter.css',
    'modules/_rembg.css',
    'modules/_upscale.css',
    'modules/_stt.css',
    'modules/_toolbox.css',
    'modules/_metadata.css',
    'modules/_localdrop.css',
    'modules/_settings.css',
    'modules/_chat.css',
    'modules/_plexus.css',
    'modules/_databank.css',
    'utils/_states.css',
    'utils/_utilities.css',
    'utils/_animations.css',
    'utils/_responsive.css',
    'youtube.css',
    'torrent.css'
];

function buildCSS() {
    console.log('📦 Building CSS bundle...');

    let bundledCSS = '/* Ultra Dashboard - Bundled CSS */\n';

    for (const file of CSS_FILES) {
        const filePath = path.join(CSS_DIR, file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            // Remove @import statements (already bundled)
            const cleanContent = content.replace(/@import\s+url\([^)]+\);?\s*/g, '');
            bundledCSS += `\n/* === ${file} === */\n${cleanContent}\n`;
        } else {
            console.warn(`⚠️ CSS file not found: ${file}`);
        }
    }

    // Minify CSS (simple minification)
    const minifiedCSS = bundledCSS
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ')              // Collapse whitespace
        .replace(/\s*{\s*/g, '{')          // Clean braces
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*;\s*/g, ';')
        .replace(/\s*:\s*/g, ':')
        .replace(/\s*,\s*/g, ',')
        .trim();

    fs.writeFileSync(path.join(DIST_DIR, 'bundle.css'), bundledCSS);
    fs.writeFileSync(path.join(DIST_DIR, 'bundle.min.css'), minifiedCSS);

    const originalSize = Buffer.byteLength(bundledCSS, 'utf8');
    const minifiedSize = Buffer.byteLength(minifiedCSS, 'utf8');
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    console.log(`✅ CSS bundled: ${(originalSize / 1024).toFixed(1)}KB → ${(minifiedSize / 1024).toFixed(1)}KB (${savings}% saved)`);
}

function buildJS() {
    console.log('📦 Building JS bundle with esbuild...');

    try {
        const entryPoint = path.join(JS_DIR, 'app.js');
        const outfile = path.join(DIST_DIR, 'bundle.min.js');
        // Quoting paths to support spaces in directory names
        execSync(`npx esbuild "${entryPoint}" --bundle --minify --format=esm --outfile="${outfile}"`, {
            stdio: 'inherit',
            cwd: __dirname
        });
        console.log('✅ JS bundled successfully');
    } catch (error) {
        console.error('❌ JS bundling failed:', error.message);
        console.log('💡 Make sure esbuild is installed: npm install -D esbuild');
    }
}

console.log('🔨 Ultra Dashboard Build\n');
buildCSS();
buildJS();
console.log('\n✨ Build complete!');
