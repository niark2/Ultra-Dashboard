/**
 * Upscale Module - AI Image Upscaling
 */
export class UpscaleModule {
    constructor() {
        this.selectedFile = null;
        this.isServerAvailable = false;
        this.selectedScale = 4;
        this.denoise = false;
        this.elements = {
            dropZone: document.getElementById('upscaleDropZone'),
            fileInput: document.getElementById('upscaleFileInput'),
            fileInfo: document.getElementById('upscaleFileInfo'),
            preview: document.getElementById('upscalePreview'),
            fileName: document.getElementById('upscaleFileName'),
            fileSize: document.getElementById('upscaleFileSize'),
            removeBtn: document.getElementById('upscaleRemoveFile'),
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
            scaleBtns: document.querySelectorAll('.scale-toggle .toggle-btn'),
            denoiseBtns: document.querySelectorAll('.denoise-toggle .toggle-btn')
        };
        this.init();
    }

    async init() {
        await this.checkServer();
        this.setupEventListeners();
    }

    async checkServer() {
        try {
            const res = await fetch('/api/upscale/health');
            const data = await res.json();
            this.isServerAvailable = data.available === true;
            this.updateServerStatus();
        } catch (error) {
            this.isServerAvailable = false;
            this.updateServerStatus();
        }
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

        // Scale Buttons
        this.elements.scaleBtns.forEach(btn => {
            btn.onclick = () => {
                this.elements.scaleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedScale = parseInt(btn.dataset.scale);
            };
        });

        // Denoise Buttons
        this.elements.denoiseBtns.forEach(btn => {
            btn.onclick = () => {
                this.elements.denoiseBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.denoise = btn.dataset.denoise === 'true';
            };
        });

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
        this.elements.processBtn.onclick = () => this.processImage();
        this.elements.newBtn.onclick = () => this.reset();

        // Retry server check
        document.getElementById('upscaleRetryBtn')?.addEventListener('click', () => {
            this.checkServer();
        });
    }

    handleFile(file) {
        // Vérifier le type
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
        if (!validTypes.includes(file.type)) {
            alert('❌ Type de fichier non supporté. Utilisez PNG, JPG, WEBP ou BMP.');
            return;
        }

        // Vérifier la taille (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            alert('❌ Fichier trop volumineux. Maximum: 10MB');
            return;
        }

        this.selectedFile = file;

        // Afficher les infos
        this.elements.dropZone.classList.add('hidden');
        this.elements.fileInfo.classList.remove('hidden');
        this.elements.resultContainer.classList.add('hidden');
        this.elements.processBtn.classList.remove('hidden');

        this.elements.fileName.textContent = file.name;
        this.elements.fileSize.textContent = this.formatSize(file.size);

        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            this.elements.preview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async processImage() {
        if (!this.selectedFile) return;

        // UI Loading state
        this.elements.processBtn.disabled = true;
        this.elements.progressContainer.classList.remove('hidden');
        this.elements.progressText.textContent = `Agrandissement x${this.selectedScale} par l'IA...`;
        this.animateProgress(0, 95, 15000); // Upscale takes longer on CPU

        const formData = new FormData();
        formData.append('file', this.selectedFile);
        formData.append('scale', this.selectedScale);
        formData.append('denoise', this.denoise);

        try {
            const response = await fetch('/api/upscale/process', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors du traitement');
            }

            // Récupérer le blob résultat
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);

            // Finaliser la progression
            this.animateProgress(95, 100, 300);

            setTimeout(() => {
                this.showResult(imageUrl, blob);
            }, 400);

        } catch (error) {
            console.error('Upscale Error:', error);
            alert('🚨 ' + error.message);
            this.elements.progressContainer.classList.add('hidden');
            this.elements.processBtn.classList.remove('hidden');
            this.elements.processBtn.disabled = false;
        }
    }

    showResult(imageUrl, blob) {
        this.elements.fileInfo.classList.add('hidden');
        this.elements.progressContainer.classList.add('hidden');
        this.elements.processBtn.classList.add('hidden');
        this.elements.resultContainer.classList.remove('hidden');

        this.elements.resultImage.src = imageUrl;

        // Setup download
        this.elements.downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = imageUrl;
            a.download = `upscaled-${this.selectedFile.name.replace(/\.[^.]+$/, '')}.png`;
            a.click();
        };
    }

    animateProgress(from, to, duration) {
        if (this._progressInterval) clearInterval(this._progressInterval);

        const startTime = Date.now();
        this._progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = from + (to - from) * this.easeOutQuad(progress);
            this.elements.progressFill.style.width = `${current}%`;

            if (progress >= 1) clearInterval(this._progressInterval);
        }, 50);
    }

    easeOutQuad(t) {
        return t * (2 - t);
    }

    reset() {
        if (this._progressInterval) clearInterval(this._progressInterval);
        this.selectedFile = null;
        this.elements.dropZone.classList.remove('hidden');
        this.elements.fileInfo.classList.add('hidden');
        this.elements.resultContainer.classList.add('hidden');
        this.elements.progressContainer.classList.add('hidden');
        this.elements.processBtn.classList.add('hidden');
        this.elements.processBtn.disabled = false;
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
