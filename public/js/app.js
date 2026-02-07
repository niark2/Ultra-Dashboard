import { TabManager } from './core/tabs.js';
import { ConverterModule } from './modules/converter.js';
import { YoutubeModule } from './modules/youtube.js';
import { SocialModule } from './modules/social.js';
import { ImageAIModule } from './modules/image-ai.js';
import { STTModule } from './modules/stt.js';
import { SettingsModule } from './modules/settings.js';
import { initChat } from './modules/chat.js';
import { initToolbox } from './modules/toolbox.js';
import { MetadataModule } from './modules/metadata.js';
import { TorrentModule } from './modules/torrent.js';
import { LocalDropModule } from './modules/localdrop.js';
import { HomeModule } from './modules/home.js';
import { DatabankModule } from './modules/databank.js';
import { NotificationModule } from './modules/notifications.js';
import { initPlexus } from './modules/plexus.js';
import { Auth } from './utils/auth.js';


document.addEventListener('DOMContentLoaded', async () => {
    // Initialise Auth
    await Auth.init();

    // Initialise Core Systems
    new TabManager();

    // Initialise Modules
    new NotificationModule();
    new ConverterModule();
    new YoutubeModule();
    new SocialModule();
    new ImageAIModule();
    new STTModule();
    new SettingsModule();
    new MetadataModule();
    new TorrentModule();
    new LocalDropModule();
    new DatabankModule();
    new HomeModule();

    initChat();
    initToolbox();
    initPlexus();

    // Initialize Sidebar Sections Toggles
    const sectionHeaders = document.querySelectorAll('.nav-section-header');
    sectionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const section = header.parentElement;
            section.classList.toggle('collapsed');
        });
    });

    // Auto-expand section containing active item
    const activeItem = document.querySelector('.nav-item.active');
    if (activeItem) {
        const parentSection = activeItem.closest('.nav-section');
        if (parentSection) {
            parentSection.classList.remove('collapsed');
        }
    }

    // Render Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Logout logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => Auth.logout());
    }

    console.log('🚀 Ultra Dashboard Loaded (Modular)');
});
