/**
 * Databank Module - Gestion centralisée des résultats
 */
export class DatabankModule {
    constructor() {
        this.items = [];
        this.folders = [];
        this.currentFolderId = 'root';
        this.breadcrumbs = [{ id: 'root', name: 'Racine' }];
        this.currentPage = 1;
        this.limit = 20;
        this.isLoading = false;
        this.refreshInterval = null;

        this.elements = {
            grid: document.getElementById('databankGrid'),
            refreshBtn: document.getElementById('databankRefreshBtn'),
            clearBtn: document.getElementById('databankClearBtn'),
            search: document.getElementById('databankSearch'),
            filterType: document.getElementById('databankFilterType'),
            prevBtn: document.getElementById('databankPrevBtn'),
            nextBtn: document.getElementById('databankNextBtn'),
            pageInfo: document.getElementById('databankPageInfo'),
            pagination: document.getElementById('databankPagination'),
            previewModal: document.getElementById('databankPreviewModal'),
            closePreviewBtn: document.getElementById('closePreviewModal'),
            previewBody: document.getElementById('previewBody'),
            previewTitle: document.getElementById('previewTitle'),
            previewDownloadBtn: document.getElementById('previewDownloadBtn'),
            previewMeta: document.getElementById('previewMeta'),
            // Folder UI
            newFolderBtn: document.getElementById('databankNewFolderBtn'),
            breadcrumbs: document.getElementById('databankBreadcrumbs'),
            folderModal: document.getElementById('databankFolderModal'),
            closeFolderModal: document.getElementById('closeFolderModal'),
            confirmFolderBtn: document.getElementById('confirmFolderBtn'),
            cancelFolderBtn: document.getElementById('cancelFolderBtn'),
            folderNameInput: document.getElementById('folderName'),
            // Move UI
            moveModal: document.getElementById('databankMoveModal'),
            closeMoveModal: document.getElementById('closeMoveModal'),
            folderList: document.getElementById('folderList')
        };

        this.init();
    }

    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    sanitizeUrl(url) {
        if (!url) return '';
        if (url.startsWith('javascript:')) return '';
        return this.escapeHtml(url);
    }

    init() {
        this.setupEventListeners();

        // Listen for tab changes
        document.addEventListener('tab-changed', (e) => {
            if (e.detail.tabId === 'databank') {
                this.onTabActivate();
            } else {
                this.onTabDeactivate();
            }
        });

        // If databank is already active
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'tab-databank') {
            this.onTabActivate();
        }

        // Expose to window for global access
        window.databankModule = this;
    }

    onTabActivate() {
        console.log('📊 Databank Activated');
        this.loadItems();
        this.startAutoRefresh();
    }

    onTabDeactivate() {
        this.stopAutoRefresh();
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(() => {
            this.loadItems(null, true);
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    setupEventListeners() {
        this.elements.refreshBtn.addEventListener('click', () => this.loadItems());
        this.elements.clearBtn.addEventListener('click', () => this.clearAll());

        this.elements.search.addEventListener('input', this.debounce(() => this.loadItems(1), 500));
        this.elements.filterType.addEventListener('change', () => this.loadItems(1));

        this.elements.prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) this.loadItems(this.currentPage - 1);
        });

        this.elements.nextBtn.addEventListener('click', () => {
            this.loadItems(this.currentPage + 1);
        });

        // Folder Modal
        this.elements.newFolderBtn.addEventListener('click', () => {
            this.elements.folderNameInput.value = '';
            this.elements.folderModal.classList.add('active');
            this.elements.folderNameInput.focus();
        });

        this.elements.closeFolderModal.addEventListener('click', () => this.elements.folderModal.classList.remove('active'));
        this.elements.cancelFolderBtn.addEventListener('click', () => this.elements.folderModal.classList.remove('active'));
        this.elements.confirmFolderBtn.addEventListener('click', () => this.createFolder());

        // Preview Modal
        this.elements.closePreviewBtn.addEventListener('click', () => {
            this.elements.previewModal.classList.remove('active');
        });

        // Move Modal
        this.elements.closeMoveModal.addEventListener('click', () => this.elements.moveModal.classList.remove('active'));

        // Close modals on overlay click
        [this.elements.previewModal, this.elements.folderModal, this.elements.moveModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });
    }

    async loadItems(page = null, silent = false) {
        if (this.isLoading) return;
        this.isLoading = true;

        if (page) this.currentPage = page;

        const offset = (this.currentPage - 1) * this.limit;
        const type = this.elements.filterType.value !== 'all' ? this.elements.filterType.value : '';
        const search = this.elements.search.value.trim();

        if (!silent) {
            this.elements.grid.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Chargement...</p>
                </div>
            `;
        }

        try {
            // Fetch Items
            const itemsUrl = new URL('/api/databank', window.location.origin);
            itemsUrl.searchParams.append('limit', this.limit);
            itemsUrl.searchParams.append('offset', offset);
            if (type) itemsUrl.searchParams.append('type', type);
            if (search) itemsUrl.searchParams.append('search', search);

            if (this.currentFolderId !== 'all') {
                itemsUrl.searchParams.append('folderId', this.currentFolderId === 'root' ? 'root' : this.currentFolderId);
            }

            // Fetch Folders (only if viewing root or a specific folder)
            let folders = [];
            if (this.currentFolderId !== 'all') {
                const foldersUrl = new URL('/api/databank/folders', window.location.origin);
                if (search) foldersUrl.searchParams.append('search', search);

                if (this.currentFolderId !== 'root' && !search) {
                    foldersUrl.searchParams.append('parentId', this.currentFolderId);
                }
                const fRes = await fetch(foldersUrl);
                if (fRes.ok) {
                    const fData = await fRes.json();
                    folders = fData.folders || [];
                }
            }

            const res = await fetch(itemsUrl);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

            const data = await res.json();
            this.items = data.items || [];
            this.folders = folders;

            this.renderItems();
            this.renderBreadcrumbs();
            this.updatePagination(this.items.length);

        } catch (error) {
            console.error('Error loading databank:', error);
            this.elements.grid.innerHTML = `<div class="error-message"><p>Erreur lors du chargement des données</p></div>`;
        } finally {
            this.isLoading = false;
        }
    }

    renderItems() {
        this.elements.grid.innerHTML = '';

        if (this.items.length === 0 && this.folders.length === 0) {
            this.elements.grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i data-lucide="database" style="font-size: 48px; margin-bottom: 20px; opacity: 0.5;"></i>
                    <p>Aucune donnée trouvée</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Render Folders
        this.folders.forEach(folder => {
            const el = document.createElement('div');
            el.className = 'databank-item folder-item';
            el.innerHTML = `
                <div class="databank-preview">
                    <i data-lucide="folder"></i>
                    <div class="databank-actions">
                        <button class="action-btn" title="Supprimer" onclick="event.stopPropagation(); window.databankModule.deleteFolder(${folder.id})">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
                <div class="databank-info">
                    <h4>${this.escapeHtml(folder.name)}</h4>
                    <p>Dossier</p>
                </div>
            `;
            el.addEventListener('click', () => this.navigateToFolder(folder.id, folder.name));
            this.elements.grid.appendChild(el);
        });

        // Render Items
        this.items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'databank-item';
            if (item.metadata.tool === 'plexus') el.classList.add('item-plexus');

            let preview = '';
            if (item.type === 'image') {
                preview = `<img src="${this.sanitizeUrl(item.content)}" alt="Image" loading="lazy">`;
            } else if (item.type === 'audio') {
                preview = item.metadata.thumbnail ? `<img src="${this.sanitizeUrl(item.metadata.thumbnail)}" alt="Thumb">` : `<i data-lucide="music"></i>`;
            } else if (item.type === 'video') {
                preview = item.metadata.thumbnail ? `<img src="${this.sanitizeUrl(item.metadata.thumbnail)}" alt="Thumb">` : `<i data-lucide="video"></i>`;
            } else if (item.type === 'text') {
                const rawContent = item.content;
                const snippet = rawContent.length > 200 ? rawContent.substring(0, 200) + '...' : rawContent;
                preview = `<div class="text-preview-snippet">${this.escapeHtml(snippet)}</div>`;
            } else {
                preview = `<i data-lucide="file-text"></i>`;
            }

            const date = new Date(item.created_at).toLocaleString();
            let title = item.metadata.originalName || item.metadata.title;
            if (!title && item.type === 'text') title = item.content.split('\n')[0].substring(0, 50);
            if (!title) title = `Item #${item.id}`;

            const tool = item.metadata.tool || 'Unknown';
            const toolIcon = tool === 'plexus' ? 'sparkles' : 'cpu';

            el.innerHTML = `
                <div class="databank-preview">
                    ${preview}
                    <span class="databank-type-badge">${this.escapeHtml(item.type)}</span>
                    <div class="databank-actions">
                        <button class="action-btn" title="Télécharger" onclick="event.stopPropagation(); window.databankModule.downloadItem(${item.id})">
                            <i data-lucide="download"></i>
                        </button>
                        <button class="move-action" title="Déplacer" onclick="event.stopPropagation(); window.databankModule.openMoveModal(${item.id})">
                            <i data-lucide="folder-output"></i>
                        </button>
                        <button class="action-btn" title="Supprimer" onclick="event.stopPropagation(); window.databankModule.deleteItem(${item.id})">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
                <div class="databank-info">
                    <h4>${this.escapeHtml(title)}</h4>
                    <p><i data-lucide="${toolIcon}" style="width:12px; height:12px;"></i> ${this.escapeHtml(tool)} • ${date}</p>
                </div>
            `;

            el.addEventListener('click', () => this.openPreview(item));
            this.elements.grid.appendChild(el);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    renderBreadcrumbs() {
        this.elements.breadcrumbs.innerHTML = '';
        this.breadcrumbs.forEach((bc, index) => {
            const el = document.createElement('span');
            el.className = `breadcrumb-item ${index === this.breadcrumbs.length - 1 ? 'active' : ''}`;
            el.innerHTML = bc.id === 'root' ? `<i data-lucide="home"></i> Racine` : bc.name;
            el.addEventListener('click', () => this.navigateToBreadcrumb(index));
            this.elements.breadcrumbs.appendChild(el);
        });
        if (window.lucide) window.lucide.createIcons();
    }

    navigateToFolder(id, name) {
        this.currentFolderId = id;
        this.breadcrumbs.push({ id, name });
        this.currentPage = 1;
        this.loadItems();
    }

    navigateToBreadcrumb(index) {
        if (index === this.breadcrumbs.length - 1) return;
        this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
        this.currentFolderId = this.breadcrumbs[index].id;
        this.currentPage = 1;
        this.loadItems();
    }

    async createFolder() {
        const name = this.elements.folderNameInput.value.trim();
        if (!name) return;

        try {
            const res = await fetch('/api/databank/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    parentId: this.currentFolderId === 'root' ? null : this.currentFolderId
                })
            });

            if (res.ok) {
                this.elements.folderModal.classList.remove('active');
                this.loadItems();
            }
        } catch (error) {
            console.error('Error creating folder:', error);
        }
    }

    async deleteFolder(id) {
        if (!confirm('Voulez-vous supprimer ce dossier ? Les éléments qu\'il contient seront déplacés vers le parent.')) return;
        try {
            await fetch(`/api/databank/folders/${id}`, { method: 'DELETE' });
            this.loadItems();
        } catch (error) {
            console.error('Error deleting folder:', error);
        }
    }

    async openMoveModal(itemId) {
        this.elements.folderList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        this.elements.moveModal.classList.add('active');

        try {
            // Get all folders for the move list (infinite depth or just flatten?)
            // For now, let's just show folders in the current view or root
            const res = await fetch('/api/databank/folders'); // Adjust API to get all maybe?
            const data = await res.json();
            const folders = data.folders || [];

            this.elements.folderList.innerHTML = '';

            // Option for Root
            const rootEl = document.createElement('div');
            rootEl.className = 'folder-select-item';
            rootEl.innerHTML = `<i data-lucide="home"></i><span>Racine</span>`;
            rootEl.onclick = () => this.moveItemToFolder(itemId, null);
            this.elements.folderList.appendChild(rootEl);

            folders.forEach(f => {
                const fEl = document.createElement('div');
                fEl.className = 'folder-select-item';
                fEl.innerHTML = `<i data-lucide="folder"></i><span>${f.name}</span>`;
                fEl.onclick = () => this.moveItemToFolder(itemId, f.id);
                this.elements.folderList.appendChild(fEl);
            });

            if (window.lucide) window.lucide.createIcons();
        } catch (error) {
            console.error('Error loading move folders:', error);
        }
    }

    async moveItemToFolder(itemId, folderId) {
        try {
            await fetch(`/api/databank/${itemId}/folder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderId })
            });
            this.elements.moveModal.classList.remove('active');
            this.loadItems();
        } catch (error) {
            console.error('Error moving item:', error);
        }
    }

    updatePagination(count) {
        this.elements.pagination.classList.toggle('hidden', count < this.limit && this.currentPage === 1);
        this.elements.pageInfo.textContent = `Page ${this.currentPage}`;
        this.elements.prevBtn.disabled = this.currentPage === 1;
        this.elements.nextBtn.disabled = count < this.limit;
    }

    openPreview(item) {
        this.elements.previewTitle.textContent = item.metadata.originalName || `Item #${item.id}`;
        if (item.type === 'image') {
            this.elements.previewBody.innerHTML = `<img src="${this.sanitizeUrl(item.content)}" class="preview-image-full" alt="Preview">`;
        } else if (item.type === 'text') {
            const safeContent = this.escapeHtml(item.content);
            this.elements.previewBody.innerHTML = `<div class="preview-text-full">${safeContent}</div>`;
        } else if (item.type === 'audio') {
            let html = item.metadata.thumbnail ? `<img src="${this.sanitizeUrl(item.metadata.thumbnail)}" class="preview-image-full" style="max-height: 300px;">` : '';
            html += `<div style="padding: 20px;"><audio controls style="width: 100%;"><source src="${this.sanitizeUrl(item.content)}"></audio></div>`;
            this.elements.previewBody.innerHTML = html;
        } else if (item.type === 'video') {
            this.elements.previewBody.innerHTML = `<div style="padding: 20px;"><video controls style="width: 100%; max-height: 70vh;"><source src="${this.sanitizeUrl(item.content)}"></video></div>`;
        } else if (item.type === 'md') {
            this.elements.previewBody.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Chargement du document...</p></div>';

            // Normalize path for Windows: replace backslashes with forward slashes
            let url = item.content.replace(/\\/g, '/');
            if (!url.startsWith('/')) url = '/' + url;

            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error('Impossible de charger le fichier');
                    return response.text();
                })
                .then(text => {
                    if (window.marked && window.marked.parse) {
                        try {
                            const rawHtml = window.marked.parse(text);
                            // Basic sanitizer for Markdown output since we don't have DOMPurify
                            const safeHtml = rawHtml.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
                                .replace(/javascript:/gim, "")
                                .replace(/on\w+=/gim, "data-blocked-event=");
                            this.elements.previewBody.innerHTML = `<div class="markdown-preview" style="padding: 20px; max-height: 60vh; overflow-y: auto; background: var(--surface-secondary); border-radius: 8px;">${safeHtml}</div>`;
                        } catch (e) {
                            this.elements.previewBody.innerText = text;
                        }
                    } else {
                        // Fallback plain text
                        this.elements.previewBody.innerHTML = `<pre class="preview-text-full" style="white-space: pre-wrap;">${this.escapeHtml(text)}</pre>`;
                    }
                })
                .catch(err => {
                    this.elements.previewBody.innerHTML = `<div class="error-message" style="padding: 20px; color: var(--error);">Erreur: ${this.escapeHtml(err.message)}</div>`;
                });
        } else {
            this.elements.previewBody.innerHTML = `<div style="text-align: center; padding: 40px;"><i data-lucide="file" style="font-size: 64px;"></i><p>Aperçu non disponible</p></div>`;
        }

        const metaList = Object.entries(item.metadata).map(([k, v]) => `
            <div class="preview-meta-item">
                <strong>${this.escapeHtml(k)}</strong>
                <span>${this.escapeHtml(String(v || 'N/A'))}</span>
            </div>
        `).join('');

        this.elements.previewMeta.innerHTML = `
            <div class="preview-meta-grid">
                <div class="preview-meta-item"><strong>ID</strong><span>#${item.id}</span></div>
                <div class="preview-meta-item"><strong>Type</strong><span>${item.type}</span></div>
                <div class="preview-meta-item"><strong>Date</strong><span>${new Date(item.created_at).toLocaleString()}</span></div>
                ${metaList}
            </div>
        `;

        this.elements.previewDownloadBtn.onclick = () => this.downloadItem(item.id);
        this.elements.previewModal.classList.add('active');
        if (window.lucide) window.lucide.createIcons();
    }

    async downloadItem(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        const a = document.createElement('a');
        a.href = item.content;
        a.download = item.metadata.originalName || `item-${id}`;
        a.click();
    }

    async deleteItem(id) {
        if (!confirm('Supprimer cet élément ?')) return;
        try {
            await fetch(`/api/databank/${id}`, { method: 'DELETE' });
            this.loadItems();

            // Emit global event for other modules (like Notes)
            const event = new CustomEvent('databank-item-deleted', { detail: { id: id } });
            document.dispatchEvent(event);

        } catch (error) {
            console.error('Error deleting item:', error);
        }
    }

    async clearAll() {
        if (!confirm('TOUT effacer ? Cette action est irréversible.')) return;
        try {
            await fetch(`/api/databank/clear`, { method: 'POST' });
            this.loadItems();
        } catch (error) {
            console.error('Error clearing all:', error);
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}
