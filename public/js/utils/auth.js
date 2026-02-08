/**
 * Auth Utility
 * Handles login, logout and authentication status
 */

import { I18n } from './i18n.js';

export class Auth {
    static async check() {
        try {
            const res = await fetch('/api/auth/status');
            const data = await res.json();

            if (data.authenticated) {
                this.hideOverlay();
                return true;
            } else {
                this.showOverlay();
                return false;
            }
        } catch (e) {
            console.error('Auth check failed:', e);
            this.showOverlay();
            return false;
        }
    }

    static showOverlay() {
        const overlay = document.getElementById('authOverlay');
        const app = document.querySelector('.app');
        if (overlay) overlay.classList.remove('hidden');
        if (app) app.style.display = 'none';

        // Refresh icons for the overlay
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    static hideOverlay() {
        const overlay = document.getElementById('authOverlay');
        const app = document.querySelector('.app');
        if (overlay) overlay.classList.add('hidden');
        if (app) app.style.display = 'flex';
    }

    static async init() {
        const form = document.getElementById('authForm');
        if (!form) return;

        const setupNotice = document.getElementById('setupNotice');
        const authTitle = document.getElementById('authTitle');
        const authSubtitle = document.getElementById('authSubtitle');
        const submitBtn = document.getElementById('authSubmit');
        const btnTextEl = submitBtn.querySelector('.btn-text');

        // Toggle Elements
        const authToggleBtn = document.getElementById('authToggleBtn');
        const authToggleText = document.getElementById('authToggleText');

        let isSetupMode = false;
        let isRegisterMode = false;

        try {
            const res = await fetch('/api/auth/status');
            const data = await res.json();

            if (data.needsSetup) {
                isSetupMode = true;
                setupNotice.classList.remove('hidden');
                authSubtitle.textContent = I18n.t('Configuration initiale');
                btnTextEl.textContent = I18n.t('Créer le compte');
                // Hide toggle in setup mode
                if (authToggleBtn) authToggleBtn.parentElement.style.display = 'none';
            }
        } catch (e) { }

        // Toggle Handler
        if (authToggleBtn) {
            authToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                isRegisterMode = !isRegisterMode;

                if (isRegisterMode) {
                    authSubtitle.textContent = I18n.t('Création de compte');
                    btnTextEl.textContent = I18n.t("S'inscrire");
                    authToggleText.textContent = I18n.t('Déjà un compte ?');
                    authToggleBtn.textContent = I18n.t('Se connecter');
                } else {
                    authSubtitle.textContent = I18n.t('Authentification requise');
                    btnTextEl.textContent = I18n.t('Se connecter');
                    authToggleText.textContent = I18n.t('Pas de compte ?');
                    authToggleBtn.textContent = I18n.t('Créer un compte');
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('authUsername').value;
            const password = document.getElementById('authPassword').value;
            const errorEl = document.getElementById('authError');

            errorEl.classList.add('hidden');
            submitBtn.disabled = true;
            btnTextEl.textContent = I18n.t('Traitement...');

            try {
                let endpoint = '/api/auth/login';
                if (isSetupMode) endpoint = '/api/auth/setup';
                else if (isRegisterMode) endpoint = '/api/auth/register';

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();

                if (res.ok) {
                    if (isSetupMode || isRegisterMode) {
                        // Attempt login if setup/register didn't auto-set session (though server usually does)
                        // Reloading usually enough as server sets session
                        window.location.reload();
                    } else {
                        window.location.reload();
                    }
                } else {
                    errorEl.textContent = data.error || I18n.t('Erreur de connexion');
                    errorEl.classList.remove('hidden');
                    submitBtn.disabled = false;

                    if (isSetupMode) btnTextEl.textContent = I18n.t('Créer le compte');
                    else if (isRegisterMode) btnTextEl.textContent = I18n.t("S'inscrire");
                    else btnTextEl.textContent = I18n.t('Se connecter');
                }
            } catch (error) {
                errorEl.textContent = I18n.t('Erreur serveur');
                errorEl.classList.remove('hidden');
                submitBtn.disabled = false;

                if (isSetupMode) btnTextEl.textContent = I18n.t('Créer le compte');
                else if (isRegisterMode) btnTextEl.textContent = I18n.t("S'inscrire");
                else btnTextEl.textContent = I18n.t('Se connecter');
            }
        });

        this.check();
    }

    static async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.reload();
        } catch (e) {
            console.error('Logout failed:', e);
        }
    }
}
