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
  const { isDark, isAmoled, appMode, setSyncState, syncFromRemote, items, categories } = useShopStore();
  const [showSettings, setShowSettings] = useState(false);

  // Auto-reconnect to sync on app mount
  useEffect(() => {
    const { sync } = useShopStore.getState();
    const savedCode = sync.code || localStorage.getItem('shopListSyncCode');
    if (savedCode && navigator.onLine) {
      reconnectSync(savedCode);
    }
  }, []);

  // Sync local changes to remote when items/categories change
  useEffect(() => {
    const syncToRemote = async () => {
      const { sync } = useShopStore.getState();
      if (sync.connected && sync.recordId) {
        try {
          await pb.collection('shopping_lists').update(sync.recordId, {
            data: { items, categories }
          });
        } catch (e) {
          console.error('Failed to sync to remote:', e);
        }
      }
    };

    // Debounce sync
    const timer = setTimeout(syncToRemote, 500);
    return () => clearTimeout(timer);
  }, [items, categories]);

  const reconnectSync = async (code: string) => {
    try {
      const record = await pb.collection('shopping_lists').getFirstListItem(`list_code="${code}"`);
      if (record.data) {
        syncFromRemote({ items: record.data.items || [], categories: record.data.categories || undefined });
      }
      setSyncState({ connected: true, code, recordId: record.id, msg: 'Connected', msgType: 'success' });

      // Subscribe to real-time updates
      pb.collection('shopping_lists').unsubscribe('*');
      pb.collection('shopping_lists').subscribe(record.id, (e) => {
        if (e.action === 'update' && e.record.data) {
          syncFromRemote({ items: e.record.data.items || [], categories: e.record.data.categories || undefined });
        } else if (e.action === 'delete') {
          setSyncState({ connected: false, code: null, recordId: null, msg: '' });
          localStorage.removeItem('shopListSyncCode');
        }
      });
    } catch {
      // Code not found or network error, don't show error on auto-reconnect
      localStorage.removeItem('shopListSyncCode');
    }
  };

  return (
    <div className={`${isDark ? 'dark' : ''} ${isAmoled ? 'amoled' : ''}`}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-darkBg dark:via-darkBg dark:to-darkBg transition-colors duration-500">
        <Header openSettings={() => setShowSettings(true)} />

        <main className="pt-20 pb-24 px-4 max-w-lg mx-auto">
          {appMode === 'planning' ? <PlanningView /> : <ShoppingView />}
          <ListView />
        </main>

        <Footer />

        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </div>
    </div>
  );
}

export default App;
