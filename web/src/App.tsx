import { useState, useEffect } from 'react';
import { useShopStore } from './store/shopStore';
import Header from './components/layout/Header';
// Footer removed
import PlanningView from './components/views/PlanningView';
import ShoppingView from './components/views/ShoppingView';
import ListView from './components/views/ListView';
import SettingsModal from './components/modals/SettingsModal';
import AdminLayout from './components/admin/AdminLayout';

import { useGuestAuth } from './hooks/useGuestAuth';
import { useListSync } from './hooks/useListSync';
import { usePresence } from './hooks/usePresence';
import { useStatusBarSync } from './hooks/useStatusBarSync';

function App() {
  const checkAdmin = () => window.location.hash.startsWith('#/admin') || window.location.pathname.startsWith('/admin');

  const [isAdmin, setIsAdmin] = useState(checkAdmin());
  const { isDark, isAmoled, appMode } = useShopStore();
  const [showSettings, setShowSettings] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // --- Custom Hooks ---
  const { ensureGuestAuth } = useGuestAuth();
  const { refreshList } = useListSync();
  usePresence(ensureGuestAuth);
  useStatusBarSync();

  // --- Route Handlers ---
  useEffect(() => {
    const handleRoute = () => setIsAdmin(checkAdmin());
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, []);

  // --- Auto Theme Listener ---
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      useShopStore.getState().updateSystemTheme(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    // Ensure correct initial state if in auto mode on mount
    if (useShopStore.getState().theme === 'auto') {
      useShopStore.getState().updateSystemTheme(mediaQuery.matches);
    }

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // --- Global Lifecycle & updates ---
  useEffect(() => {
    // Restore connection if configured for native
    if (import.meta.env.VITE_PLATFORM !== 'web') { // Optimization: check env first if possible, or use isNativePlatform helper
      // We use the helper from lib/pocketbase inside the effect
    }

    // Initialize Catalog
    useShopStore.getState().loadCatalog();

    // Re-connect to custom server if needed (Native)
    const { serverUrl } = useShopStore.getState();
    if (serverUrl) {
      // Dynamic import or direct usage if imported at top
      import('./lib/pocketbase').then(({ reinitializePocketBase, isNativePlatform }) => {
        if (isNativePlatform()) {
          reinitializePocketBase(serverUrl);
        }
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Proactive SW update check & Sync check
    const checkUpdates = async () => {
      if ('serviceWorker' in navigator && typeof (navigator.serviceWorker as any).getRegistration === 'function') {
        const registration = await (navigator.serviceWorker as any).getRegistration();
        if (registration) registration.update();
      }

      await ensureGuestAuth();
      await refreshList();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkUpdates();
    };

    const handleActivity = () => {
      checkUpdates();
    };

    window.addEventListener('focus', checkUpdates);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', checkUpdates);
    window.addEventListener('touchstart', handleActivity, { passive: true });

    const updateInterval = setInterval(checkUpdates, 1000 * 60 * 30); // Every 30 mins

    return () => {
      window.removeEventListener('focus', checkUpdates);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkUpdates);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(updateInterval);
    };
  }, []); // Dependencies empty to run once on mount (hooks handle their own stale closures if well designed, or we use refs)

  // --- Web App Status Check ---
  const [isWebAppEnabled, setIsWebAppEnabled] = useState(true);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  useEffect(() => {
    const checkConfig = async () => {
      // First check if we are in native platform - if so, always enabled
      if (import.meta.env.VITE_PLATFORM !== 'web') {
        setIsConfigLoaded(true);
        return;
      }

      // Check URL for admin - if admin, always enabled
      if (checkAdmin()) {
        setIsConfigLoaded(true);
        return;
      }

      try {
        // We import pb dynamically or from lib to avoid circular deps if any, but import is safe here
        // Using a fail-safe fetch since this blocks the app
        const { pb } = await import('./lib/pocketbase');
        const config = await pb.collection('admin_config').getFullList();
        const enabledRecord = config.find(c => c.key === 'enable_web_app');

        // Default to true if not found or error
        const isEnabled = enabledRecord ? enabledRecord.value !== 'false' : true;
        setIsWebAppEnabled(isEnabled);
      } catch (e) {
        console.warn('Failed to fetch config, assuming enabled', e);
      } finally {
        setIsConfigLoaded(true);
      }
    };

    checkConfig();
  }, [isAdmin]); // Re-run if admin status changes

  if (!isConfigLoaded && !isAdmin && import.meta.env.VITE_PLATFORM === 'web') {
    // Optional: Render simple loading or just wait (to avoid flash)
    // For now we render nothing or a spinner if preferred, but existing app skeleton is fine.
    // To avoid layout shift, let's just let it fall through to render but maybe show a skeleton?
    // Actually, let's just wait to render content.
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>;
  }

  // Blocking Screen for Web Users if Disabled
  if (!isWebAppEnabled && !isAdmin && import.meta.env.VITE_PLATFORM === 'web') {
    return (
      <div className={`${isDark ? 'dark' : ''} ${isAmoled ? 'amoled' : ''}`}>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 dark:border-slate-700">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">Solo App Móvil</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              La versión web de esta aplicación está desactivada. Este servidor funciona únicamente como backend para las aplicaciones móviles.
            </p>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-xs font-mono text-slate-400">STATUS: API_ONLINE</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'dark' : ''} ${isAmoled ? 'amoled' : ''}`}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-darkBg dark:via-darkBg dark:to-darkBg transition-colors duration-500">
        {isAdmin ? (
          <AdminLayout />
        ) : (
          <>
            <Header openSettings={() => setShowSettings(true)} />

            <main className="pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] px-4 max-w-2xl mx-auto transition-all duration-500">
              {appMode === 'planning' ? <PlanningView /> : <ShoppingView />}
              <ListView />
            </main>


            {showSettings && <SettingsModal
              onClose={() => setShowSettings(false)}
              installPrompt={deferredPrompt}
              onInstall={() => setDeferredPrompt(null)}
            />}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
