/**
 * STT Module - Speech-to-Text avec Whisper
 */
import { Storage } from '../utils/storage.js';

export class STTModule {
    constructor() {
        this.selectedFile = null;
        this.isServerAvailable = false;
        this.reconnectInterval = null;
        this.availableModels = [];
        this.elements = {
            dropZone: document.getElementById('sttDropZone'),
            fileInput: document.getElementById('sttFileInput'),
            fileInfo: document.getElementById('sttFileInfo'),
            fileName: document.getElementById('sttFileName'),
            fileSize: document.getElementById('sttFileSize'),
            fileDuration: document.getElementById('sttFileDuration'),
            removeBtn: document.getElementById('sttRemoveFile'),
            modelSelect: document.getElementById('sttModelSelect'),
            transcribeBtn: document.getElementById('sttTranscribeBtn'),
            progressContainer: document.getElementById('sttProgressContainer'),
            progressFill: document.getElementById('sttProgressFill'),
            progressText: document.getElementById('sttProgressText'),
            resultContainer: document.getElementById('sttResultContainer'),
            resultText: document.getElementById('sttResultText'),
            copyBtn: document.getElementById('sttCopyBtn'),
            downloadBtn: document.getElementById('sttDownloadBtn'),
            newBtn: document.getElementById('sttNewBtn'),
            statusBadge: document.getElementById('sttStatusBadge'),
            serverError: document.getElementById('sttServerError')
        };
        this.init();
    }

    async init() {
        await this.checkServer();
        await this.loadModels();
        this.setupEventListeners();

        // Reload settings when tab is activated
        document.addEventListener('tab-changed', (e) => {
            if (e.detail.tabId === 'stt') {
                this.loadModels();
            }
        });
    }

    async checkServer() {
        try {
            const res = await fetch('/api/stt/health');
            const data = await res.json();
            this.isServerAvailable = data.available === true;
            this.updateServerStatus();
            return this.isServerAvailable;
        } catch (error) {
            this.isServerAvailable = false;
            this.updateServerStatus();
            return false;
        }
    }

    startAutoReconnect() {
        if (this.reconnectInterval) return;

        this.reconnectInterval = setInterval(async () => {
            if (!this.isServerAvailable) {
                const success = await this.checkServer();
                if (success) {
                    await this.loadModels();
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                }
            } else {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
        }, 3000);
    }

    async loadModels() {
        if (!this.isServerAvailable) return;

        try {
            const res = await fetch('/api/stt/models');
            const data = await res.json();
            this.availableModels = data.models || [];

            // Priority: Storage > Server Default
            const { Storage } = await import('../utils/storage.js');
            const savedModel = await Storage.get('ultra-whisper-default-model', '');
            this.populateModelSelect(savedModel || data.default || 'base');
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    }


    populateModelSelect(defaultModel) {
        const select = this.elements.modelSelect;
        if (!select) return;

        select.innerHTML = '';
        this.availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `${model.name} - ${model.description}`;
            option.selected = model.id === defaultModel;
            select.appendChild(option);
        });
    }

    updateServerStatus() {
        const badge = this.elements.statusBadge;
        const errorMsg = this.elements.serverError;

        if (this.isServerAvailable) {
            badge.textContent = '● Connecté';
            badge.classList.add('connected');
            badge.classList.remove('disconnected');
            errorMsg.classList.add('hidden');
            this.elements.dropZone.classList.remove('disabled');
        } else {
            badge.textContent = '○ Déconnecté';
            badge.classList.add('disconnected');
            badge.classList.remove('connected');
            errorMsg.classList.remove('hidden');
            this.elements.dropZone.classList.add('disabled');
            this.startAutoReconnect();
        }
    }

    setupEventListeners() {
        // Drop Zone
        this.elements.dropZone.onclick = () => {
            if (this.isServerAvailable) {
                this.elements.fileInput.click();
            }
        };

        this.elements.fileInput.onchange = (e) => {
            if (e.target.files[0]) {
                this.handleFile(e.target.files[0]);
            }
        };

        // Drag & Drop
        this.elements.dropZone.ondragover = (e) => {
            e.preventDefault();
            if (this.isServerAvailable) {
                this.elements.dropZone.classList.add('drag-over');
            }
        };

        this.elements.dropZone.ondragleave = () => {
            this.elements.dropZone.classList.remove('drag-over');
        };

        this.elements.dropZone.ondrop = (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.remove('drag-over');
            if (this.isServerAvailable && e.dataTransfer.files.length) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        };

        // Buttons
        this.elements.removeBtn.onclick = () => this.reset();
        this.elements.transcribeBtn.onclick = () => this.transcribe();
        this.elements.newBtn.onclick = () => this.reset();
        this.elements.copyBtn.onclick = () => this.copyResult();
        this.elements.downloadBtn.onclick = () => this.downloadResult();

        // Retry server check
        document.getElementById('sttRetryBtn')?.addEventListener('click', () => {
            this.checkServer().then(() => this.loadModels());
        });
    }

    handleFile(file) {
        // Vérifier le type
        const validTypes = [
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
            'audio/m4a', 'audio/x-m4a', 'audio/mp4',
            'audio/ogg', 'audio/flac', 'audio/webm',
            'video/webm', 'video/mp4'
        ];
        const validExt = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'mp4'];
        const ext = file.name.split('.').pop().toLowerCase();

        if (!validTypes.includes(file.type) && !validExt.includes(ext)) {
            alert('❌ Type de fichier non supporté. Utilisez MP3, WAV, M4A, OGG, FLAC ou WebM.');
            return;
        }

        // Vérifier la taille (500MB max)
        if (file.size > 500 * 1024 * 1024) {
            alert('❌ Fichier trop volumineux. Maximum: 500MB');
            return;
        }

        this.selectedFile = file;

        // Afficher les infos
        this.elements.dropZone.classList.add('hidden');
        this.elements.fileInfo.classList.remove('hidden');
        this.elements.resultContainer.classList.add('hidden');
        this.elements.transcribeBtn.classList.remove('hidden');

        this.elements.fileName.textContent = file.name;
        this.elements.fileSize.textContent = this.formatSize(file.size);

        // Try to get duration
        this.getAudioDuration(file);
    }

    getAudioDuration(file) {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.onloadedmetadata = () => {
            const duration = this.formatDuration(audio.duration);
            this.elements.fileDuration.textContent = duration;
            URL.revokeObjectURL(audio.src);
        };
        audio.onerror = () => {
            this.elements.fileDuration.textContent = '--:--';
        };
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    async transcribe() {
        if (!this.selectedFile) return;

        const model = this.elements.modelSelect.value;

        // UI Loading state
        this.elements.transcribeBtn.disabled = true;
        this.elements.progressContainer.classList.remove('hidden');
        this.elements.progressText.textContent = `Transcription avec le modèle ${model}...`;
        this.animateProgress(0, 90, 30000); // Long duration for transcription

        const formData = new FormData();
        formData.append('file', this.selectedFile);
        formData.append('model', model);

        try {
            const response = await fetch('/api/stt/transcribe', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors de la transcription');
            }

            const result = await response.json();

            // Finaliser la progression
            this.animateProgress(90, 100, 300);

            setTimeout(() => {
                this.showResult(result);

                document.dispatchEvent(new CustomEvent('app-notification', {
                    detail: {
                        title: 'Transcription terminée',
                        message: `La transcription de ${this.selectedFile.name} est prête.`,
                        type: 'success',
                        icon: 'mic'
                    }
                }));
            }, 400);

        } catch (error) {
            console.error('STT Error:', error);
            alert('🚨 ' + error.message);
            this.elements.progressContainer.classList.add('hidden');
            this.elements.transcribeBtn.disabled = false;
        }
    }

    showResult(result) {
        this.elements.fileInfo.classList.add('hidden');
        this.elements.progressContainer.classList.add('hidden');
        this.elements.transcribeBtn.classList.add('hidden');
        this.elements.resultContainer.classList.remove('hidden');

        this.elements.resultText.value = result.text || '';

        // Store result for download
        this.transcriptionResult = result;
    }

    copyResult() {
        const text = this.elements.resultText.value;
        navigator.clipboard.writeText(text).then(() => {
            const btn = this.elements.copyBtn;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="btn-text">✓ Copié!</span>';
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 2000);
        });
    }

    downloadResult() {
        const text = this.elements.resultText.value;
        const filename = this.selectedFile?.name.replace(/\.[^.]+$/, '') || 'transcription';

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.txt`;
        a.click();

        URL.revokeObjectURL(url);
    }

    animateProgress(from, to, duration) {
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = from + (to - from) * this.easeOutQuad(progress);
            this.elements.progressFill.style.width = `${current}%`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    easeOutQuad(t) {
        return t * (2 - t);
    }

    reset() {
        this.selectedFile = null;
        this.transcriptionResult = null;
        this.elements.dropZone.classList.remove('hidden');
        this.elements.fileInfo.classList.add('hidden');
        this.elements.resultContainer.classList.add('hidden');
        this.elements.progressContainer.classList.add('hidden');
        this.elements.transcribeBtn.classList.add('hidden');
        this.elements.transcribeBtn.disabled = false;
        this.elements.fileInput.value = '';
        this.elements.progressFill.style.width = '0%';
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
