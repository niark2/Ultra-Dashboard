/**
 * RemoveBG Module - Suppression d'arrière-plan avec REMBG
 */
export class RemoveBGModule {
    constructor() {
        this.selectedFile = null;
        this.isServerAvailable = false;
        this.elements = {
            dropZone: document.getElementById('rembgDropZone'),
            fileInput: document.getElementById('rembgFileInput'),
            fileInfo: document.getElementById('rembgFileInfo'),
            preview: document.getElementById('rembgPreview'),
            fileName: document.getElementById('rembgFileName'),
            fileSize: document.getElementById('rembgFileSize'),
            removeBtn: document.getElementById('rembgRemoveFile'),
            processBtn: document.getElementById('rembgProcessBtn'),
            progressContainer: document.getElementById('rembgProgressContainer'),
            progressFill: document.getElementById('rembgProgressFill'),
            progressText: document.getElementById('rembgProgressText'),
            resultContainer: document.getElementById('rembgResultContainer'),
            resultImage: document.getElementById('rembgResultImage'),
            downloadBtn: document.getElementById('rembgDownloadBtn'),
            newBtn: document.getElementById('rembgNewBtn'),
            statusBadge: document.getElementById('rembgStatusBadge'),
            serverError: document.getElementById('rembgServerError')
        };
        this.init();
    }

    async init() {
        await this.checkServer();
        this.setupEventListeners();
    }

    async checkServer() {
        try {
            const res = await fetch('/api/rembg/health');
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
        document.getElementById('rembgRetryBtn')?.addEventListener('click', () => {
            this.checkServer();
        });
    }

    handleFile(file) {
        // Vérifier le type
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp'];
        if (!validTypes.includes(file.type)) {
            alert('❌ Type de fichier non supporté. Utilisez PNG, JPG, WEBP, GIF ou BMP.');
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
        this.elements.progressText.textContent = 'Suppression de l\'arrière-plan...';
        this.animateProgress(0, 90, 8000);

        const formData = new FormData();
        formData.append('file', this.selectedFile);

        try {
            const response = await fetch('/api/rembg/remove', {
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
            this.animateProgress(90, 100, 300);

            setTimeout(() => {
                this.showResult(imageUrl, blob);
            }, 400);

        } catch (error) {
            console.error('REMBG Error:', error);
            alert('🚨 ' + error.message);
            this.elements.progressContainer.classList.add('hidden');
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
            a.download = `nobg-${this.selectedFile.name.replace(/\.[^.]+$/, '')}.png`;
            a.click();
        };
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
