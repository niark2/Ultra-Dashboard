import { formatSize, formatSpeed, formatEta, refreshIcons } from '../utils/formatters.js';

export class TorrentModule {
    constructor() {
        this.dom = {
            tab: document.getElementById('tab-torrent'),
            status: document.getElementById('torrentConnectionStatus'),
            loginOverlay: document.getElementById('torrentLoginOverlay'),
            user: document.getElementById('qbitUser'),
            pass: document.getElementById('qbitPass'),
            loginBtn: document.getElementById('qbitLoginBtn'),

            listBody: document.getElementById('torrentListBody'),

            addBtn: document.getElementById('torrentAddBtn'),
            magnetBtn: document.getElementById('torrentMagnetBtn'),
            fileInput: document.getElementById('torrentFileInput'),
            addModal: document.getElementById('addTorrentModal'),
            addOverlay: document.getElementById('addTorrentOverlay'),
            closeAddModal: document.getElementById('closeAddModal'),
            magnetInput: document.getElementById('magnetInput'),
            submitAdd: document.getElementById('submitAddTorrent'),
            pasteBtn: document.getElementById('pasteMagnetBtn'),

            totalDl: document.getElementById('totalDlSpeed'),
            totalUl: document.getElementById('totalUlSpeed'),

            pauseAll: document.getElementById('torrentPauseAllBtn'),
            resumeAll: document.getElementById('torrentResumeAllBtn'),
        };

        this.pollingInterval = null;
        this.cache = new Map(); // Store row elements by hash
        this.completedTorrents = new Set();
        this.init();
    }

    init() {
        if (!this.dom.tab) return;

        // Login
        this.dom.loginBtn.addEventListener('click', () => this.login());

        // Open file selector
        this.dom.addBtn.addEventListener('click', () => this.dom.fileInput.click());

        // Handle file selection
        this.dom.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Modal for magnet
        this.dom.magnetBtn.addEventListener('click', () => this.showAddModal());
        this.dom.closeAddModal.addEventListener('click', () => this.hideAddModal());
        this.dom.addOverlay.addEventListener('click', () => this.hideAddModal());

        // Add Torrent
        this.dom.submitAdd.addEventListener('click', () => this.addTorrent());
        this.dom.pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                this.dom.magnetInput.value = text;
            } catch (err) {
                console.error('Failed to read clipboard', err);
            }
        });

        // Global Actions
        this.dom.pauseAll.addEventListener('click', () => this.globalAction('pause'));
        this.dom.resumeAll.addEventListener('click', () => this.globalAction('resume'));

        // Start Loop
        this.startPolling();
    }

    startPolling() {
        // Poll every 2 seconds
        this.pollingInterval = setInterval(() => {
            if (this.dom.tab.classList.contains('active')) {
                this.fetchData();
            }
        }, 2000);

        // Initial fetch
        setTimeout(() => {
            if (this.dom.tab.classList.contains('active')) {
                this.fetchData();
            }
        }, 500);
    }

    async login() {
        try {
            const username = this.dom.user.value;
            const password = this.dom.pass.value;

            const res = await fetch('/api/torrent/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (data.success) {
                this.dom.loginOverlay.classList.add('hidden');
                this.fetchData();
            } else {
                alert('Login failed');
            }
        } catch (e) {
            console.error(e);
            alert('Login error');
        }
    }

    async fetchData() {
        try {
            const res = await fetch('/api/torrent/list');
            if (res.status === 403 || res.status === 401) {
                this.dom.loginOverlay.classList.remove('hidden');
                this.updateStatus(false);
                return;
            }

            const data = await res.json();
            this.dom.loginOverlay.classList.add('hidden');
            this.updateStatus(true);
            this.render(data);
        } catch (e) {
            console.error('Fetch error:', e);
            this.updateStatus(false);
        }
    }

    updateStatus(connected) {
        if (connected) {
            this.dom.status.innerHTML = '<i data-lucide="check-circle" class="status-icon"></i> CONNECTÉ';
            this.dom.status.className = 'status-badge connected';
        } else {
            this.dom.status.innerHTML = '<i data-lucide="power" class="status-icon"></i> DÉCONNECTÉ';
            this.dom.status.className = 'status-badge disconnected';
        }
        refreshIcons();
    }

    visibleTorrents = new Set();

    render(torrents) {
        if (!Array.isArray(torrents)) {
            console.error('Expected array of torrents, got:', torrents);
            return;
        }

        // Calculate totals
        let dl = 0, ul = 0;

        const currentHashes = new Set();

        torrents.forEach(t => {
            dl += t.dlspeed;
            ul += t.upspeed;
            currentHashes.add(t.hash);

            let row = this.cache.get(t.hash);
            if (!row) {
                row = this.createRow(t);
                this.dom.listBody.appendChild(row);
                this.cache.set(t.hash, row);
            }

            this.updateRow(row, t);

            // Notify on completion
            if (t.progress === 1 && !this.completedTorrents.has(t.hash)) {
                this.completedTorrents.add(t.hash);
                document.dispatchEvent(new CustomEvent('app-notification', {
                    detail: {
                        title: 'Torrent terminé',
                        message: `Le téléchargement de "${t.name}" est fini.`,
                        type: 'success',
                        icon: 'package'
                    }
                }));
            }
        });

        // Remove old
        for (const [hash, row] of this.cache) {
            if (!currentHashes.has(hash)) {
                row.remove();
                this.cache.delete(hash);
            }
        }

        this.dom.totalDl.textContent = formatSpeed(dl);
        this.dom.totalUl.textContent = formatSpeed(ul);

        refreshIcons();
    }

    createRow(t) {
        const div = document.createElement('div');
        div.className = 'torrent-item';
        div.innerHTML = `
            <div class="torrent-icon"><i data-lucide="package"></i></div>
            <div class="torrent-name-col">
                <div class="torrent-name" title="${t.name}">${t.name}</div>
                <div class="torrent-meta">
                    <span class="meta-peers"><i data-lucide="users" class="inline-icon"></i> ${t.num_leechs}/${t.num_seeds}</span>
                    <span class="meta-eta"><i data-lucide="clock" class="inline-icon"></i> ${formatEta(t.eta)}</span>
                </div>
            </div>
            <div class="size-col">${formatSize(t.total_size)}</div>
            <div class="progress-col">
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${t.progress * 100}%"></div>
                </div>
                <div class="progress-text">${(t.progress * 100).toFixed(1)}%</div>
            </div>
            <div class="speed-col">
                <div class="speed-down"><i data-lucide="arrow-down" class="inline-icon"></i> ${formatSpeed(t.dlspeed)}</div>
                <div class="speed-up"><i data-lucide="arrow-up" class="inline-icon"></i> ${formatSpeed(t.upspeed)}</div>
            </div>
            <div class="actions-col">
                <button class="btn-icon-s action-toggle" title="Pause/Resume">
                    <i data-lucide="${t.state === 'pausedDL' || t.state === 'pausedUP' ? 'play' : 'pause'}"></i>
                </button>
                <button class="btn-icon-s delete action-delete" title="Supprimer"><i data-lucide="trash-2"></i></button>
            </div>
        `;

        // Bind events
        div.querySelector('.action-toggle').addEventListener('click', () => {
            const isPaused = t.state === 'pausedDL' || t.state === 'pausedUP';
            this.singleAction(isPaused ? 'resume' : 'pause', t.hash);
        });

        div.querySelector('.action-delete').addEventListener('click', () => {
            if (confirm(`Supprimer ${t.name} ?`)) {
                this.singleAction('delete', t.hash);
            }
        });

        return div;
    }

    updateRow(row, t) {
        // Only update text/attributes to avoid heavy DOM ops
        row.querySelector('.torrent-name').textContent = t.name;
        row.querySelector('.meta-peers').innerHTML = `<i data-lucide="users" class="inline-icon"></i> ${t.num_leechs}L / ${t.num_seeds}S`;
        row.querySelector('.meta-eta').innerHTML = `<i data-lucide="clock" class="inline-icon"></i> ${formatEta(t.eta)}`;

        row.querySelector('.size-col').textContent = formatSize(t.total_size);

        row.querySelector('.progress-fill').style.width = `${t.progress * 100}%`;
        row.querySelector('.progress-text').textContent = `${(t.progress * 100).toFixed(1)}%`;

        row.querySelector('.speed-down').innerHTML = `<i data-lucide="arrow-down" class="inline-icon"></i> ${formatSpeed(t.dlspeed)}`;
        row.querySelector('.speed-up').innerHTML = `<i data-lucide="arrow-up" class="inline-icon"></i> ${formatSpeed(t.upspeed)}`;

        const toggleBtn = row.querySelector('.action-toggle');
        const isPaused = t.state === 'pausedDL' || t.state === 'pausedUP' || t.state === 'stoppedDL' || t.state === 'stoppedUP';

        toggleBtn.innerHTML = `<i data-lucide="${isPaused ? 'play' : 'pause'}"></i>`;
        refreshIcons();

        // Status updates on Icon/Color could be added here
        if (t.state.includes('error')) {
            row.style.borderLeft = '4px solid #ef4444';
        } else if (t.progress === 1) {
            row.style.borderLeft = '4px solid #3b82f6';
        } else if (isPaused) {
            row.style.borderLeft = '4px solid #6b7280';
        } else {
            row.style.borderLeft = '4px solid #10b981';
        }
    }

    // Actions
    showAddModal() {
        this.dom.addModal.classList.add('visible');
        this.dom.addOverlay.classList.add('visible');
        this.dom.magnetInput.focus();
    }

    hideAddModal() {
        this.dom.addModal.classList.remove('visible');
        this.dom.addOverlay.classList.remove('visible');
        this.dom.magnetInput.value = '';
    }

    async addTorrent() {
        const urls = this.dom.magnetInput.value.trim();
        if (!urls) return;

        this.dom.submitAdd.textContent = 'Envoi...';
        try {
            await fetch('/api/torrent/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls })
            });
            this.hideAddModal();
            this.fetchData(); // Instant update
        } catch (e) {
            alert('Erreur: ' + e.message);
        } finally {
            this.dom.submitAdd.textContent = 'Télécharger';
        }
    }

    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.torrent')) {
            alert('Veuillez sélectionner un fichier .torrent');
            return;
        }

        await this.addTorrentFile(file);
        // Reset input
        e.target.value = '';
    }

    async addTorrentFile(file) {
        const formData = new FormData();
        formData.append('torrents', file);

        const originalBtnText = this.dom.addBtn.innerHTML;
        this.dom.addBtn.disabled = true;
        this.dom.addBtn.innerHTML = '<span class="btn-loader"></span>';

        try {
            const res = await fetch('/api/torrent/add-file', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                this.fetchData();
            } else {
                const err = await res.json();
                alert('Erreur: ' + (err.error || 'Échec de l\'ajout du torrent'));
            }
        } catch (e) {
            console.error(e);
            alert('Erreur de connexion');
        } finally {
            this.dom.addBtn.disabled = false;
            this.dom.addBtn.innerHTML = originalBtnText;
            refreshIcons();
        }
    }

    async singleAction(action, hash) {
        // Action: pause, resume, delete
        try {
            await fetch(`/api/torrent/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hashes: hash })
            });
            setTimeout(() => this.fetchData(), 200);
        } catch (e) {
            console.error(e);
        }
    }

    async globalAction(action) {
        // This assumes 'all' or iterating. 
        // qBittorrent 'pause' endpoint takes list of hashes separated by |. 
        // Since I don't have all hashes readily available without iterating my cache or fetching.
        // Let's implement global pause/resume slightly different or just fetch hashes first.
        // Actually simpler: pass 'all' if API supports it, but v2 API usually needs hashes.
        // I'll grab hashes from cache keys.
        const hashes = Array.from(this.cache.keys()).join('|');
        if (!hashes) return;

        await fetch(`/api/torrent/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hashes })
        });
        setTimeout(() => this.fetchData(), 500);
    }
}
