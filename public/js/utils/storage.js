/**
 * Storage Utility
 * Handles persistent settings via API (SQLite) with LocalStorage fallback/migration
 */

export class Storage {
    static async get(key, defaultValue = null) {
        try {
            const res = await fetch(`/api/settings/${key}`);
            const data = await res.json();

            // Si on a une valeur en DB, on la prend
            if (data.value !== null && data.value !== undefined && data.value !== '') {
                return data.value;
            }

            // Sinon, si le serveur nous dit qu'il y a une valeur dans le .env
            if (data.effectiveValue) {
                // On peut optionnellement stocker l'info qu'on utilise le .env
                return data.value; // On retourne quand même null/vide pour l'input
            }
        } catch (e) {
            console.warn(`Error fetching setting ${key}:`, e);
        }

        // Fallback to localStorage
        const local = localStorage.getItem(key);
        if (local !== null) {
            try {
                return JSON.parse(local);
            } catch (e) {
                return local;
            }
        }

        return defaultValue;
    }

    /**
     * Version étendue de get qui retourne aussi la source et la valeur effective
     */
    static async getFull(key) {
        try {
            const res = await fetch(`/api/settings/${key}`);
            return await res.json();
        } catch (e) {
            return { key, value: null, source: 'error' };
        }
    }

    static async set(key, value) {
        // Save to LocalStorage for offline/fallback
        localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);

        // Save to Server
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
        } catch (e) {
            console.error(`Error saving setting ${key}:`, e);
        }
    }

    /**
     * Migrates all 'ultra-' prefixed keys from LocalStorage to the server
     */
    static async migrate() {
        const settings = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('ultra-')) {
                let value = localStorage.getItem(key);
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    // Keep as string
                }
                settings[key] = value;
            }
        }

        if (Object.keys(settings).length === 0) return;

        try {
            const res = await fetch('/api/settings/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            });
            if (res.ok) {
                console.log('✅ Migration to SQLite successful');
                // Optional: clear local storage if you want to be pure DB
                // but keeping it as fallback is safer
            }
        } catch (e) {
            console.error('Migration failed:', e);
        }
    }

    static async getAll() {
        try {
            const res = await fetch('/api/settings');
            return await res.json();
        } catch (e) {
            console.error('Error fetching all settings:', e);
            return {};
        }
    }
}
