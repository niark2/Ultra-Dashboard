const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');
require('dotenv').config();

// Nous utilisons node-fetch pour appeler l'API OpenRouter
// Si node-fetch v3+ est utilisé, il faut un import dynamique car c'est un module ESM
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const chatController = {
    /**
     * Envoie un message à l'IA via OpenRouter
     */
    sendMessage: async (req, res) => {
        try {
            const { message, history, context } = req.body;
            const apiKey = process.env.OPENROUTER_API_KEY;
            const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-pro-exp-02-05:free';

            if (!apiKey) {
                return res.status(500).json({ error: "Clé API OpenRouter manquante dans le fichier .env" });
            }

            const messages = [
                {
                    role: "system",
                    content: "Tu es Ultra AI, un assistant intelligent intégré au dashboard Ultra. " +
                        (context ? `Voici un contexte extrait d'un document PDF pour t'aider à répondre : \n\n${context}` : "")
                },
                ...history,
                { role: "user", content: message }
            ];

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "Ultra Dashboard"
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error("OpenRouter Error:", data.error);
                return res.status(500).json({ error: data.error.message || "Erreur de l'API OpenRouter" });
            }

            res.json({
                reply: data.choices[0].message.content,
                history: [...history, { role: "user", content: message }, data.choices[0].message]
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
        res.json({
            model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-pro-exp-02-05:free'
        });
    }
};

module.exports = chatController;
