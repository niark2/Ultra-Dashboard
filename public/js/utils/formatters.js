/**
 * Centralized formatting utilities for Ultra Dashboard
 * Avoids code duplication across modules
 */

/**
 * Format bytes to human readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g., "1.5 MB")
 */
export const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format bytes per second to human readable speed
 * @param {number} bytes - Speed in bytes/second
 * @returns {string} Formatted speed (e.g., "1.5 MB/s")
 */
export const formatSpeed = (bytes) => formatSize(bytes) + '/s';

/**
 * Format seconds to duration string (MM:SS or HH:MM:SS)
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Format ETA (Estimated Time of Arrival) for downloads
 * @param {number} seconds - Remaining seconds
 * @returns {string} Human readable ETA
 */
export const formatEta = (seconds) => {
    const MAX_ETA_SECONDS = 8640000; // ~100 days

    if (seconds >= MAX_ETA_SECONDS) return '∞';
    if (seconds <= 0) return 'Terminé';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${seconds}s`;
};

/**
 * Refresh Lucide icons safely
 */
export const refreshIcons = () => {
    if (window.lucide) {
        window.lucide.createIcons();
    }
};
