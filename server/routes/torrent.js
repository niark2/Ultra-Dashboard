const express = require('express');
const router = express.Router();
// Use dynamic import for node-fetch v3 (ESM-only) in a CJS project
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Configuration
const QBIT_URL = process.env.QBIT_URL || 'http://localhost:6000';

// Proxy helper
const proxyRequest = async (method, path, body, headers = {}) => {
    try {
        const url = `${QBIT_URL}${path}`;
        const options = {
            method,
            headers: {
                // Forward content type if present
                ...(headers['content-type'] ? { 'Content-Type': headers['content-type'] } : {}),
                // Forward cookie if present (important for auth)
                ...(headers.cookie ? { Cookie: headers.cookie } : {})
            }
        };

        if (body) {
            // If body is form-data (file upload), we might need special handling
            // But for simple texts/json, just pass it.
            // qBittorrent uses x-www-form-urlencoded often for simple commands
            if (headers['content-type'] && headers['content-type'].includes('application/x-www-form-urlencoded')) {
                options.body = new URLSearchParams(body);
            } else {
                options.body = JSON.stringify(body);
            }
        }

        const response = await fetch(url, options);
        return response;
    } catch (error) {
        console.error(`Proxy Error [${path}]:`, error);
        throw error;
    }
};

// Login
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // qBittorrent exprects form-urlencoded for login
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);

        const response = await fetch(`${QBIT_URL}/api/v2/auth/login`, {
            method: 'POST',
            body: params
        });

        const text = await response.text();

        // Forward set-cookie header
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            res.setHeader('Set-Cookie', setCookie);
        }

        if (text === 'Ok.') {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Login failed' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Torrents List
router.get('/list', async (req, res) => {
    try {
        const response = await proxyRequest('GET', '/api/v2/torrents/info', null, req.headers);
        if (response.status === 403) return res.status(403).json({ error: 'Auth required' });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Add Torrent (Magnet)
router.post('/add', async (req, res) => {
    try {
        const { urls } = req.body;
        const params = new URLSearchParams();
        params.append('urls', urls);

        // qBittorrent expects form-urlencoded for simple magnet add
        const addResponse = await fetch(`${QBIT_URL}/api/v2/torrents/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {})
            },
            body: params
        });

        res.send(await addResponse.text());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add Torrent (File)
router.post('/add-file', upload.single('torrents'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier reçu' });
        }

        const formData = new FormData();
        // Forward the file as a Blob/File
        const blob = new Blob([req.file.buffer], { type: 'application/x-bittorrent' });
        formData.append('torrents', blob, req.file.originalname);

        const response = await fetch(`${QBIT_URL}/api/v2/torrents/add`, {
            method: 'POST',
            headers: {
                ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {})
            },
            body: formData
        });

        const text = await response.text();
        if (text === 'Ok.') {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: text });
        }
    } catch (error) {
        console.error('Torrent File Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Pause
router.post('/pause', async (req, res) => {
    try {
        const { hashes } = req.body; // usually "hash1|hash2"
        const params = new URLSearchParams();
        params.append('hashes', hashes);

        await fetch(`${QBIT_URL}/api/v2/torrents/pause`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {})
            },
            body: params
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Resume
router.post('/resume', async (req, res) => {
    try {
        const { hashes } = req.body;
        const params = new URLSearchParams();
        params.append('hashes', hashes);

        await fetch(`${QBIT_URL}/api/v2/torrents/resume`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {})
            },
            body: params
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete
router.post('/delete', async (req, res) => {
    try {
        const { hashes, deleteFiles } = req.body;
        const params = new URLSearchParams();
        params.append('hashes', hashes);
        if (deleteFiles) params.append('deleteFiles', 'true');

        await fetch(`${QBIT_URL}/api/v2/torrents/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {})
            },
            body: params
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
