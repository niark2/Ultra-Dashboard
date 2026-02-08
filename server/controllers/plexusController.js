/**
 * Plexus Controller - AI Search with SearXNG integration
 * Clone de Perplexity utilisant SearXNG pour la recherche web
 */

require('dotenv').config();

// Dynamic import for node-fetch (ESM module)
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const db = require('../lib/db');

// Configuration SearXNG
const SEARXNG_URL_ENV = process.env.SEARXNG_URL || 'http://localhost:8080';
const SEARXNG_TIMEOUT = 30000; // 30 seconds

/**
 * Search the web using SearXNG
 * @param {string} query - Search query
 * @param {number} limit - Max results to return
 * @returns {Promise<Array>} Search results
 */
async function searchWeb(query, limit = 8, userId = null) {
    console.log(`[Plexus-Server] searchWeb() appelé pour: "${query}"`);
    try {
        const baseUrl = userId ? db.getConfigValue('SEARXNG_URL', userId, SEARXNG_URL_ENV) : SEARXNG_URL_ENV;
        const searchUrl = new URL('/search', baseUrl);
        searchUrl.searchParams.set('q', query);
        searchUrl.searchParams.set('format', 'json');
        searchUrl.searchParams.set('categories', 'general');
        searchUrl.searchParams.set('engines', 'google,bing,duckduckgo,brave');
        searchUrl.searchParams.set('safesearch', '0');

        console.log(`[Plexus-Server] URL SearXNG: ${searchUrl.toString()}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SEARXNG_TIMEOUT);

        const response = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`SearXNG responded with status ${response.status}`);
        }

        const data = await response.json();
        console.log(`[Plexus] SearXNG a renvoyé ${data.results ? data.results.length : 0} résultats bruts`);

        // Transform and limit results
        const results = (data.results || [])
            .slice(0, limit)
            .map((result, index) => ({
                index: index + 1,
                title: result.title || 'Sans titre',
                url: result.url,
                content: result.content || '',
                engine: result.engine || 'web'
            }));

        console.log(`[Plexus] ${results.length} sources web filtrées et prêtes`);
        return results;

    } catch (error) {
        console.error('[Plexus] SearXNG search error:', error.message);
        return [];
    }
}

/**
 * Build context from search results for the AI
 * @param {Array} sources - Search results
 * @returns {string} Formatted context
 */
function buildSearchContext(sources) {
    if (sources.length === 0) {
        return "Aucune source web trouvée pour cette requête.";
    }

    let context = "Voici les informations trouvées sur le web :\n\n";

    sources.forEach((source, idx) => {
        context += `[Source ${idx + 1}] ${source.title}\n`;
        context += `URL: ${source.url}\n`;
        if (source.content) {
            context += `Contenu: ${source.content}\n`;
        }
        context += '\n';
    });

    return context;
}

/**
 * Generate AI response using OpenRouter
 * @param {string} query - User query
 * @param {string} context - Search context
 * @returns {Promise<Object>} AI response with answer and follow-up questions
 */
/**
 * Generate AI response using OpenRouter
 * @param {string} query - User query
 * @param {string} context - Search context
 * @param {string} extraInfo - Additional user instructions
 * @returns {Promise<Object>} AI response with answer and follow-up questions
 */
async function generateAIResponse(query, context, userId, extraInfo = '', isDeepResearch = false, onProgress = null) {
    const provider = db.getConfigValue('AI_PROVIDER', userId, 'openrouter');
    let apiKey = '';
    let model = '';
    let apiUrl = '';

    if (provider === 'ollama') {
        model = db.getConfigValue('OLLAMA_MODEL', userId, 'llama3');
        apiUrl = db.getConfigValue('OLLAMA_URL', userId, 'http://localhost:11434') + '/api/chat';
        console.log(`[Plexus] Appel Ollama avec modèle: ${model} à ${apiUrl}`);
    } else {
        apiKey = db.getConfigValue('OPENROUTER_API_KEY', userId);
        model = db.getConfigValue('OPENROUTER_MODEL', userId, 'google/gemini-2.0-flash-lite-preview-02-05:free');
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        console.log(`[Plexus] Appel OpenRouter avec modèle: ${model}`);

        if (!apiKey || apiKey.includes('YOUR_OPENROUTER_KEY_HERE')) {
            console.error("[Plexus] Erreur: Clé API OpenRouter non configurée ou placeholder détecté");
            throw new Error("Clé API OpenRouter manquante ou non valide. Veuillez la configurer dans les réglages.");
        }
    }

    let systemPrompt;
    let fullResponse = ""; // Ensure this is defined early for all paths

    if (isDeepResearch) {
        systemPrompt = `Tu es Plexus Deep Research, un agent d'intelligence artificielle d'élite spécialisé dans l'analyse approfondie et la synthèse exhaustive.

MISSION:
Produire un rapport de recherche approfondi, détaillé et parfaitement structuré sur le sujet demandé, en te basant exclusivement sur les sources fournies.

APPROCHE ANALYTIQUE:
1. Analyse croisée : Ne te contente pas de résumer. Compare les sources, identifie les consensus et les divergences.
2. Profondeur : Explore les nuances, les détails techniques et les implications.
3. Rigueur : Cite tes sources avec une précision absolue.

STRUCTURE OBLIGATOIRE DU RAPPORT:
1. **Synthèse Exécutive** : Résumé dense de 3-4 phrases en tête.
2. **Développement Détaillé** : Utilise des titres de section clairs (## Titre). Organise logiquement.
3. **Analyse Comparative/Critique** (si pertinent) : Mises en perspective.
4. **Conclusion et Perspectives**.

INSTRUCTIONS DE RÉDACTION:
- Longueur : Vise une réponse longue et complète (minimum 800 mots si le sujet le permet).
- Ton : Académique, professionnel, objectif.
- Formatage : Markdown riche. Utilise du gras pour les concepts clés.
- Titres : Utilise la syntaxe Markdown (##) mais N'ÉCRIS PAS "H2:" ou "H3:" dans le texte.
- Citations : Format [n] OBLIGATOIRE à la fin de chaque affirmation factuelle.

${extraInfo ? `INSTRUCTIONS SPÉCIFIQUES: ${extraInfo}\n` : ''}

SORTIE FINALE:
- Le contenu Markdown du rapport.
- Termine par "QUESTIONS_SUIVI: q1 | q2 | q3 | q4 | q5" (propose 5 questions pour aller plus loin).

CONTEXTE DES SOURCES:
${context}`;
    } else {
        systemPrompt = `Tu es Plexus, un moteur de recherche IA haut de gamme. Ta mission est de synthétiser l'actualité ou les informations de manière élégante et structurée.

${extraInfo ? `INSTRUCTIONS SUPPLÉMENTAIRES DE L'UTILISATEUR (À RESPECTER PRIORITAIREMENT):\n${extraInfo}\n` : ''}

STYLE DE RÉDACTION (IMPORTANT):
- Structure : Commence par un paragraphe d'introduction global.
- Titres : Utilise des titres H2 (ex: ## Titre) pour séparer les grandes catégories d'informations.
- Format : Fais des paragraphes denses et informatifs, pas de listes à puces trop longues.
- Ton : Journalistique, expert, mais accessible.

RÈGLES DE CITATION:
- Groupe tes citations à la fin des phrases ou des paragraphes importants, ex: "L'IA progresse rapidement dans le domaine de la santé [1][2][3]."
- Utilise uniquement le format [n].

SORTIE:
- Markdown riche uniquement.
- Termine par "QUESTIONS_SUIVI: q1 | q2 | q3" sans rien d'autre après.

CONTEXTE DES SOURCES:
${context}`;
    }

    const controller = new AbortController();
    const timeoutDuration = isDeepResearch ? 120000 : 30000;
    const timeout = setTimeout(() => controller.abort(), timeoutDuration);

    // Prepare request options (conditionally add stream: true)
    const requestHeaders = {
        "Content-Type": "application/json"
    };

    if (provider !== 'ollama') {
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
        requestHeaders["HTTP-Referer"] = "http://localhost:3000";
        requestHeaders["X-Title"] = "Ultra Dashboard - Plexus";
    }

    const requestOptions = {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: query }
            ],
            temperature: 0.7,
            max_tokens: 4000,
            stream: !!onProgress // Enable streaming if callback is provided
        }),
        signal: controller.signal
    };

    const response = await fetch(apiUrl, requestOptions);

    clearTimeout(timeout);

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Plexus] Erreur ${provider}:`, errorText);
        throw new Error(`Erreur API ${provider}: ${response.status}`);
    }

    if (onProgress && response.body) {
        // Handle Streaming Response with robust buffering
        try {
            let buffer = "";
            const decoder = new TextDecoder();

            for await (const chunk of response.body) {
                const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
                buffer += text;

                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep last incomplete line

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

                    if (trimmedLine.startsWith('data: ')) {
                        const dataStr = trimmedLine.slice(6);
                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices?.[0]?.delta?.content || '';
                            if (content) {
                                fullResponse += content;
                                onProgress(content);
                            }
                        } catch (e) { }
                    } else if (trimmedLine.startsWith('{')) {
                        // Likely Ollama native JSON stream
                        try {
                            const data = JSON.parse(trimmedLine);
                            const content = data.message?.content || '';
                            if (content) {
                                fullResponse += content;
                                onProgress(content);
                            }
                        } catch (e) { }
                    }
                }
            }
        } catch (streamError) {
            console.error('Stream processing error:', streamError);
        }
    } else {
        // Handle Standard JSON Response (Fallback)
        const data = await response.json();
        console.log(`[Plexus] Réponse reçue de ${provider} (modèle: ${model})`);

        if (data.error) {
            console.error(`[Plexus] Erreur ${provider} JSON:`, JSON.stringify(data.error));
            throw new Error(data.error.message || `Erreur API ${provider}`);
        }

        if (provider === 'ollama') {
            fullResponse = data.message?.content || "";
        } else {
            if (!data.choices || !data.choices[0]) {
                console.error(`[Plexus] Réponse ${provider} invalide (pas de choices):`, JSON.stringify(data));
                throw new Error(`Réponse vide de ${provider}`);
            }
            fullResponse = data.choices[0].message.content;
        }
    }

    // Continue common processing...

    // Extract follow-up questions if present
    let answer = fullResponse;
    let followUpQuestions = [];

    // More robust regex to handle bolding, newlines, and varying formats
    // Matches: QUESTIONS_SUIVI: (optionally bolded) followed by anything until end of string
    const followUpMatch = fullResponse.match(/(?:\*\*|#)?\s*QUESTIONS_SUIVI\s*(?:\*\*|#)?\s*:?\s*([\s\S]+)$/i);

    if (followUpMatch) {
        // Remove the questions part from the main answer
        answer = fullResponse.substring(0, followUpMatch.index).trim();

        let questionsText = followUpMatch[1].trim();

        // Handle different separators (pipe | or newline - or numbered list)
        if (questionsText.includes('|')) {
            followUpQuestions = questionsText
                .split('|')
                .map(q => {
                    // Remove "q1", "q2", etc at start or end
                    let cleanQ = q.trim()
                        .replace(/^q\d+\s*[:\.]?\s*/i, '') // Remove "q1: " or "q1 " at start
                        .replace(/\s*q\d+$/i, ''); // Remove " q1" at end
                    return cleanQ;
                })
                .filter(q => q.length > 3); // Filter out very short garbage
        } else {
            // Fallback for newline separated lists or bullet points
            followUpQuestions = questionsText
                .split('\n')
                .map(q => {
                    // Remove list markers and "q1" prefixes
                    let cleanQ = q.replace(/^[-*•\d\.]+\s*/, '') // Remove standard bullets/numbers
                        .replace(/^q\d+\s*[:\.]?\s*/i, '') // Remove "q1 " prefix generic
                        .trim();
                    return cleanQ;
                })
                .filter(q => q.length > 3);
        }
    }

    return {
        answer,
        followUpQuestions
    };
}

const plexusController = {
    /**
     * Health check for SearXNG connection
     */
    checkHealth: async (req, res) => {
        try {
            const userId = req.session.user ? req.session.user.id : null;
            const baseUrl = userId ? db.getConfigValue('SEARXNG_URL', userId, SEARXNG_URL_ENV) : SEARXNG_URL_ENV;
            const response = await fetch(`${baseUrl}/healthz`, {
                method: 'GET',
                timeout: 5000
            });

            res.json({
                searxng: response.ok ? 'connected' : 'error',
                url: baseUrl
            });
        } catch (error) {
            res.json({
                searxng: 'disconnected',
                url: baseUrl,
                error: error.message
            });
        }
    },

    /**
     * Main search endpoint - search web and generate AI answer
     */
    search: async (req, res) => {
        try {
            const { query, settings } = req.body;
            const isDeepResearch = settings?.deepResearch || false;
            const userId = req.session.user ? req.session.user.id : 1;

            // FORCE 25 sources if deep mode is on
            const sourceCount = isDeepResearch ? 25 : (settings?.sourceCount || 8);
            const extraInfo = settings?.extraInfo || '';

            if (!query || query.trim().length === 0) {
                return res.status(400).json({ error: "La requête est vide" });
            }

            // Set headers for streaming text
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Transfer-Encoding', 'chunked');

            // Step 1: Search the web with SearXNG
            console.log(`[Plexus] Début de recherche ${isDeepResearch ? '(DEEP MODE)' : ''} pour: "${query}" (Sources: ${sourceCount})`);
            const sources = await searchWeb(query, sourceCount, userId);

            // Send sources immediately to client
            res.write(JSON.stringify({ type: 'sources', data: sources }) + '\n');

            // Step 2: Build context from search results
            const context = buildSearchContext(sources);

            // Step 3: Generate AI response with Streaming
            console.log(`[Plexus] Appel à OpenRouter pour synthèse (Streaming)...`);

            const { answer, followUpQuestions } = await generateAIResponse(
                query,
                context,
                userId,
                extraInfo,
                isDeepResearch,
                (chunk) => {
                    // Send chunk to client
                    res.write(JSON.stringify({ type: 'chunk', content: chunk }) + '\n');
                }
            );

            console.log(`[Plexus] Synthèse IA terminée avec succès`);

            // Databank Saving
            try {
                db.addDatabankItem('text', answer, {
                    tool: 'plexus',
                    mode: isDeepResearch ? 'deep-research' : 'standard',
                    query: query,
                    sourceCount: sources.length,
                    sources: sources.map(s => ({ title: s.title, url: s.url })),
                    followUpQuestions: followUpQuestions,
                    timestamp: Date.now()
                }, userId);
            } catch (dbError) {
                console.error('⚠️ Erreur ajout Databank:', dbError.message);
            }

            // End the stream with the final structured data (implicit via stream end, but good to check)
            // We can send a 'done' event just in case client needs it, or just end
            // Sending 'done' with clean questions is helpful for the client to refresh UI buttons cleanly
            res.write(JSON.stringify({
                type: 'done',
                followUpQuestions: followUpQuestions
            }) + '\n');

            res.end();

        } catch (error) {
            console.error('[Plexus] Search error:', error);
            // If headers already sent, write error event
            if (res.headersSent) {
                res.write(JSON.stringify({ type: 'error', message: "Erreur lors de la recherche" }) + '\n');
                res.end();
            } else {
                res.status(500).json({
                    error: "Erreur lors de la recherche",
                    details: error.message
                });
            }
        }
    },

    /**
     * Quick search - only returns web results without AI (for streaming)
     */
    quickSearch: async (req, res) => {
        try {
            const { query } = req.body;

            if (!query || query.trim().length === 0) {
                return res.status(400).json({ error: "La requête est vide" });
            }

            const sources = await searchWeb(query, 10);

            res.json({ sources });

        } catch (error) {
            console.error('[Plexus] Quick search error:', error);
            res.status(500).json({
                error: "Erreur lors de la recherche rapide",
                details: error.message
            });
        }
    }
};

module.exports = plexusController;
