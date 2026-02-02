export class HomeModule {
    constructor() {
        const defaultWidgets = [
            { id: 'clock', type: 'clock', title: 'Heure & Date', w: 6 },
            { id: 'weather', type: 'weather', title: 'Météo', w: 3 },
            { id: 'quick-actions', type: 'quick-actions', title: 'Actions Rapides', w: 3 }
        ];

        // Load from localStorage or use defaults
        const saved = localStorage.getItem('ultra-home-widgets');
        this.widgets = saved ? JSON.parse(saved) : defaultWidgets;

        this.locked = localStorage.getItem('ultra-home-locked') === 'true';

        this.initialized = false;
        this.init();
    }

    init() {
        if (this.initialized) return;

        // Render initial structure if needed, or just bind events
        this.renderWidgets();
        this.startClock();
        this.bindEvents();
        this.updateAllWeather();

        this.initialized = true;
        console.log('🏠 Home Module Initialized');
    }

    bindEvents() {
        const addWidgetBtn = document.getElementById('addWidgetBtn');
        const lockWidgetsBtn = document.getElementById('lockWidgetsBtn');
        const closeStoreBtn = document.getElementById('closeWidgetStore');
        const overlay = document.getElementById('widgetStoreOverlay');

        if (addWidgetBtn) {
            addWidgetBtn.addEventListener('click', () => this.openWidgetStore());
        }

        if (lockWidgetsBtn) {
            lockWidgetsBtn.addEventListener('click', () => this.toggleLock());
            this.updateLockUI();
        }

        if (closeStoreBtn) {
            closeStoreBtn.addEventListener('click', () => this.closeWidgetStore());
        }

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeWidgetStore();
            });
        }

        // Listen for store item clicks (dynamic binding or delegated)
        const storeItems = document.querySelectorAll('.store-item');
        storeItems.forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.widgetType;
                this.addWidget(type);
                this.closeWidgetStore();
            });
        });
    }

    openWidgetStore() {
        const overlay = document.getElementById('widgetStoreOverlay');
        if (overlay) overlay.classList.add('active');
    }

    closeWidgetStore() {
        const overlay = document.getElementById('widgetStoreOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    toggleLock() {
        this.locked = !this.locked;
        localStorage.setItem('ultra-home-locked', this.locked);
        this.updateLockUI();
        this.renderWidgets();
    }

    updateLockUI() {
        const btn = document.getElementById('lockWidgetsBtn');
        const addBtn = document.getElementById('addWidgetBtn');
        if (!btn) return;

        if (this.locked) {
            btn.innerHTML = '<i data-lucide="lock"></i>';
            btn.classList.add('locked');
            btn.title = 'Déverrouiller le dashboard';
            if (addBtn) addBtn.style.display = 'none';
        } else {
            btn.innerHTML = '<i data-lucide="unlock"></i>';
            btn.classList.remove('locked');
            btn.title = 'Verrouiller le dashboard';
            if (addBtn) addBtn.style.display = 'flex';
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    addWidget(type) {
        // Simple logic: check if already exists, if not add
        // For 'clock' and 'weather' we usually only want one
        if (this.widgets.find(w => w.type === type)) {
            // Shake or alert? For now just log
            console.warn('Widget already exists');
            return;
        }

        const newWidget = {
            id: type + '-' + Date.now(),
            type: type,
            title: this.getWidgetTitle(type),
            w: this.getWidgetWidth(type)
        };

        this.widgets.push(newWidget);
        this.saveWidgets();
        this.renderWidgets();
    }

    saveWidgets() {
        localStorage.setItem('ultra-home-widgets', JSON.stringify(this.widgets));
    }

    getWidgetWidth(type) {
        switch (type) {
            case 'clock': return 6;
            case 'weather': return 3;
            case 'quick-actions': return 3;
            case 'system': return 3;
            case 'note': return 4;
            case 'news': return 4;
            case 'downloads': return 4;
            default: return 3;
        }
    }

    getWidgetTitle(type) {
        switch (type) {
            case 'clock': return 'Heure & Date';
            case 'weather': return 'Météo';
            case 'quick-actions': return 'Actions Rapides';
            case 'system': return 'Système';
            case 'note': return 'Notes';
            case 'news': return 'Actualités';
            case 'downloads': return 'Téléchargements';
            default: return 'Widget';
        }
    }

    renderWidgets() {
        const grid = document.getElementById('homeWidgetGrid');
        if (!grid) return;

        grid.innerHTML = ''; // Clear current

        this.widgets.forEach(widget => {
            const el = document.createElement('div');
            el.id = `widget-instance-${widget.id}`;
            el.className = `widget-card widget-${widget.type}`;
            el.style.gridColumn = `span ${widget.w}`;

            el.innerHTML = this.getWidgetHTML(widget);

            // Add remove button logic
            const removeBtn = el.querySelector('.btn-remove-widget');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.widgets = this.widgets.filter(w => w.id !== widget.id);
                    this.saveWidgets();
                    this.renderWidgets();
                });
            }

            grid.appendChild(el);

            // Trigger specific widget updates
            if (widget.type === 'weather') {
                this.fetchWeatherForWidget(widget.id);
            } else if (widget.type === 'note') {
                this.initNoteWidget(widget.id);
            } else if (widget.type === 'news') {
                this.fetchNewsForWidget(widget.id);
            } else if (widget.type === 'downloads') {
                this.updateDownloadsForWidget(widget.id);
            }
        });

        // Re-initialize dynamic content if needed (like lucide icons)
        if (window.lucide) window.lucide.createIcons();
    }

    getWidgetHTML(widget) {
        const header = `
            <div class="widget-header">
                <span class="widget-title">
                    <i data-lucide="${this.getWidgetIcon(widget.type)}"></i> ${widget.title}
                </span>
                <div class="widget-controls">
                    ${this.locked ? '' : '<button class="btn-widget-control btn-remove-widget"><i data-lucide="x"></i></button>'}
                </div>
            </div>
        `;

        let content = '';
        switch (widget.type) {
            case 'clock':
                content = `
                    <div class="clock-display">
                        <div class="time" id="widgetTime">00:00</div>
                        <div class="date" id="widgetDate">Lundi 1 Janvier</div>
                    </div>
                `;
                break;
            case 'weather':
                content = `
                    <div class="weather-content" id="weather-content-${widget.id}">
                        <div class="weather-info">
                            <span class="weather-temp">--°C</span>
                            <span class="weather-desc">Chargement...</span>
                        </div>
                        <div class="weather-icon-large">⏳</div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;" id="weather-location-${widget.id}">
                        <i data-lucide="map-pin" style="width: 12px"></i> Localisation...
                    </div>
                `;
                break;
            case 'quick-actions':
                content = `
                    <div class="quick-actions-grid">
                        <button class="quick-action-btn" onclick="document.querySelector('[data-tab=\\'convert\\']').click()">
                            <i data-lucide="refresh-cw"></i> <span>Convertir</span>
                        </button>
                        <button class="quick-action-btn" onclick="document.querySelector('[data-tab=\\'youtube\\']').click()">
                            <i data-lucide="youtube"></i> <span>YouTube</span>
                        </button>
                    </div>
                `;
                break;
            case 'note':
                content = `
                    <textarea id="note-${widget.id}" placeholder="Écrire une note..."></textarea>
                `;
                break;
            case 'news':
                content = `
                    <div class="news-list" id="news-list-${widget.id}">
                        <div style="color: var(--text-muted); padding: 20px; text-align: center;">Chargement des actus...</div>
                    </div>
                `;
                break;
            case 'downloads':
                content = `
                    <div class="download-status-list" id="download-list-${widget.id}">
                        <div style="color: var(--text-muted); padding: 20px; text-align: center;">Aucun téléchargement actif</div>
                    </div>
                `;
                break;
            default:
                content = `<div style="padding: 20px; text-align: center; color: var(--text-muted)">Contenu du widget...</div>`;
        }

        return header + content;
    }

    initNoteWidget(id) {
        const textarea = document.getElementById(`note-${id}`);
        if (!textarea) return;

        // Load saved note
        textarea.value = localStorage.getItem(`ultra-note-${id}`) || '';

        // Save on change
        textarea.addEventListener('input', (e) => {
            localStorage.setItem(`ultra-note-${id}`, e.target.value);
        });
    }

    async fetchNewsForWidget(id) {
        const listContainer = document.getElementById(`news-list-${id}`);
        if (!listContainer) return;

        try {
            const rssUrl = 'https://www.franceinfo.fr/titres.rss';
            // Use rss2json to convert RSS to JSON as it's easier to handle client-side without CORS issues for this specific feed
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status === 'ok') {
                const items = data.items.slice(0, 4);
                listContainer.innerHTML = items.map(item => `
                    <a href="${item.link}" target="_blank" class="news-item">
                        <span class="news-title">${item.title}</span>
                        <span class="news-meta">France Info • ${new Date(item.pubDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </a>
                `).join('');
            } else {
                throw new Error('RSS conversion failed');
            }
        } catch (error) {
            console.error('News fetch error:', error);
            listContainer.innerHTML = '<div style="color: var(--error); font-size: 0.82rem; text-align: center; padding: 15px;">Impossible de charger les actualités France Info.</div>';
        }
    }

    async updateDownloadsForWidget(id) {
        const listContainer = document.getElementById(`download-list-${id}`);
        if (!listContainer) return;

        try {
            // Check torrent list as an example of active downloads
            const response = await fetch('/api/torrent/list');
            if (response.ok) {
                const torrents = await response.json();
                const active = (Array.isArray(torrents) ? torrents : []).filter(t => t.progress < 1).slice(0, 2);

                if (active.length > 0) {
                    listContainer.innerHTML = active.map(t => `
                        <div class="download-item">
                            <div class="download-info">
                                <span class="download-name">${t.name}</span>
                                <span class="download-percent">${Math.round(t.progress * 100)}%</span>
                            </div>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" style="width: ${t.progress * 100}%"></div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    listContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 10px;">Aucun téléchargement en cours</div>';
                }
            }
        } catch (error) {
            listContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 10px;">Service indisponible</div>';
        }
    }

    updateAllWeather() {
        this.widgets.filter(w => w.type === 'weather').forEach(w => this.fetchWeatherForWidget(w.id));
    }

    async fetchWeatherForWidget(widgetId) {
        const fallbackCoords = { latitude: 48.8566, longitude: 2.3522, name: "Paris, France" };

        if (!navigator.geolocation) {
            this.fetchWeatherFromAPI(widgetId, fallbackCoords.latitude, fallbackCoords.longitude, fallbackCoords.name);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                this.fetchWeatherFromAPI(widgetId, latitude, longitude, "Position actuelle");
            },
            (error) => {
                console.warn('Geolocation error, falling back to Paris:', error);
                this.fetchWeatherFromAPI(widgetId, fallbackCoords.latitude, fallbackCoords.longitude, fallbackCoords.name);
            },
            { timeout: 5000 } // Add a timeout to geolocation
        );
    }

    async fetchWeatherFromAPI(widgetId, lat, lon, locationName) {
        try {
            // Use Open-Meteo (No API Key needed)
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.current_weather) {
                const weatherData = {
                    temp: Math.round(data.current_weather.temperature),
                    code: data.current_weather.weathercode,
                    lat: lat,
                    lon: lon,
                    locationName: locationName
                };
                this.updateWeatherUI(widgetId, weatherData);
            }
        } catch (error) {
            console.error('Weather fetch error:', error);
            this.updateWeatherUI(widgetId, { error: "Erreur API" });
        }
    }

    updateWeatherUI(widgetId, data) {
        const container = document.getElementById(`weather-content-${widgetId}`);
        const locationEl = document.getElementById(`weather-location-${widgetId}`);
        if (!container) return;

        if (data.error) {
            container.innerHTML = `<div style="color: var(--error); font-size: 0.9rem; padding: 10px;">${data.error}</div>`;
            return;
        }

        const icon = this.getWeatherIconByCode(data.code);
        const desc = this.getWeatherDescByCode(data.code);

        container.innerHTML = `
            <div class="weather-info">
                <span class="weather-temp">${data.temp}°C</span>
                <span class="weather-desc">${desc}</span>
            </div>
            <div class="weather-icon-large">${icon}</div>
        `;

        if (locationEl) {
            locationEl.innerHTML = `<i data-lucide="map-pin" style="width: 12px"></i> ${data.locationName || 'Position actuelle'}`;
            if (window.lucide) window.lucide.createIcons();
        }
    }

    getWeatherIconByCode(code) {
        // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
        if (code === 0) return '☀️'; // Clear sky
        if (code <= 3) return '🌤️'; // Partly cloudy
        if (code <= 48) return '☁️'; // Fog
        if (code <= 67) return '🌧️'; // Rain
        if (code <= 77) return '❄️'; // Snow
        if (code <= 82) return '🌧️'; // Rain showers
        if (code <= 99) return '⚡'; // Thunderstorm
        return '☀️';
    }

    getWeatherDescByCode(code) {
        const codes = {
            0: "Ciel dégagé",
            1: "Principalement dégagé", 2: "Partiellement nuageux", 3: "Couvert",
            45: "Brouillard", 48: "Brouillard givrant",
            51: "Bruine légère", 53: "Bruine modérée", 55: "Bruine dense",
            61: "Pluie légère", 63: "Pluie modérée", 65: "Pluie forte",
            71: "Neige légère", 73: "Neige modérée", 75: "Neige forte",
            80: "Averses de pluie légères", 81: "Averses de pluie modérées", 82: "Averses de pluie violentes",
            95: "Orage", 96: "Orage avec grêle légère", 99: "Orage avec grêle forte"
        };
        return codes[code] || "Ensoleillé";
    }


    getWidgetIcon(type) {
        switch (type) {
            case 'clock': return 'clock';
            case 'weather': return 'cloud-sun';
            case 'quick-actions': return 'zap';
            case 'system': return 'cpu';
            case 'note': return 'sticky-note';
            case 'news': return 'newspaper';
            case 'downloads': return 'download';
            default: return 'layout';
        }
    }

    startClock() {
        const updateTime = () => {
            const timeEl = document.getElementById('widgetTime');
            const dateEl = document.getElementById('widgetDate');

            if (timeEl && dateEl) {
                const now = new Date();
                timeEl.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                dateEl.textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            }
        };

        updateTime();
        setInterval(updateTime, 1000);
    }
}
