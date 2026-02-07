const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/database.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// --- MIGRATION & INIT ---

// 1. USERS
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    );
`);

// 2. SETTINGS
// Check if settings table exists and has user_id
let settingsColumns = [];
try {
    settingsColumns = db.prepare("PRAGMA table_info(settings)").all();
} catch (e) { }

if (settingsColumns.length > 0 && !settingsColumns.some(c => c.name === 'user_id')) {
    console.log("Migrating settings table to multi-user...");
    db.prepare('ALTER TABLE settings RENAME TO settings_old').run();
    db.prepare(`
        CREATE TABLE settings (
            user_id INTEGER,
            key TEXT,
            value TEXT,
            PRIMARY KEY (user_id, key)
        )
    `).run();

    const firstUser = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
    const userId = firstUser ? firstUser.id : 1;

    const oldSettings = db.prepare('SELECT * FROM settings_old').all();
    const insert = db.prepare('INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)');

    const transaction = db.transaction((settings) => {
        for (const s of settings) insert.run(userId, s.key, s.value);
    });
    transaction(oldSettings);

    db.prepare('DROP TABLE settings_old').run();
} else {
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            user_id INTEGER,
            key TEXT,
            value TEXT,
            PRIMARY KEY (user_id, key)
        );
    `);
}

// 3. DATABANK
let databankColumns = [];
try {
    databankColumns = db.prepare("PRAGMA table_info(databank)").all();
} catch (e) { }

if (databankColumns.length > 0 && !databankColumns.some(c => c.name === 'user_id')) {
    console.log("Migrating databank table to multi-user...");
    db.prepare('ALTER TABLE databank ADD COLUMN user_id INTEGER').run();

    const firstUser = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
    const userId = firstUser ? firstUser.id : 1;

    db.prepare('UPDATE databank SET user_id = ? WHERE user_id IS NULL').run(userId);
} else {
    db.exec(`
        CREATE TABLE IF NOT EXISTS databank (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

module.exports = {
    // Users
    getUser: (username) => {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    },
    createUser: (username, hashedPassword) => {
        return db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);
    },
    countUsers: () => {
        return db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    },
    updateUserPassword: (username, newHashedPassword) => {
        return db.prepare('UPDATE users SET password = ? WHERE username = ?').run(newHashedPassword, username);
    },

    // Settings
    getSetting: (key, userId) => {
        if (!userId) return null;
        const row = db.prepare('SELECT value FROM settings WHERE key = ? AND user_id = ?').get(key, userId);
        if (row) {
            try {
                return JSON.parse(row.value);
            } catch (e) {
                return row.value;
            }
        }
        return null; // Don't fall back to global if strictly user-scoped
    },
    setSetting: (key, value, userId) => {
        if (!userId) return;
        const valueStr = JSON.stringify(value);
        db.prepare('INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)').run(userId, key, valueStr);
    },
    getAllSettings: (userId) => {
        if (!userId) return {};
        const rows = db.prepare('SELECT * FROM settings WHERE user_id = ?').all(userId);
        const settings = {};
        rows.forEach(row => {
            try {
                settings[row.key] = JSON.parse(row.value);
            } catch (e) {
                settings[row.key] = row.value;
            }
        });
        return settings;
    },

    /**
     * Get a configuration value, checking DB first, then process.env
     */
    getConfigValue: (key, userId, defaultValue = null) => {
        const dbValue = module.exports.getSetting(key, userId);
        if (dbValue !== null && dbValue !== undefined && dbValue !== '') {
            return dbValue;
        }
        return process.env[key] || defaultValue;
    },

    // Databank
    addDatabankItem: (type, content, metadata = {}, userId) => {
        if (!userId) throw new Error('User ID required for databank item');
        const metadataStr = JSON.stringify(metadata);
        return db.prepare('INSERT INTO databank (type, content, metadata, user_id) VALUES (?, ?, ?, ?)').run(type, content, metadataStr, userId);
    },
    getDatabankItems: (userId, limit = 50, offset = 0, typeFilter = null) => {
        if (!userId) return [];
        let query = 'SELECT * FROM databank WHERE user_id = ?';
        const params = [userId];

        if (typeFilter) {
            query += ' AND type = ?';
            params.push(typeFilter);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const rows = db.prepare(query).all(...params);
        return rows.map(row => ({
            ...row,
            metadata: JSON.parse(row.metadata || '{}')
        }));
    },
    deleteDatabankItem: (id, userId) => {
        return db.prepare('DELETE FROM databank WHERE id = ? AND user_id = ?').run(id, userId);
    },
    clearDatabank: (userId) => {
        return db.prepare('DELETE FROM databank WHERE user_id = ?').run(userId);
    }
};
