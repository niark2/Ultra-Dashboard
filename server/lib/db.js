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
            folder_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

// 4. DATABANK FOLDERS
db.exec(`
    CREATE TABLE IF NOT EXISTS databank_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        parent_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Add folder_id column to databank if it doesn't exist
const databankInfo = db.prepare("PRAGMA table_info(databank)").all();
if (!databankInfo.some(c => c.name === 'folder_id')) {
    db.prepare('ALTER TABLE databank ADD COLUMN folder_id INTEGER').run();
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
    addDatabankItem: (type, content, metadata = {}, userId, folderId = null) => {
        if (!userId) throw new Error('User ID required for databank item');
        const metadataStr = JSON.stringify(metadata);
        return db.prepare('INSERT INTO databank (type, content, metadata, user_id, folder_id) VALUES (?, ?, ?, ?, ?)').run(type, content, metadataStr, userId, folderId);
    },
    getDatabankItems: (userId, limit = 50, offset = 0, typeFilter = null, folderId = null, search = null) => {
        if (!userId) return [];
        let query = 'SELECT * FROM databank WHERE user_id = ?';
        const params = [userId];

        if (typeFilter) {
            query += ' AND type = ?';
            params.push(typeFilter);
        }

        if (search) {
            query += ' AND (content LIKE ? OR metadata LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (folderId === 'root' || folderId === null) {
            // When searching, we might want to ignore folders to find items everywhere
            if (!search) query += ' AND folder_id IS NULL';
        } else if (folderId !== 'all') {
            query += ' AND folder_id = ?';
            params.push(folderId);
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
    },

    // Databank Folders
    getDatabankFolders: (userId, parentId = null, search = null) => {
        if (!userId) return [];
        let query = 'SELECT * FROM databank_folders WHERE user_id = ?';
        const params = [userId];

        if (search) {
            query += ' AND name LIKE ?';
            params.push(`%${search}%`);
        } else {
            if (parentId === null) {
                query += ' AND parent_id IS NULL';
            } else {
                query += ' AND parent_id = ?';
                params.push(parentId);
            }
        }

        query += ' ORDER BY name ASC';
        return db.prepare(query).all(...params);
    },
    getDatabankFolderName: (folderId, userId) => {
        const row = db.prepare('SELECT name FROM databank_folders WHERE id = ? AND user_id = ?').get(folderId, userId);
        return row ? row.name : null;
    },
    createDatabankFolder: (userId, name, parentId = null) => {
        return db.prepare('INSERT INTO databank_folders (user_id, name, parent_id) VALUES (?, ?, ?)').run(userId, name, parentId);
    },
    deleteDatabankFolder: (folderId, userId) => {
        // First move items in this folder to root or parent? Let's say root (null) or just leave them as they are but they might become "orphans" if they references a non-existent folder
        // Better: move items to parent_id of the folder being deleted
        const folder = db.prepare('SELECT parent_id FROM databank_folders WHERE id = ? AND user_id = ?').get(folderId, userId);
        if (folder) {
            db.prepare('UPDATE databank SET folder_id = ? WHERE folder_id = ? AND user_id = ?').run(folder.parent_id, folderId, userId);
            db.prepare('UPDATE databank_folders SET parent_id = ? WHERE parent_id = ? AND user_id = ?').run(folder.parent_id, folderId, userId);
        }
        return db.prepare('DELETE FROM databank_folders WHERE id = ? AND user_id = ?').run(folderId, userId);
    },
    moveDatabankItemToFolder: (itemId, folderId, userId) => {
        return db.prepare('UPDATE databank SET folder_id = ? WHERE id = ? AND user_id = ?').run(folderId, itemId, userId);
    },
    renameDatabankFolder: (folderId, newName, userId) => {
        return db.prepare('UPDATE databank_folders SET name = ? WHERE id = ? AND user_id = ?').run(newName, folderId, userId);
    },
    updateDatabankItemContent: (id, content, userId) => {
        return db.prepare('UPDATE databank SET content = ? WHERE id = ? AND user_id = ?').run(content, id, userId);
    },
    getValidDatabankIds: (userId, ids) => {
        if (!userId || !ids || ids.length === 0) return [];
        const placeholders = ids.map(() => '?').join(',');
        const rows = db.prepare(`SELECT id FROM databank WHERE user_id = ? AND id IN (${placeholders})`).all(userId, ...ids);
        return rows.map(r => r.id);
    }
};
