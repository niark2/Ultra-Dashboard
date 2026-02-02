# Ultra Dashboard 🚀

A comprehensive, modular dashboard for media management, AI processing, and local networking. Built with Node.js and Python microservices.

## ✨ Features

### 🤖 AI Suite (Python Integration)
- **RemoveBG**: Instant background removal for images using AI.
- **Whisper STT**: High-accuracy local speech-to-text transcription.
- **AI Upscaler**: Enhance image resolution using deep learning.
- **AI Chat**: Integrated LLM chat interface.

### 🎬 Media Tools
- **YouTube Hub**: Compact interface for downloading/converting videos & audio (yt-dlp).
- **Format Converter**: Advanced FFmpeg frontend for all your conversion needs.
- **Metadata Editor**: Edit ID3 tags and metadata for audio/video files.

### ⚡ Network & Utils
- **LocalDrop**: Seamless p2p file sharing (WebRTC) - AirDrop for your local network.
- **Torrent Client**: Integrated qBittorrent management interface.
- **Home Widgets**: Personal dashboard with weather, time, and system stats.
- **Toolbox**: Collection of useful utilities (Webcam Mirror, etc.).

## 🛠️ Tech Stack
- **Frontend**: EJS, CSS Variables, Lucide Icons
- **Backend**: Node.js (Express), Socket.io
- **AI Services**: Python (Rembg, OpenAI Whisper)
- **Core Processing**: FFmpeg, yt-dlp, Sharp

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/niark2/Niark-Dashboard.git
   cd Niark-Dashboard
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   Ensure you have Python 3.x installed, then install required packages for AI features:
   ```bash
   pip install rembg openai-whisper torch
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```
   Access the dashboard at `http://localhost:3000`

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

---
*Created by [Niark2](https://github.com/niark2)*
