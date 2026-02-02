import { formatSize, refreshIcons } from '../utils/formatters.js';

export class ConverterModule {
    constructor() {
        this.selectedFile = null;
        this.selectedFormat = null;
        this.supportedFormats = null;
        this.compressEnabled = false;
        this.compressQuality = 75;
        this.elements = {
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            fileInfo: document.getElementById('fileInfo'),
            formatSection: document.getElementById('formatSection'),
            formatGrid: document.getElementById('formatGrid'),
            convertBtn: document.getElementById('convertBtn'),
            progressContainer: document.getElementById('progressContainer'),
            successMessage: document.getElementById('successMessage'),
            fileName: document.getElementById('fileName'),
            fileSize: document.getElementById('fileSize'),
            convertOptions: document.getElementById('convertOptions'),
            compressToggle: document.getElementById('compressToggle'),
            compressLevelContainer: document.getElementById('compressLevelContainer'),
            compressLevel: document.getElementById('compressLevel'),
            compressLevelValue: document.getElementById('compressLevelValue')
        };
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadFormats();
    }

    setupEventListeners() {
        this.elements.dropZone.onclick = () => this.elements.fileInput.click();
        this.elements.fileInput.onchange = (e) => e.target.files[0] && this.handleFile(e.target.files[0]);
        document.getElementById('removeFile').onclick = () => this.reset();
        this.elements.convertBtn.onclick = () => this.processFile();

        this.elements.dropZone.ondragover = (e) => { e.preventDefault(); this.elements.dropZone.classList.add('drag-over'); };
        this.elements.dropZone.ondragleave = () => this.elements.dropZone.classList.remove('drag-over');
        this.elements.dropZone.ondrop = (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) this.handleFile(e.dataTransfer.files[0]);
        };

        // Compress toggle
        this.elements.compressToggle.onchange = (e) => {
            this.compressEnabled = e.target.checked;
            this.elements.compressLevelContainer.classList.toggle('hidden', !this.compressEnabled);
            this.updateButtonState();
        };

        // Compress level slider
        this.elements.compressLevel.oninput = (e) => {
            this.compressQuality = parseInt(e.target.value, 10);
            this.elements.compressLevelValue.textContent = `${this.compressQuality}%`;
        };
    }

    handleFile(file) {
        this.selectedFile = file;
        this.elements.dropZone.classList.add('hidden');
        this.elements.fileInfo.classList.remove('hidden');
        this.elements.formatSection.classList.remove('hidden');
        this.elements.convertOptions.classList.remove('hidden');
        this.elements.successMessage.classList.add('hidden');

        this.elements.fileName.textContent = file.name;
        this.elements.fileSize.textContent = formatSize(file.size);
        const ext = file.name.split('.').pop().toLowerCase();

        // UI Preview
        const imgPre = document.getElementById('imagePreview');
        const icoPre = document.getElementById('fileIconLarge');
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'bmp', 'ico'].includes(ext)) {
            imgPre.src = URL.createObjectURL(file);
            imgPre.classList.remove('hidden');
            icoPre.classList.add('hidden');
        } else {
            imgPre.classList.add('hidden');
            icoPre.classList.remove('hidden');
            const iconName = this.getIcon(ext);
            icoPre.innerHTML = `<i data-lucide="${iconName}"></i>`;
            refreshIcons();
        }

        this.generateButtons(ext);
        this.updateButtonState();
    }

    getIcon(ext) {
        if (['pdf', 'docx', 'odt', 'rtf', 'epub', 'txt', 'md', 'html'].includes(ext)) return 'file-text';
        if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'].includes(ext)) return 'music';
        if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video';
        return 'package';
    }

    async loadFormats() {
        try {
            const res = await fetch('/api/convert/formats');
            this.supportedFormats = await res.json();
        } catch (e) {
            console.error('Erreur chargement formats', e);
        }
    }

    generateButtons(ext) {
        const grid = this.elements.formatGrid;
        grid.innerHTML = '';
        let targets = [];
        const f = this.supportedFormats;
        if (!f) return;

        // Logique de sélection des cibles
        if (f.image.includes(ext)) targets = f.image;
        else if (f.audio.includes(ext)) targets = f.audio;
        else if (f.video.includes(ext)) targets = f.video;
        else if (f.document.includes(ext)) targets = f.document;
        else {
            // Par défaut si inconnu, on propose les formats documents Pandoc
            targets = f.document;
        }

        // On ajoute toujours PDF et DOCX pour les documents/images si pertinent
        if (f.document.includes(ext) || f.image.includes(ext)) {
            if (!targets.includes('pdf')) targets.push('pdf');
            if (!targets.includes('docx')) targets.push('docx');
            if (!targets.includes('md')) targets.push('md');
            if (!targets.includes('txt')) targets.push('txt');
        }

        targets.filter(t => t !== ext).sort().forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'format-btn';
            btn.textContent = t.toUpperCase();
            btn.onclick = () => {
                document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedFormat = t;
                this.updateButtonState();
            };
            grid.appendChild(btn);
        });
    }

    updateButtonState() {
        // Show button if either format is selected OR compress is enabled
        const shouldShowBtn = this.selectedFormat || this.compressEnabled;
        this.elements.convertBtn.classList.toggle('hidden', !shouldShowBtn);

        // Update button text based on action
        const btnText = this.elements.convertBtn.querySelector('.btn-text');
        if (this.selectedFormat && this.compressEnabled) {
            btnText.innerHTML = '<i data-lucide="refresh-cw" class="inline-icon"></i> Convertir & Compresser';
        } else if (this.compressEnabled) {
            btnText.innerHTML = '<i data-lucide="package" class="inline-icon"></i> Compresser';
        } else {
            btnText.innerHTML = '<i data-lucide="refresh-cw" class="inline-icon"></i> Convertir';
        }
        refreshIcons();
    }

    async processFile() {
        this.elements.convertBtn.disabled = true;
        this.elements.progressContainer.classList.remove('hidden');
        const btnText = this.elements.convertBtn.querySelector('.btn-text');
        const originalText = btnText.textContent;
        btnText.textContent = 'Traitement en cours...';

        const fd = new FormData();
        fd.append('file', this.selectedFile);

        // Add target format if selected (can be empty for compress-only)
        if (this.selectedFormat) {
            fd.append('targetFormat', this.selectedFormat);
        }

        // Add compression options
        fd.append('compress', this.compressEnabled.toString());
        fd.append('quality', this.compressQuality.toString());

        try {
            const res = await fetch('/api/convert', { method: 'POST', body: fd });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Erreur lors du traitement');
            }

            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);

            // Determine output filename
            const ext = this.selectedFormat || this.selectedFile.name.split('.').pop().toLowerCase();
            const baseName = this.selectedFile.name.replace(/\.[^/.]+$/, '');
            const suffix = this.compressEnabled ? '-compressed' : '';
            a.download = `${baseName}${suffix}.${ext}`;

            a.click();
            this.elements.successMessage.classList.remove('hidden');
        } catch (e) {
            alert('🚨 ' + e.message);
        } finally {
            this.elements.convertBtn.disabled = false;
            btnText.textContent = originalText;
            this.elements.progressContainer.classList.add('hidden');
        }
    }

    reset() {
        this.selectedFile = null;
        this.selectedFormat = null;
        this.compressEnabled = false;
        this.compressQuality = 75;
        this.elements.dropZone.classList.remove('hidden');
        this.elements.fileInfo.classList.add('hidden');
        this.elements.formatSection.classList.add('hidden');
        this.elements.convertOptions.classList.add('hidden');
        this.elements.convertBtn.classList.add('hidden');
        this.elements.successMessage.classList.add('hidden');
        this.elements.fileInput.value = '';
        this.elements.compressToggle.checked = false;
        this.elements.compressLevelContainer.classList.add('hidden');
        this.elements.compressLevel.value = 75;
        this.elements.compressLevelValue.textContent = '75%';
    }

}

