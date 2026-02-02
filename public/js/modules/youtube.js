import { formatDuration, refreshIcons } from '../utils/formatters.js';

export class YoutubeModule {
    constructor() {
        this.elements = {
            urlInput: document.getElementById('ytUrl'),
            searchBtn: document.getElementById('ytSearchBtn'),
            preview: document.getElementById('ytPreview'),
            loading: document.getElementById('ytLoading'),
            thumbnail: document.getElementById('ytThumbnail'),
            title: document.getElementById('ytTitle'),
            channel: document.getElementById('ytChannel'),
            duration: document.getElementById('ytDuration'),
            downloadBtn: document.getElementById('ytDownloadBtn'),

            // Advanced Controls
            modeToggles: document.querySelectorAll('.mode-toggle .toggle-btn'),
            qualitySelect: document.getElementById('ytQuality'),
            formatSelect: document.getElementById('ytFormat'),
            advancedBtn: document.getElementById('ytAdvancedBtn'),
            advancedPanel: document.getElementById('ytAdvancedOptions'),

            // Options
            chkMetadata: document.getElementById('chkMetadata'),
            chkThumbnail: document.getElementById('chkThumbnail'),
            chkSubs: document.getElementById('chkSubs'),
            trimStart: document.getElementById('trimStart'),
            trimEnd: document.getElementById('trimEnd'),
            containerSubtitles: document.getElementById('containerSubtitles')
        };

        this.currentMode = 'video'; // video | audio
        this.currentUrl = '';
        this.videoInfo = null;

        this.init();
    }

    init() {
        // Search
        this.elements.searchBtn.onclick = () => this.fetchInfo();
        this.elements.urlInput.onkeypress = (e) => {
            if (e.key === 'Enter') this.fetchInfo();
        };

        // Mode Toggle (Video/Audio)
        this.elements.modeToggles.forEach(btn => {
            btn.onclick = () => {
                this.elements.modeToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setMode(btn.dataset.mode);
            };
        });

        // Advanced Toggle
        this.elements.advancedBtn.onclick = () => {
            this.elements.advancedPanel.classList.toggle('hidden');
        };

        // Download
        this.elements.downloadBtn.onclick = () => this.download();
    }

    setMode(mode) {
        this.currentMode = mode;

        // Update Format Options
        const formatSelect = this.elements.formatSelect;
        formatSelect.innerHTML = '';

        if (mode === 'video') {
            ['mp4', 'mkv', 'webm'].forEach(fmt => {
                formatSelect.add(new Option(fmt.toUpperCase(), fmt));
            });
            this.elements.qualitySelect.disabled = false;
            this.elements.chkSubs.disabled = false;
            this.elements.containerSubtitles.style.opacity = '1';
        } else {
            ['mp3', 'm4a', 'wav', 'flac'].forEach(fmt => {
                formatSelect.add(new Option(fmt.toUpperCase(), fmt));
            });
            this.elements.qualitySelect.disabled = true;
            this.elements.chkSubs.disabled = true;
            this.elements.chkSubs.checked = false;
            this.elements.containerSubtitles.style.opacity = '0.5';
        }

        // Refresh Quality if video
        if (this.videoInfo && mode === 'video') {
            this.populateQualities(this.videoInfo.resolutions);
        }
    }

    async fetchInfo() {
        const url = this.elements.urlInput.value.trim();
        if (!url) return;

        this.currentUrl = url;
        this.showLoading(true);
        this.elements.preview.classList.add('hidden');

        try {
            const res = await fetch(`/api/youtube/info?url=${encodeURIComponent(url)}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            this.videoInfo = data;
            this.updatePreview(data);
        } catch (error) {
            alert('Erreur: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    updatePreview(data) {
        this.elements.thumbnail.src = data.thumbnail;
        this.elements.title.textContent = data.title;
        this.elements.channel.textContent = data.channel || 'YouTube Video';
        this.elements.duration.textContent = formatDuration(data.duration);

        // Populate Resolutions
        this.populateQualities(data.resolutions);

        // Initialize Mode
        this.setMode('video');

        this.elements.preview.classList.remove('hidden');
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

        // Create a unique ID for this download to track progress
        const downloadId = Date.now().toString();

        btn.disabled = true;
        btnText.textContent = 'Initialisation...';
        btnLoader.classList.remove('hidden');

        // Elements for progress
        const progressContainer = document.getElementById('ytProgressContainer');
        const progressFill = document.getElementById('ytProgressFill');
        const progressStatus = document.getElementById('ytProgressStatus');
        const progressPercent = document.getElementById('ytProgressPercent');

        // Reset and show progress
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
            progressFill.style.width = '0%';
            progressStatus.textContent = 'Démarrage...';
            progressPercent.textContent = '0%';
        }

        // Connect to progress events
        const eventSource = new EventSource(`/api/youtube/progress/${downloadId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'progress') {
                if (progressFill) progressFill.style.width = `${data.percent}%`;
                if (progressPercent) progressPercent.textContent = `${Math.round(data.percent)}%`;
                if (progressStatus) progressStatus.textContent = data.status;
                btnText.textContent = `${data.status} (${Math.round(data.percent)}%)`;
            } else if (data.type === 'complete') {
                if (progressFill) progressFill.style.width = '100%';
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressStatus) progressStatus.textContent = 'Prêt pour le téléchargement !';
                btnText.textContent = 'Finalisation...';
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        try {
            const body = {
                url: this.currentUrl,
                videoId: downloadId,
                mode: this.currentMode,
                quality: this.elements.qualitySelect.value,
                format: this.elements.formatSelect.value,
                embedMetadata: this.elements.chkMetadata.checked,
                embedThumbnail: this.elements.chkThumbnail.checked,
                embedSubs: this.elements.chkSubs.checked,
                trimStart: this.elements.trimStart.value,
                trimEnd: this.elements.trimEnd.value
            };

            const res = await fetch('/api/youtube/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erreur inconnue');
            }

            // Success! Close event source
            eventSource.close();

            // Trigger download browser-side
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Use the video title for the downloaded file if available
            const finalName = this.videoInfo ? `${this.videoInfo.title}.${body.format}` : `video.${body.format}`;
            a.download = finalName;
            a.click();
            URL.revokeObjectURL(url);

            if (progressStatus) progressStatus.textContent = 'Téléchargé !';

        } catch (error) {
            eventSource.close();
            alert('Erreur: ' + error.message);
            if (progressStatus) progressStatus.textContent = 'Échec';
        } finally {
            btn.disabled = false;
            btnText.textContent = 'Télécharger';
            btnLoader.classList.add('hidden');
            // Keep progress visible for 3 seconds then hide
            setTimeout(() => {
                if (progressContainer) progressContainer.classList.add('hidden');
            }, 5000);
        }
    }

    showLoading(show) {
        if (show) {
            this.elements.loading.classList.remove('hidden');
        } else {
            this.elements.loading.classList.add('hidden');
        }
    }

}

