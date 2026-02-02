# Niark Dashboard 🚀

A powerful, all-in-one local dashboard for media management, creation, and system utilities. Built with Node.js, Express, and modern web technologies.

## ✨ Features

### 🎬 Media Studio
- **Multi-track Timeline**: Advanced video and audio editing capabilities.
- **YouTube Integration**: Compact downloader and upload interface.
- **Media Converter**: FFmpeg-powered format conversion.

### 🛠️ Toolbox & Utilities
- **Metadata Editor**: Edit file tags and information using FFmetadata.
- **LocalDrop**: Seamless P2P file sharing on your local network (WebRTC).
- **Webcam Mirror**: Quick camera check and capture tool.
- **Widgets**: Customizable home screen with persistent widgets (Weather, Time, etc.).

### ⬇️ Download Manager
- **Torrent Client**: Integrated qBittorrent management.
- **YouTube Downloader**: High-quality video/audio extraction.

## 🚀 File Structure
- `server/`: Express backend logic and API routes.
- `public/`: Static assets, CSS, and client-side JavaScript.
- `views/`: EJS templates for dynamic rendering.
- `uploads/`: Temporary storage for processed files.

## 🛠️ Tech Stack
- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla JS, EJS, CSS3 (Modern variables & layout)
- **Processing**: FFmpeg, Sharp, Pandoc
- **Data**: LocalStorage & JSON persistence

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/niark2/Niark-Dashboard.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

---
*Created by [Niark2](https://github.com/niark2)*
