import { I18n } from '../utils/i18n.js';

export class MetadataModule {
    constructor() {
        this.dirPathInput = document.getElementById('metaDirPath');
        this.scanBtn = document.getElementById('metaScanBtn');
        this.folderInput = document.getElementById('metaFolderInput');
        this.metadataBody = document.getElementById('metadataBody');
        this.emptyState = document.getElementById('metaEmptyState');
        this.loadingOverlay = document.getElementById('metaLoading');
        this.toolbar = document.getElementById('metaToolbar');
        this.statusText = document.getElementById('metaStatusText');
        this.applyAllBtn = document.getElementById('metaApplyAllBtn');
        this.magicBtn = document.getElementById('metaMagicBtn');
        this.searchSelector = document.getElementById('metaSearch');

        this.files = [];
        this.filteredFiles = [];
        this.modifiedIndices = new Set();

        this.init();
    }

    init() {
        if (!this.scanBtn) return;

        this.folderInput.addEventListener('change', (e) => this.handleFolderSelect(e));
        this.scanBtn.addEventListener('click', () => this.scanDirectory());
        this.applyAllBtn.addEventListener('click', () => this.applyAllChanges());
        this.magicBtn.addEventListener('click', () => this.magicAutoTag());
        this.searchSelector.addEventListener('input', (e) => this.filterFiles(e.target.value));

        // Keyboard support for scan
        this.dirPathInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.scanDirectory();
        });
    }

    handleFolderSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            // Extract folder path from the first file's webkitRelativePath
            // webkitRelativePath gives "folderName/subfolder/file.mp3"
            // We need the actual full path which isn't available in browser for security
            // So we'll process files directly instead

            const folderName = files[0].webkitRelativePath.split('/')[0];
            this.dirPathInput.value = `${I18n.t('Dossier sélectionné')}: ${folderName} (${files.length} ${I18n.t('fichiers')})`;

            // Process files directly from browser
            this.processFilesFromBrowser(files);
        }
    }

    async processFilesFromBrowser(fileList) {
        this.setLoading(true);
        this.metadataBody.innerHTML = '';
        this.files = [];
        this.modifiedIndices.clear();

        const supportedAudio = ['.mp3', '.flac', '.m4a', '.wav', '.ogg'];
        const supportedImages = ['.jpg', '.jpeg', '.png', '.webp'];

        for (const file of fileList) {
            const ext = '.' + file.name.split('.').pop().toLowerCase();

            if (supportedAudio.includes(ext)) {
                this.files.push({
                    type: 'audio',
                    fileName: file.name,
                    filePath: file.webkitRelativePath,
                    title: file.name.replace(/\.[^/.]+$/, ''),
                    artist: '',
                    album: '',
                    genre: '',
                    year: '',
                    track: '',
                    format: ext.substring(1).toUpperCase(),
                    browserFile: file
                });
            } else if (supportedImages.includes(ext)) {
                this.files.push({
                    type: 'image',
                    fileName: file.name,
                    filePath: file.webkitRelativePath,
                    title: file.name,
                    format: ext.substring(1).toUpperCase(),
                    browserFile: file
                });
            }
        }

        this.filteredFiles = [...this.files];
        this.renderTable();
        this.updateToolbar();
        this.setLoading(false);
    }

    async scanDirectory() {
        // This method is now primarily for re-rendering or initial display after files are loaded via browser input
        // The actual "scanning" (loading files) is handled by processFilesFromBrowser
        this.metadataBody.innerHTML = '';

        if (this.filteredFiles.length === 0) {
            this.emptyState.classList.remove('hidden');
            this.toolbar.classList.add('hidden');
            return;
        }

        this.emptyState.classList.add('hidden');
        this.toolbar.classList.remove('hidden');
        this.renderTable();
        this.updateToolbar();
    }

    renderTable() {
        this.metadataBody.innerHTML = '';

        if (this.filteredFiles.length === 0) {
            this.emptyState.classList.remove('hidden');
            this.toolbar.classList.add('hidden');
            return;
        }

        this.emptyState.classList.add('hidden');
        this.toolbar.classList.remove('hidden');

        this.filteredFiles.forEach((file, index) => {
            const tr = document.createElement('tr');
            if (this.modifiedIndices.has(index)) tr.classList.add('modified');

            tr.innerHTML = `
                <td class="col-type"><span class="badge-type badge-${file.type}">${file.type}</span></td>
                <td class="col-filename" title="${file.fileName}">${file.fileName}</td>
                <td class="col-title"><div class="editable-cell" contenteditable="true" data-field="title" data-index="${index}">${file.title || ''}</div></td>
                <td class="col-artist"><div class="editable-cell" contenteditable="true" data-field="artist" data-index="${index}">${file.artist || ''}</div></td>
                <td class="col-album"><div class="editable-cell" contenteditable="true" data-field="album" data-index="${index}">${file.album || ''}</div></td>
                <td class="col-genre"><div class="editable-cell" contenteditable="true" data-field="genre" data-index="${index}">${file.genre || ''}</div></td>
                <td class="col-year"><div class="editable-cell" contenteditable="true" data-field="year" data-index="${index}">${file.year || ''}</div></td>
                <td class="col-track"><div class="editable-cell" contenteditable="true" data-field="track" data-index="${index}">${file.track || ''}</div></td>
                <td class="col-actions">
                    <button class="btn-icon-small" title="Aperçu"><i data-lucide="eye" style="width: 14px; height: 14px;"></i></button>
                </td>
            `;

            // Handle inline editing
            const editableCells = tr.querySelectorAll('.editable-cell');
            editableCells.forEach(cell => {
                cell.addEventListener('input', (e) => {
                    const field = e.target.dataset.field;
                    const idx = parseInt(e.target.dataset.index);
                    const value = e.target.innerText.trim();

                    // Update internal data
                    this.files[idx][field] = value;
                    this.modifiedIndices.add(idx);
                    tr.classList.add('modified');
                    this.updateToolbar();
                });
            });

            this.metadataBody.appendChild(tr);
        });

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    filterFiles(query) {
        const q = query.toLowerCase();
        this.filteredFiles = this.files.filter(f =>
            f.fileName.toLowerCase().includes(q) ||
            (f.title && f.title.toLowerCase().includes(q)) ||
            (f.artist && f.artist.toLowerCase().includes(q)) ||
            (f.album && f.album.toLowerCase().includes(q))
        );
        this.renderTable();
    }

    updateToolbar() {
        const modifiedCount = this.modifiedIndices.size;
        this.statusText = document.getElementById('metaStatusText');
        this.statusText.innerText = `${this.files.length} ${I18n.t('fichiers chargés')} | ${modifiedCount} ${I18n.t('modifiés')}`;

        if (modifiedCount > 0) {
            this.applyAllBtn.classList.remove('hidden');
        } else {
            this.applyAllBtn.classList.add('hidden');
        }

        if (this.files.length > 0) {
            this.magicBtn.classList.remove('hidden');
        } else {
            this.magicBtn.classList.add('hidden');
        }
    }

    magicAutoTag() {
        if (this.files.length === 0) return;

        // Simple parsing "Artist - Title" or "Artist - Album - Track - Title"
        this.files.forEach((file, index) => {
            const nameWithoutExt = file.fileName.replace(/\.[^/.]+$/, "");

            // Pattern 1: Artist - Title
            if (nameWithoutExt.includes(' - ')) {
                const parts = nameWithoutExt.split(' - ');
                if (parts.length >= 2) {
                    file.artist = parts[0].trim();
                    file.title = parts[1].trim();
                    this.modifiedIndices.add(index);
                }
            } else {
                // Pattern 2: Title only (clean underscores/hyphens)
                file.title = nameWithoutExt.replace(/[_-]/g, ' ').trim();
                this.modifiedIndices.add(index);
            }
        });

        this.renderTable();
        this.updateToolbar();
    }

    async applyAllChanges() {
        if (this.modifiedIndices.size === 0) return;

        const confirmMsg = `${I18n.t('Voulez-vous appliquer les modifications à')} ${this.modifiedIndices.size} ${I18n.t('fichiers')} ?`;
        if (!confirm(confirmMsg)) return;

        this.setApplyLoading(true);

        const indices = Array.from(this.modifiedIndices);
        let successCount = 0;

        for (const idx of indices) {
            const file = this.files[idx];
            try {
                const response = await fetch('/api/metadata/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filePath: file.filePath,
                        metadata: {
                            title: file.title,
                            artist: file.artist,
                            album: file.album,
                            genre: file.genre,
                            year: file.year,
                            track: file.track
                        }
                    })
                });

                const data = await response.json();
                if (data.success) {
                    successCount++;
                }
            } catch (error) {
                console.error(`Error updating ${file.fileName}:`, error);
            }
        }

        this.setApplyLoading(false);
        alert(`${successCount} ${I18n.t('fichiers')} ${I18n.t('mis à jour avec succès !')}`);

        // Refresh to show clean state
        this.modifiedIndices.clear();
        this.renderTable();
        this.updateToolbar();
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.loadingOverlay.classList.remove('hidden');
        } else {
            this.loadingOverlay.classList.add('hidden');
        }
    }

    setApplyLoading(isLoading) {
        const btnText = this.applyAllBtn.querySelector('.btn-text');
        const btnLoader = this.applyAllBtn.querySelector('.btn-loader');

        if (isLoading) {
            btnText.innerText = I18n.t('Application...');
            btnLoader.classList.remove('hidden');
            this.applyAllBtn.disabled = true;
        } else {
            btnText.innerHTML = `<i data-lucide="save" class="inline-icon"></i> ${I18n.t('Appliquer les modifications')}`;
            btnLoader.classList.add('hidden');
            this.applyAllBtn.disabled = false;
        }
        if (window.lucide) window.lucide.createIcons();
    }
}
