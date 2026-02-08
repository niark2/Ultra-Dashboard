# 🚀 Ultra Dashboard

Ultra Dashboard is a modular and elegant platform designed to centralize your digital tools, media management, and cutting-edge AI services, all in a premium and responsive interface.

![Dashboard Preview](https://i.imgur.com/zUNtJVL.png)

![Dashboard Preview](https://i.imgur.com/GowGm9r.png)


---

## ✨ Key Features

### 🤖 Integrated AI Suite
- **Plexus (Deep Research)**: An advanced AI search engine (Perplexity clone) that synthesizes the web in real-time with cited sources.
- **AI Chat**: Intelligent multi-model assistant compatible with **OpenRouter** and **Ollama** (local AI).
- **Remove BG**: Automatic background removal via local Python models (U2NET, ISNET, etc.).
- **AI Upscaler**: Image upscaling and enhancement using the **PAN** model (CPU optimized) by default.
- **Speech-to-Text (STT)**: Accurate audio transcription via Whisper (`base` model pre-loaded).

### 🎬 Media Tools & Downloading
- **Global Downloader**: Unified downloading and conversion of video/audio from **YouTube**, **Instagram**, **TikTok**, and more via `yt-dlp`.
- **Universal Converter**: Complete FFmpeg interface to transform all your audio and video files.

### ⚡ Network & Utilities
- **Notes & Ideas**: Quick note-taking with Markdown support and AI assistants for writing.
- **LocalDrop**: Ultra-fast P2P file sharing via WebRTC (the "AirDrop" of your local network).
- **Torrent Manager**: Integrated download manager.
- **Toolbox**: Webcam mirror, system utilities, and widgets (Weather, CPU/RAM Stats).
- **Databank**: Your centralized vault where all generated and downloaded files are automatically indexed and sorted.

---

## 🛠️ Tech Stack
- **Backend**: Node.js (Express), Socket.io, Better-SQLite3
- **Frontend**: EJS, Vanilla JS, CSS Variables (Custom Design System)
- **AI Backend**: Python Microservices (Flask), PyTorch, ONNX
- **Processing**: FFmpeg, yt-dlp, Sharp

---

## 📦 Quick Installation

### 🐳 Via Docker (Totally Plug & Play)
The recommended way to launch everything (Dashboard, AI, SearXNG, FFmpeg, Nginx) without installing anything on your machine:

```bash
# 1. Clone the project
git clone https://github.com/niark2/Niark-Dashboard.git
cd Niark-Dashboard

# 2. Launch using
docker-compose up -d --build
```

### 2. Access & Advantages
- **Dashboard**: `http://localhost` (via Nginx).
- **SearXNG**: `http://localhost/searxng` (integrated and pre-configured).
- **Persistence**: Your settings, AI models, and files are saved in the `data/`, `models/`, and `uploads/` folders on your machine.
- **Service Health**: The Dashboard waits for AI services to be fully operational (models loaded) before opening, thanks to Docker *healthchecks*.
- **No .env file to create manually**: everything is pre-configured for instant startup.
- **Local AI**: Models are downloaded automatically on first launch (PAN, Whisper, Rembg).
- **Search Engine**: A dedicated **SearXNG** instance is automatically deployed and connected.

### 💻 Local Installation
1. **Node.js**: `npm install`
2. **Python**: `pip install -r server/python/requirements.txt`
3. **Launch**: `npm run dev`
Access at `http://localhost:3000`.

> [!IMPORTANT]
> For more details on prerequisites and advanced configuration, consult the **[Complete Installation Guide (INSTALL.md)](./INSTALL.md)**.

---

## ⚙️ Configuration
No need to manipulate complex configuration files. Once launched, go to the **Settings > Env Variables** tab to configure:
- Your **OpenRouter** key for AI (optional if using Ollama).
- The URL of your local **Ollama** instance (e.g., `http://localhost:11434`).
- The URLs of your custom microservices.
- Your interface preferences.

---

*Created by [Niark2](https://github.com/niark2) - Designed for speed, style, and versatility.*
