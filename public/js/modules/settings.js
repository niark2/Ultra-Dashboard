export class SettingsModule {
    constructor() {
        this.themeToggle = document.getElementById('themeToggle');
        this.reduceMotionToggle = document.getElementById('reduceMotionToggle');
        this.compactSidebarToggle = document.getElementById('compactSidebarToggle');
        this.soundToggle = document.getElementById('soundToggle');
        this.clearCacheBtn = document.getElementById('clearCacheBtn');
        this.accentPicker = document.getElementById('accentPicker');
        this.accentDots = document.querySelectorAll('.accent-dot');
        this.sidebarItemCheckboxes = document.querySelectorAll('[data-sidebar-item]');

        this.init();
    }

    init() {
        // Load saved settings
        this.loadSettings();

        // Event Listeners
        if (this.themeToggle) {
            this.themeToggle.addEventListener('change', () => this.toggleTheme());
        }

        if (this.reduceMotionToggle) {
            this.reduceMotionToggle.addEventListener('change', () => this.toggleReduceMotion());
        }

        if (this.compactSidebarToggle) {
            this.compactSidebarToggle.addEventListener('change', () => this.toggleCompactSidebar());
        }

        if (this.clearCacheBtn) {
            this.clearCacheBtn.addEventListener('click', () => this.clearCache());
        }

        if (this.accentDots) {
            this.accentDots.forEach(dot => {
                dot.addEventListener('click', () => this.setAccentColor(dot.dataset.color, dot));
            });
        }

        // Sidebar items visibility
        if (this.sidebarItemCheckboxes) {
            this.sidebarItemCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => this.toggleSidebarItem(checkbox));
            });
        }
    }

    loadSettings() {
        // Theme
        const theme = localStorage.getItem('ultra-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        if (this.themeToggle) {
            this.themeToggle.checked = theme === 'dark';
        }

        // Reduce Motion
        const reduceMotion = localStorage.getItem('ultra-reduce-motion') === 'true';
        document.body.classList.toggle('reduce-motion', reduceMotion);
        if (this.reduceMotionToggle) {
            this.reduceMotionToggle.checked = reduceMotion;
        }

        // Compact Sidebar
        const compactSidebar = localStorage.getItem('ultra-compact-sidebar') === 'true';
        document.body.classList.toggle('compact-sidebar', compactSidebar);
        if (this.compactSidebarToggle) {
            this.compactSidebarToggle.checked = compactSidebar;
        }

        // Sound
        const soundEnabled = localStorage.getItem('ultra-sound') !== 'false';
        if (this.soundToggle) {
            this.soundToggle.checked = soundEnabled;
        }

        // Accent Color
        const accentColor = localStorage.getItem('ultra-accent-color') || '#ffffff';
        this.applyAccentColor(accentColor);

        // Update active dot
        this.accentDots.forEach(dot => {
            dot.classList.toggle('active', dot.dataset.color === accentColor);
        });

        // Sidebar items visibility
        this.loadSidebarItemsVisibility();
    }

    loadSidebarItemsVisibility() {
        const hiddenItems = JSON.parse(localStorage.getItem('ultra-hidden-sidebar-items') || '[]');

        this.sidebarItemCheckboxes.forEach(checkbox => {
            const itemName = checkbox.dataset.sidebarItem;
            const isHidden = hiddenItems.includes(itemName);

            // Update checkbox state
            checkbox.checked = !isHidden;

            // Update sidebar nav item visibility
            this.updateSidebarItemVisibility(itemName, !isHidden);
        });
    }

    updateSidebarItemVisibility(itemName, isVisible) {
        const navItem = document.querySelector(`.nav-item[data-tab="${itemName}"]`);
        if (navItem) {
            if (isVisible) {
                navItem.classList.remove('hidden-by-settings');
            } else {
                navItem.classList.add('hidden-by-settings');
            }
        }
    }

    toggleSidebarItem(checkbox) {
        const itemName = checkbox.dataset.sidebarItem;
        const isVisible = checkbox.checked;

        // Update visibility
        this.updateSidebarItemVisibility(itemName, isVisible);

        // Save to localStorage
        const hiddenItems = JSON.parse(localStorage.getItem('ultra-hidden-sidebar-items') || '[]');

        if (isVisible) {
            // Remove from hidden list
            const index = hiddenItems.indexOf(itemName);
            if (index > -1) {
                hiddenItems.splice(index, 1);
            }
        } else {
            // Add to hidden list
            if (!hiddenItems.includes(itemName)) {
                hiddenItems.push(itemName);
            }
        }

        localStorage.setItem('ultra-hidden-sidebar-items', JSON.stringify(hiddenItems));
    }

    toggleTheme() {
        const isDark = this.themeToggle.checked;
        const newTheme = isDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('ultra-theme', newTheme);
        console.log(`Theme switched to: ${newTheme}`);
    }

    toggleReduceMotion() {
        const reduce = this.reduceMotionToggle.checked;
        document.body.classList.toggle('reduce-motion', reduce);
        localStorage.setItem('ultra-reduce-motion', reduce);
    }

    toggleCompactSidebar() {
        const compact = this.compactSidebarToggle.checked;
        document.body.classList.toggle('compact-sidebar', compact);
        localStorage.setItem('ultra-compact-sidebar', compact);
    }

    setAccentColor(color, dotElement) {
        this.accentDots.forEach(d => d.classList.remove('active'));
        dotElement.classList.add('active');
        this.applyAccentColor(color);
        localStorage.setItem('ultra-accent-color', color);
    }

    applyAccentColor(color) {
        document.documentElement.style.setProperty('--accent', color);
        // Adjust accent-hover and accent-dim based on color if needed
        // For now, we'll keep it simple
        if (color === '#ffffff') {
            document.documentElement.style.setProperty('--accent-hover', '#f4f4f5');
            document.documentElement.style.setProperty('--accent-dim', '#27272a');
        } else {
            document.documentElement.style.setProperty('--accent-hover', color + 'ee');
            document.documentElement.style.setProperty('--accent-dim', color + '22');
        }
    }

    clearCache() {
        if (confirm('Voulez-vous vraiment vider le cache local ? Cela réinitialisera également vos réglages.')) {
            localStorage.clear();
            window.location.reload();
        }
    }
}
