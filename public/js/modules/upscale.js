/**
 * Upscale Module - Agrandissement d'images avec IA
 */
export class UpscaleModule {
    constructor() {
        this.selectedFile = null;
        this.resultUrl = null;
        this.selectedScale = 4;
        this.selectedModel = 'edsr';
        this.denoise = false;
        this.isServerAvailable = false;
        this.reconnectInterval = null;
        this.isProcessing = false;
        this.elements = {
            dropZone: document.getElementById('upscaleDropZone'),
            fileInput: document.getElementById('upscaleFileInput'),
            fileInfo: document.getElementById('upscaleFileInfo'),
            preview: document.getElementById('upscalePreview'),
            fileName: document.getElementById('upscaleFileName'),
            fileSize: document.getElementById('upscaleFileSize'),
            removeBtn: document.getElementById('upscaleRemoveFile'),
            scaleToggles: document.querySelectorAll('.scale-toggle .toggle-btn'),
            modelToggles: document.querySelectorAll('.model-toggle .toggle-btn'),
            denoiseToggles: document.querySelectorAll('.denoise-toggle .toggle-btn'),
            processBtn: document.getElementById('upscaleProcessBtn'),
            progressContainer: document.getElementById('upscaleProgressContainer'),
            progressFill: document.getElementById('upscaleProgressFill'),
            progressText: document.getElementById('upscaleProgressText'),
            resultContainer: document.getElementById('upscaleResultContainer'),
            resultImage: document.getElementById('upscaleResultImage'),
            downloadBtn: document.getElementById('upscaleDownloadBtn'),
            newBtn: document.getElementById('upscaleNewBtn'),
            statusBadge: document.getElementById('upscaleStatusBadge'),
            serverError: document.getElementById('upscaleServerError'),
            optionsSection: document.getElementById('upscaleOptionsSection')
        };
        this.init();
    }

    async init() {
        // Load default settings from Storage
        const { Storage } = await import('../utils/storage.js');
        const defaultModel = await Storage.get('ultra-upscale-default-model', 'edsr');
        const defaultScale = await Storage.get('ultra-upscale-default-scale', '4');

        this.selectedModel = defaultModel;
        this.selectedScale = parseInt(defaultScale);

        // Update active class in UI
        this.elements.modelToggles?.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.model === this.selectedModel);
        });
        this.elements.scaleToggles?.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scale === this.selectedScale.toString());
        });

        await this.checkServer();
        this.setupEventListeners();
    }

    async checkServer() {
        try {
            const res = await fetch('/api/upscale/health');
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
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                }
            } else {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
        }, 3000);
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
            this.elements.optionsSection.classList.remove('hidden');
        } else {
            badge.textContent = '○ Déconnecté';
            badge.classList.add('disconnected');
            badge.classList.remove('connected');
            errorMsg.classList.remove('hidden');
            this.elements.dropZone.classList.add('disabled');
            this.elements.optionsSection.classList.add('hidden');
            this.startAutoReconnect();
        }
    }

    setupEventListeners() {
        // Drop Zone
        this.elements.dropZone.onclick = () => {
            if (this.isServerAvailable && !this.isProcessing) {
                this.elements.fileInput.click();
            }
        };

        this.elements.fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
                this.elements.fileInput.value = '';
            }
        };

        // Drag & Drop
        this.elements.dropZone.ondragover = (e) => {
            e.preventDefault();
            if (this.isServerAvailable && !this.isProcessing) {
                this.elements.dropZone.classList.add('drag-over');
            }
        };

        this.elements.dropZone.ondragleave = () => {
            this.elements.dropZone.classList.remove('drag-over');
        };

        this.elements.dropZone.ondrop = (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.remove('drag-over');
            if (this.isServerAvailable && !this.isProcessing && e.dataTransfer.files.length) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        };

        // Buttons
        this.elements.removeBtn.onclick = () => this.removeFile();
        this.elements.processBtn.onclick = () => this.processImage();
        this.elements.newBtn.onclick = () => this.reset();

        // Scale Selection
        this.elements.scaleToggles.forEach(btn => {
            btn.onclick = () => {
                if (this.isProcessing) return;
                this.elements.scaleToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedScale = parseInt(btn.getAttribute('data-scale'));
            };
        });

        // Model Selection
        this.elements.modelToggles.forEach(btn => {
            btn.onclick = () => {
                if (this.isProcessing) return;
                this.elements.modelToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedModel = btn.getAttribute('data-model');
            };
        });

        // Denoise Selection
        this.elements.denoiseToggles.forEach(btn => {
            btn.onclick = () => {
                if (this.isProcessing) return;
                this.elements.denoiseToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.denoise = btn.getAttribute('data-denoise') === 'true';
            };
        });

        // Retry server check
        document.getElementById('upscaleRetryBtn')?.addEventListener('click', () => {
            this.checkServer();
        });
    }

    handleFile(file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];

        // Vérifier le type
        if (!validTypes.includes(file.type)) {
            console.warn(`Type de fichier non supporté: ${file.name}`);
            return;
        }

        // Vérifier la taille (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            console.warn(`Fichier trop volumineux: ${file.name}`);
            return;
        }

        this.selectedFile = file;
        this.updateUI();
    }

    updateUI() {
        if (this.selectedFile) {
            this.elements.dropZone.classList.add('hidden');
            this.elements.fileInfo.classList.remove('hidden');
            this.elements.processBtn.classList.remove('hidden');

            // Update preview
            const reader = new FileReader();
            reader.onload = (e) => {
                this.elements.preview.src = e.target.result;
            };
            reader.readAsDataURL(this.selectedFile);

            // Update file details
            this.elements.fileName.textContent = this.selectedFile.name;
            this.elements.fileSize.textContent = this.formatSize(this.selectedFile.size);

            // Refresh icons
            if (window.lucide) {
                window.lucide.createIcons();
            }
        } else {
            this.elements.dropZone.classList.remove('hidden');
            this.elements.fileInfo.classList.add('hidden');
            this.elements.processBtn.classList.add('hidden');
        }
    }

    removeFile() {
        if (this.selectedFile && this.elements.preview.src) {
            URL.revokeObjectURL(this.elements.preview.src);
        }
        this.selectedFile = null;
        this.updateUI();
    }

    async processImage() {
        if (!this.selectedFile || this.isProcessing) return;

        this.isProcessing = true;
        this.elements.processBtn.disabled = true;
        this.elements.processBtn.classList.add('hidden');
        this.elements.fileInfo.classList.add('hidden');
        this.elements.progressContainer.classList.remove('hidden');

        this.elements.progressText.textContent = `Agrandissement x${this.selectedScale} en cours...`;
        this.updateProgress(30);

        try {
            const formData = new FormData();
            formData.append('file', this.selectedFile);
            formData.append('scale', this.selectedScale);
            formData.append('model', this.selectedModel);
            formData.append('denoise', this.denoise);

            const response = await fetch('/api/upscale/process', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors du traitement');
            }

            const data = await response.json();
            this.resultUrl = `/databank/${data.fileName}`;
            this.resultFileName = data.fileName;

            this.updateProgress(100);
            this.elements.progressText.textContent = 'Traitement terminé !';

            setTimeout(() => {
                this.showResult();

                document.dispatchEvent(new CustomEvent('app-notification', {
                    detail: {
                        title: 'Upscale terminé',
                        message: `Image agrandie x${this.selectedScale} avec succès.`,
                        type: 'success',
                        icon: 'sparkles'
                    }
                }));
            }, 800);

        } catch (error) {
            console.error('Error processing image:', error);
            this.updateProgress(0);
            this.elements.progressText.textContent = 'Erreur lors du traitement';
            this.isProcessing = false;
            this.elements.processBtn.disabled = false;

            document.dispatchEvent(new CustomEvent('app-notification', {
                detail: {
                    title: 'Erreur',
                    message: error.message || 'Impossible de traiter l\'image',
                    type: 'error',
                    icon: 'alert-triangle'
                }
            }));

            setTimeout(() => {
                this.elements.progressContainer.classList.add('hidden');
                this.elements.fileInfo.classList.remove('hidden');
                this.elements.processBtn.classList.remove('hidden');
            }, 2000);
        }
    }

    updateProgress(percent) {
        this.elements.progressFill.style.width = `${percent}%`;
    }

    showResult() {
        this.elements.progressContainer.classList.add('hidden');
        this.elements.resultContainer.classList.remove('hidden');
        this.elements.resultImage.src = this.resultUrl;

        this.elements.downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = this.resultUrl;
            a.download = `upscaled-x${this.selectedScale}-${this.selectedFile.name.replace(/\.[^.]+$/, '')}.png`;
            a.click();
        };

        this.isProcessing = false;

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    reset() {
        if (this.selectedFile && this.elements.preview.src) {
            URL.revokeObjectURL(this.elements.preview.src);
        }
        if (this.resultUrl) {
            URL.revokeObjectURL(this.resultUrl);
        }

        this.selectedFile = null;
        this.resultUrl = null;
        this.isProcessing = false;

        this.elements.dropZone.classList.remove('hidden');
        this.elements.fileInfo.classList.add('hidden');
        this.elements.resultContainer.classList.add('hidden');
        this.elements.progressContainer.classList.add('hidden');
        this.elements.processBtn.classList.add('hidden');
        this.elements.processBtn.disabled = false;
        this.elements.fileInput.value = '';
        this.elements.progressFill.style.width = '0%';
        this.elements.preview.src = '';
        this.elements.resultImage.src = '';
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
