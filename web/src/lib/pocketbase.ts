import PocketBase from 'pocketbase';

// Helper to detect if running in Capacitor native app
const isNativePlatform = () => {
    return typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform();
};

// Get the server URL based on context
const getServerUrl = (): string => {
    // For native apps, use configured server URL from localStorage (persisted by Zustand)
    if (isNativePlatform()) {
        try {
            const stored = localStorage.getItem('shoplist-storage');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.state?.serverUrl) {
                    return parsed.state.serverUrl;
                }
            }
        } catch (e) {
            console.warn('Error reading serverUrl from storage:', e);
        }
        // Default fallback for native - user must configure
        return '';
    }

    // For web: production uses same origin, dev uses local backend
    return import.meta.env.PROD
        ? window.location.origin
        : 'http://127.0.0.1:8090';
};

const url = getServerUrl();
export let pb = new PocketBase(url || 'http://localhost:8090');
pb.autoCancellation(false);

// Function to reinitialize PocketBase with a new URL (for native apps)
export const reinitializePocketBase = (newUrl: string) => {
    pb = new PocketBase(newUrl);
    pb.autoCancellation(false);
    return pb;
};

// Export helper for components
export { isNativePlatform };
