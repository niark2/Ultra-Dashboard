# 🚀 Guide d'Installation - Ultra Dashboard

Ce guide vous explique comment installer et configurer **Ultra Dashboard** sur votre machine ou serveur.

---

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé les éléments suivants :

### Pour l'installation locale :
- **Node.js** (v18 ou supérieur)
- **Python** (v3.10 ou supérieur)
- **FFmpeg** (indispensable pour la conversion média)
- **npm** (installé avec Node.js)

### Pour l'installation Docker (Recommandé) :
- **Docker**
- **Docker Compose**

---

## 🛠️ Méthode 1 : Installation Standard (Locale)

Cette méthode est idéale pour le développement ou si vous souhaitez gérer vous-même les dépendances.

### 1. Cloner le projet
```bash
git clone https://github.com/niark2/Niark-Dashboard.git
cd Niark-Dashboard
```

### 2. Installer les dépendances Node.js
```bash
npm install
```

### 3. Installer les dépendances Python
Le dashboard utilise des microservices Python pour l'IA (Rembg, Whisper, etc.).
```bash
pip install -r server/python/requirements.txt
```

### 4. Configurer les variables d'environnement
Copiez le fichier d'exemple (si disponible) ou créez un fichier `.env` à la racine :
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=votre_secret_ici
OPENROUTER_API_KEY=votre_cle_api
```

### 5. Lancer l'application
```bash
# Mode développement (avec auto-reload)
npm run dev

# Mode production
npm start
```
L'application sera disponible sur `http://localhost:3000`.

---

## 🐳 Méthode 2 : Installation via Docker (Recommandé)

C'est la méthode la plus simple car elle encapsule toutes les dépendances (Node, Python, FFmpeg, Nginx) dans des containers isolés.

### 1. Lancer les containers
À la racine du projet, exécutez :
```bash
docker-compose up -d --build
```

### 2. Accès
- Le dashboard est accessible directement sur le port **80** : `http://localhost`
- Nginx gère le proxy inverse vers le service Node.js.

---

## ⚙️ Configuration du .env

Le fichier `.env` contient les réglages essentiels :

| Variable | Description |
| :--- | :--- |
| `PORT` | Port d'écoute du serveur Node.js (défaut: 3000) |
| `OPENROUTER_API_KEY` | Clé pour les fonctionnalités d'IA Chat |
| `OPENROUTER_MODEL` | Modèle LLM à utiliser par défaut |
| `SESSION_SECRET` | Clé pour sécuriser les sessions utilisateurs |
| `SEARXNG_URL` | URL de votre instance SearXNG pour la recherche |

---

## 🎨 Configuration via l'Interface (Recommandé)

Une fois l'application lancée, vous pouvez configurer vos clés API et URLs de services directement dans l'interface sans toucher au fichier `.env` :

1. Accédez aux **Réglages** (icône roue dentée).
2. Allez dans l'onglet **Variables d'env**.
3. Remplissez votre clé **OpenRouter** et les URLs de vos microservices.
4. Cliquez sur **Enregistrer**.

Ces réglages sont stockés en base de données SQLite (`data/database.db`) et sont propres à chaque utilisateur. Ils surchargent les valeurs par défaut du fichier `.env`.

---

## 🔍 Dépannage (FAQ)

### FFmpeg n'est pas reconnu
Assurez-vous que FFmpeg est bien dans votre PATH système. Sur Docker, il est déjà inclus dans l'image.

### Erreurs Python (pip)
Si vous utilisez une version récente de Linux (comme Debian 12 ou Ubuntu 24.04), vous devrez peut-être ajouter `--break-system-packages` à votre commande pip ou utiliser un environnement virtuel (`venv`).

### Taille des fichiers (Uploads)
Si vous passez par Nginx (Docker), la limite est fixée à **500M** dans `nginx/default.conf`. Vous pouvez modifier cette valeur si nécessaire.

---

*Développé avec ❤️ par [Niark2](https://github.com/niark2)*
