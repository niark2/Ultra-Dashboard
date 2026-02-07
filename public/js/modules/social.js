import { formatDuration, refreshIcons } from '../utils/formatters.js';

export class SocialModule {
    constructor() {
        this.elements = {
            urlInput: document.getElementById('socialUrl'),
            searchBtn: document.getElementById('socialSearchBtn'),
            preview: document.getElementById('socialPreview'),
            loading: document.getElementById('socialLoading'),
            thumbnail: document.getElementById('socialThumbnail'),
            title: document.getElementById('socialTitle'),
            channel: document.getElementById('socialChannel'),
            duration: document.getElementById('socialDuration'),
            downloadBtn: document.getElementById('socialDownloadBtn'),
            saveBtn: document.getElementById('socialSaveBtn'),

            // Controls
            modeToggles: document.querySelectorAll('.social-mode-toggle .toggle-btn'),
            qualitySelect: document.getElementById('socialQuality'),
            formatSelect: document.getElementById('socialFormat'),

            // Progress
            progressContainer: document.getElementById('socialProgressContainer'),
            progressFill: document.getElementById('socialProgressFill'),
            progressStatus: document.getElementById('socialProgressStatus'),
            progressPercent: document.getElementById('socialProgressPercent'),

            // Empty State
            emptyState: document.getElementById('socialEmptyState'),
            historyList: document.getElementById('socialHistoryList'),
            clearHistoryBtn: document.getElementById('btnClearSocialHistory')
        };

        this.currentMode = 'video';
        this.currentUrl = '';
        this.mediaInfo = null;

        if (this.elements.urlInput) {
            this.init();
        }
    }

    init() {
        // Search
        this.elements.searchBtn.onclick = () => this.fetchInfo();
        this.elements.urlInput.onkeypress = (e) => {
            if (e.key === 'Enter') this.fetchInfo();
        };

        // Mode Toggle
        this.elements.modeToggles.forEach(btn => {
            btn.onclick = () => {
                this.elements.modeToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setMode(btn.dataset.mode);
            };
        });

        // Download
        this.elements.downloadBtn.onclick = () => this.download();

        // History
        this.elements.clearHistoryBtn.onclick = () => this.clearHistory();
        this.loadHistory();

        // Initial format population
        this.setMode('video');
    }

    setMode(mode) {
        this.currentMode = mode;
        const formatSelect = this.elements.formatSelect;
        formatSelect.innerHTML = '';

        if (mode === 'video') {
            ['mp4', 'mkv', 'webm'].forEach(fmt => {
                formatSelect.add(new Option(fmt.toUpperCase(), fmt));
            });
            this.elements.qualitySelect.disabled = false;
        } else {
            ['mp3', 'm4a', 'wav', 'opus'].forEach(fmt => {
                formatSelect.add(new Option(fmt.toUpperCase(), fmt));
            });
            this.elements.qualitySelect.disabled = true;
        }

        if (this.mediaInfo && mode === 'video') {
            this.populateQualities(this.mediaInfo.resolutions);
        }
    }

    async fetchInfo() {
        const url = this.elements.urlInput.value.trim();
        if (!url) return;

        this.currentUrl = url;
        this.showLoading(true);
        this.elements.preview.classList.add('hidden');
        this.elements.emptyState.classList.add('hidden');
        if (this.elements.saveBtn) this.elements.saveBtn.classList.add('hidden');
        this.elements.downloadBtn.classList.remove('hidden');

        try {
            const res = await fetch(`/api/social/info?url=${encodeURIComponent(url)}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            this.mediaInfo = data;
            this.updatePreview(data);
        } catch (error) {
            alert('Erreur: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    updatePreview(data) {
        this.elements.thumbnail.src = data.thumbnail || '/img/social-placeholder.png';
        this.elements.title.textContent = data.title;
        this.elements.channel.textContent = data.platform.toUpperCase() + (data.channel ? ` • ${data.channel}` : '');
        this.elements.duration.textContent = formatDuration(data.duration);

        this.populateQualities(data.resolutions);
        this.setMode(this.currentMode);
        this.elements.preview.classList.remove('hidden');
        this.elements.emptyState.classList.add('hidden');
    }

    async addToHistory(data) {
        let history = await this.getHistory();
        const newItem = {
            id: Date.now(),
            title: data.title,
            thumbnail: data.thumbnail,
            platform: data.platform,
            timestamp: new Date().toISOString()
        };

        // Remove duplicates (same title/platform)
        history = history.filter(item => item.title !== data.title);
        history.unshift(newItem);
        history = history.slice(0, 10); // Keep last 10

        await localStorage.setItem('ultra-social-history', JSON.stringify(history));
        this.renderHistory(history);
    }

    async getHistory() {
        const history = localStorage.getItem('ultra-social-history');
        return history ? JSON.parse(history) : [];
    }

    async loadHistory() {
        const history = await this.getHistory();
        this.renderHistory(history);
    }

    renderHistory(history) {
        const list = this.elements.historyList;
        if (!history || history.length === 0) {
            list.innerHTML = '<p class="empty-history-text">Aucun téléchargement récent</p>';
            return;
        }

        list.innerHTML = history.map(item => `
            <div class="history-item">
                <img src="${item.thumbnail || '/img/social-placeholder.png'}" class="history-item-thumb">
                <div class="history-item-info">
                    <div class="history-item-title">${item.title}</div>
                    <div class="history-item-meta">${item.platform.toUpperCase()} • ${new Date(item.timestamp).toLocaleDateString()}</div>
                </div>
            </div>
        `).join('');
        refreshIcons();
    }

    clearHistory() {
        localStorage.removeItem('ultra-social-history');
        this.renderHistory([]);
    }

    populateQualities(resolutions) {
        const select = this.elements.qualitySelect;
        select.innerHTML = '<option value="best">Auto (Max)</option>';

        if (resolutions && resolutions.length) {
            resolutions.forEach(res => {
                const label = res >= 2160 ? '4K/2160p' :
                    res >= 1080 ? '1080p' : `${res}p`;
                select.add(new Option(label, res));
            });
        }
    }

    async download() {
        const btn = this.elements.downloadBtn;
        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');
        const downloadId = Date.now().toString();

        btn.disabled = true;
        btnText.textContent = 'Initialisation...';
        btnLoader.classList.remove('hidden');

        if (this.elements.progressContainer) {
            this.elements.progressContainer.classList.remove('hidden');
            this.elements.progressFill.style.width = '0%';
            this.elements.progressStatus.textContent = 'Démarrage...';
            this.elements.progressPercent.textContent = '0%';
        }

        const eventSource = new EventSource(`/api/social/progress/${downloadId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'progress') {
                if (this.elements.progressFill) this.elements.progressFill.style.width = `${data.percent}%`;
                if (this.elements.progressPercent) this.elements.progressPercent.textContent = `${Math.round(data.percent)}%`;
                if (this.elements.progressStatus) this.elements.progressStatus.textContent = data.status;
                btnText.textContent = `${data.status} (${Math.round(data.percent)}%)`;
            } else if (data.type === 'complete') {
                if (this.elements.progressFill) this.elements.progressFill.style.width = '100%';
                if (this.elements.progressPercent) this.elements.progressPercent.textContent = '100%';
                if (this.elements.progressStatus) this.elements.progressStatus.textContent = 'Prêt !';
                btnText.textContent = 'Téléchargement...';
                this.addToHistory(this.mediaInfo);
            }
        };

        try {
            const body = {
                url: this.currentUrl,
                downloadId: downloadId,
                mode: this.currentMode,
                quality: this.elements.qualitySelect.value,
                format: this.elements.formatSelect.value
            };

            const res = await fetch('/api/social/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erreur inconnue');
            }

            eventSource.close();

            const data = await res.json();

            document.dispatchEvent(new CustomEvent('app-notification', {
                detail: {
                    title: 'Téléchargement terminé',
                    message: `Le média "${this.mediaInfo.title}" de ${this.mediaInfo.platform} est prêt.`,
                    type: 'success',
                    icon: 'share-2'
                }
            }));

            // Show Save Button
            if (data.fileName && this.elements.saveBtn) {
                this.elements.saveBtn.href = `/databank/${data.fileName}`;
                this.elements.saveBtn.download = data.prettyName || data.fileName;
                this.elements.saveBtn.classList.remove('hidden');
                this.elements.downloadBtn.classList.add('hidden');
                if (this.elements.progressStatus) this.elements.progressStatus.textContent = 'Enregistré dans la Databank !';
            }

        } catch (error) {
            eventSource.close();
            alert('Erreur: ' + error.message);
        } finally {
            btn.disabled = false;
            btnText.textContent = 'Télécharger';
            btnLoader.classList.add('hidden');
            setTimeout(() => {
                if (this.elements.progressContainer) this.elements.progressContainer.classList.add('hidden');
            }, 5000);
        }
    }

    showLoading(show) {
        if (show) {
            this.elements.loading.classList.remove('hidden');
        } else {
            this.elements.loading.classList.add('hidden');
            // If no preview is shown, restore empty state
            if (this.elements.preview.classList.contains('hidden')) {
                this.elements.emptyState.classList.remove('hidden');
            }
        }
    }
}
