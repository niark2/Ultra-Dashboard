const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../lib/db');

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });

    try {
        const user = db.getUser(username);
        if (!user) return res.status(401).json({ error: 'Utilisateur non trouvé' });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Mot de passe incorrect' });

        req.session.user = { id: user.id, username: user.username };
        res.json({ success: true, user: req.session.user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check status
router.get('/status', (req, res) => {
    const needsSetup = db.countUsers() === 0;
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user, needsSetup });
    } else {
        res.json({ authenticated: false, needsSetup });
    }
});

// Register new user
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Pseudo et mot de passe requis' });

    try {
        const existingUser = db.getUser(username);
        if (existingUser) return res.status(400).json({ error: 'Ce nom d\'utilisateur est déjà pris' });

        const hashedPassword = await bcrypt.hash(password, 10);
        db.createUser(username, hashedPassword);

        // Auto-login after registration
        const user = db.getUser(username);
        req.session.user = { id: user.id, username: user.username };

        res.json({ success: true, message: 'Compte créé avec succès', user: req.session.user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Setup initial user (admin)
router.post('/setup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Pseudo et mot de passe requis' });

    try {
        if (db.countUsers() > 0) {
            return res.status(403).json({ error: 'Le système est déjà configuré' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        db.createUser(username, hashedPassword);

        // Auto-login after setup
        const user = db.getUser(username);
        req.session.user = { id: user.id, username: user.username };

        res.json({ success: true, message: 'Administrateur créé', user: req.session.user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change password
router.post('/change-password', async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    try {
        const user = db.getUser(username);
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

        // Hash new password and update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.updateUserPassword(username, hashedPassword);

        res.json({ success: true, message: 'Mot de passe mis à jour avec succès' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
