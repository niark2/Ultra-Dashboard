/**
 * Databank Module - Gestion centralisée des résultats
 */
export class DatabankModule {
    constructor() {
        this.items = [];
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
            previewMeta: document.getElementById('previewMeta')
        };

        this.init();
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

        // If databank is already active (rare but possible if default tab changed)
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'tab-databank') {
            this.onTabActivate();
        }

        // Expose to window for tab management
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
        // Refresh every 30 seconds while tab is active
        this.refreshInterval = setInterval(() => {
            console.log('🔄 Databank Auto-refreshing...');
            this.loadItems(null, true); // silent refresh
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

        // Modal
        this.elements.closePreviewBtn.addEventListener('click', () => {
            this.elements.previewModal.classList.remove('active');
        });

        this.elements.previewModal.addEventListener('click', (e) => {
            if (e.target === this.elements.previewModal) {
                this.elements.previewModal.classList.remove('active');
            }
        });
    }

    async loadItems(page = null, silent = false) {
        if (this.isLoading) return;
        this.isLoading = true;

        if (page) this.currentPage = page;

        const offset = (this.currentPage - 1) * this.limit;
        const type = this.elements.filterType.value !== 'all' ? this.elements.filterType.value : '';
        const search = this.elements.search.value; // Search would need backend support, for now filtering client side or just ignore

        if (!silent) {
            this.elements.grid.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Chargement...</p>
                </div>
            `;
        }

        try {
            const url = new URL('/api/databank', window.location.origin);
            url.searchParams.append('limit', this.limit);
            url.searchParams.append('offset', offset);
            if (type) url.searchParams.append('type', type);

            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

            const data = await res.json();
            this.items = data.items || [];
            this.renderItems();
            this.updatePagination(this.items.length);

        } catch (error) {
            console.error('Error loading databank:', error);
            this.elements.grid.innerHTML = `
                <div class="error-message">
                    <p>Erreur lors du chargement des données</p>
                    <button class="btn-secondary" onclick="window.databankModule.loadItems()">Réessayer</button>
                </div>
            `;
        } finally {
            this.isLoading = false;
        }
    }

    renderItems() {
        if (!Array.isArray(this.items) || this.items.length === 0) {
            this.elements.grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i data-lucide="database" style="font-size: 48px; margin-bottom: 20px; opacity: 0.5;"></i>
                    <p>Aucune donnée trouvée</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        this.elements.grid.innerHTML = '';

        this.items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'databank-item';
            if (item.metadata.tool === 'plexus') {
                el.classList.add('item-plexus');
            }

            let preview = '';
            let icon = 'file';

            if (item.type === 'image') {
                preview = `<img src="${item.content}" alt="Image" loading="lazy">`;
                icon = 'image';
            } else if (item.type === 'audio') {
                if (item.metadata.thumbnail) {
                    preview = `<img src="${item.metadata.thumbnail}" alt="Thumbnail" loading="lazy">`;
                } else {
                    preview = `<i data-lucide="music"></i>`;
                }
                icon = 'music';
            } else if (item.type === 'video') {
                if (item.metadata.thumbnail) {
                    preview = `<img src="${item.metadata.thumbnail}" alt="Thumbnail" loading="lazy">`;
                } else {
                    preview = `<i data-lucide="video"></i>`;
                }
                icon = 'video';
            } else if (item.type === 'text') {
                const snippet = item.content.length > 300 ? item.content.substring(0, 300) + '...' : item.content;
                preview = `<div class="text-preview-snippet">${snippet}</div>`;
                icon = 'file-text';
            } else {
                preview = `<i data-lucide="file-text"></i>`;
                icon = 'file-text';
            }

            const date = new Date(item.created_at).toLocaleString();
            let title = item.metadata.originalName || item.metadata.title;

            // Generate title from content if missing for text items (like Plexus)
            if (!title && item.type === 'text') {
                title = item.content.split('\n')[0].substring(0, 50);
                if (title.length >= 50) title += '...';
            }
            if (!title) title = `Item #${item.id}`;

            const tool = item.metadata.tool || 'Unknown';
            const toolIcon = tool === 'plexus' ? 'sparkles' : 'cpu';

            el.innerHTML = `
                <div class="databank-preview">
                    ${preview}
                    <span class="databank-type-badge">${item.type}</span>
                    <div class="databank-actions">
                        <button class="action-btn" title="Télécharger" onclick="event.stopPropagation(); window.databankModule.downloadItem(${item.id})">
                            <i data-lucide="download"></i>
                        </button>
                        <button class="action-btn" title="Supprimer" onclick="event.stopPropagation(); window.databankModule.deleteItem(${item.id})">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
                <div class="databank-info">
                    <h4>${title}</h4>
                    <p><i data-lucide="${toolIcon}" style="width:12px; height:12px;"></i> ${tool} • ${date}</p>
                </div>
            `;


            el.addEventListener('click', () => this.openPreview(item));
            this.elements.grid.appendChild(el);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    updatePagination(count) {
        this.elements.pagination.classList.remove('hidden');
        this.elements.pageInfo.textContent = `Page ${this.currentPage}`;

        this.elements.prevBtn.disabled = this.currentPage === 1;
        this.elements.nextBtn.disabled = count < this.limit;
    }

    openPreview(item) {
        this.elements.previewTitle.textContent = item.metadata.originalName || `Item #${item.id}`;

        if (item.type === 'image') {
            this.elements.previewBody.innerHTML = `<img src="${item.content}" class="preview-image-full" alt="Preview">`;
        } else if (item.type === 'text') {
            this.elements.previewBody.innerHTML = `<div class="preview-text-full">${item.content}</div>`;
        } else if (item.type === 'audio') {
            let innerHTML = '';
            if (item.metadata.thumbnail) {
                innerHTML = `<img src="${item.metadata.thumbnail}" class="preview-image-full" alt="Thumbnail" style="max-width: 100%; max-height: 300px; object-fit: contain; margin-bottom: 20px; border-radius: 8px;">`;
            }
            innerHTML += `
                <div style="padding: 20px;">
                    <audio controls style="width: 100%; max-width: 600px; margin: 0 auto; display: block;">
                        <source src="${item.content}" type="audio/mpeg">
                        <source src="${item.content}" type="audio/mp4">
                        <source src="${item.content}" type="audio/wav">
                        <source src="${item.content}" type="audio/ogg">
                        Votre navigateur ne supporte pas la lecture audio.
                    </audio>
                    ${item.metadata.title ? `<p style="margin-top: 15px; text-align: center; font-weight: 500;">${item.metadata.title}</p>` : ''}
                </div>
            `;
            this.elements.previewBody.innerHTML = innerHTML;
        } else if (item.type === 'video') {
            this.elements.previewBody.innerHTML = `
                <div style="padding: 20px;">
                    <video controls style="width: 100%; max-width: 100%; max-height: 70vh; border-radius: 8px; display: block; margin: 0 auto;">
                        <source src="${item.content}" type="video/mp4">
                        <source src="${item.content}" type="video/webm">
                        <source src="${item.content}" type="video/ogg">
                        Votre navigateur ne supporte pas la lecture vidéo.
                    </video>
                    ${item.metadata.title ? `<p style="margin-top: 15px; text-align: center; font-weight: 500;">${item.metadata.title}</p>` : ''}
                </div>
            `;
        } else {
            // Fallback pour autres types
            let innerHTML = '';
            if (item.metadata.thumbnail) {
                innerHTML = `<img src="${item.metadata.thumbnail}" class="preview-image-full" alt="Preview" style="max-height: 40vh; margin-bottom: 20px;">`;
            }
            innerHTML += `
                <div style="text-align: center; padding: 20px;">
                    <i data-lucide="file" style="font-size: 64px; margin-bottom: 20px;"></i>
                    <p>Aperçu non disponible pour ce type de fichier.</p>
                    <p style="font-size: 12px; color: var(--text-muted);">${item.metadata.title || ''}</p>
                </div>
            `;
            this.elements.previewBody.innerHTML = innerHTML;
        }

        if (window.lucide) window.lucide.createIcons();

        // Meta info
        const metaList = Object.entries(item.metadata).map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('');
        this.elements.previewMeta.innerHTML = `
            <div style="margin-top: 10px; font-size: 12px; color: var(--text-secondary); display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><strong>ID:</strong> ${item.id}</div>
                <div><strong>Type:</strong> ${item.type}</div>
                <div><strong>Date:</strong> ${new Date(item.created_at).toLocaleString()}</div>
                ${metaList}
            </div>
        `;

        this.elements.previewDownloadBtn.onclick = () => this.downloadItem(item.id);

        this.elements.previewModal.classList.add('active');
    }

    async downloadItem(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;

        const a = document.createElement('a');
        a.href = item.content;
        a.download = item.metadata.originalName || `databank-item-${id}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async deleteItem(id) {
        if (!confirm('Voulez-vous vraiment supprimer cet élément ?')) return;

        try {
            await fetch(`/api/databank/${id}`, { method: 'DELETE' });
            this.loadItems();
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Erreur lors de la suppression');
        }
    }

    async clearAll() {
        if (!confirm('ATTENTION: Voulez-vous vraiment TOUT effacer ? Cette action est irréversible.')) return;

        try {
            await fetch(`/api/databank/clear`, { method: 'POST' });
            this.loadItems();
        } catch (error) {
            console.error('Error clearing all:', error);
            alert('Erreur lors du nettoyage');
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}
