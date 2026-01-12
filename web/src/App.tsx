import { useState, useEffect } from 'react';
import { useShopStore } from './store/shopStore';
import { Capacitor } from '@capacitor/core';
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

  // --- Global Theme Sync ---
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (isAmoled) {
      document.documentElement.classList.add('amoled');
    } else {
      document.documentElement.classList.remove('amoled');
    }

    // Also set meta theme-color for mobile browsrs
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isAmoled ? '#000000' : isDark ? '#0f172a' : '#ffffff');
    }
  }, [isDark, isAmoled]);

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

  // --- Deep Link Handling ---
  useEffect(() => {
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('appUrlOpen', async (data) => {
        try {
          const url = new URL(data.url);

          // Handle Custom Scheme: shoppinglist://open?server=...&c=...
          if (url.protocol.includes('shoppinglist')) {
            const server = url.searchParams.get('server');
            const code = url.searchParams.get('c');

            if (server) {
              // If a server is specified in the link, we switch to it (Dynamic!)
              // Use the store properly outside of component if needed or via hook
              useShopStore.getState().setServerUrl(server);
              // Re-init PB
              import('./lib/pocketbase').then(({ reinitializePocketBase }) => {
                reinitializePocketBase(server);
              });
            }

            if (code) {
              // Trigger the sync modal flow
              // We can set a temporary storage or state that the modal checks
              // For now, let's assume we want to open settings
              setShowSettings(true);
              // We can emit a custom event or set a global state for the modal to pick up
              window.dispatchEvent(new CustomEvent('deep-link-code', { detail: code }));
            }
          } else {
            // Handle standard web links (https://domain.com/?c=XYZ) if intercepted
            const code = url.searchParams.get('c');
            if (code) {
              setShowSettings(true);
              // Slight delay to ensure modal mounts handling the event
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('deep-link-code', { detail: code }));
              }, 500);
            }
          }
        } catch (e) {
          console.error('Deep Link Error', e);
        }
      });
    });
  }, []);

  // --- Web App Status Check ---
  const [isWebAppEnabled, setIsWebAppEnabled] = useState(true);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);



  useEffect(() => {
    let unsub: (() => void) | undefined;

    const checkConfig = async () => {
      // First check if we are in native platform - if so, always enabled
      if (Capacitor.getPlatform() !== 'web') {
        setIsConfigLoaded(true);
        return;
      }

      // Check URL for admin - if admin, always enabled
      if (checkAdmin()) {
        setIsConfigLoaded(true);
        return;
      }

      try {
        const { pb } = await import('./lib/pocketbase');

        // Initial fetch
        const config = await pb.collection('admin_config').getFullList();
        const updateState = (records: any[]) => {
          const enabledRecord = records.find((c: any) => c.key === 'enable_web_app');
          const isEnabled = enabledRecord ? enabledRecord.value !== 'false' : true;
          setIsWebAppEnabled(isEnabled);
        };
        updateState(config);

        // Real-time subscription
        pb.collection('admin_config').subscribe('*', async (e) => {
          // Reload all config to be safe/simple, or just check event
          if (e.action === 'update' || e.action === 'create') {
            const newConfig = await pb.collection('admin_config').getFullList();
            updateState(newConfig);
          }
        }).then(u => unsub = u);

      } catch (e) {
        console.warn('Failed to fetch config, assuming enabled', e);
      } finally {
        setIsConfigLoaded(true);
      }
    };

    checkConfig();

    return () => {
      if (unsub) unsub();
    };
  }, [isAdmin]); // Re-run if admin status changes

  if (!isConfigLoaded && !isAdmin && Capacitor.getPlatform() === 'web') {
    // Optional: Render simple loading or just wait (to avoid flash)
    // For now we render nothing or a spinner if preferred, but existing app skeleton is fine.
    // To avoid layout shift, let's just let it fall through to render but maybe show a skeleton?
    // Actually, let's just wait to render content.
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>;
  }

  // Blocking Screen for Web Users if Disabled (Simulate 404)
  if (!isWebAppEnabled && !isAdmin && Capacitor.getPlatform() === 'web') {
    return (
      <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '2rem' }}>
        <h1>404 Not Found</h1>
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
