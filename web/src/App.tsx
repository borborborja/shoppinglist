import { useState, useEffect, useRef } from 'react';
import { useShopStore } from './store/shopStore';
import { pb } from './lib/pocketbase';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import PlanningView from './components/views/PlanningView';
import ShoppingView from './components/views/ShoppingView';
import ListView from './components/views/ListView';
import SettingsModal from './components/modals/SettingsModal';

import AdminLayout from './components/admin/AdminLayout';

function App() {
  const checkAdmin = () => {
    // Debug
    console.log('Checking Admin Route:', window.location.pathname, window.location.hash);
    return window.location.hash.startsWith('#/admin') || window.location.pathname.startsWith('/admin');
  };

  const [isAdmin, setIsAdmin] = useState(checkAdmin());
  const { isDark, isAmoled, appMode, items, categories, notifyOnAdd, notifyOnCheck, sync, lang, syncFromRemote, setSyncState } = useShopStore();
  const [showSettings, setShowSettings] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const lastRemoteStateRef = useRef<string>('');

  useEffect(() => {
    const handleRoute = () => setIsAdmin(checkAdmin());
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, []);


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
      // Check for SW updates
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          registration.update();
        }
      }

      // Force a re-fetch of remote data if connected
      const { sync } = useShopStore.getState();
      if (sync.connected && sync.recordId) {
        setSyncState({ syncVersion: sync.syncVersion + 1 });
        try {
          const record = await pb.collection('shopping_lists').getOne(sync.recordId);
          if (record.data) {
            useShopStore.getState().syncFromRemote(record.data);
            setSyncState({ lastSync: Date.now() });
          }
        } catch (e) {
          console.error('Failed proactive re-sync:', e);
        }
      }
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
  }, []);

  // Auto-reconnect and URL parameter sync
  useEffect(() => {
    const handleSyncParam = async () => {
      const { sync, setSyncState, syncFromRemote } = useShopStore.getState();

      // 1. Check for URL parameter
      const params = new URLSearchParams(window.location.search);
      const urlCode = (params.get('c') || params.get('code'))?.toUpperCase();

      if (urlCode && urlCode !== sync.code) {
        if (!navigator.onLine) return;

        const { items, lang } = useShopStore.getState();
        const hasData = items.length > 0 || sync.connected;

        if (hasData) {
          const msg = lang === 'ca'
            ? `Tens una llista activa. Vols descartar-la i connectar-te a la llista compartida (${urlCode})?`
            : `Tienes una lista activa. ¿Quieres descartarla y conectarte a la lista compartida (${urlCode})?`;

          if (!confirm(msg)) {
            // User cancelled - clear URL param and stop
            const newUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            return;
          }
        }

        setSyncState({ msg: 'Connecting from link...', msgType: 'info' });
        try {
          const record = await pb.collection('shopping_lists').getFirstListItem(`list_code="${urlCode}"`);
          const remoteData = record.data || { items: [], categories: undefined };

          // Auto-sync from URL (prioritizing remote if conflict for simplicity in auto-join)
          syncFromRemote({ items: remoteData.items || [], categories: remoteData.categories || undefined });
          setSyncState({ connected: true, code: urlCode, recordId: record.id, msg: 'Connected from link', msgType: 'success' });
          useShopStore.getState().addToSyncHistory(urlCode);
          localStorage.setItem('shopListSyncCode', urlCode);

          // Clear URL param without reloading
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } catch (e) {
          console.error('URL Sync failed:', e);
          setSyncState({ msg: 'Invalid link code', msgType: 'error' });
        }
        return;
      }

      // 2. Standard auto-reconnect
      if (!sync.connected && sync.code) {
        try {
          const record = await pb.collection('shopping_lists').getFirstListItem(`list_code="${sync.code}"`);
          setSyncState({ connected: true, recordId: record.id, msg: 'Reconnected', msgType: 'success' });
          if (record.data) syncFromRemote(record.data);
        } catch (e) {
          console.error('Auto-reconnect failed:', e);
        }
      }
    };
    handleSyncParam();
  }, [sync.code, sync.connected]);

  // Sync local changes to remote when items/categories change
  useEffect(() => {
    const syncToRemote = async () => {
      const { sync } = useShopStore.getState();
      if (sync.connected && sync.recordId) {
        const currentState = JSON.stringify({ items, categories });
        if (currentState === lastRemoteStateRef.current) return;

        try {
          await pb.collection('shopping_lists').update(sync.recordId, {
            data: { items, categories }
          });
          lastRemoteStateRef.current = currentState;
        } catch (e) {
          console.error('Failed to sync to remote:', e);
        }
      }
    };

    // Debounce sync
    const timer = setTimeout(syncToRemote, 200);
    return () => clearTimeout(timer);
  }, [items, categories]);

  // Subscribe to remote updates
  useEffect(() => {
    const { sync } = useShopStore.getState();
    if (sync.connected && sync.recordId) {
      pb.collection('shopping_lists').subscribe(sync.recordId, (e) => {
        if (e.action === 'update' && e.record.data) {
          const remoteData = e.record.data;
          const remoteStateStr = JSON.stringify({ items: remoteData.items, categories: remoteData.categories });

          if (remoteStateStr === lastRemoteStateRef.current) return;

          const remoteItems = remoteData.items || [];
          const localItems = useShopStore.getState().items;

          // Check for additions/unchecks
          if (notifyOnAdd && 'Notification' in window && Notification.permission === 'granted') {
            const newOrUnchecked = remoteItems.filter((ri: any) => {
              const local = localItems.find(li => li.id === ri.id);
              return (!local && !ri.checked) || (local && local.checked && !ri.checked);
            });
            if (newOrUnchecked.length > 0) {
              const names = newOrUnchecked.map((i: any) => typeof i.name === 'string' ? i.name : (i.name[lang] || i.name.es)).join(', ');
              new Notification('ShopList', { body: `+ ${names}` });
            }
          }

          // Check for completions
          if (notifyOnCheck && 'Notification' in window && Notification.permission === 'granted') {
            const checked = remoteItems.filter((ri: any) => {
              const local = localItems.find(li => li.id === ri.id);
              return local && !local.checked && ri.checked;
            });
            if (checked.length > 0) {
              const names = checked.map((i: any) => typeof i.name === 'string' ? i.name : (i.name[lang] || i.name.es)).join(', ');
              new Notification('ShopList', { body: `✓ ${names}` });
            }
          }

          lastRemoteStateRef.current = remoteStateStr;
          syncFromRemote(remoteData);
          setSyncState({ lastSync: Date.now() });
        }
      });
    }
    return () => { pb.collection('shopping_lists').unsubscribe('*'); };
  }, [sync.connected, sync.recordId, sync.syncVersion, notifyOnAdd, notifyOnCheck, syncFromRemote, lang]);

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
