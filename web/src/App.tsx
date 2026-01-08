import { useState, useEffect } from 'react';
import { useShopStore } from './store/shopStore';
import { pb } from './lib/pocketbase';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import PlanningView from './components/views/PlanningView';
import ShoppingView from './components/views/ShoppingView';
import ListView from './components/views/ListView';
import SettingsModal from './components/modals/SettingsModal';

function App() {
  const { isDark, isAmoled, appMode, items, categories, notifyOnAdd, notifyOnCheck, sync, lang, setSyncState, syncFromRemote } = useShopStore();
  const [showSettings, setShowSettings] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Auto-reconnect on mount
  useEffect(() => {
    const reconnect = async () => {
      const { sync } = useShopStore.getState();
      if (!sync.connected && sync.code && sync.recordId) {
        try {
          const record = await pb.collection('shopping_lists').getOne(sync.recordId);
          if (record.list_code === sync.code) {
            setSyncState({ connected: true, msg: 'Connected', msgType: 'success' });
            // Initial pull to ensure we have latest
            if (record.data) {
              syncFromRemote({ items: record.data.items || [], categories: record.data.categories });
            }
          }
        } catch (e) {
          console.error('Auto-reconnect failed:', e);
          setSyncState({ connected: false, code: null, recordId: null });
        }
      }
    };
    reconnect();
  }, []);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Proactive SW update check
    const checkUpdates = async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          registration.update();
        }
      }
    };

    window.addEventListener('focus', checkUpdates);
    const updateInterval = setInterval(checkUpdates, 1000 * 60 * 60); // Every hour

    return () => {
      window.removeEventListener('focus', checkUpdates);
      clearInterval(updateInterval);
    };
  }, []);

  // Sync local changes to remote
  useEffect(() => {
    const syncToRemote = async () => {
      const state = useShopStore.getState();
      if (state.sync.connected && state.sync.recordId) {
        try {
          // Verify if remote is already same to avoid unnecessary writes
          const record = await pb.collection('shopping_lists').getOne(state.sync.recordId);
          const remoteStr = JSON.stringify(record.data || {});
          const localStr = JSON.stringify({ items, categories });

          if (remoteStr !== localStr) {
            await pb.collection('shopping_lists').update(state.sync.recordId, {
              data: { items, categories }
            });
          }
        } catch (e) {
          console.error('Failed to sync to remote:', e);
        }
      }
    };

    const timer = setTimeout(syncToRemote, 1000);
    return () => clearTimeout(timer);
  }, [items, categories]);

  // Subscribe to remote updates for state AND notifications
  useEffect(() => {
    const { sync } = useShopStore.getState();
    if (sync.connected && sync.recordId) {
      pb.collection('shopping_lists').subscribe(sync.recordId, (e) => {
        if (e.action === 'update' && e.record.data) {
          const remoteData = e.record.data;
          const currentState = useShopStore.getState();

          // Compare strings to detect actual changes
          const remoteStr = JSON.stringify(remoteData);
          const localStr = JSON.stringify({ items: currentState.items, categories: currentState.categories });

          if (remoteStr !== localStr) {
            // Apply update to local state
            syncFromRemote({ items: remoteData.items || [], categories: remoteData.categories });

            // Notifications logic...
            const remoteItems = remoteData.items || [];
            const localItems = currentState.items;

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
          }
        }
        if (e.action === 'delete') {
          setSyncState({ connected: false, code: null, recordId: null, msg: 'List deleted', msgType: 'error' });
        }
      });
    }
    return () => { pb.collection('shopping_lists').unsubscribe('*'); };
  }, [sync.connected, sync.recordId, notifyOnAdd, notifyOnCheck, lang]);

  return (
    <div className={`${isDark ? 'dark' : ''} ${isAmoled ? 'amoled' : ''}`}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-darkBg dark:via-darkBg dark:to-darkBg transition-colors duration-500">
        <Header openSettings={() => setShowSettings(true)} />

        <main className="pt-20 pb-24 px-4 max-w-lg mx-auto">
          {appMode === 'planning' ? <PlanningView /> : <ShoppingView />}
          <ListView />
        </main>

        <Footer installPrompt={deferredPrompt} onInstall={() => setDeferredPrompt(null)} />

        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </div>
    </div>
  );
}

export default App;
