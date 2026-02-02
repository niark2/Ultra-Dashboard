const express = require('express');
require('dotenv').config(); // Note: environment-specific tips are usually controlled by the package version.
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const convertRoutes = require('./routes/convert');
const youtubeRoutes = require('./routes/youtube');
const rembgRoutes = require('./routes/rembg');
const sttRoutes = require('./routes/stt');
const upscaleRoutes = require('./routes/upscale');
const chatRoutes = require('./routes/chat');
const metadataRoutes = require('./routes/metadata');
const torrentRoutes = require('./routes/torrent');


const app = express();
const PORT = process.env.PORT || 3000;

// Référence aux processus Python
let rembgProcess = null;
let whisperProcess = null;
let upscaleProcess = null;

/**
 * Démarre le serveur Python REMBG automatiquement
 */
function startRembgServer() {
    const pythonScript = path.join(__dirname, 'python', 'rembg_server.py');
    if (!fs.existsSync(pythonScript)) return;

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    rembgProcess = spawn(pythonCmd, [pythonScript], { cwd: path.join(__dirname, 'python'), stdio: ['ignore', 'pipe', 'pipe'] });

    let rembgReady = false;
    rembgProcess.stdout.on('data', (data) => {
        if (!rembgReady && data.toString().includes('http://localhost')) {
            console.log('✅ REMBG service is ready');
            rembgReady = true;
        }
    });

    rembgProcess.stderr.on('data', (data) => {
        const msg = data.toString().toLowerCase();
        if (msg.includes('error') || msg.includes('exception')) console.error(`❌ REMBG Error: ${msg.trim()}`);
    });

    rembgProcess.on('close', (code) => { rembgProcess = null; });
}

/**
 * Démarre le serveur Python Whisper automatiquement
 */
function startWhisperServer() {
    const pythonScript = path.join(__dirname, 'python', 'whisper_server.py');
    if (!fs.existsSync(pythonScript)) return;

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    whisperProcess = spawn(pythonCmd, [pythonScript], { cwd: path.join(__dirname, 'python'), stdio: ['ignore', 'pipe', 'pipe'] });

    let whisperReady = false;
    whisperProcess.stdout.on('data', (data) => {
        if (!whisperReady && data.toString().includes('http://localhost')) {
            console.log('✅ Whisper service is ready');
            whisperReady = true;
        }
    });

    whisperProcess.stderr.on('data', (data) => {
        const msg = data.toString().toLowerCase();
        if (msg.includes('error') || msg.includes('exception')) console.error(`❌ Whisper Error: ${msg.trim()}`);
    });

    whisperProcess.on('close', (code) => { whisperProcess = null; });
}

/**
 * Démarre le serveur Python AI Upscale automatiquement
 */
function startUpscaleServer() {
    const pythonScript = path.join(__dirname, 'python', 'upscale_server.py');
    if (!fs.existsSync(pythonScript)) return;

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    upscaleProcess = spawn(pythonCmd, [pythonScript], { cwd: path.join(__dirname, 'python'), stdio: ['ignore', 'pipe', 'pipe'] });

    let upscaleReady = false;
    upscaleProcess.stdout.on('data', (data) => {
        if (!upscaleReady && data.toString().includes('http://localhost')) {
            console.log('✅ Upscale service is ready');
            upscaleReady = true;
        }
    });

    upscaleProcess.stderr.on('data', (data) => {
        const msg = data.toString().toLowerCase();
        if (msg.includes('error') || msg.includes('exception')) console.error(`❌ Upscale Error: ${msg.trim()}`);
    });

    upscaleProcess.on('close', (code) => { upscaleProcess = null; });
}

/**
 * Arrête proprement les serveurs Python
 */
function stopPythonServers() {
    if (rembgProcess) {
        console.log('🛑 REMBG: Arrêt du serveur Python...');
        rembgProcess.kill();
        rembgProcess = null;
    }
    if (whisperProcess) {
        console.log('🛑 Whisper: Arrêt du serveur Python...');
        whisperProcess.kill();
        whisperProcess = null;
    }
    if (upscaleProcess) {
        console.log('🛑 Upscale: Arrêt du serveur Python...');
        upscaleProcess.kill();
        upscaleProcess = null;
    }
}

// Gestion de la fermeture propre
const gracefulShutdown = () => {
    console.log('🛑 Arrêt du serveur...');

    stopPythonServers();

    server.close(() => {
        console.log('✅ Serveur HTTP fermé');
        process.exit(0);
    });

    // Forcer la fermeture si elle prend trop de temps (ex: connexions persistantes)
    setTimeout(() => {
        console.error('⚠️ Forçage de l\'arrêt après délai');
        process.exit(1);
    }, 5000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));


// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Routes API
app.use('/api/convert', convertRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/rembg', rembgRoutes);
app.use('/api/stt', sttRoutes);
app.use('/api/upscale', upscaleRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/torrent', torrentRoutes);


// Route principale (EJS)
app.get('/', (req, res) => {
    res.render('index');
});

// Middleware 404 (EJS)
app.use((req, res) => {
    res.status(404).render('404');
});

// Démarrage serveur
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Gestion des sockets pour LocalDrop
const clients = new Map();
const os = require('os');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const SERVER_IP = getLocalIP();

io.on('connection', (socket) => {
    // Générer un nom d'animal pour l'utilisateur
    const animals = ['Dauphin', 'Tigre', 'Aigle', 'Panda', 'Renard', 'Lion', 'Ours', 'Loup', 'Chat', 'Chien'];
    const colors = ['Bleu', 'Vert', 'Rouge', 'Jaune', 'Violet', 'Orange', 'Rose', 'Cyan'];
    const name = `${colors[Math.floor(Math.random() * colors.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`;

    const client = {
        id: socket.id,
        name: name,
        ip: socket.handshake.address,
        serverIp: SERVER_IP
    };

    clients.set(socket.id, client);
    console.log(`📡 Nouveau client LocalDrop: ${name} (${socket.id})`);

    // Envoyer l'ID actuel au client avec l'IP réelle du serveur
    socket.emit('init', client);

    // Notifier les autres de la nouvelle connexion
    socket.broadcast.emit('client-connected', client);

    // Envoyer la liste des clients déjà connectés
    socket.emit('clients-list', Array.from(clients.values()).filter(c => c.id !== socket.id));

    // Signalling WebRTC
    socket.on('signal', ({ to, signal, from }) => {
        io.to(to).emit('signal', { from, signal });
    });

    socket.on('disconnect', () => {
        clients.delete(socket.id);
        io.emit('client-disconnected', socket.id);
        console.log(`🔌 Client déconnecté: ${name}`);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Ultra Dashboard running at http://localhost:${PORT}`);

    // Démarrer les serveurs Python automatiquement
    startRembgServer();
    startWhisperServer();
    startUpscaleServer();
});
