export class TabManager {
    constructor() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.currentTab = 'convert';
        this.init();
    }

    init() {
        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (item.disabled) return;
                const tabId = item.dataset.tab;
                this.switchTab(tabId);
            });
        });
    }

    switchTab(tabId) {
        // Update Nav
        this.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabId);
        });

        // Update Content
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });

        this.currentTab = tabId;
        console.log(`Tab switched to: ${tabId}`);
    }
}
