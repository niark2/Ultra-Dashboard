const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');
require('dotenv').config();

// Nous utilisons node-fetch pour appeler l'API OpenRouter
// Si node-fetch v3+ est utilisé, il faut un import dynamique car c'est un module ESM
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const db = require('../lib/db');

const chatController = {
    /**
     * Envoie un message à l'IA via OpenRouter
     */
    sendMessage: async (req, res) => {
        try {
            const { message, history, context, systemPrompt } = req.body;
            const userId = req.session.user.id;
            const provider = db.getConfigValue('AI_PROVIDER', userId, 'openrouter');
            const plexusModel = db.getConfigValue('OPENROUTER_MODEL', userId, 'google/gemini-2.0-pro-exp-02-05:free');
            const ollamaModel = db.getConfigValue('OLLAMA_MODEL', userId, 'llama3');
            const ollamaUrl = db.getConfigValue('OLLAMA_URL', userId, 'http://localhost:11434');

            const defaultSystemPrompt = "Tu es Ultra AI, un assistant intelligent intégré au dashboard Ultra.";
            const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

            const messages = [
                {
                    role: "system",
                    content: finalSystemPrompt +
                        (context ? `\n\nVoici un contexte extrait d'un document PDF pour t'aider à répondre : \n${context}` : "")
                },
                ...history,
                { role: "user", content: message }
            ];

            let reply = "";
            let finalHistory = [];

            if (provider === 'ollama') {
                console.log(`[Chat] Calling Ollama (${ollamaModel}) at ${ollamaUrl}`);
                const response = await fetch(`${ollamaUrl}/api/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: ollamaModel,
                        messages: messages,
                        stream: false
                    })
                });

                if (!response.ok) {
                    const err = await response.text();
                    throw new Error(`Ollama Error: ${response.status} - ${err}`);
                }

                const data = await response.json();
                reply = data.message.content;
                finalHistory = [...history, { role: "user", content: message }, data.message];

            } else {
                // OpenRouter (Default)
                const apiKey = db.getConfigValue('OPENROUTER_API_KEY', userId);
                if (!apiKey || apiKey.includes('YOUR_OPENROUTER_KEY_HERE')) {
                    return res.status(401).json({ error: "Clé API OpenRouter manquante ou non valide (placeholder détecté). Veuillez la configurer dans les réglages." });
                }

                console.log(`[Chat] Calling OpenRouter (${plexusModel})`);
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "Ultra Dashboard"
                    },
                    body: JSON.stringify({
                        model: plexusModel,
                        messages: messages
                    })
                });

                const data = await response.json();

                if (data.error) {
                    console.error("OpenRouter Error:", data.error);
                    return res.status(500).json({ error: data.error.message || "Erreur de l'API OpenRouter" });
                }

                reply = data.choices[0].message.content;
                finalHistory = [...history, { role: "user", content: message }, data.choices[0].message];
            }

            res.json({
                reply,
                history: finalHistory
            });

        } catch (error) {
            console.error("Chat Error:", error);
            res.status(500).json({ error: "Erreur lors de la communication avec l'IA" });
        }
    },

    /**
     * Upload un PDF et extrait son texte pour le contexte
     */
    uploadPDF: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "Aucun fichier uploadé" });
            }

            const dataBuffer = fs.readFileSync(req.file.path);
            const data = await pdf(dataBuffer);

            // On limite le texte pour ne pas exploser le token limit (ex: 10k caractères pour le contexte gratuit)
            const extractedText = data.text.substring(0, 15000);

            res.json({
                filename: req.file.originalname,
                text: extractedText,
                pages: data.numpages
            });

        } catch (error) {
            console.error("PDF Upload Error:", error);
            res.status(500).json({ error: "Erreur lors de l'extraction du PDF" });
        }
    },

    /**
     * Retourne la configuration (modèle utilisé)
     */
    getConfig: (req, res) => {
        const userId = req.session.user.id;
        res.json({
            model: db.getConfigValue('OPENROUTER_MODEL', userId, 'google/gemini-2.0-pro-exp-02-05:free')
        });
    }
};

module.exports = chatController;
