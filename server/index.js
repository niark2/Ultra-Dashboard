const express = require('express');
require('dotenv').config();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const session = require('express-session');

const LOCK_FILE = path.join(__dirname, '../server.lock');

// --- PROTECTION ANTI-DOUBLON ---
if (fs.existsSync(LOCK_FILE)) {
    try {
        const oldPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'));
        process.kill(oldPid, 0);
        console.error(`\n❌ [ERREUR] Ultra Dashboard est déjà lancé (PID: ${oldPid}).`);
        process.exit(1);
    } catch (e) {
        try { fs.unlinkSync(LOCK_FILE); } catch (err) { }
    }
}
fs.writeFileSync(LOCK_FILE, process.pid.toString());

const removeLock = () => {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'));
            if (pid === process.pid) fs.unlinkSync(LOCK_FILE);
        }
    } catch (err) { }
};

const convertRoutes = require('./routes/convert');
const youtubeRoutes = require('./routes/youtube');
const rembgRoutes = require('./routes/rembg');
const sttRoutes = require('./routes/stt');
const upscaleRoutes = require('./routes/upscale');
const chatRoutes = require('./routes/chat');
const metadataRoutes = require('./routes/metadata');
const torrentRoutes = require('./routes/torrent');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');
const socialRoutes = require('./routes/social');
const plexusRoutes = require('./routes/plexus');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Nginx
app.set('trust proxy', 1);

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'ultra-secret-default-change-me',
    resave: false,
    saveUninitialized: false,
    name: 'ultra.sid',
    cookie: {
        secure: process.env.NODE_ENV === 'production' && process.env.USE_HTTPS === 'true',
        maxAge: 24 * 60 * 60 * 1000, // 24h
        sameSite: 'lax'
    }
}));

// Auth middleware
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Authentification requise' });
    }
};

// Python service management
const pythonProcesses = new Map();
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

function startPythonServer(name, scriptName) {
    const pythonScript = path.join(__dirname, 'python', scriptName);
    if (!fs.existsSync(pythonScript)) return;

    const proc = spawn(PYTHON_CMD, [pythonScript], {
        cwd: path.join(__dirname, 'python'),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let isReady = false;
    proc.stdout.on('data', (data) => {
        if (!isReady && data.toString().includes('http://localhost')) {
            console.log(`✅ ${name} service is ready`);
            isReady = true;
        }
    });
    proc.stderr.on('data', (data) => {
        console.error(`[${name} STDERR] ${data.toString().trim()}`);
    });
    proc.on('close', () => pythonProcesses.delete(name));

    pythonProcesses.set(name, proc);
}

function stopPythonServers() {
    for (const [name, proc] of pythonProcesses) {
        proc.kill();
    }
    pythonProcesses.clear();
}

const gracefulShutdown = () => {
    stopPythonServers();
    removeLock();
    server.close(() => process.exit(0));
    setTimeout(() => { removeLock(); process.exit(1); }, 5000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Pass environment flag to all views
const isProd = process.env.NODE_ENV === 'production';
app.use((req, res, next) => {
    res.locals.isProd = isProd;
    next();
});

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Auth Routes Publics
app.use('/api/auth', authRoutes);

// Protected API Routes
app.use('/api/convert', requireAuth, convertRoutes);
app.use('/api/youtube', requireAuth, youtubeRoutes);
app.use('/api/rembg', requireAuth, rembgRoutes);
app.use('/api/stt', requireAuth, sttRoutes);
app.use('/api/upscale', requireAuth, upscaleRoutes);
app.use('/api/chat', requireAuth, chatRoutes);
app.use('/api/metadata', requireAuth, metadataRoutes);
app.use('/api/torrent', requireAuth, torrentRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/social', requireAuth, socialRoutes);
app.use('/api/plexus', requireAuth, plexusRoutes);
app.use('/api/databank', requireAuth, require('./routes/databank'));

// Health status for settings
app.get('/api/status/health', requireAuth, async (req, res) => {
    const userId = req.session.user.id;
    const db = require('./lib/db');
    const services = [
        { name: 'REMBG', url: db.getConfigValue('REMBG_URL', userId, 'http://localhost:5100') },
        { name: 'Whisper', url: db.getConfigValue('WHISPER_URL', userId, 'http://localhost:5200') },
        { name: 'Upscale', url: db.getConfigValue('UPSCALE_URL', userId, 'http://localhost:5300') },
        { name: 'SearXNG', url: db.getConfigValue('SEARXNG_URL', userId, process.env.SEARXNG_URL || 'http://localhost:8080') }
    ];

    const results = await Promise.all(services.map(async (s) => {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(`${s.url}/health`, { signal: controller.signal });
            clearTimeout(id);

            if (response.ok) {
                const data = await response.json();
                return { name: s.name, status: 'online', details: data };
            }
            return { name: s.name, status: 'error', error: 'Response not OK' };
        } catch (err) {
            return { name: s.name, status: 'offline', error: err.message };
        }
    }));

    res.json({
        services: results,
        system: {
            uptime: Math.floor(process.uptime()),
            platform: process.platform,
            nodeVersion: process.version,
            memory: process.memoryUsage()
        }
    });
});

app.get('/', (req, res) => res.render('index'));
app.use((req, res) => res.status(404).render('404'));

const http = require('http');
const server = http.createServer(app);

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ [ERREUR] Le port ${PORT} est déjà utilisé.`);
        removeLock();
        process.exit(1);
    }
});

const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const clients = new Map();
const os = require('os');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return '127.0.0.1';
}

const SERVER_IP = getLocalIP();

io.on('connection', (socket) => {
    const animals = ['Dauphin', 'Tigre', 'Aigle', 'Panda', 'Renard', 'Lion', 'Ours', 'Loup', 'Chat', 'Chien'];
    const colors = ['Bleu', 'Vert', 'Rouge', 'Jaune', 'Violet', 'Orange', 'Rose', 'Cyan'];
    const name = `${colors[Math.floor(Math.random() * colors.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`;
    const client = { id: socket.id, name: name, ip: socket.handshake.address, serverIp: SERVER_IP };
    clients.set(socket.id, client);
    socket.emit('init', client);
    socket.broadcast.emit('client-connected', client);
    socket.emit('clients-list', Array.from(clients.values()).filter(c => c.id !== socket.id));
    socket.on('signal', ({ to, signal, from }) => io.to(to).emit('signal', { from, signal }));
    socket.on('disconnect', () => { clients.delete(socket.id); io.emit('client-disconnected', socket.id); });
});

server.listen(PORT, () => {
    console.log(`🚀 Ultra Dashboard running at http://localhost:${PORT}`);
    startPythonServer('REMBG', 'rembg_server.py');
    startPythonServer('Whisper', 'whisper_server.py');
    startPythonServer('Upscale', 'upscale_server.py');
});
