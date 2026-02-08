/**
 * Image AI Module - Combined Remove BG and Upscale functionality
 */
import { Storage } from '../utils/storage.js';

export class ImageAIModule {
    constructor() {
        this.currentTool = 'removebg'; // 'removebg' or 'upscale'
        this.selectedFiles = [];
        this.results = [];
        this.selectedModel = 'u2net'; // For removebg
        this.selectedUpscaleModel = 'edsr'; // For upscale
        this.selectedScale = 4; // For upscale
        this.denoise = false; // For upscale
        this.isRembgAvailable = false;
        this.isUpscaleAvailable = false;
        this.reconnectIntervals = { rembg: null, upscale: null };
        this.isProcessing = false;

        this.elements = {
            toolBtns: document.querySelectorAll('.tool-btn'),
            rembgStatus: document.getElementById('imageAiRembgStatus'),
            upscaleStatus: document.getElementById('imageAiUpscaleStatus'),
            rembgError: document.getElementById('imageAiRembgError'),
            upscaleError: document.getElementById('imageAiUpscaleError'),
            rembgOptions: document.getElementById('imageAiRembgOptions'),
            upscaleOptions: document.getElementById('imageAiUpscaleOptions'),
            dropZone: document.getElementById('imageAiDropZone'),
            fileInput: document.getElementById('imageAiFileInput'),
            fileList: document.getElementById('imageAiFileList'),
            modelOptions: document.querySelectorAll('.model-option'),
            upscaleModelToggles: document.querySelectorAll('#imageAiUpscaleOptions .model-toggle .toggle-btn'),
            scaleToggles: document.querySelectorAll('.scale-toggle .toggle-btn'),
            denoiseToggles: document.querySelectorAll('.denoise-toggle .toggle-btn'),
            processBtn: document.getElementById('imageAiProcessBtn'),
            processText: document.getElementById('imageAiProcessText'),
            progressContainer: document.getElementById('imageAiProgressContainer'),
            progressFill: document.getElementById('imageAiProgressFill'),
            progressText: document.getElementById('imageAiProgressText'),
            resultContainer: document.getElementById('imageAiResultContainer')
        };

        this.init();
    }

    async init() {
        await this.loadDefaultSettings();
        await this.checkServers();
        this.setupEventListeners();
        this.updateToolUI();

        // Reload settings when tab is activated
        document.addEventListener('tab-changed', (e) => {
            if (e.detail.tabId === 'image-ai') {
                this.loadDefaultSettings();
            }
        });
    }

    async loadDefaultSettings() {
        if (this.isProcessing) return;

        // Load REMBG default
        const rembgModel = await Storage.get('ultra-rembg-default-model', 'u2net');
        this.selectedModel = rembgModel;
        this.elements.modelOptions.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.model === rembgModel);
        });

        // Load Upscale defaults
        const scaleModelValue = await Storage.get('ultra-upscale-default-model', 'edsr');
        const scaleValue = await Storage.get('ultra-upscale-default-scale', '4');

        this.selectedUpscaleModel = scaleModelValue;
        this.selectedScale = parseInt(scaleValue);

        this.elements.upscaleModelToggles.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.model === this.selectedUpscaleModel);
        });
        this.elements.scaleToggles.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scale === this.selectedScale.toString());
        });
    }

    async checkServers() {
        // Check REMBG
        try {
            const res = await fetch('/api/rembg/health');
            const data = await res.json();
            this.isRembgAvailable = data.available === true;
        } catch (error) {
            this.isRembgAvailable = false;
        }

        // Check Upscale
        try {
            const res = await fetch('/api/upscale/health');
            const data = await res.json();
            this.isUpscaleAvailable = data.available === true;
        } catch (error) {
            this.isUpscaleAvailable = false;
        }

        this.updateServerStatus();
    }

    updateServerStatus() {
        // REMBG Status
        if (this.isRembgAvailable) {
            this.elements.rembgStatus.textContent = '● REMBG';
            this.elements.rembgStatus.classList.add('connected');
            this.elements.rembgStatus.classList.remove('disconnected');
            this.elements.rembgError.classList.add('hidden');
        } else {
            this.elements.rembgStatus.textContent = '○ REMBG';
            this.elements.rembgStatus.classList.add('disconnected');
            this.elements.rembgStatus.classList.remove('connected');
            if (this.currentTool === 'removebg') {
                this.elements.rembgError.classList.remove('hidden');
                this.startAutoReconnect('rembg');
            }
        }

        // Upscale Status
        if (this.isUpscaleAvailable) {
            this.elements.upscaleStatus.textContent = '● Upscale';
            this.elements.upscaleStatus.classList.add('connected');
            this.elements.upscaleStatus.classList.remove('disconnected');
            this.elements.upscaleError.classList.add('hidden');
        } else {
            this.elements.upscaleStatus.textContent = '○ Upscale';
            this.elements.upscaleStatus.classList.add('disconnected');
            this.elements.upscaleStatus.classList.remove('connected');
            if (this.currentTool === 'upscale') {
                this.elements.upscaleError.classList.remove('hidden');
                this.startAutoReconnect('upscale');
            }
        }
    }

    startAutoReconnect(service) {
        if (this.reconnectIntervals[service]) return;

        this.reconnectIntervals[service] = setInterval(async () => {
            await this.checkServers();
            const isAvailable = service === 'rembg' ? this.isRembgAvailable : this.isUpscaleAvailable;
            if (isAvailable) {
                clearInterval(this.reconnectIntervals[service]);
                this.reconnectIntervals[service] = null;
            }
        }, 3000);
    }

    setupEventListeners() {
        // Tool Selection
        this.elements.toolBtns.forEach(btn => {
            btn.onclick = () => {
                if (this.isProcessing) return;
                this.elements.toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.getAttribute('data-tool');
                this.updateToolUI();
                this.reset();
            };
        });

        // Drop Zone
        this.elements.dropZone.onclick = () => {
            if (this.canProcess() && !this.isProcessing) {
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
            if (this.canProcess() && !this.isProcessing) {
                this.elements.dropZone.classList.add('drag-over');
            }
        };

        this.elements.dropZone.ondragleave = () => {
            this.elements.dropZone.classList.remove('drag-over');
        };

        this.elements.dropZone.ondrop = (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.remove('drag-over');
            if (this.canProcess() && !this.isProcessing && e.dataTransfer.files.length) {
                this.handleFiles(Array.from(e.dataTransfer.files));
            }
        };

        // Process Button
        this.elements.processBtn.onclick = () => this.processImages();

        // Model Selection (RemoveBG)
        this.elements.modelOptions.forEach(opt => {
            opt.onclick = () => {
                if (this.isProcessing) return;
                this.elements.modelOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.selectedModel = opt.getAttribute('data-model');
            };
        });

        // Scale Selection (Upscale)
        this.elements.scaleToggles.forEach(btn => {
            btn.onclick = () => {
                if (this.isProcessing) return;
                this.elements.scaleToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedScale = parseInt(btn.getAttribute('data-scale'));
            };
        });

        // Model Selection (Upscale)
        this.elements.upscaleModelToggles.forEach(btn => {
            btn.onclick = () => {
                if (this.isProcessing) return;
                this.elements.upscaleModelToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedUpscaleModel = btn.getAttribute('data-model');
            };
        });

        // Denoise Selection (Upscale)
        this.elements.denoiseToggles.forEach(btn => {
            btn.onclick = () => {
                if (this.isProcessing) return;
                this.elements.denoiseToggles.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.denoise = btn.getAttribute('data-denoise') === 'true';
            };
        });

        // Retry buttons
        document.getElementById('imageAiRembgRetryBtn')?.addEventListener('click', () => {
            this.checkServers();
        });
        document.getElementById('imageAiUpscaleRetryBtn')?.addEventListener('click', () => {
            this.checkServers();
        });
    }

    updateToolUI() {
        // Show/hide options based on selected tool
        if (this.currentTool === 'removebg') {
            this.elements.rembgOptions.classList.remove('hidden');
            this.elements.upscaleOptions.classList.add('hidden');
            this.elements.rembgError.classList.toggle('hidden', this.isRembgAvailable);
            this.elements.upscaleError.classList.add('hidden');
            this.elements.processText.textContent = "Supprimer l'arrière-plan";
            this.elements.dropZone.classList.toggle('disabled', !this.isRembgAvailable);
        } else {
            this.elements.rembgOptions.classList.add('hidden');
            this.elements.upscaleOptions.classList.remove('hidden');
            this.elements.upscaleError.classList.toggle('hidden', this.isUpscaleAvailable);
            this.elements.rembgError.classList.add('hidden');
            this.elements.processText.textContent = "Agrandir les images";
            this.elements.dropZone.classList.toggle('disabled', !this.isUpscaleAvailable);
        }
    }

    canProcess() {
        return this.currentTool === 'removebg' ? this.isRembgAvailable : this.isUpscaleAvailable;
    }

    handleFiles(files) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp'];

        files.forEach(file => {
            if (!validTypes.includes(file.type)) {
                console.warn(`Type de fichier non supporté: ${file.name}`);
                return;
            }

            if (file.size > 30 * 1024 * 1024) {
                console.warn(`Fichier trop volumineux: ${file.name}`);
                return;
            }

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

        if (window.lucide) {
            window.lucide.createIcons();
        }

        this.elements.fileList.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.onclick = () => {
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
        if (this.selectedFiles.length === 0 || this.isProcessing || !this.canProcess()) return;

        this.isProcessing = true;
        this.results = [];
        this.elements.processBtn.disabled = true;
        this.elements.processBtn.classList.add('hidden');
        this.elements.progressContainer.classList.remove('hidden');

        const total = this.selectedFiles.length;
        const endpoint = this.currentTool === 'removebg' ? '/api/rembg/remove' : '/api/upscale/process';

        for (let i = 0; i < this.selectedFiles.length; i++) {
            const item = this.selectedFiles[i];
            item.status = 'processing';
            this.renderFileList();

            this.elements.progressText.textContent = `Traitement de ${i + 1}/${total} : ${item.name}`;
            this.updateProgress(((i) / total) * 100);

            try {
                const formData = new FormData();
                formData.append('file', item.file);

                if (this.currentTool === 'removebg') {
                    formData.append('model', this.selectedModel);
                } else {
                    formData.append('model', this.selectedUpscaleModel);
                    formData.append('scale', this.selectedScale);
                    formData.append('denoise', this.denoise);
                }

                const response = await fetch(endpoint, {
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

            const toolName = this.currentTool === 'removebg' ? 'Remove Background' : 'Upscale';
            document.dispatchEvent(new CustomEvent('app-notification', {
                detail: {
                    title: `${toolName} terminé`,
                    message: `${this.results.length} image(s) traitée(s) avec succès.`,
                    type: 'success',
                    icon: 'sparkles'
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
                <button class="btn-secondary btn-sm" onclick="window.downloadImageAIResult(${index})">
                    <i data-lucide="download"></i> Télécharger
                </button>
            `;
            resultGrid.appendChild(card);
        });

        window.downloadImageAIResult = (index) => {
            const res = this.results[index];
            const a = document.createElement('a');
            a.href = res.url;
            const prefix = this.currentTool === 'removebg' ? 'nobg' : `upscaled-x${this.selectedScale}`;
            a.download = `${prefix}-${res.name.replace(/\.[^.]+$/, '')}.png`;
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
            downloadBtn.onclick = () => window.downloadImageAIResult(0);
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
        if (window.JSZip || typeof JSZip !== 'undefined') {
            const zip = new JSZip();
            const prefix = this.currentTool === 'removebg' ? 'nobg' : `upscaled-x${this.selectedScale}`;

            for (const res of this.results) {
                const response = await fetch(res.url);
                const blob = await response.blob();
                zip.file(`${prefix}-${res.name.replace(/\.[^.]+$/, '')}.png`, blob);
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(content);
            a.download = `${prefix}-images.zip`;
            a.click();
        } else {
            for (let i = 0; i < this.results.length; i++) {
                window.downloadImageAIResult(i);
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
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
