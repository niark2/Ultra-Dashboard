/**
 * RemoveBG Module - Suppression d'arrière-plan avec REMBG
 */
export class RemoveBGModule {
    constructor() {
        this.selectedFiles = [];
        this.results = [];
        this.selectedModel = 'u2net';
        this.isServerAvailable = false;
        this.reconnectInterval = null;
        this.isProcessing = false;
        this.elements = {
            dropZone: document.getElementById('rembgDropZone'),
            fileInput: document.getElementById('rembgFileInput'),
            fileList: document.getElementById('rembgFileList'),
            modelOptions: document.querySelectorAll('.model-option'),
            processBtn: document.getElementById('rembgProcessBtn'),
            progressContainer: document.getElementById('rembgProgressContainer'),
            progressFill: document.getElementById('rembgProgressFill'),
            progressText: document.getElementById('rembgProgressText'),
            resultContainer: document.getElementById('rembgResultContainer'),
            downloadBtn: document.getElementById('rembgDownloadBtn'),
            newBtn: document.getElementById('rembgNewBtn'),
            statusBadge: document.getElementById('rembgStatusBadge'),
            serverError: document.getElementById('rembgServerError')
        };
        this.init();
    }

    async init() {
        // Load default settings
        const defaultModel = await Storage.get('ultra-rembg-default-model', 'u2net');
        this.selectedModel = defaultModel;

        // Update active class in UI
        this.elements.modelOptions.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.model === defaultModel);
        });

        await this.checkServer();
        this.setupEventListeners();
    }

    async checkServer() {
        try {
            const res = await fetch('/api/rembg/health');
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
            if (this.isServerAvailable && !this.isProcessing) {
                this.elements.fileInput.click();
            }
        };

        this.elements.fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                this.handleFiles(Array.from(e.target.files));
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
                this.handleFiles(Array.from(e.dataTransfer.files));
            }
        };

        // Buttons
        this.elements.processBtn.onclick = () => this.processImages();
        this.elements.newBtn.onclick = () => this.reset();

        // Model Selection
        this.elements.modelOptions.forEach(opt => {
            opt.onclick = () => {
                if (this.isProcessing) return;
                this.elements.modelOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.selectedModel = opt.getAttribute('data-model');
            };
        });

        // Retry server check
        document.getElementById('rembgRetryBtn')?.addEventListener('click', () => {
            this.checkServer();
        });
    }

    handleFiles(files) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp'];

        files.forEach(file => {
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

            // Ajouter à la liste s'il n'est pas déjà présent (par nom et taille)
            const exists = this.selectedFiles.some(f => f.name === file.name && f.size === file.size);
            if (!exists) {
                this.selectedFiles.push({
                    file: file,
                    name: file.name,
                    size: file.size,
                    status: 'pending',
                    preview: URL.createObjectURL(file)
                });
            }
        });

        this.updateUI();
    }

    updateUI() {
        if (this.selectedFiles.length > 0) {
            this.elements.dropZone.classList.add('hidden');
            this.elements.fileList.classList.remove('hidden');
            this.elements.processBtn.classList.remove('hidden');
            this.renderFileList();
        } else {
            this.elements.dropZone.classList.remove('hidden');
            this.elements.fileList.classList.add('hidden');
            this.elements.processBtn.classList.add('hidden');
        }
    }

    renderFileList() {
        this.elements.fileList.innerHTML = '';
        this.selectedFiles.forEach((item, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = `rembg-file-item ${item.status}`;
            fileItem.innerHTML = `
                <div class="rembg-preview">
                    <img src="${item.preview}" alt="Aperçu">
                </div>
                <div class="file-details">
                    <h3>${item.name}</h3>
                    <p>${this.formatSize(item.size)}</p>
                    <div class="item-status">${this.getStatusText(item.status)}</div>
                </div>
                ${!this.isProcessing ? `
                    <button class="btn-remove-item" data-index="${index}">
                        <i data-lucide="trash-2"></i>
                    </button>
                ` : ''}
            `;
            this.elements.fileList.appendChild(fileItem);
        });

        // Initialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Add remove events
        this.elements.fileList.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.onclick = (e) => {
                const index = parseInt(btn.getAttribute('data-index'));
                this.removeFile(index);
            };
        });
    }

    getStatusText(status) {
        switch (status) {
            case 'pending': return 'En attente';
            case 'processing': return 'Traitement...';
            case 'completed': return 'Terminé';
            case 'error': return 'Erreur';
            default: return '';
        }
    }

    removeFile(index) {
        const item = this.selectedFiles[index];
        if (item.preview) URL.revokeObjectURL(item.preview);
        this.selectedFiles.splice(index, 1);
        this.updateUI();
    }

    async processImages() {
        if (this.selectedFiles.length === 0 || this.isProcessing) return;

        this.isProcessing = true;
        this.results = [];
        this.elements.processBtn.disabled = true;
        this.elements.processBtn.classList.add('hidden');
        this.elements.progressContainer.classList.remove('hidden');

        const total = this.selectedFiles.length;

        for (let i = 0; i < this.selectedFiles.length; i++) {
            const item = this.selectedFiles[i];
            item.status = 'processing';
            this.renderFileList();

            this.elements.progressText.textContent = `Traitement de ${i + 1}/${total} : ${item.name}`;
            this.updateProgress(((i) / total) * 100);

            try {
                const formData = new FormData();
                formData.append('file', item.file);
                formData.append('model', this.selectedModel);

                const response = await fetch('/api/rembg/remove', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erreur lors du traitement');
                }

                const data = await response.json();
                const resultUrl = `/databank/${data.fileName}`;

                item.status = 'completed';
                item.resultUrl = resultUrl;

                this.results.push({
                    name: item.name,
                    url: resultUrl,
                    fileName: data.fileName
                });

            } catch (error) {
                console.error(`Error processing ${item.name}:`, error);
                item.status = 'error';
                item.error = error.message;
            }
        }

        this.updateProgress(100);
        this.elements.progressText.textContent = 'Traitement terminé !';
        this.isProcessing = false;

        setTimeout(() => {
            this.showResults();

            document.dispatchEvent(new CustomEvent('app-notification', {
                detail: {
                    title: 'Suppression de fond terminée',
                    message: `${this.results.length} image(s) traitée(s) avec succès.`,
                    type: 'success',
                    icon: 'scissors'
                }
            }));
        }, 800);
    }

    updateProgress(percent) {
        this.elements.progressFill.style.width = `${percent}%`;
    }

    showResults() {
        this.elements.fileList.classList.add('hidden');
        this.elements.progressContainer.classList.add('hidden');
        this.elements.resultContainer.classList.remove('hidden');

        const resultGrid = document.createElement('div');
        resultGrid.className = 'results-grid';

        this.results.forEach((res, index) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <img src="${res.url}" alt="${res.name}">
                <h4>${res.name}</h4>
                <button class="btn-secondary btn-sm" onclick="window.downloadSingleResult(${index})">
                    <i data-lucide="download"></i> Télécharger
                </button>
            `;
            resultGrid.appendChild(card);
        });

        // Set up global download function for the results
        window.downloadSingleResult = (index) => {
            const res = this.results[index];
            const a = document.createElement('a');
            a.href = res.url;
            a.download = `nobg-${res.name.replace(/\.[^.]+$/, '')}.png`;
            a.click();
        };

        const container = this.elements.resultContainer;
        container.innerHTML = '';

        const header = document.createElement('h3');
        header.textContent = `${this.results.length} image(s) traitée(s)`;
        header.style.marginBottom = '24px';
        container.appendChild(header);

        container.appendChild(resultGrid);

        const actions = document.createElement('div');
        actions.className = 'result-actions';

        if (this.results.length > 1) {
            const downloadAllBtn = document.createElement('button');
            downloadAllBtn.className = 'btn-convert';
            downloadAllBtn.innerHTML = '<span class="btn-text"><i data-lucide="package"></i> Tout télécharger (ZIP)</span>';
            downloadAllBtn.onclick = () => this.downloadAllAsZip();
            actions.appendChild(downloadAllBtn);
        } else if (this.results.length === 1) {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'btn-convert';
            downloadBtn.innerHTML = '<span class="btn-text"><i data-lucide="download"></i> Télécharger</span>';
            downloadBtn.onclick = () => window.downloadSingleResult(0);
            actions.appendChild(downloadBtn);
        }

        const newBtn = document.createElement('button');
        newBtn.className = 'btn-secondary';
        newBtn.textContent = 'Nouvelles images';
        newBtn.onclick = () => this.reset();
        actions.appendChild(newBtn);

        container.appendChild(actions);

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    async downloadAllAsZip() {
        // We'll need JSZip for this. If it's not available, we can either alert or download one by one.
        // For now, let's download them sequentially if JSZip isn't there, or provide a simple implementation.
        // Actually, many of these projects use JSZip. Let me check if it's available.
        if (window.JSZip || typeof JSZip !== 'undefined') {
            const zip = new JSZip();
            for (const res of this.results) {
                const response = await fetch(res.url);
                const blob = await response.blob();
                zip.file(`nobg-${res.name.replace(/\.[^.]+$/, '')}.png`, blob);
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(content);
            a.download = "images-sans-fond.zip";
            a.click();
        } else {
            // Fallback: download each with a small delay
            for (let i = 0; i < this.results.length; i++) {
                window.downloadSingleResult(i);
                await new Promise(r => setTimeout(r, 300));
            }
        }
    }

    reset() {
        this.selectedFiles.forEach(item => {
            if (item.preview) URL.revokeObjectURL(item.preview);
        });
        this.results.forEach(res => {
            if (res.url) URL.revokeObjectURL(res.url);
        });

        this.selectedFiles = [];
        this.results = [];
        this.isProcessing = false;

        this.elements.dropZone.classList.remove('hidden');
        this.elements.fileList.classList.add('hidden');
        this.elements.resultContainer.classList.add('hidden');
        this.elements.progressContainer.classList.add('hidden');
        this.elements.processBtn.classList.add('hidden');
        this.elements.processBtn.disabled = false;
        this.elements.fileInput.value = '';
        this.elements.progressFill.style.width = '0%';

        // Restore initial result container structure if needed, but it's cleared in showResults
        // So we just need to make sure the next showResults clears it again.
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
