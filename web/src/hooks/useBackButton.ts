import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Global stack of handlers. LIFO (Last In First Out).
// The last registered handler is the one that gets executed.
const backHandlingStack: Array<() => void> = [];

export function useBackButton(handler: () => void) {
    // Track if the unmount was caused by a back navigation (popstate/native back)
    // to avoid double-modifying history on manual close.
    const isBackNav = useRef(false);

    useEffect(() => {
        const isNative = Capacitor.isNativePlatform();

        // --- COMMON: Stack Management ---
        backHandlingStack.push(handler);

        // --- NATIVE: Capacitor App Listener ---
        const updateNativeListener = async () => {
            await App.removeAllListeners();
            App.addListener('backButton', () => {
                if (backHandlingStack.length > 0) {
                    isBackNav.current = true; // Mark as back nav
                    const topHandler = backHandlingStack[backHandlingStack.length - 1];
                    topHandler();
                } else {
                    App.exitApp();
                }
            });
        };

        if (isNative) {
            updateNativeListener();
        } else {
            // --- WEB: History API ---
            // Push a state when the modal opens
            window.history.pushState({ modalOpen: true }, '', null);

            const handlePopState = () => {
                // If we receive a popstate, it means the user pressed Back.
                // We execute the handler (close modal).
                isBackNav.current = true;
                // The history is already popped by the browser, so we don't need to go back.

                // We only handle it if this component is the top of the stack.
                // In a browser, popstate usually happens 1-by-1, but good to be safe.
                if (backHandlingStack[backHandlingStack.length - 1] === handler) {
                    handler();
                }
            };

            window.addEventListener('popstate', handlePopState);

            // Cleanup function for Web listener
            return () => {
                window.removeEventListener('popstate', handlePopState);

                const index = backHandlingStack.indexOf(handler);
                if (index > -1) {
                    backHandlingStack.splice(index, 1);
                }

                // If closure wasn't triggered by back button (i.e. click X, or click outside),
                // we need to revert the history state we pushed.
                if (!isBackNav.current) {
                    window.history.back();
                }
            };
        }

        // --- CLEANUP ---
        return () => {
            if (isNative) {
                const index = backHandlingStack.indexOf(handler);
                if (index > -1) {
                    backHandlingStack.splice(index, 1);
                }
                // Native listener re-bind might be needed if multiple levels,
                // but usually the next effect in the stack (parent) will re-assert or existing listener is fine?
                // Actually, removing the listener globally is risky if we don't re-add the previous.
                // BUT: Our logic always uses `backHandlingStack`, so as long as the LISTENER is alive, it grabs top.
                // We only need to ensure the listener is active.
                // Since this effect runs on every mount, the last mounted one sets up the listener.
                // When unmounting, we don't necessarily kill the listener unless stack is empty?
                // Actually, the previous implementation re-bound it. Let's keep it simple.
                // Better approach: One single global listener setup outside hooks?
                // For now, let's stick to the stack manipulation.
            }
        };
    }, [handler]);
}
