import { useEffect } from 'react';
import { useShopStore } from '../store/shopStore';
import { pb } from '../lib/pocketbase';

export function usePresence(ensureGuestAuth: () => Promise<void>) {
    const { sync, auth, setActiveUsers, logout } = useShopStore();

    useEffect(() => {
        let heartbeatInterval: any;

        const updatePresence = async () => {
            if (sync.connected && auth.username) {
                try {
                    if (pb.authStore.model?.id) {
                        await pb.collection('users').update(pb.authStore.model.id, {
                            display_name: auth.username,
                            current_list: sync.code,
                            last_active_at: new Date().toISOString()
                        });
                    }
                } catch (e: any) {
                    console.error('Failed to update presence:', e);
                    // Self-healing: If user is 404 (deleted) or 401 (unauthorized)
                    if (e.status === 404 || e.status === 401) {
                        console.warn('User record missing or invalid, resetting auth...');
                        pb.authStore.clear();
                        localStorage.removeItem('shopList_guest');
                        logout();
                        // Trigger immediate re-check/re-login which will now use the preserved name
                        ensureGuestAuth();
                    }
                }
            }
        };

        const fetchActiveUsers = async () => {
            if (sync.connected && sync.code) {
                try {
                    // Users active in the last 2 minutes
                    const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
                    const active = await pb.collection('users').getFullList({
                        filter: `current_list = "${sync.code}" && last_active_at > "${twoMinutesAgo}"`,
                    });

                    setActiveUsers(active.map((u: any) => ({
                        id: u.id,
                        username: u.display_name || u.username || 'Usuario',
                        lastActiveAt: u.last_active_at
                    })));
                } catch (e) {
                    console.error('Failed to fetch active users:', e);
                }
            } else {
                setActiveUsers([]);
            }
        };

        if (sync.connected) {
            updatePresence();
            fetchActiveUsers();
            heartbeatInterval = setInterval(() => {
                updatePresence();
                fetchActiveUsers();
            }, 30000); // Every 30s
        } else {
            setActiveUsers([]);
        }

        return () => clearInterval(heartbeatInterval);
    }, [sync.connected, sync.code, auth.username]);
}
