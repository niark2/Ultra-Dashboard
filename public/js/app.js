import { TabManager } from './core/tabs.js';
import { ConverterModule } from './modules/converter.js';
import { YoutubeModule } from './modules/youtube.js';
import { RemoveBGModule } from './modules/removebg.js';
import { STTModule } from './modules/stt.js';
import { UpscaleModule } from './modules/upscale.js';
import { SettingsModule } from './modules/settings.js';
import { initChat } from './modules/chat.js';
import { initToolbox } from './modules/toolbox.js';
import { MetadataModule } from './modules/metadata.js';
import { TorrentModule } from './modules/torrent.js';
import { LocalDropModule } from './modules/localdrop.js';
import { HomeModule } from './modules/home.js';


document.addEventListener('DOMContentLoaded', () => {
    // Initialise Core Systems
    new TabManager();

    // Initialise Modules
    new ConverterModule();
    new YoutubeModule();
    new RemoveBGModule();
    new STTModule();
    new UpscaleModule();
    new SettingsModule();
    new MetadataModule();
    new TorrentModule();
    new LocalDropModule();
    new HomeModule();

    initChat();
    initToolbox();

    // Render Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    console.log('🚀 Ultra Dashboard Loaded (Modular)');
});
