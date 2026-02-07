# 🚀 Ultra Dashboard

Ultra Dashboard est une plateforme modulaire et élégante conçue pour centraliser vos outils numériques, la gestion de vos médias et des services d'Intelligence Artificielle de pointe, le tout dans une interface haut de gamme et réactive.

![Dashboard Preview](https://via.placeholder.com/1200x600/18181b/ffffff?text=Ultra+Dashboard+Premium+Experience)

---

## ✨ Fonctionnalités Clés

### 🤖 Suite AI Intégrée
- **Plexus (Deep Research)** : Un moteur de recherche IA avancé (clone Perplexity) qui synthétise le web en temps réel avec des sources citées.
- **AI Chat** : Assistant intelligent avec support de lecture de documents PDF pour une analyse contextuelle.
- **Remove BG** : Détourage automatique d'images via des modèles Python locaux (U2NET, ISNET, etc.).
- **AI Upscaler** : Agrandissement et amélioration de la résolution d'image par deep learning.
- **Speech-to-Text (STT)** : Transcription audio précise utilisant les modèles Whisper de OpenAI.

### 🎬 Outils Média & Téléchargement
- **YouTube Hub** : Téléchargement et conversion de vidéos/audio YouTube via `yt-dlp`.
- **Social Downloader** : Récupération de médias depuis Instagram, TikTok et plus encore.
- **Convertisseur Universel** : Interface FFmpeg complète pour transformer tous vos fichiers audio et vidéo.
- **Metadata Editor** : Édition des tags ID3 et métadonnées pour organiser votre bibliothèque.

### ⚡ Réseau & Utilitaires
- **LocalDrop** : Partage de fichiers P2P ultra-rapide via WebRTC (le "AirDrop" de votre réseau local).
- **Torrent Manager** : Gestionnaire de téléchargements intégré.
- **Toolbox** : Miroir webcam, utilitaires système et widgets (Météo, Stats CPU/RAM).
- **Databank** : Votre coffre-fort centralisé où tous les fichiers générés et téléchargés sont automatiquement indexés et triés.

---

## 🛠️ Stack Technique
- **Backend** : Node.js (Express), Socket.io, Better-SQLite3
- **Frontend** : EJS, Vanilla JS, CSS Variables (Design System custom)
- **AI Backend** : Microservices Python (Flask), PyTorch, ONNX
- **Processing** : FFmpeg, yt-dlp, Sharp

---

## 📦 Installation Rapide

### 🐳 Via Docker (Recommandé)
Le moyen le plus simple de tout lancer (Node, Python, FFmpeg, Nginx) en une commande :
```bash
docker-compose up -d --build
```
L'application sera disponible sur `http://localhost`.

### 💻 Installation Locale
1. **Node.js** : `npm install`
2. **Python** : `pip install -r server/python/requirements.txt`
3. **Lancement** : `npm run dev`
Accès sur `http://localhost:3000`.

> [!IMPORTANT]
> Pour plus de détails sur les prérequis et la configuration avancée, consultez le **[Guide d'Installation Complet (INSTALL.md)](./INSTALL.md)**.

---

## ⚙️ Configuration
Pas besoin de manipuler des fichiers de configuration complexes. Une fois lancé, allez dans l'onglet **Réglages > Variables d'env** pour configurer :
- Votre clé **OpenRouter** pour l'IA.
- Les URLs de vos microservices personnalisés.
- Vos préférences d'interface.

---

*Créé par [Niark2](https://github.com/niark2) - Conçu pour la vitesse, le style et la polyvalence.*
