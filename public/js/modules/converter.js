import { formatSize, refreshIcons } from '../utils/formatters.js';
import { I18n } from '../utils/i18n.js';

export class ConverterModule {
    constructor() {
        // ... (existing constructor code)
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
            saveBtn: document.getElementById('convertSaveBtn')
        };
        this.init();
    }

    init() {
        // Load available formats
        this.loadFormats();

        // Drop zone click
        this.elements.dropZone.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        // Drag & Drop
        this.elements.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.add('drag-over');
        });

        this.elements.dropZone.addEventListener('dragleave', () => {
            this.elements.dropZone.classList.remove('drag-over');
        });

        this.elements.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFile(file);
        });

        // File input change
        this.elements.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleFile(file);
        });

        // Remove file button
        const removeBtn = document.getElementById('removeFile');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.reset());
        }

        // Compress toggle
        if (this.elements.compressToggle) {
            this.elements.compressToggle.addEventListener('change', (e) => {
                this.compressEnabled = e.target.checked;
                this.updateButtonState();
            });
        }

        // Convert button
        if (this.elements.convertBtn) {
            this.elements.convertBtn.addEventListener('click', () => this.processFile());
        }
    }

    handleFile(file) {
        this.selectedFile = file;
        this.selectedFormat = null;

        // Update UI
        this.elements.dropZone.classList.add('hidden');
        this.elements.fileInfo.classList.remove('hidden');
        this.elements.formatSection.classList.remove('hidden');
        this.elements.convertOptions.classList.remove('hidden');
        this.elements.successMessage.classList.add('hidden');
        this.elements.saveBtn.classList.add('hidden');

        // Display file info
        this.elements.fileName.textContent = file.name;
        this.elements.fileSize.textContent = formatSize(file.size);

        // Show image preview if applicable
        const imagePreview = document.getElementById('imagePreview');
        const fileIconLarge = document.getElementById('fileIconLarge');

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('hidden');
                fileIconLarge.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.classList.add('hidden');
            fileIconLarge.classList.remove('hidden');
        }

        // Generate format buttons
        this.generateFormatButtons(file);
    }

    generateFormatButtons(file) {
        const grid = this.elements.formatGrid;
        grid.innerHTML = '';

        if (!this.supportedFormats) return;

        const fileType = file.type.split('/')[0]; // 'image', 'audio', 'video'
        const formats = this.supportedFormats[fileType] || [];

        formats.forEach(fmt => {
            const btn = document.createElement('button');
            btn.className = 'format-btn';
            btn.textContent = fmt.toUpperCase();
            btn.addEventListener('click', () => {
                // Toggle selection
                grid.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedFormat = fmt;
                this.updateButtonState();
            });
            grid.appendChild(btn);
        });

        refreshIcons();
    }

    // ... (rest of methods until updateButtonState)

    async loadFormats() {
        try {
            const res = await fetch('/api/convert/formats');
            this.supportedFormats = await res.json();
        } catch (e) {
            console.error('Erreur chargement formats', e);
        }
    }

    // ... (generateButtons)

    updateButtonState() {
        // Show button if either format is selected OR compress is enabled
        const shouldShowBtn = this.selectedFormat || this.compressEnabled;
        this.elements.convertBtn.classList.toggle('hidden', !shouldShowBtn);

        // Update button text based on action
        const btnText = this.elements.convertBtn.querySelector('.btn-text');
        if (this.selectedFormat && this.compressEnabled) {
            btnText.innerHTML = `<i data-lucide="refresh-cw" class="inline-icon"></i> ${I18n.t('Convertir')} & ${I18n.t('Compresser')}`;
        } else if (this.compressEnabled) {
            btnText.innerHTML = `<i data-lucide="package" class="inline-icon"></i> ${I18n.t('Compresser')}`;
        } else {
            btnText.innerHTML = `<i data-lucide="refresh-cw" class="inline-icon"></i> ${I18n.t('Convertir')}`;
        }
        refreshIcons();
    }

    async processFile() {
        this.elements.convertBtn.disabled = true;
        this.elements.progressContainer.classList.remove('hidden');
        const btnText = this.elements.convertBtn.querySelector('.btn-text');
        const originalText = btnText.textContent;
        btnText.textContent = I18n.t('Traitement en cours...');

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
                throw new Error(errorData.error || I18n.t('Erreur lors du traitement'));
            }

            const data = await res.json();
            this.elements.successMessage.classList.remove('hidden');

            document.dispatchEvent(new CustomEvent('app-notification', {
                detail: {
                    title: I18n.t('Conversion terminée'),
                    message: `${I18n.t('Le fichier')} ${this.selectedFile.name} ${I18n.t('a été traité avec succès.')}`,
                    type: 'success',
                    icon: 'refresh-cw'
                }
            }));

            // Show Save Button and Link to Databank
            if (data.databankUrl && this.elements.saveBtn) {
                this.elements.saveBtn.href = data.databankUrl;
                this.elements.saveBtn.setAttribute('download', data.fileName || 'converted-file');
                this.elements.saveBtn.classList.remove('hidden');

                // Hide convert button to verify user flow
                this.elements.convertBtn.classList.add('hidden');
            }
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
    }

}

