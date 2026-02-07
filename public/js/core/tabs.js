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

        // Listen for external tab switch requests
        document.addEventListener('switch-tab', (e) => {
            if (e.detail && e.detail.tab) {
                this.switchTab(e.detail.tab);
            }
        });
    }

    switchTab(tabId) {
        // Update Nav (Re-select to include dynamic items like pinned ones)
        const allNavItems = document.querySelectorAll('.nav-item');
        allNavItems.forEach(item => {
            const isActive = item.dataset.tab === tabId;
            item.classList.toggle('active', isActive);

            // Expand parent section if active
            if (isActive) {
                const parentSection = item.closest('.nav-section');
                if (parentSection) {
                    parentSection.classList.remove('collapsed');
                }
            }
        });

        // Update Content
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });

        this.currentTab = tabId;
        console.log(`Tab switched to: ${tabId}`);

        // Dispatch global event for modules
        document.dispatchEvent(new CustomEvent('tab-changed', {
            detail: { tabId: tabId }
        }));
    }
}
