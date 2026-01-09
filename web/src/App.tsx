import { useState, useEffect } from 'react';
import { useShopStore } from './store/shopStore';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import PlanningView from './components/views/PlanningView';
import ShoppingView from './components/views/ShoppingView';
import ListView from './components/views/ListView';
import SettingsModal from './components/modals/SettingsModal';
import AdminLayout from './components/admin/AdminLayout';

import { useGuestAuth } from './hooks/useGuestAuth';
import { useListSync } from './hooks/useListSync';
import { usePresence } from './hooks/usePresence';

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

  // --- Global Lifecycle & updates ---
  useEffect(() => {
    useShopStore.getState().loadCatalog();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Proactive SW update check & Sync check
    const checkUpdates = async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
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

  return (
    <div className={`${isDark ? 'dark' : ''} ${isAmoled ? 'amoled' : ''}`}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-darkBg dark:via-darkBg dark:to-darkBg transition-colors duration-500">
        {isAdmin ? (
          <AdminLayout />
        ) : (
          <>
            <Header openSettings={() => setShowSettings(true)} />

            <main className="pt-20 pb-24 px-4 max-w-2xl mx-auto transition-all duration-500">
              {appMode === 'planning' ? <PlanningView /> : <ShoppingView />}
              <ListView />
            </main>

            <Footer installPrompt={deferredPrompt} onInstall={() => setDeferredPrompt(null)} />

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
