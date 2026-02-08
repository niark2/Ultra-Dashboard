import { translations } from '../translations.js';
import { Storage } from './storage.js';

export class I18n {
    static async init() {
        // En: Default language as requested by the user
        const lang = await Storage.get('ultra-language', 'en');
        await this.applyLanguage(lang);
    }

    static async applyLanguage(lang) {
        document.documentElement.setAttribute('lang', lang);
        const dictionary = translations[lang] || translations['en'];

        // Translate page title and meta description
        const title = document.querySelector('title');
        if (title && dictionary[title.textContent.trim()]) {
            title.textContent = dictionary[title.textContent.trim()];
        }
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && dictionary[metaDesc.content.trim()]) {
            metaDesc.content = dictionary[metaDesc.content.trim()];
        }

        // 1. Translate elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.dataset.i18n || el.textContent.trim();
            if (dictionary[key]) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (el.placeholder && dictionary[el.placeholder]) {
                        el.placeholder = dictionary[el.placeholder];
                    }
                } else {
                    el.textContent = dictionary[key];
                }
            }
        });

        // 1b. Translate placeholders with data-i18n-placeholder attribute
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            if (dictionary[key]) {
                el.placeholder = dictionary[key];
            }
        });

        // 1c. Translate title attributes with data-i18n-title attribute
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(el => {
            const key = el.dataset.i18nTitle;
            if (dictionary[key]) {
                el.title = dictionary[key];
            }
        });

        // 2. Translate by Specific Selectors (for hardcoded EJS content)
        this.translateBySelectors(dictionary);
    }

    static translateBySelectors(dictionary) {
        const selectors = [
            '.nav-label',
            '.nav-section-title',
            '.content-header h1',
            '.content-header .subtitle',
            '.settings-group-title',
            '.setting-title',
            '.setting-description',
            '.welcome-text h1',
            '.welcome-text p',
            '#addWidgetBtn',
            '.store-header h2',
            '.store-item h4',
            '.store-item p',
            '.btn-primary',
            '.btn-secondary',
            '.btn-add-widget span',
            '.version',
            '.plexus-tagline',
            '.plexus-suggestion span',
            '.plexus-followup h4',
            '.plexus-sources-title',
            '.plexus-thinking-header span',
            '.thinking-step span',
            '.plexus-logo-text',
            '.tool-title',
            '.drop-text',
            '.drop-subtext',
            '.btn-text',
            '.option-title',
            '.option-desc',
            '.progress-text',
            '.success-message p',
            '.empty-history-text',
            '.history-header h3',
            '.feature-text h4',
            '.feature-text p',
            '.platform-card span',
            '.yt-channel',
            '.yt-info label',
            '.yt-select option',
            '.custom-checkbox',
            '.trim-group label',
            '.checkbox-group label',
            '.header-with-status h1',
            '.server-error h3',
            '.server-error p',
            '.model-label',
            '.model-name',
            '.model-desc',
            '.badge-perf',
            '.result-label',
            '.chat-sidebar .section-title',
            '.pdf-upload-label .text',
            '.message-content',
            '.metadata-table th',
            '.empty-state h3',
            '.empty-state p',
            '.status-info',
            '.login-overlay h3',
            '.login-overlay p',
            '.stat-item',
            '.torrent-header-row div',
            '.modal-title',
            '.device-label',
            '.share-label',
            '.no-devices p',
            '.tool-button',
            '.stat-label-row span',
            '.tool-checkbox',
            '.text-stats span',
            '.mirror-placeholder p',
            '.header-title p',
            '#authSubtitle',
            '#authToggleText',
            '#authToggleBtn',
            '#setupNotice span',
            '#authForm .btn-text'
        ];

        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                // If the element has children (like icons), we only want to translate the text nodes
                const textNodes = Array.from(el.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);

                if (textNodes.length > 0) {
                    textNodes.forEach(node => {
                        const text = node.textContent.trim();
                        if (text && dictionary[text]) {
                            // Preserve leading/trailing whitespace if it's there for spacing
                            const leading = node.textContent.match(/^\s*/)[0];
                            const trailing = node.textContent.match(/\s*$/)[0];
                            node.textContent = leading + dictionary[text] + trailing;
                        }
                    });
                } else {
                    // No children, just translate the whole textContent
                    const text = el.textContent.trim();
                    if (text && dictionary[text]) {
                        el.textContent = dictionary[text];
                    }
                }
            });
        });

        // Translate placeholders
        document.querySelectorAll('input, textarea').forEach(el => {
            if (el.placeholder && dictionary[el.placeholder]) {
                el.placeholder = dictionary[el.placeholder];
            }
        });

        // Special case for settings tab buttons (link text is after the icon)
        document.querySelectorAll('.settings-tab-link').forEach(link => {
            const textNodes = Array.from(link.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
            textNodes.forEach(node => {
                const text = node.textContent.trim();
                if (text && dictionary[text]) {
                    const leading = node.textContent.match(/^\s*/)[0];
                    node.textContent = leading + dictionary[text];
                }
            });
        });
    }

    static t(text) {
        if (!text) return '';
        const lang = document.documentElement.getAttribute('lang') || 'en';
        const dictionary = translations[lang] || translations['en'];
        return dictionary[text] || text;
    }

    static async setLanguage(lang) {
        await Storage.set('ultra-language', lang);
        window.location.reload();
    }
}
