import { formatDuration, refreshIcons } from '../utils/formatters.js';
import { I18n } from '../utils/i18n.js';

export class DownloaderModule {
    constructor() {
        // ... (constructor remains same)
        this.elements = {
            urlInput: document.getElementById('dlUrl'),
            searchBtn: document.getElementById('dlSearchBtn'),
            preview: document.getElementById('dlPreview'),
            loading: document.getElementById('dlLoading'),
            thumbnail: document.getElementById('dlThumbnail'),
            title: document.getElementById('dlTitle'),
            channel: document.getElementById('dlChannel'),
            duration: document.getElementById('dlDuration'),
            downloadBtn: document.getElementById('dlDownloadBtn'),
            saveBtn: document.getElementById('dlSaveBtn'),

            // Advanced Controls
            modeToggles: document.querySelectorAll('.dl-mode-toggle .toggle-btn'),
            qualitySelect: document.getElementById('dlQuality'),
            formatSelect: document.getElementById('dlFormat'),
            advancedBtn: document.getElementById('dlAdvancedBtn'),
            advancedPanel: document.getElementById('dlAdvancedOptions'),

            // Options
            chkMetadata: document.getElementById('chkDlMetadata'),
            chkThumbnail: document.getElementById('chkDlThumbnail'),
            chkSubs: document.getElementById('chkDlSubs'),
            trimStart: document.getElementById('trimDlStart'),
            trimEnd: document.getElementById('trimDlEnd'),
            containerSubtitles: document.getElementById('containerDlSubtitles'),

            // Progress
            progressContainer: document.getElementById('dlProgressContainer'),
            progressFill: document.getElementById('dlProgressFill'),
            progressStatus: document.getElementById('dlProgressStatus'),
            progressPercent: document.getElementById('dlProgressPercent'),

            // Empty State
            emptyState: document.getElementById('dlEmptyState'),
            historyList: document.getElementById('dlHistoryList'),
            clearHistoryBtn: document.getElementById('btnClearDlHistory')
        };

        this.currentMode = 'video';
        this.currentUrl = '';
        this.mediaInfo = null;

        if (this.elements.urlInput) {
            this.init();
        }
    }

    // ... (init, isYoutube, setMode, fetchInfo, updatePreview, addToHistory, getHistory, loadHistory remain mostly same)

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

        // Advanced Toggle
        if (this.elements.advancedBtn) {
            this.elements.advancedBtn.onclick = () => {
                this.elements.advancedPanel.classList.toggle('hidden');
            };
        }

        // Download
        this.elements.downloadBtn.onclick = () => this.download();

        // History
        this.elements.clearHistoryBtn.onclick = () => this.clearHistory();
        this.loadHistory();

        // Initial format population
        this.setMode('video');
    }

    isYoutube(url) {
        return url.includes('youtube.com') || url.includes('youtu.be');
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
            if (this.elements.chkSubs) this.elements.chkSubs.disabled = false;
            if (this.elements.containerSubtitles) this.elements.containerSubtitles.style.opacity = '1';
        } else {
            ['mp3', 'm4a', 'wav', 'flac', 'opus'].forEach(fmt => {
                formatSelect.add(new Option(fmt.toUpperCase(), fmt));
            });
            this.elements.qualitySelect.disabled = true;
            if (this.elements.chkSubs) {
                this.elements.chkSubs.disabled = true;
                this.elements.chkSubs.checked = false;
            }
            if (this.elements.containerSubtitles) this.elements.containerSubtitles.style.opacity = '0.5';
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
        this.elements.saveBtn.classList.add('hidden');
        this.elements.downloadBtn.classList.remove('hidden');

        const isYt = this.isYoutube(url);
        const endpoint = isYt ? '/api/youtube/info' : '/api/social/info';

        try {
            const res = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            this.mediaInfo = data;
            this.updatePreview(data);
        } catch (error) {
            alert(I18n.t('Erreur') + ': ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    updatePreview(data) {
        this.elements.thumbnail.src = data.thumbnail || '/img/social-placeholder.png';
        this.elements.title.textContent = data.title;

        let platformLabel = data.platform ? data.platform.toUpperCase() : 'YOUTUBE';
        this.elements.channel.textContent = platformLabel + (data.channel ? ` • ${data.channel}` : '');
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
            platform: data.platform || 'YouTube',
            timestamp: new Date().toISOString()
        };

        // Remove duplicates
        history = history.filter(item => item.title !== data.title);
        history.unshift(newItem);
        history = history.slice(0, 10);

        localStorage.setItem('ultra-dl-history', JSON.stringify(history));
        this.renderHistory(history);
    }

    async getHistory() {
        const history = localStorage.getItem('ultra-dl-history');
        if (!history) {
            // Try to migration from old histories
            const ytHistory = localStorage.getItem('ultra-yt-history');
            const socialHistory = localStorage.getItem('ultra-social-history');
            if (ytHistory || socialHistory) {
                let combined = [];
                if (ytHistory) combined = combined.concat(JSON.parse(ytHistory));
                if (socialHistory) combined = combined.concat(JSON.parse(socialHistory));
                combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                combined = combined.slice(0, 10);
                localStorage.setItem('ultra-dl-history', JSON.stringify(combined));
                // Optionally clear old ones
                return combined;
            }
            return [];
        }
        return JSON.parse(history);
    }

    async loadHistory() {
        const history = await this.getHistory();
        this.renderHistory(history);
    }

    renderHistory(history) {
        const list = this.elements.historyList;
        if (!history || history.length === 0) {
            list.innerHTML = `<p class="empty-history-text">${I18n.t('Aucun téléchargement récent')}</p>`;
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
        localStorage.removeItem('ultra-dl-history');
        localStorage.removeItem('ultra-yt-history');
        localStorage.removeItem('ultra-social-history');
        this.renderHistory([]);
    }

    populateQualities(resolutions) {
        const select = this.elements.qualitySelect;
        select.innerHTML = '<option value="best">Auto (Max)</option>';

        if (resolutions && resolutions.length) {
            resolutions.forEach(res => {
                const label = res >= 2160 ? '4K/2160p' :
                    res >= 1440 ? '2K/1440p' :
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
        btnText.textContent = I18n.t('Initialisation...');
        btnLoader.classList.remove('hidden');

        if (this.elements.progressContainer) {
            this.elements.progressContainer.classList.remove('hidden');
            this.elements.progressFill.style.width = '0%';
            this.elements.progressStatus.textContent = I18n.t('Démarrage...');
            this.elements.progressPercent.textContent = '0%';
        }

        const isYt = this.isYoutube(this.currentUrl);
        const progressEndpoint = isYt ? `/api/youtube/progress/${downloadId}` : `/api/social/progress/${downloadId}`;
        const downloadEndpoint = isYt ? '/api/youtube/download' : '/api/social/download';

        const eventSource = new EventSource(progressEndpoint);

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
                if (this.elements.progressStatus) this.elements.progressStatus.textContent = I18n.t('Prêt !');
                btnText.textContent = I18n.t('Téléchargement...');
                this.addToHistory(this.mediaInfo);
            }
        };

        try {
            const body = {
                url: this.currentUrl,
                mode: this.currentMode,
                quality: this.elements.qualitySelect.value,
                format: this.elements.formatSelect.value,
            };

            // Add specific fields for YouTube controller
            if (isYt) {
                body.videoId = downloadId;
                body.embedMetadata = this.elements.chkMetadata.checked;
                body.embedThumbnail = this.elements.chkThumbnail.checked;
                body.embedSubs = this.elements.chkSubs.checked;
                body.trimStart = this.elements.trimStart.value;
                body.trimEnd = this.elements.trimEnd.value;
            } else {
                body.downloadId = downloadId;
            }

            const res = await fetch(downloadEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || I18n.t('Erreur inconnue'));
            }

            eventSource.close();
            const data = await res.json();

            document.dispatchEvent(new CustomEvent('app-notification', {
                detail: {
                    title: I18n.t('Téléchargement terminé'),
                    message: `${I18n.t('Le média')} "${this.mediaInfo.title}" ${I18n.t('est prêt.')}`,
                    type: 'success',
                    icon: 'download'
                }
            }));

            if (data.fileName) {
                this.elements.saveBtn.href = `/databank/${data.fileName}`;
                this.elements.saveBtn.download = data.prettyName || data.fileName;
                this.elements.saveBtn.classList.remove('hidden');
                this.elements.downloadBtn.classList.add('hidden');
                if (this.elements.progressStatus) this.elements.progressStatus.textContent = I18n.t('Enregistré dans la Databank !');
            }

        } catch (error) {
            eventSource.close();
            alert(I18n.t('Erreur') + ': ' + error.message);
        } finally {
            btn.disabled = false;
            btnText.textContent = I18n.t('Télécharger');
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
            if (this.elements.preview.classList.contains('hidden')) {
                this.elements.emptyState.classList.remove('hidden');
            }
        }
    }
}
