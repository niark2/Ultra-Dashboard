import { Storage } from '../utils/storage.js';
import { I18n } from '../utils/i18n.js';

export class SettingsModule {
    constructor() {
        this.themeToggle = document.getElementById('themeToggle');
        this.reduceMotionToggle = document.getElementById('reduceMotionToggle');
        this.compactSidebarToggle = document.getElementById('compactSidebarToggle');
        this.sidebarSectionsToggle = document.getElementById('sidebarSectionsToggle');
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
        this.languageToggles = document.querySelectorAll('#languageToggle .toggle-btn');

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
        this.downloadedModelsContainer = document.getElementById('downloadedModelsContainer');
        this.statusRefreshInterval = null;

        // Env Variables
        this.envOpenRouterKey = document.getElementById('envOpenRouterKey');
        this.envOpenRouterModel = document.getElementById('envOpenRouterModel');
        this.envSearxngUrl = document.getElementById('envSearxngUrl');
        this.envRembgUrl = document.getElementById('envRembgUrl');
        this.envWhisperUrl = document.getElementById('envWhisperUrl');
        this.envUpscaleUrl = document.getElementById('envUpscaleUrl');
        this.envOllamaUrl = document.getElementById('envOllamaUrl');
        this.envOllamaModel = document.getElementById('envOllamaModel');
        this.aiProviderToggles = document.querySelectorAll('#settingsAiProviderToggle .toggle-btn');
        this.openRouterSection = document.getElementById('settingsOpenRouterSection');
        this.ollamaSection = document.getElementById('settingsOllamaSection');
        this.saveEnvSettingsBtn = document.getElementById('saveEnvSettingsBtn');

        // Logs
        this.refreshLogsBtn = document.getElementById('refreshLogsBtn');
        this.clearLogsBtn = document.getElementById('clearLogsBtn');
        this.settingsLogsContainer = document.getElementById('settingsLogsContainer');
        this.logsRefreshInterval = null;

        // Auto-save debounce
        this.saveTimeout = null;

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

        if (this.sidebarSectionsToggle) {
            this.sidebarSectionsToggle.addEventListener('change', () => this.toggleSidebarSections());
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

        // Language toggle listener (special case for reload)
        if (this.languageToggles) {
            this.languageToggles.forEach(btn => {
                btn.addEventListener('click', () => I18n.setLanguage(btn.dataset.lang));
            });
        }

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

        // Env Tool Settings Listeners
        this.setupToggleGroupListeners(this.aiProviderToggles, 'AI_PROVIDER', 'provider', (val) => this.updateAiProviderVisibility(val));

        // Intelligence Auto-save listeners
        const aiInputs = [
            this.envOpenRouterKey, this.envOpenRouterModel, this.envSearxngUrl,
            this.envRembgUrl, this.envWhisperUrl, this.envUpscaleUrl,
            this.envOllamaUrl, this.envOllamaModel, this.plexusSourceCount,
            this.plexusExtraInfo
        ];

        aiInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.debouncedSaveIntelligence());
            }
        });

        // Log Listeners
        if (this.refreshLogsBtn) {
            this.refreshLogsBtn.addEventListener('click', () => this.refreshServerLogs());
        }
        if (this.clearLogsBtn) {
            this.clearLogsBtn.addEventListener('click', () => this.clearServerLogs());
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

        // Sidebar Sections
        const useSections = await Storage.get('ultra-sidebar-sections', true);
        document.body.classList.toggle('no-sidebar-sections', !useSections);
        if (this.sidebarSectionsToggle) {
            this.sidebarSectionsToggle.checked = useSections;
        }

        // Sound
        const soundEnabled = await Storage.get('ultra-sound', true);
        if (this.soundToggle) {
            this.soundToggle.checked = soundEnabled;
        }

        // Accent Color
        const accentColor = await Storage.get('ultra-accent-color', '#ffffff');
        this.applyAccentColor(accentColor);

        // AI Provider
        const aiProvider = await Storage.get('AI_PROVIDER', 'openrouter');
        this.aiProviderToggles.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.provider === aiProvider);
        });
        this.updateAiProviderVisibility(aiProvider);

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
        this.loadToggleGroupState(this.languageToggles, 'ultra-language', 'en');

        // Load Env Variables
        const envKeys = [
            { id: 'envOpenRouterKey', key: 'OPENROUTER_API_KEY' },
            { id: 'envOpenRouterModel', key: 'OPENROUTER_MODEL' },
            { id: 'envSearxngUrl', key: 'SEARXNG_URL' },
            { id: 'envRembgUrl', key: 'REMBG_URL' },
            { id: 'envWhisperUrl', key: 'WHISPER_URL' },
            { id: 'envUpscaleUrl', key: 'UPSCALE_URL' },
            { id: 'envOllamaUrl', key: 'OLLAMA_URL' },
            { id: 'envOllamaModel', key: 'OLLAMA_MODEL' }
        ];

        for (const item of envKeys) {
            const input = document.getElementById(item.id);
            if (!input) continue;

            const config = await Storage.getFull(item.key);

            if (config.source === 'env') {
                input.value = config.effectiveValue || '';
                input.classList.add('using-env-fallback');
            } else if (config.value) {
                input.value = config.value;
                input.classList.remove('using-env-fallback');
            }
        }

        // AI Provider
        await this.loadToggleGroupState(this.aiProviderToggles, 'AI_PROVIDER', 'openrouter', 'provider');
    }

    setupToggleGroupListeners(buttons, storageKey, dataAttr = 'model', onSave = null) {
        buttons.forEach(btn => {
            btn.addEventListener('click', async () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const value = btn.dataset[dataAttr] || btn.dataset.scale;
                await Storage.set(storageKey, value);
                if (onSave) onSave(value);
            });
        });
    }

    updateAiProviderVisibility(provider) {
        if (!this.openRouterSection || !this.ollamaSection) return;

        if (provider === 'openrouter') {
            this.openRouterSection.style.display = 'block';
            this.ollamaSection.style.display = 'none';
        } else if (provider === 'ollama') {
            this.openRouterSection.style.display = 'none';
            this.ollamaSection.style.display = 'block';
        }
    }

    async loadToggleGroupState(buttons, storageKey, defaultValue, dataAttr = 'model') {
        const val = await Storage.get(storageKey, defaultValue);
        buttons.forEach(btn => {
            const btnVal = btn.dataset[dataAttr] || btn.dataset.scale;
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

        // Combined logic for Maintenance tab (status + logs)
        if (tabId === 'system') {
            // Initial refresh
            this.refreshServerStatus();
            this.refreshServerLogs();

            // Set up intervals if not already active
            if (!this.statusRefreshInterval) {
                this.statusRefreshInterval = setInterval(() => this.refreshServerStatus(), 5000);
            }
            if (!this.logsRefreshInterval) {
                this.logsRefreshInterval = setInterval(() => this.refreshServerLogs(), 3000);
            }
        } else {
            // Clear intervals when leaving Maintenance tab
            if (this.statusRefreshInterval) {
                clearInterval(this.statusRefreshInterval);
                this.statusRefreshInterval = null;
            }
            if (this.logsRefreshInterval) {
                clearInterval(this.logsRefreshInterval);
                this.logsRefreshInterval = null;
            }
        }
    }

    async refreshServerStatus() {
        try {
            // Fetch health status
            const healthRes = await fetch('/api/status/health');
            if (healthRes.ok) {
                const healthData = await healthRes.json();
                this.renderServerStatus(healthData);
            }

            // Fetch models info
            const modelsRes = await fetch('/api/status/models');
            if (modelsRes.ok) {
                const modelsData = await modelsRes.json();
                this.renderDownloadedModels(modelsData.models);
            }
        } catch (error) {
            console.error('Error fetching health status:', error);
        }
    }

    renderDownloadedModels(models) {
        if (!this.downloadedModelsContainer) return;

        if (!models || models.length === 0) {
            this.downloadedModelsContainer.innerHTML = `
                <div class="status-loading">
                    <i data-lucide="info" style="width: 24px; height: 24px; color: var(--text-muted);"></i>
                    Aucun modèle téléchargé trouvé.
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        this.downloadedModelsContainer.innerHTML = `
            <div class="models-table-wrapper">
                <table class="models-table">
                    <thead>
                        <tr>
                            <th>Modèle</th>
                            <th>Type</th>
                            <th>Taille</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${models.map(m => `
                            <tr>
                                <td class="model-name-cell">
                                    <i data-lucide="file-code" class="model-icon"></i>
                                    <span>${m.name}</span>
                                </td>
                                <td><span class="model-tag">${m.type}</span></td>
                                <td class="model-size">${m.size}</td>
                                <td class="model-date">${new Date(m.date).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }

    renderServerStatus(data) {
        if (!this.servicesStatusContainer || !this.systemMetricsContainer || !data || !data.services) return;

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
                            <span class="detail-value">${s.details?.service || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">${s.details?.status || 'OK'}</span>
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
        if (!data.system || !data.system.memory) {
            this.systemMetricsContainer.innerHTML = '<div class="status-loading">Metrics non disponibles</div>';
            return;
        }

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
                <span class="metric-value">${data.system.platform || 'N/A'}</span>
            </div>
            <div class="metric-box">
                <span class="metric-label">Node JS</span>
                <span class="metric-value">${data.system.nodeVersion || 'N/A'}</span>
            </div>
        `;
    }

    async refreshServerLogs() {
        try {
            const res = await fetch('/api/status/logs');
            if (res.ok) {
                const data = await res.json();
                this.renderServerLogs(data.logs);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    }

    renderServerLogs(logs) {
        if (!this.settingsLogsContainer) return;

        if (!logs || logs.length === 0) {
            this.settingsLogsContainer.innerHTML = '<div class="log-placeholder">Aucun log disponible.</div>';
            return;
        }

        const isAtBottom = this.settingsLogsContainer.scrollHeight - this.settingsLogsContainer.scrollTop <= this.settingsLogsContainer.clientHeight + 50;

        this.settingsLogsContainer.innerHTML = logs.map(log => `
            <div class="log-entry">
                <span class="log-time">[${log.time}]</span>
                <span class="log-type ${log.type}">${log.type}</span>
                <span class="log-message">${this.escapeHtml(log.message)}</span>
            </div>
        `).join('');

        // Auto-scroll to bottom if user was already at the bottom
        if (isAtBottom) {
            this.settingsLogsContainer.scrollTop = this.settingsLogsContainer.scrollHeight;
        }
    }

    async clearServerLogs() {
        if (!confirm('Voulez-vous vraiment effacer les logs du serveur ?')) return;

        try {
            const res = await fetch('/api/status/logs/clear', { method: 'POST' });
            if (res.ok) {
                this.renderServerLogs([]);
            }
        } catch (error) {
            console.error('Error clearing logs:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    debouncedSaveIntelligence() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.saveIntelligenceSettings(), 500);
    }

    async saveIntelligenceSettings() {
        console.log('Auto-saving Intelligence settings...');
        try {
            const settings = {
                'OPENROUTER_API_KEY': this.envOpenRouterKey?.value.trim(),
                'OPENROUTER_MODEL': this.envOpenRouterModel?.value.trim(),
                'SEARXNG_URL': this.envSearxngUrl?.value.trim(),
                'REMBG_URL': this.envRembgUrl?.value.trim(),
                'WHISPER_URL': this.envWhisperUrl?.value.trim(),
                'UPSCALE_URL': this.envUpscaleUrl?.value.trim(),
                'OLLAMA_URL': this.envOllamaUrl?.value.trim(),
                'OLLAMA_MODEL': this.envOllamaModel?.value.trim(),
                'ultra-plexus-source-count': parseInt(this.plexusSourceCount?.value) || 3,
                'ultra-plexus-extra-info': this.plexusExtraInfo?.value
            };

            for (const [key, value] of Object.entries(settings)) {
                if (value !== undefined) {
                    await Storage.set(key, value);
                }
            }
        } catch (error) {
            console.error('Error auto-saving intelligence settings:', error);
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

    async toggleSidebarSections() {
        const useSections = this.sidebarSectionsToggle.checked;
        document.body.classList.toggle('no-sidebar-sections', !useSections);
        await Storage.set('ultra-sidebar-sections', useSections);
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

    // saveEnvSettings has been replaced by automatic saveIntelligenceSettings
}

