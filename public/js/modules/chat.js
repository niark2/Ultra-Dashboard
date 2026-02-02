/**
 * Module AI Chat - Intégration OpenRouter & Context PDF (Markdown & Enter Support)
 */

export const initChat = () => {
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const pdfInput = document.getElementById('pdfInput');
    const pdfStatusText = document.getElementById('pdfStatusText');
    const pdfInfo = document.getElementById('pdfInfo');
    const currentPdfName = document.getElementById('currentPdfName');
    const currentPdfPages = document.getElementById('currentPdfPages');
    const removePdfBtn = document.getElementById('removePdf');
    const chatClearBtn = document.getElementById('chatClearBtn');
    const modelBadge = document.querySelector('.model-badge');

    let chatHistory = [];
    let pdfContext = null;

    // --- Fonctions utilitaires ---

    /**
     * Récupère le nom du modèle configuré au chargement
     */
    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/chat/config');
            const data = await res.json();
            if (data.model && modelBadge) {
                // Formatting model name for display (e.g., openai/chatgpt-4o-latest -> CHATGPT-4O-LATEST)
                const parts = data.model.split('/');
                const shortName = parts[parts.length - 1].toUpperCase();
                modelBadge.textContent = shortName;
                modelBadge.title = data.model; // Original name on hover
            }
        } catch (e) {
            console.error("Impossible de charger la config du chat", e);
        }
    };

    const addMessage = (role, content) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Utilisation de Marked pour le rendu Markdown (si disponible)
        if (role !== 'system' && window.marked) {
            contentDiv.innerHTML = marked.parse(content);
        } else {
            contentDiv.textContent = content;
        }

        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const toggleTyping = (show) => {
        const existing = document.querySelector('.typing-indicator');
        if (show && !existing) {
            const indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            indicator.innerHTML = 'Ultra AI réfléchit <span class="dot"></span><span class="dot"></span><span class="dot"></span>';
            chatMessages.appendChild(indicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else if (!show && existing) {
            existing.remove();
        }
    };

    // --- Gestion du PDF ---

    pdfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        pdfStatusText.textContent = "Analyse en cours...";

        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const response = await fetch('/api/chat/upload-pdf', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Erreur d'analyse");

            const data = await response.json();
            pdfContext = data.text;

            // UI Update
            pdfInfo.classList.remove('hidden');
            currentPdfName.textContent = data.filename;
            currentPdfPages.textContent = `${data.pages} pages`;
            pdfStatusText.textContent = "PDF chargé";

            addMessage('system', `Document "${data.filename}" chargé. Je peux maintenant répondre à vos questions sur son contenu.`);

        } catch (error) {
            console.error(error);
            pdfStatusText.textContent = "Erreur de chargement";
            alert("Erreur lors de l'upload du PDF. Assurez-vous qu'il est valide.");
        }
    });

    removePdfBtn.addEventListener('click', () => {
        pdfContext = null;
        pdfInput.value = '';
        pdfInfo.classList.add('hidden');
        pdfStatusText.textContent = "Ajouter un PDF";
        addMessage('system', "Le contexte du document a été retiré.");
    });

    // --- Gestion du Chat ---

    const sendMessage = async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        // Reset input
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Add user message to UI
        addMessage('user', message);

        // Show typing
        toggleTyping(true);

        try {
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    history: chatHistory,
                    context: pdfContext
                })
            });

            const data = await response.json();
            toggleTyping(false);

            if (data.error) {
                addMessage('system', `Erreur: ${data.error}`);
            } else {
                addMessage('ai', data.reply);
                chatHistory = data.history;
            }

        } catch (error) {
            toggleTyping(false);
            addMessage('system', "Erreur de connexion avec le serveur.");
            console.error(error);
        }
    };

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    // Handle Enter to send (Shift+Enter for newline)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Clear history
    chatClearBtn.addEventListener('click', () => {
        if (confirm("Voulez-vous vraiment effacer l'historique de la conversation ?")) {
            chatHistory = [];
            chatMessages.innerHTML = `
                <div class="message system">
                    <div class="message-content">
                        Historique effacé. Je suis prêt pour une nouvelle discussion !
                    </div>
                </div>
            `;
        }
    });

    // Initialisation
    fetchConfig();
};
