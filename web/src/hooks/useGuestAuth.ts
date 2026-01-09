import { useEffect } from 'react';
import { useShopStore } from '../store/shopStore';
import { pb } from '../lib/pocketbase';

export function useGuestAuth() {
    const { setAuth, setUsername, auth } = useShopStore();

    const ensureGuestAuth = async () => {
        // Current preferred name (from store before potentially resetting)
        // We access the store directly to get the very latest state if needed, 
        // but here we want the name that might be persisted in the store from previous sessions
        // even if the user is currently logged out from PB's perspective.
        const currentStoreName = useShopStore.getState().auth.username;

        if (!pb.authStore.isValid) {
            const stored = localStorage.getItem('shopList_guest');
            let guestCreds = stored ? JSON.parse(stored) : null;

            try {
                if (guestCreds) {
                    await pb.collection('users').authWithPassword(guestCreds.username, guestCreds.password);
                }
            } catch (e) {
                console.warn('Stored creds invalid, resetting');
                guestCreds = null;
            }

            // If still not valid, create new user
            if (!pb.authStore.isValid) {
                const randomId = Math.floor(Math.random() * 90000) + 10000;
                const password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
                const usernameId = `user${randomId}`;

                // CRITICAL FIX: Preserve identity
                // If we have a name in the store (e.g. from a previous session where the user was deleted),
                // use it. Otherwise, fallback to the generated ID.
                const displayName = currentStoreName && currentStoreName.trim() !== ''
                    ? currentStoreName
                    : usernameId;

                try {
                    await pb.collection('users').create({
                        username: usernameId,
                        password,
                        passwordConfirm: password,
                        display_name: displayName
                    });
                    await pb.collection('users').authWithPassword(usernameId, password);

                    localStorage.setItem('shopList_guest', JSON.stringify({ username: usernameId, password }));

                    console.log(`Created guest user: ${usernameId} as "${displayName}"`);
                } catch (e) {
                    console.error('Failed to create/login guest:', e);
                }
            }

            // Sync store with PB state
            if (pb.authStore.model) {
                const finalDisplayName = pb.authStore.model.display_name || pb.authStore.model.username;
                setAuth({
                    isLoggedIn: true,
                    userId: pb.authStore.model.id,
                    username: finalDisplayName
                });
                // Ensure store matches
                setUsername(finalDisplayName);
            }
        } else if (!auth.isLoggedIn && pb.authStore.model) {
            // PB is logged in but Store is not (rehydration mismatch?)
            setAuth({
                isLoggedIn: true,
                userId: pb.authStore.model.id,
                username: pb.authStore.model.display_name || pb.authStore.model.username
            });
        }
    };

    useEffect(() => {
        ensureGuestAuth();
        // Intentionally run once on mount or when critical deps change, 
        // but usually this is a "bootstrap" check.
        // We add ensureGuestAuth to dependencies if it were a useCallback, 
        // but here we just run it. 
    }, []);

    return { ensureGuestAuth };
}
