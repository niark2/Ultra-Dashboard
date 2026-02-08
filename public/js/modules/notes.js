
import { I18n } from '../utils/i18n.js';

// ============================================
// NOTES MODULE
// ============================================

export class NotesModule {
    constructor() {
        this.currentNoteId = null;
        this.notes = [];
        this.autoSaveTimeout = null;
        this.isPreviewMode = false;

        this.init();
    }

    init() {
        if (!document.getElementById('tab-notes')) return;
        this.loadNotes();
        this.setupEventListeners();
        this.setupMarkdownToolbar();
        this.setupAutoSave();
        this.setupAI();

        // Sync on launch
        this.syncWithDatabank();

        // Listen for global databank deletions
        document.addEventListener('databank-item-deleted', (e) => {
            this.handleExternalDeletion(e.detail.id);
        });
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    setupEventListeners() {
        // Boutons nouvelle note
        document.getElementById('newNoteBtn')?.addEventListener('click', () => this.createNewNote());
        document.getElementById('newNoteWelcomeBtn')?.addEventListener('click', () => this.createNewNote());

        // Actions de l'éditeur
        document.getElementById('togglePreviewBtn')?.addEventListener('click', () => this.togglePreview());
        document.getElementById('exportNoteBtn')?.addEventListener('click', () => this.exportNoteToDatabank());
        document.getElementById('deleteNoteBtn')?.addEventListener('click', () => this.deleteCurrentNote());

        // Éditeur
        const titleInput = document.getElementById('noteTitleInput');
        const contentEditor = document.getElementById('noteContentEditor');
        const tagsInput = document.getElementById('noteTagsInput');

        titleInput?.addEventListener('input', () => {
            this.updateStats();
            this.scheduleAutoSave();
        });

        contentEditor?.addEventListener('input', () => {
            if (this.isPreviewMode) {
                this.updatePreview();
            }
            this.updateStats();
            this.scheduleAutoSave();
        });

        tagsInput?.addEventListener('input', () => this.scheduleAutoSave());

        // Recherche
        document.getElementById('notesSearchInput')?.addEventListener('input', (e) => {
            this.filterNotes(e.target.value);
        });

        // Raccourcis clavier
        contentEditor?.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    // ============================================
    // NOTES MANAGEMENT
    // ============================================

    loadNotes() {
        const saved = localStorage.getItem('ultra_notes');
        this.notes = saved ? JSON.parse(saved) : [];
        this.renderNotesList();
    }

    saveNotesToStorage() {
        localStorage.setItem('ultra_notes', JSON.stringify(this.notes));
    }

    createNewNote() {
        const newNote = {
            id: Date.now().toString(),
            title: I18n.t('Nouvelle note'),
            content: '',
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.notes.unshift(newNote);
        this.saveNotesToStorage();
        this.renderNotesList();
        this.openNote(newNote.id);
    }

    openNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        this.currentNoteId = noteId;

        // Masquer le welcome screen
        document.getElementById('notesWelcome').style.display = 'none';
        document.getElementById('notesEditorContainer').style.display = 'flex';

        // Charger les données
        document.getElementById('noteTitleInput').value = note.title;
        document.getElementById('noteContentEditor').value = note.content;
        document.getElementById('noteTagsInput').value = note.tags.join(', ');

        // Mettre à jour l'UI
        this.updateStats();
        this.updateActiveNoteInList();

        // Remettre en mode édition si on était en preview
        if (this.isPreviewMode) {
            this.togglePreview();
        }
    }

    saveCurrentNote() {
        if (!this.currentNoteId) return;

        const note = this.notes.find(n => n.id === this.currentNoteId);
        if (!note) return;

        note.title = document.getElementById('noteTitleInput').value || I18n.t('Sans titre');
        note.content = document.getElementById('noteContentEditor').value;
        note.tags = document.getElementById('noteTagsInput').value
            .split(',')
            .map(t => t.trim())
            .filter(t => t);
        note.updatedAt = new Date().toISOString();

        this.saveNotesToStorage();
        this.renderNotesList();
        this.updateActiveNoteInList();
        this.showSaveStatus('saved');

        // Auto-sync avec la databank si déjà lié
        if (note.databankId) {
            this.exportNoteToDatabank(true); // true = silent mode
        }
    }

    async deleteCurrentNote() {
        if (!this.currentNoteId) return;

        if (!confirm(I18n.t('Êtes-vous sûr de vouloir supprimer cette note ?'))) return;

        const note = this.notes.find(n => n.id === this.currentNoteId);

        // Supprimer de la Databank si lié
        if (note && note.databankId) {
            try {
                // On tente la suppression silencieuse, si ça échoue (ex: déjà supprimé), tant pis
                await fetch(`/api/databank/${note.databankId}`, { method: 'DELETE' });
            } catch (e) {
                console.warn("Impossible de supprimer la note de la Databank:", e);
            }
        }

        this.notes = this.notes.filter(n => n.id !== this.currentNoteId);
        this.saveNotesToStorage();
        this.renderNotesList();

        // Retour au welcome screen
        this.currentNoteId = null;
        document.getElementById('notesWelcome').style.display = 'flex';
        document.getElementById('notesEditorContainer').style.display = 'none';

        this.showNotification(I18n.t('Note supprimée'), 'success');
    }

    // ============================================
    // UI RENDERING
    // ============================================

    renderNotesList() {
        const container = document.getElementById('notesList');
        if (!container) return;

        if (this.notes.length === 0) {
            container.innerHTML = `
                <div class="notes-empty">
                    <i data-lucide="file-text" class="notes-empty-icon"></i>
                    <p>${I18n.t('Aucune note')}</p>
                    <p class="notes-empty-hint">${I18n.t('Créez votre première note')}</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = this.notes.map(note => `
            <div class="note-item ${note.id === this.currentNoteId ? 'active' : ''}" data-note-id="${note.id}">
                <div class="note-item-header">
                    <h4 class="note-item-title">${this.escapeHtml(note.title)}</h4>
                    <span class="note-item-date">${this.formatDate(note.updatedAt)}</span>
                </div>
                <p class="note-item-preview">${this.escapeHtml(note.content.substring(0, 100))}</p>
                ${note.tags.length > 0 ? `
                    <div class="note-item-tags">
                        ${note.tags.map(tag => `<span class="note-tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Ajouter les event listeners
        container.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                this.openNote(item.dataset.noteId);
            });
        });

        if (window.lucide) window.lucide.createIcons();
    }

    updateActiveNoteInList() {
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.toggle('active', item.dataset.noteId === this.currentNoteId);
        });
    }

    filterNotes(query) {
        const lowerQuery = query.toLowerCase();
        document.querySelectorAll('.note-item').forEach(item => {
            const noteId = item.dataset.noteId;
            const note = this.notes.find(n => n.id === noteId);
            const matches = note.title.toLowerCase().includes(lowerQuery) ||
                note.content.toLowerCase().includes(lowerQuery) ||
                note.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
            item.style.display = matches ? 'block' : 'none';
        });
    }

    // ============================================
    // MARKDOWN TOOLBAR
    // ============================================

    setupMarkdownToolbar() {
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.applyMarkdownFormat(action);
            });
        });
    }

    applyMarkdownFormat(action) {
        const editor = document.getElementById('noteContentEditor');
        if (!editor) return;

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        const beforeText = editor.value.substring(0, start);
        const afterText = editor.value.substring(end);

        let newText = '';
        let cursorOffset = 0;

        switch (action) {
            case 'bold':
                newText = `**${selectedText || I18n.t('texte en gras')}**`;
                cursorOffset = selectedText ? newText.length : 2;
                break;
            case 'italic':
                newText = `*${selectedText || I18n.t('texte en italique')}*`;
                cursorOffset = selectedText ? newText.length : 1;
                break;
            case 'strikethrough':
                newText = `~~${selectedText || I18n.t('texte barré')}~~`;
                cursorOffset = selectedText ? newText.length : 2;
                break;
            case 'heading':
                newText = `## ${selectedText || I18n.t('Titre')}`;
                cursorOffset = newText.length;
                break;
            case 'quote':
                newText = `> ${selectedText || I18n.t('Citation')}`;
                cursorOffset = newText.length;
                break;
            case 'code':
                if (selectedText.includes('\n')) {
                    newText = `\`\`\`\n${selectedText || I18n.t('code')}\n\`\`\``;
                    cursorOffset = selectedText ? newText.length - 4 : 4;
                } else {
                    newText = `\`${selectedText || I18n.t('code')}\``;
                    cursorOffset = selectedText ? newText.length : 1;
                }
                break;
            case 'list-ul':
                newText = `- ${selectedText || I18n.t('Élément de liste')}`;
                cursorOffset = newText.length;
                break;
            case 'list-ol':
                newText = `1. ${selectedText || I18n.t('Élément de liste')}`;
                cursorOffset = newText.length;
                break;
            case 'checkbox':
                newText = `- [ ] ${selectedText || I18n.t('Tâche')}`;
                cursorOffset = newText.length;
                break;
            case 'link':
                newText = `[${selectedText || I18n.t('texte du lien')}](url)`;
                cursorOffset = selectedText ? newText.length - 5 : newText.length - 4;
                break;
            case 'image':
                newText = `![${selectedText || I18n.t('description')}](url)`;
                cursorOffset = selectedText ? newText.length - 5 : newText.length - 4;
                break;
            case 'table':
                newText = `| ${I18n.t('Colonnes')} 1 | ${I18n.t('Colonnes')} 2 |\n|-----------|-----------|  \n| A         | B         |`;
                cursorOffset = newText.length;
                break;
            default:
                return;
        }

        editor.value = beforeText + newText + afterText;
        editor.focus();
        editor.setSelectionRange(start + cursorOffset, start + cursorOffset);

        this.updateStats();
        this.scheduleAutoSave();
        if (this.isPreviewMode) this.updatePreview();
    }

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================

    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    this.applyMarkdownFormat('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.applyMarkdownFormat('italic');
                    break;
                case 's':
                    e.preventDefault();
                    this.saveCurrentNote();
                    break;
            }
        }
    }

    // ============================================
    // PREVIEW MODE
    // ============================================

    togglePreview() {
        this.isPreviewMode = !this.isPreviewMode;
        const editor = document.getElementById('noteContentEditor');
        const preview = document.getElementById('noteContentPreview');
        const btn = document.getElementById('togglePreviewBtn');

        if (this.isPreviewMode) {
            editor.style.display = 'none';
            preview.style.display = 'block';
            this.updatePreview();
            btn.innerHTML = '<i data-lucide="edit"></i>';
        } else {
            editor.style.display = 'block';
            preview.style.display = 'none';
            btn.innerHTML = '<i data-lucide="eye"></i>';
        }

        if (window.lucide) window.lucide.createIcons();
    }

    updatePreview() {
        const content = document.getElementById('noteContentEditor').value;
        const preview = document.getElementById('noteContentPreview');
        preview.innerHTML = this.markdownToHtml(content);
    }

    // Simple Markdown to HTML converter
    markdownToHtml(markdown) {
        let html = markdown;

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold
        html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

        // Strikethrough
        html = html.replace(/~~(.*?)~~/gim, '<del>$1</del>');

        // Code blocks
        html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');

        // Inline code
        html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>');

        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1">');

        // Blockquotes
        html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

        // Lists
        html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
        html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    // ============================================
    // AUTO-SAVE
    // ============================================

    setupAutoSave() {
        // Auto-save toutes les 30 secondes
        setInterval(() => {
            if (this.currentNoteId) {
                this.saveCurrentNote();
            }
        }, 30000);
    }

    scheduleAutoSave() {
        this.showSaveStatus('saving');

        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        this.autoSaveTimeout = setTimeout(() => {
            this.saveCurrentNote();
        }, 2000); // 2 secondes après la dernière modification
    }

    showSaveStatus(status) {
        const statusEl = document.getElementById('noteSaveStatus');
        if (!statusEl) return;

        statusEl.className = 'note-save-status';

        switch (status) {
            case 'saving':
                statusEl.classList.add('saving');
                statusEl.innerHTML = `<i data-lucide="loader"></i><span>${I18n.t('Sauvegarde...')}</span>`;
                break;
            case 'saved':
                statusEl.innerHTML = `<i data-lucide="check-circle"></i><span>${I18n.t('Sauvegardé')}</span>`;
                this.updateLastSavedTime();
                break;
            case 'error':
                statusEl.classList.add('error');
                statusEl.innerHTML = `<i data-lucide="alert-circle"></i><span>${I18n.t('Erreur')}</span>`;
                break;
        }

        if (window.lucide) window.lucide.createIcons();
    }

    // ============================================
    // STATS
    // ============================================

    updateStats() {
        const content = document.getElementById('noteContentEditor').value;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const chars = content.length;

        document.getElementById('noteWordCount').textContent = `${words} ${words > 1 ? I18n.t('mots') : I18n.t('mot')}`;
        document.getElementById('noteCharCount').textContent = `${chars} ${chars > 1 ? I18n.t('caractères') : I18n.t('caractère')}`;
    }

    updateLastSavedTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString(document.documentElement.lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('noteLastSaved').textContent = `${I18n.t('Sauvegardé à')} ${timeStr}`;
    }

    // ============================================
    // EXPORT TO DATABANK
    // ============================================

    async exportNoteToDatabank(silent = false) {
        if (!this.currentNoteId) return;

        const note = this.notes.find(n => n.id === this.currentNoteId);
        if (!note) return;

        try {
            // Créer un fichier Markdown
            const content = `# ${note.title}\n\n${note.content}`;

            // Si la note a déjà un ID Databank, on met à jour
            if (note.databankId) {
                // Pour une mise à jour, on a besoin du chemin du fichier (qui est dans 'content' en DB pour les fichiers uploadés)
                // MAIS ici on veut mettre à jour le contenu.
                // Problème : l'endpoint updateDatabankItemContent attend le contenu textuel ou le chemin du fichier ?
                // Dans db.js : UPDATE databank SET content = ?
                // Pour les fichiers, 'content' est le chemin du fichier.
                // Pour les notes/textes, 'content' pourrait être le texte direct ?
                // Actuellement, upload() crée un fichier physique et stocke le chemin.
                // Si on update juste le texte en base, ça casse la cohérence fichier/base pour les téléchargements.
                // Solution : On ré-upload le fichier pour écraser l'ancien ou on update le fichier physique.

                // Approche simplifiée : On considère que 'content' en base pour les notes exportées est le chemin du fichier.
                // Donc on doit mettre à jour le fichier physique.
                // L'endpoint PUT /:id/content mis en place met à jour la colonne 'content' en base.
                // Cela ne met pas à jour le fichier sur le disque.

                // RECTIFICATION : Pour l'instant, on va utiliser l'upload pour créer une NOUVELLE version si on ne peut pas modifier le fichier.
                // MAIS l'utilisateur veut "ne permet pas de save plusieurs fois la meme note".

                // On va modifier l'approche :
                // 1. Si databankId existe, on essaie de mettre à jour.
                // SI c'est un fichier physique, il faut un endpoint qui met à jour le fichier physique.

                // Pour faire simple et efficace sans refondre tout le système de fichiers :
                // On va recréer le fichier et mettre à jour le chemin si nécessaire.
                // Le plus simple est de refaire un upload et de mettre à jour l'entrée existante OU de supprimer l'ancienne et recréer.
                // MAIS l'ID changerait.

                // Nouvelle stratégie pour notes.js :
                // On utilise le nouvel endpoint PUT mais il faut qu'il gère l'écriture fichier côté serveur.
                // Comme j'ai implémenté updateDatabankItemContent qui update juste la DB, c'est insuffisant pour des fichiers.

                // On va assumer pour l'instant qu'on garde la logique d'upload pour la création.
                // Pour la mise à jour, on va faire un fetch vers un endpoint custom ou réutiliser l'upload en passant l'ID.

                // SIMPLIFICATION : Je vais modifier saveNotesToStorage pour inclure databankId.
                // Et je vais modifier exportNoteToDatabank pour gérer le cas "déjà exporté".

                // Comme je ne peux pas facilement modifier le fichier physique via l'endpoint générique DB, 
                // je vais modifier exportNoteToDatabank pour :
                // Si databankId existe -> Delete ancien + Upload nouveau (Update ID dans note)
                // C'est un peu brut mais ça marche.
                // Mieux : Ajouter un endpoint spécifique pour update le contenu d'un fichier databank.

                // Pour l'instant, allons au plus simple qui marche avec ce qu'on a :
                // Si databankId, on supprime l'ancien dans la databank puis on ré-upload.
                // On met à jour databankId avec le nouveau.

                if (note.databankId) {
                    await fetch(`/api/databank/${note.databankId}`, { method: 'DELETE' });
                }
            }

            const blob = new Blob([content], { type: 'text/markdown' });
            const filename = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;

            // Créer FormData
            const formData = new FormData();
            formData.append('file', blob, filename);

            // Envoyer au serveur
            const response = await fetch('/api/databank/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                note.databankId = data.id; // Save the new ID
                this.saveNotesToStorage(); // Persist metadata
                if (!silent) this.showNotification(I18n.t('Note synchronisée avec la Databank'), 'success');
            } else {
                throw new Error(I18n.t('Erreur lors de l\'export'));
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification(error.message, 'error');
        }
    }

    // ============================================
    // UTILITIES
    // ============================================

    async syncWithDatabank() {
        const linkedNotes = this.notes.filter(n => n.databankId);
        if (linkedNotes.length === 0) return;

        const idsToCheck = linkedNotes.map(n => n.databankId);

        try {
            const response = await fetch('/api/databank/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToCheck })
            });

            if (response.ok) {
                const data = await response.json();
                const validIds = new Set(data.validIds);

                let changed = false;

                // Find removed IDs
                linkedNotes.forEach(note => {
                    if (!validIds.has(note.databankId)) {
                        // Note removed from Databank -> Remove locally
                        console.log(`Note ${note.id} removed locally because Databank item ${note.databankId} is missing.`);
                        this.notes = this.notes.filter(n => n.id !== note.id);
                        if (this.currentNoteId === note.id) {
                            this.currentNoteId = null;
                            document.getElementById('notesWelcome').style.display = 'flex';
                            document.getElementById('notesEditorContainer').style.display = 'none';
                        }
                        changed = true;
                    }
                });

                if (changed) {
                    this.saveNotesToStorage();
                    this.renderNotesList();
                    this.showNotification(I18n.t('Notes synchronisées avec la Databank (suppressions détectées)'), 'info');
                }
            }
        } catch (error) {
            console.error('Error syncing with databank:', error);
        }
    }

    handleExternalDeletion(databankId) {
        if (!databankId) return;

        const noteToDelete = this.notes.find(n => n.databankId === databankId);
        if (noteToDelete) {
            this.notes = this.notes.filter(n => n.id !== noteToDelete.id);

            if (this.currentNoteId === noteToDelete.id) {
                this.currentNoteId = null;
                document.getElementById('notesWelcome').style.display = 'flex';
                document.getElementById('notesEditorContainer').style.display = 'none';
            }

            this.saveNotesToStorage();
            this.renderNotesList();
            this.showNotification(I18n.t('Note supprimée car l\'élément Databank correspondant a été effacé.'), 'info');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            if (hours === 0) {
                const minutes = Math.floor(diff / (1000 * 60));
                return minutes === 0 ? I18n.t('À l\'instant') : `${I18n.t('Il y a')} ${minutes}min`;
            }
            return `${I18n.t('Il y a')} ${hours}h`;
        } else if (days === 1) {
            return I18n.t('Hier');
        } else if (days < 7) {
            return `${I18n.t('Il y a')} ${days}j`;
        } else {
            return date.toLocaleDateString(document.documentElement.lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit' });
        }
    }

    showNotification(message, type = 'info') {
        const event = new CustomEvent('app-notification', {
            detail: {
                title: type === 'error' ? I18n.t('Erreur') : (type === 'success' ? I18n.t('Succès') : 'Info'),
                message: message,
                type: type
            }
        });
        document.dispatchEvent(event);
    }

    // ============================================
    // AI FEATURES
    // ============================================

    setupAI() {
        this.lastAIAction = null;
        this.lastAIResult = null;

        // Open Modal
        document.getElementById('notesAiBtn')?.addEventListener('click', () => this.openAIModal());

        // Close Modal
        document.getElementById('closeAiModalBtn')?.addEventListener('click', () => this.closeAIModal());

        // Click outside to close
        document.getElementById('notesAiModal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('ai-modal-overlay')) {
                this.closeAIModal();
            }
        });

        // AI Actions
        document.querySelectorAll('.ai-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleAIAction(action);
            });
        });

        // Action Buttons
        document.getElementById('aiRetryBtn')?.addEventListener('click', () => {
            if (this.lastAIAction) this.handleAIAction(this.lastAIAction);
        });

        document.getElementById('aiApplyBtn')?.addEventListener('click', () => {
            this.applyAIResult();
        });
    }

    openAIModal() {
        const modal = document.getElementById('notesAiModal');
        const actionsList = document.getElementById('aiActionsList');
        const processing = document.getElementById('aiProcessing');
        const result = document.getElementById('aiResult');

        // Reset state
        actionsList.style.display = 'grid';
        processing.style.display = 'none';
        result.style.display = 'none';

        modal.style.display = 'flex';
    }

    closeAIModal() {
        document.getElementById('notesAiModal').style.display = 'none';
    }

    async handleAIAction(action) {
        if (!this.currentNoteId) return;

        const editor = document.getElementById('noteContentEditor');
        const fullText = editor.value;
        const selectionStart = editor.selectionStart;
        const selectionEnd = editor.selectionEnd;
        const selectedText = fullText.substring(selectionStart, selectionEnd);

        // Determine context (selection or full text)
        const textToProcess = selectedText.trim() || fullText.trim();

        if (!textToProcess) {
            this.showNotification(I18n.t("Veuillez écrire ou sélectionner du texte d'abord"), "info");
            return;
        }

        this.lastAIAction = action;

        // UI State -> Loading
        document.getElementById('aiActionsList').style.display = 'none';
        document.getElementById('aiResult').style.display = 'none';
        document.getElementById('aiProcessing').style.display = 'flex';

        // Prompt Logic
        let prompt = "";
        let systemPrompt = I18n.t("Tu es un assistant d'écriture expert. Réponds uniquement avec le contenu demandé, sans bavardage.");

        switch (action) {
            case 'summarize':
                prompt = `${I18n.t("Fais un résumé concis du texte suivant :")}\n\n"${textToProcess}"`;
                break;
            case 'fix':
                prompt = `${I18n.t("Corrige les fautes d'orthographe et de grammaire du texte suivant. Conserve le formatage Markdown. Renvoie uniquement le texte corrigé :")}\n\n"${textToProcess}"`;
                break;
            case 'continue':
                prompt = `${I18n.t("Continue la rédaction du texte suivant de manière cohérente et créative :")}\n\n"${textToProcess}"`;
                break;
            case 'ideas':
                prompt = `${I18n.t("Donne-moi 5 idées ou points clés pertinents basés sur le texte suivant :")}\n\n"${textToProcess}"`;
                break;
        }

        try {
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: prompt,
                    history: [],
                    systemPrompt: systemPrompt
                })
            });

            if (!response.ok) throw new Error(I18n.t("Erreur lors de la communication avec l'IA"));

            const data = await response.json();
            this.lastAIResult = data.reply;

            // UI State -> Result
            document.getElementById('aiProcessing').style.display = 'none';
            document.getElementById('aiResult').style.display = 'flex';

            // Render Markdown in result
            const resultContent = document.getElementById('aiResultContent');
            resultContent.innerHTML = this.lastAIResult; // Simple display, could be markdown parsed

        } catch (error) {
            console.error(error);
            this.showNotification(I18n.t("Erreur lors de la génération IA"), "error");
            this.closeAIModal();
        }
    }

    applyAIResult() {
        if (!this.lastAIResult) return;

        const editor = document.getElementById('noteContentEditor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const text = editor.value;

        // If selection exists, replace it. If not, append to end or insert at cursor
        const before = text.substring(0, start);
        const after = text.substring(end);

        // Insert prompt or replace
        const newText = before + this.lastAIResult + after;

        editor.value = newText;

        // Trigger updates
        this.updateStats();
        this.scheduleAutoSave();
        if (this.isPreviewMode) this.updatePreview();

        this.closeAIModal();
        this.showNotification(I18n.t("Contenu inséré avec succès"), "success");
    }
}
