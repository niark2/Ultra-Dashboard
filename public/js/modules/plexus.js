import { Storage } from '../utils/storage.js';

/**
 * Plexus Module - AI Search Interface (Perplexity Clone)
 * Recherche intelligente avec SearXNG + synthèse IA
 */

export const initPlexus = () => {
    // ... existing elements ...
    const form = document.getElementById('plexusForm');
    const input = document.getElementById('plexusInput');
    const sendBtn = document.getElementById('plexusSendBtn');
    const searchWrapper = document.getElementById('plexusSearchWrapper');
    const logoContainer = document.getElementById('plexusLogoContainer');
    const suggestions = document.getElementById('plexusSuggestions');
    const resultsArea = document.getElementById('plexusResultsArea');
    const currentQueryEl = document.getElementById('plexusCurrentQuery');
    const backBtn = document.getElementById('plexusBackBtn');
    const thinkingEl = document.getElementById('plexusThinking');
    const thinkingSteps = document.getElementById('plexusThinkingSteps');
    const answerEl = document.getElementById('plexusAnswer');
    const sourcesList = document.getElementById('plexusSourcesList');
    const followupEl = document.getElementById('plexusFollowup');
    const followupList = document.getElementById('plexusFollowupList');

    // State
    let isSearching = false;
    let currentSources = []; // Store sources for citation rendering

    // Initialize
    if (window.lucide) {
        window.lucide.createIcons();
    }
    checkSearXNGHealth();

    /**
     * Check SearXNG connection status
     */
    async function checkSearXNGHealth() {
        try {
            const response = await fetch('/api/plexus/health', {
                credentials: 'same-origin'
            });
            const data = await response.json();

            if (data.searxng !== 'connected') {
                console.warn('[Plexus] SearXNG not connected:', data);
            }
        } catch (error) {
            console.error('[Plexus] Health check failed:', error);
        }
    }

    /**
     * Show thinking animation
     */
    function showThinking() {
        thinkingEl.classList.remove('hidden');
        answerEl.innerHTML = '';
        answerEl.classList.remove('typing');

        const deepResearchToggle = document.getElementById('plexusDeepResearch');
        const isDeepResearch = deepResearchToggle ? deepResearchToggle.checked : false;

        thinkingSteps.innerHTML = `
            <div class="thinking-step active">
                <i data-lucide="${isDeepResearch ? 'microscope' : 'search'}"></i>
                <span>${isDeepResearch ? 'Deep Research: Exploration approfondie...' : 'Recherche sur le web...'}</span>
            </div>
        `;

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    /**
     * Update thinking step
     */
    function updateThinkingStep(step) {
        const steps = {
            searching: {
                done: [`
                    <div class="thinking-step done">
                        <i data-lucide="check"></i>
                        <span>Sources trouvées</span>
                    </div>
                `],
                active: `
                    <div class="thinking-step active">
                        <i data-lucide="brain"></i>
                        <span>Analyse et synthèse...</span>
                    </div>
                `
            },
            generating: {
                done: [`
                    <div class="thinking-step done">
                        <i data-lucide="check"></i>
                        <span>Sources trouvées</span>
                    </div>`,
                    `<div class="thinking-step done">
                        <i data-lucide="check"></i>
                        <span>Analyse terminée</span>
                    </div>
                `],
                active: `
                    <div class="thinking-step active">
                        <i data-lucide="sparkles"></i>
                        <span>Rédaction de la réponse...</span>
                    </div>
                `
            }
        };

        if (steps[step]) {
            thinkingSteps.innerHTML = steps[step].done.join('') + steps[step].active;

            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }

    /**
     * Hide thinking animation
     */
    function hideThinking() {
        thinkingEl.classList.add('hidden');
    }

    /**
     * Display sources in the sidebar
     */
    function renderSources(sources) {
        if (!sources || sources.length === 0) {
            sourcesList.innerHTML = `
                <div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">
                    Aucune source trouvée
                </div>
            `;
            return;
        }

        sourcesList.innerHTML = sources.map(source => {
            const hostname = new URL(source.url).hostname;
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

            return `
                <a href="${source.url}" target="_blank" rel="noopener noreferrer" class="plexus-source-card">
                    <div class="plexus-source-header">
                        <img src="${faviconUrl}" alt="" class="source-favicon">
                        <div class="plexus-source-index">${source.index}</div>
                    </div>
                    <div class="plexus-source-info">
                        <div class="plexus-source-title">${escapeHtml(source.title)}</div>
                        <div class="plexus-source-url">${hostname}</div>
                    </div>
                </a>
            `;
        }).join('');
    }

    /**
     * Display loading skeletons for sources
     */
    function showSourcesSkeleton() {
        sourcesList.innerHTML = `
            <div class="plexus-sources-loading">
                <div class="plexus-source-skeleton"></div>
                <div class="plexus-source-skeleton"></div>
                <div class="plexus-source-skeleton"></div>
                <div class="plexus-source-skeleton"></div>
            </div>
        `;
    }

    /**
     * Display the AI answer with markdown rendering and citation enrichment
     */
    function renderAnswer(answer) {
        hideThinking();

        // 1. Render Markdown to HTML first
        let htmlContent = "";
        if (window.marked) {
            htmlContent = marked.parse(answer);
        } else {
            htmlContent = answer.replace(/\n/g, '<br>');
        }

        // 2. Process citations in the generated HTML
        if (currentSources && currentSources.length > 0) {
            htmlContent = htmlContent.replace(/(\[\d+\])+/g, (match) => {
                const nums = match.match(/\d+/g);
                if (!nums) return match;

                const firstIndex = parseInt(nums[0]) - 1;
                const source = currentSources[firstIndex];

                if (source) {
                    const hostname = new URL(source.url).hostname;
                    const displayDomain = hostname.replace('www.', '').split('.')[0];
                    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

                    const additionalCount = nums.length - 1;
                    const plusText = additionalCount > 0 ? `<span class="citation-plus">+${additionalCount}</span>` : '';

                    return `<span class="plexus-citation" data-indices="${nums.map(n => parseInt(n) - 1).join(',')}">
                        <img src="${faviconUrl}" alt="" class="citation-favicon">
                        <span class="citation-domain">${displayDomain}</span>
                        ${plusText}
                    </span>`;
                }
                return match;
            });
        }

        answerEl.innerHTML = htmlContent;

        // 3. Add citation click handlers
        answerEl.querySelectorAll('.plexus-citation').forEach(citation => {
            citation.addEventListener('click', () => {
                const indices = citation.dataset.indices.split(',');
                const firstIndex = parseInt(indices[0]);
                const sourceCards = sourcesList.querySelectorAll('.plexus-source-card');

                if (sourceCards[firstIndex]) {
                    sourceCards[firstIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });

                    indices.forEach(idx => {
                        const card = sourceCards[parseInt(idx)];
                        if (card) {
                            card.classList.add('highlight');
                            setTimeout(() => card.classList.remove('highlight'), 3000);
                        }
                    });
                }
            });
        });
    }

    /**
     * Display follow-up questions
     */
    function renderFollowup(questions) {
        if (!questions || questions.length === 0) {
            followupEl.classList.add('hidden');
            return;
        }

        followupEl.classList.remove('hidden');
        followupList.innerHTML = questions.map(q => `
            <button class="plexus-followup-item" data-query="${escapeHtml(q)}">
                <i data-lucide="corner-down-right"></i>
                <span>${escapeHtml(q)}</span>
            </button>
        `).join('');

        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Add click handlers for follow-up questions
        followupList.querySelectorAll('.plexus-followup-item').forEach(item => {
            item.addEventListener('click', () => {
                const query = item.dataset.query;
                performSearch(query);
            });
        });
    }

    /**
     * Switch to results view
     */
    function showResultsView(query) {
        searchWrapper.classList.add('hidden');
        resultsArea.classList.remove('hidden');
        currentQueryEl.textContent = query;
    }

    /**
     * Switch back to search view
     */
    function showSearchView() {
        resultsArea.classList.add('hidden');
        searchWrapper.classList.remove('hidden');
        input.value = '';
        input.focus();
    }

    /**
     * Main search function
     */
    async function performSearch(query) {
        if (isSearching) return;

        query = query.trim();
        if (!query) return;

        isSearching = true;
        sendBtn.disabled = true;

        // Switch to results view
        showResultsView(query);
        showThinking();
        showSourcesSkeleton();
        followupEl.classList.add('hidden');

        try {
            // Load settings from storage
            const sourceCount = await Storage.get('ultra-plexus-source-count', 3);
            const extraInfo = await Storage.get('ultra-plexus-extra-info', '');

            // Check Deep Research toggle
            const deepResearchToggle = document.getElementById('plexusDeepResearch');
            const isDeepResearch = deepResearchToggle ? deepResearchToggle.checked : false;

            // Make the API call with text processing for stream
            const response = await fetch('/api/plexus/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    query,
                    settings: {
                        sourceCount,
                        extraInfo,
                        deepResearch: isDeepResearch
                    }
                })
            });

            if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);

            // Initialize Stream Reader
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let fullAnswer = "";
            let buffer = "";

            // Reading Loop
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // Process incomplete JSON lines
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep the last incomplete line in buffer

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const evt = JSON.parse(line);

                        if (evt.type === 'sources') {
                            // Sources Received
                            currentSources = evt.data || [];
                            updateThinkingStep('searching');
                            renderSources(currentSources);
                            // Transition to generating state
                            await new Promise(r => setTimeout(r, 200));
                            updateThinkingStep('generating');
                        }
                        else if (evt.type === 'chunk') {
                            // Content Chunk
                            fullAnswer += evt.content;
                            renderAnswer(fullAnswer); // Re-render with new content
                        }
                        else if (evt.type === 'done') {
                            // Finished
                            // Ensure thinking is hidden and answer is visible
                            hideThinking();

                            // Last render to ensure everything is up to date and clean
                            const cleanAnswer = fullAnswer.replace(/(?:\*\*|#)?\s*QUESTIONS_SUIVI\s*(?:\*\*|#)?\s*:?\s*([\s\S]+)$/i, '').trim();
                            if (cleanAnswer) {
                                renderAnswer(cleanAnswer);
                            }

                            renderFollowup(evt.followUpQuestions);
                        }
                        else if (evt.type === 'error') {
                            throw new Error(evt.message);
                        }

                    } catch (e) {
                        console.warn('Error parsing stream line:', e);
                    }
                }
            }

            isSearching = false;
            sendBtn.disabled = false;

        } catch (error) {
            console.error('[Plexus] Search error:', error);
            hideThinking();
            answerEl.innerHTML = `
                <div style="color: var(--error); padding: 20px; text-align: center;">
                    <p><strong>Erreur lors de la recherche</strong></p>
                    <p style="font-size: 13px; margin-top: 8px;">${escapeHtml(error.message)}</p>
                </div>
            `;
        } finally {
            isSearching = false;
            sendBtn.disabled = false;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event Listeners
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        performSearch(input.value);
    });

    // Enter to submit (Shift+Enter for newline)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            performSearch(input.value);
        }
    });

    // Auto-resize textarea
    input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Back button
    backBtn.addEventListener('click', showSearchView);

    // Suggestion buttons
    suggestions.querySelectorAll('.plexus-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.dataset.query;
            performSearch(query);
        });
    });
};

// Export as a class-like module for consistency with other modules
export class PlexusModule {
    constructor() {
        initPlexus();
    }
}

