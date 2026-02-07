import { Storage } from '../utils/storage.js';

export class SettingsModule {
    constructor() {
        this.themeToggle = document.getElementById('themeToggle');
        this.reduceMotionToggle = document.getElementById('reduceMotionToggle');
        this.compactSidebarToggle = document.getElementById('compactSidebarToggle');
        this.soundToggle = document.getElementById('soundToggle');
        this.clearCacheBtn = document.getElementById('clearCacheBtn');
        this.accentPicker = document.getElementById('accentPicker');
        this.accentDots = document.querySelectorAll('.accent-dot');
        this.sidebarItemCheckboxes = document.querySelectorAll('[data-sidebar-item]');

        // Internal Tabs
        this.settingsTabLinks = document.querySelectorAll('.settings-tab-link');
        this.settingsTabPanes = document.querySelectorAll('.settings-tab-pane');

        // Plexus Settings
        this.plexusSourceCount = document.getElementById('plexusSourceCount');
        this.plexusExtraInfo = document.getElementById('plexusExtraInfo');

        // Tool Settings Elements
        this.rembgModelToggles = document.querySelectorAll('#settingsRembgModelToggle .toggle-btn');
        this.upscaleModelToggles = document.querySelectorAll('#settingsUpscaleModelToggle .toggle-btn');
        this.upscaleScaleToggles = document.querySelectorAll('#settingsUpscaleScaleToggle .toggle-btn');
        this.whisperModelToggles = document.querySelectorAll('#settingsWhisperModelToggle .toggle-btn');

        // Pin Items
        this.pinItemBtns = document.querySelectorAll('.pin-item-btn');
        this.pinnedItemsContainer = document.getElementById('pinnedItemsContainer');

        // Security
        this.secUsername = document.getElementById('secUsername');
        this.secCurrentPassword = document.getElementById('secCurrentPassword');
        this.secNewPassword = document.getElementById('secNewPassword');
        this.updatePasswordBtn = document.getElementById('updatePasswordBtn');
        this.passwordUpdateMsg = document.getElementById('passwordUpdateMsg');

        // Status
        this.servicesStatusContainer = document.getElementById('servicesStatusContainer');
        this.systemMetricsContainer = document.getElementById('systemMetricsContainer');
        this.statusRefreshInterval = null;

        // Env Variables
        this.envOpenRouterKey = document.getElementById('envOpenRouterKey');
        this.envOpenRouterModel = document.getElementById('envOpenRouterModel');
        this.envSearxngUrl = document.getElementById('envSearxngUrl');
        this.envRembgUrl = document.getElementById('envRembgUrl');
        this.envWhisperUrl = document.getElementById('envWhisperUrl');
        this.envUpscaleUrl = document.getElementById('envUpscaleUrl');
        this.saveEnvSettingsBtn = document.getElementById('saveEnvSettingsBtn');


        this.init();
    }

    async init() {
        // Trigger migration from localStorage on first load
        await Storage.migrate();

        // Load saved settings
        await this.loadSettings();

        // Event Listeners
        if (this.themeToggle) {
            this.themeToggle.addEventListener('change', () => this.toggleTheme());
        }

        if (this.reduceMotionToggle) {
            this.reduceMotionToggle.addEventListener('change', () => this.toggleReduceMotion());
        }

        if (this.compactSidebarToggle) {
            this.compactSidebarToggle.addEventListener('change', () => this.toggleCompactSidebar());
        }

        if (this.clearCacheBtn) {
            this.clearCacheBtn.addEventListener('click', () => this.clearCache());
        }

        if (this.accentDots) {
            this.accentDots.forEach(dot => {
                dot.addEventListener('click', () => this.setAccentColor(dot.dataset.color, dot));
            });
        }

        // Sidebar items visibility
        if (this.sidebarItemCheckboxes) {
            this.sidebarItemCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => this.toggleSidebarItem(checkbox));
            });
        }

        // Internal Tab Switching
        if (this.settingsTabLinks) {
            this.settingsTabLinks.forEach(link => {
                link.addEventListener('click', () => this.switchSettingsTab(link.dataset.settingsTab));
            });
        }

        // Plexus Settings Listeners
        if (this.plexusSourceCount) {
            this.plexusSourceCount.addEventListener('input', () => this.savePlexusSettings());
        }
        if (this.plexusExtraInfo) {
            this.plexusExtraInfo.addEventListener('input', () => this.savePlexusSettings());
        }

        // General Tool Settings Listeners
        this.setupToggleGroupListeners(this.rembgModelToggles, 'ultra-rembg-default-model');
        this.setupToggleGroupListeners(this.upscaleModelToggles, 'ultra-upscale-default-model');
        this.setupToggleGroupListeners(this.upscaleScaleToggles, 'ultra-upscale-default-scale');
        this.setupToggleGroupListeners(this.whisperModelToggles, 'ultra-whisper-default-model');

        // Pin Item Listeners
        if (this.pinItemBtns) {
            this.pinItemBtns.forEach(btn => {
                btn.addEventListener('click', () => this.togglePinItem(btn));
            });
        }

        // Password Update Listener
        if (this.updatePasswordBtn) {
            this.updatePasswordBtn.addEventListener('click', () => this.handlePasswordUpdate());
        }

        // Env Settings Listener
        if (this.saveEnvSettingsBtn) {
            this.saveEnvSettingsBtn.addEventListener('click', () => this.saveEnvSettings());
        }

        // Initial update of pinned items in sidebar
        await this.updatePinnedSidebar();
    }

    async handlePasswordUpdate() {
        const username = this.secUsername.value;
        const currentPassword = this.secCurrentPassword.value;
        const newPassword = this.secNewPassword.value;

        if (!username || !currentPassword || !newPassword) {
            this.showPasswordMsg('Tous les champs sont requis', 'error');
            return;
        }

        this.updatePasswordBtn.disabled = true;
        this.updatePasswordBtn.textContent = 'Mise à jour...';

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, currentPassword, newPassword })
            });

            const data = await res.json();

            if (res.ok) {
                this.showPasswordMsg(data.message, 'success');
                // Clear passwords
                this.secCurrentPassword.value = '';
                this.secNewPassword.value = '';
            } else {
                this.showPasswordMsg(data.error || 'Erreur lors de la mise à jour', 'error');
            }
        } catch (error) {
            this.showPasswordMsg('Erreur de connexion au serveur', 'error');
        } finally {
            this.updatePasswordBtn.disabled = false;
            this.updatePasswordBtn.textContent = 'Mettre à jour le mot de passe';
        }
    }

    showPasswordMsg(msg, type) {
        this.passwordUpdateMsg.textContent = msg;
        this.passwordUpdateMsg.style.display = 'block';
        this.passwordUpdateMsg.style.color = type === 'error' ? 'var(--error)' : 'var(--success)';
        setTimeout(() => {
            this.passwordUpdateMsg.style.display = 'none';
        }, 5000);
    }

    async loadSettings() {
        // Theme
        const theme = await Storage.get('ultra-theme', 'dark');
        document.documentElement.setAttribute('data-theme', theme);
        if (this.themeToggle) {
            this.themeToggle.checked = theme === 'dark';
        }

        // Reduce Motion
        const reduceMotion = await Storage.get('ultra-reduce-motion', false);
        document.body.classList.toggle('reduce-motion', reduceMotion);
        if (this.reduceMotionToggle) {
            this.reduceMotionToggle.checked = reduceMotion;
        }

        // Compact Sidebar
        const compactSidebar = await Storage.get('ultra-compact-sidebar', false);
        document.body.classList.toggle('compact-sidebar', compactSidebar);
        if (this.compactSidebarToggle) {
            this.compactSidebarToggle.checked = compactSidebar;
        }

        // Sound
        const soundEnabled = await Storage.get('ultra-sound', true);
        if (this.soundToggle) {
            this.soundToggle.checked = soundEnabled;
        }

        // Accent Color
        const accentColor = await Storage.get('ultra-accent-color', '#ffffff');
        this.applyAccentColor(accentColor);

        // Update active dot
        this.accentDots.forEach(dot => {
            dot.classList.toggle('active', dot.dataset.color === accentColor);
        });

        // Sidebar items visibility
        await this.loadSidebarItemsVisibility();

        // Plexus Settings
        const plexusCount = await Storage.get('ultra-plexus-source-count', 3);
        const plexusInfo = await Storage.get('ultra-plexus-extra-info', '');
        if (this.plexusSourceCount) this.plexusSourceCount.value = plexusCount;
        if (this.plexusExtraInfo) this.plexusExtraInfo.value = plexusInfo;

        // Load Tool Defaults
        this.loadToggleGroupState(this.rembgModelToggles, 'ultra-rembg-default-model', 'u2net');
        this.loadToggleGroupState(this.upscaleModelToggles, 'ultra-upscale-default-model', 'edsr');
        this.loadToggleGroupState(this.upscaleScaleToggles, 'ultra-upscale-default-scale', '4');
        this.loadToggleGroupState(this.whisperModelToggles, 'ultra-whisper-default-model', 'base');

        // Load Env Variables
        const envKeys = [
            { id: 'envOpenRouterKey', key: 'OPENROUTER_API_KEY' },
            { id: 'envOpenRouterModel', key: 'OPENROUTER_MODEL' },
            { id: 'envSearxngUrl', key: 'SEARXNG_URL' },
            { id: 'envRembgUrl', key: 'REMBG_URL' },
            { id: 'envWhisperUrl', key: 'WHISPER_URL' },
            { id: 'envUpscaleUrl', key: 'UPSCALE_URL' }
        ];

        for (const item of envKeys) {
            const input = document.getElementById(item.id);
            if (!input) continue;

            const config = await Storage.getFull(item.key);

            if (config.source === 'env') {
                input.value = '';
                input.placeholder = 'Utilise la config serveur (.env)';
                input.classList.add('using-env-fallback');
                // Optionnel: ajouter un petit badge ou texte à côté
            } else if (config.value) {
                input.value = config.value;
                input.classList.remove('using-env-fallback');
            }
        }
    }

    setupToggleGroupListeners(buttons, storageKey) {
        buttons.forEach(btn => {
            btn.addEventListener('click', async () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const value = btn.dataset.model || btn.dataset.scale;
                await Storage.set(storageKey, value);
            });
        });
    }

    async loadToggleGroupState(buttons, storageKey, defaultValue) {
        const val = await Storage.get(storageKey, defaultValue);
        buttons.forEach(btn => {
            const btnVal = btn.dataset.model || btn.dataset.scale;
            btn.classList.toggle('active', btnVal === val.toString());
        });
    }

    switchSettingsTab(tabId) {
        // Update links
        this.settingsTabLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.settingsTab === tabId);
        });

        // Update panes
        this.settingsTabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === `settings-${tabId}`);
        });

        if (tabId === 'status') {
            this.refreshServerStatus();
            if (!this.statusRefreshInterval) {
                this.statusRefreshInterval = setInterval(() => this.refreshServerStatus(), 5000);
            }
        } else {
            if (this.statusRefreshInterval) {
                clearInterval(this.statusRefreshInterval);
                this.statusRefreshInterval = null;
            }
        }
    }

    async refreshServerStatus() {
        try {
            const res = await fetch('/api/status/health');
            const data = await res.json();
            this.renderServerStatus(data);
        } catch (error) {
            console.error('Error fetching health status:', error);
        }
    }

    renderServerStatus(data) {
        if (!this.servicesStatusContainer || !this.systemMetricsContainer) return;

        // Render Services
        this.servicesStatusContainer.innerHTML = data.services.map(s => `
            <div class="status-card">
                <div class="status-header">
                    <span class="service-name">${s.name}</span>
                    <span class="status-indicator ${s.status}">${s.status}</span>
                </div>
                <div class="status-details">
                    ${s.status === 'online' ? `
                        <div class="detail-row">
                            <span class="detail-label">Service</span>
                            <span class="detail-value">${s.details.service || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">${s.details.status || 'OK'}</span>
                        </div>
                    ` : `
                        <div class="detail-row">
                            <span class="detail-label">Erreur</span>
                            <span class="detail-value">${s.error || 'Inconnu'}</span>
                        </div>
                    `}
                </div>
            </div>
        `).join('');

        // Render System Metrics
        const memMb = Math.round(data.system.memory.rss / 1024 / 1024);
        const uptimeH = Math.floor(data.system.uptime / 3600);
        const uptimeM = Math.floor((data.system.uptime % 3600) / 60);

        this.systemMetricsContainer.innerHTML = `
            <div class="metric-box">
                <span class="metric-label">Uptime</span>
                <span class="metric-value">${uptimeH}h ${uptimeM}m</span>
            </div>
            <div class="metric-box">
                <span class="metric-label">Mémoire (RSS)</span>
                <span class="metric-value">${memMb} MB</span>
            </div>
            <div class="metric-box">
                <span class="metric-label">Platform</span>
                <span class="metric-value">${data.system.platform}</span>
            </div>
            <div class="metric-box">
                <span class="metric-label">Node JS</span>
                <span class="metric-value">${data.system.nodeVersion}</span>
            </div>
        `;
    }

    async savePlexusSettings() {
        if (this.plexusSourceCount) {
            await Storage.set('ultra-plexus-source-count', parseInt(this.plexusSourceCount.value) || 3);
        }
        if (this.plexusExtraInfo) {
            await Storage.set('ultra-plexus-extra-info', this.plexusExtraInfo.value);
        }
    }

    async loadSidebarItemsVisibility() {
        const hiddenItems = await Storage.get('ultra-hidden-sidebar-items', []);

        this.sidebarItemCheckboxes.forEach(checkbox => {
            const itemName = checkbox.dataset.sidebarItem;
            const isHidden = hiddenItems.includes(itemName);

            // Update checkbox state
            checkbox.checked = !isHidden;

            // Update sidebar nav item visibility
            this.updateSidebarItemVisibility(itemName, !isHidden);
        });
    }

    updateSidebarItemVisibility(itemName, isVisible) {
        const navItem = document.querySelector(`.nav-item[data-tab="${itemName}"]`);
        if (navItem) {
            if (isVisible) {
                navItem.classList.remove('hidden-by-settings');
            } else {
                navItem.classList.add('hidden-by-settings');
            }
        }
    }

    async toggleSidebarItem(checkbox) {
        const itemName = checkbox.dataset.sidebarItem;
        const isVisible = checkbox.checked;

        this.updateSidebarItemVisibility(itemName, isVisible);

        const hiddenItems = await Storage.get('ultra-hidden-sidebar-items', []);

        if (isVisible) {
            const index = hiddenItems.indexOf(itemName);
            if (index > -1) hiddenItems.splice(index, 1);
        } else {
            if (!hiddenItems.includes(itemName)) hiddenItems.push(itemName);
        }

        await Storage.set('ultra-hidden-sidebar-items', hiddenItems);

        // Also update pinned if visibility changes
        await this.updatePinnedSidebar();
    }

    async togglePinItem(btn) {
        const itemName = btn.dataset.pinItem;
        const pinnedItems = await Storage.get('ultra-pinned-sidebar-items', []);

        const index = pinnedItems.indexOf(itemName);
        if (index > -1) {
            pinnedItems.splice(index, 1);
            btn.classList.remove('active');
        } else {
            pinnedItems.push(itemName);
            btn.classList.add('active');
        }

        await Storage.set('ultra-pinned-sidebar-items', pinnedItems);
        await this.updatePinnedSidebar();
    }

    async updatePinnedSidebar() {
        if (!this.pinnedItemsContainer) return;

        const pinnedItems = await Storage.get('ultra-pinned-sidebar-items', []);
        const hiddenItems = await Storage.get('ultra-hidden-sidebar-items', []);

        // Update buttons state in settings UI
        if (this.pinItemBtns) {
            this.pinItemBtns.forEach(btn => {
                const itemName = btn.dataset.pinItem;
                btn.classList.toggle('active', pinnedItems.includes(itemName));
            });
        }

        // Clear container
        this.pinnedItemsContainer.innerHTML = '';

        // Filter out hidden items from being shown as pinned
        const activePinnedItems = pinnedItems.filter(item => !hiddenItems.includes(item));

        if (activePinnedItems.length === 0) {
            this.pinnedItemsContainer.style.display = 'none';
            return;
        }

        this.pinnedItemsContainer.style.display = 'flex';

        activePinnedItems.forEach(itemName => {
            // Find the original nav item to clone its icon and label
            const originalNavItem = document.querySelector(`.nav-section .nav-item[data-tab="${itemName}"]`);
            if (originalNavItem) {
                const icon = originalNavItem.querySelector('.nav-icon').innerHTML;
                const label = originalNavItem.querySelector('.nav-label').textContent;

                const pinnedBtn = document.createElement('button');
                pinnedBtn.className = 'nav-item pinned-nav-item';
                pinnedBtn.dataset.tab = itemName;
                pinnedBtn.innerHTML = `
                    <span class="nav-icon">${icon}</span>
                    <span class="nav-label">${label}</span>
                `;

                pinnedBtn.addEventListener('click', () => {
                    // Reuse tab manager switch (which is globally accessible through DOM events)
                    const tabEvent = new CustomEvent('switch-tab', { detail: { tab: itemName } });
                    document.dispatchEvent(tabEvent);
                });

                this.pinnedItemsContainer.appendChild(pinnedBtn);
            }
        });

        // Trigger lucide if available
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    async toggleTheme() {
        const isDark = this.themeToggle.checked;
        const newTheme = isDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        await Storage.set('ultra-theme', newTheme);
    }

    async toggleReduceMotion() {
        const reduce = this.reduceMotionToggle.checked;
        document.body.classList.toggle('reduce-motion', reduce);
        await Storage.set('ultra-reduce-motion', reduce);
    }

    async toggleCompactSidebar() {
        const compact = this.compactSidebarToggle.checked;
        document.body.classList.toggle('compact-sidebar', compact);
        await Storage.set('ultra-compact-sidebar', compact);
    }

    async setAccentColor(color, dotElement) {
        this.accentDots.forEach(d => d.classList.remove('active'));
        dotElement.classList.add('active');
        this.applyAccentColor(color);
        await Storage.set('ultra-accent-color', color);
    }

    applyAccentColor(color) {
        document.documentElement.style.setProperty('--accent', color);
        if (color === '#ffffff') {
            document.documentElement.style.setProperty('--accent-hover', '#f4f4f5');
            document.documentElement.style.setProperty('--accent-dim', '#27272a');
        } else {
            document.documentElement.style.setProperty('--accent-hover', color + 'ee');
            document.documentElement.style.setProperty('--accent-dim', color + '22');
        }
    }

    async clearCache() {
        if (confirm('Voulez-vous vraiment vider le cache local ? Cela réinitialisera également vos réglages.')) {
            localStorage.clear();
            // We might want to clear the server side too, but usually clear cache means local.
            // For now let's just reload.
            window.location.reload();
        }
    }

    async saveEnvSettings() {
        if (!this.saveEnvSettingsBtn) return;

        const originalText = this.saveEnvSettingsBtn.textContent;
        this.saveEnvSettingsBtn.disabled = true;
        this.saveEnvSettingsBtn.textContent = 'Enregistrement...';

        try {
            const key = this.envOpenRouterKey.value.trim();
            const model = this.envOpenRouterModel.value.trim();
            const url = this.envSearxngUrl.value.trim();
            const rbUrl = this.envRembgUrl.value.trim();
            const whUrl = this.envWhisperUrl.value.trim();
            const upUrl = this.envUpscaleUrl.value.trim();

            await Storage.set('OPENROUTER_API_KEY', key);
            await Storage.set('OPENROUTER_MODEL', model);
            await Storage.set('SEARXNG_URL', url);
            await Storage.set('REMBG_URL', rbUrl);
            await Storage.set('WHISPER_URL', whUrl);
            await Storage.set('UPSCALE_URL', upUrl);

            // Notify user
            this.saveEnvSettingsBtn.textContent = '✅ Enregistré !';
            this.saveEnvSettingsBtn.style.backgroundColor = 'var(--success)';

            setTimeout(() => {
                this.saveEnvSettingsBtn.disabled = false;
                this.saveEnvSettingsBtn.textContent = originalText;
                this.saveEnvSettingsBtn.style.backgroundColor = '';
            }, 3000);

        } catch (error) {
            console.error('Error saving env settings:', error);
            this.saveEnvSettingsBtn.textContent = '❌ Erreur';
            this.saveEnvSettingsBtn.style.backgroundColor = 'var(--error)';
            setTimeout(() => {
                this.saveEnvSettingsBtn.disabled = false;
                this.saveEnvSettingsBtn.textContent = originalText;
                this.saveEnvSettingsBtn.style.backgroundColor = '';
            }, 3000);
        }
    }
}

