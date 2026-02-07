import { Storage } from '../utils/storage.js';

export class NotificationModule {
    constructor() {
        this.notifications = [];
        this.initialized = false;
        this.init();
    }

    async init() {
        if (this.initialized) return;

        // Load notifications from Storage
        this.notifications = await Storage.get('ultra-notifications', []);

        this.render();
        this.updateBadge();
        this.bindEvents();

        this.initialized = true;

        // Expose global push method
        window.pushNotification = (data) => this.push(data);

        // Listen for global event
        document.addEventListener('app-notification', (e) => {
            this.push(e.detail);
        });

        console.log('🔔 Notification Module Initialized');
    }

    bindEvents() {
        const clearBtn = document.getElementById('clearAllNotifications');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAll());
        }

        // Listen for tab changes
        document.addEventListener('tab-changed', (e) => {
            if (e.detail.tabId === 'notifications') {
                this.markAllAsRead();
            }
        });
    }

    async push({ title, message, type = 'info', icon = null }) {
        const notif = {
            id: Date.now(),
            title,
            message,
            type,
            icon: icon || this.getDefaultIcon(type),
            time: new Date().toISOString(),
            read: false
        };

        this.notifications.unshift(notif);
        if (this.notifications.length > 50) this.notifications.pop();

        await Storage.set('ultra-notifications', this.notifications);
        this.render();
        this.updateBadge();

        // Potential: Browser Notification API
        if (Notification.permission === 'granted') {
            new Notification(title, { body: message });
        }
    }

    async markAllAsRead() {
        let changed = false;
        this.notifications.forEach(n => {
            if (!n.read) {
                n.read = true;
                changed = true;
            }
        });

        if (changed) {
            await Storage.set('ultra-notifications', this.notifications);
            this.updateBadge();
            this.render();
        }
    }

    async clearAll() {
        this.notifications = [];
        await Storage.set('ultra-notifications', this.notifications);
        this.render();
        this.updateBadge();
    }

    updateBadge() {
        const badge = document.getElementById('notifBadge');
        if (!badge) return;

        const unreadCount = this.notifications.filter(n => !n.read).length;
        if (unreadCount > 0) {
            badge.hidden = false;
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        } else {
            badge.hidden = true;
        }
    }

    render() {
        const list = document.getElementById('notificationsList');
        if (!list) return;

        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="empty-notifications">
                    <div class="empty-icon">
                        <i data-lucide="bell-off"></i>
                    </div>
                    <h3>Aucune notification</h3>
                    <p>Vos nouvelles notifications apparaîtront ici.</p>
                </div>
            `;
        } else {
            list.innerHTML = this.notifications.map(n => `
                <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
                    <div class="notification-icon type-${n.type}">
                        <i data-lucide="${n.icon}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-header">
                            <span class="notification-title">${n.title}</span>
                            <span class="notification-time">${this.formatTime(n.time)}</span>
                        </div>
                        <div class="notification-message">${n.message}</div>
                    </div>
                </div>
            `).join('');
        }

        if (window.lucide) window.lucide.createIcons();
    }

    getDefaultIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'alert-circle';
            case 'warning': return 'alert-triangle';
            default: return 'info';
        }
    }

    formatTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'À l\'instant';
        if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
        if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)} h`;
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }
}
