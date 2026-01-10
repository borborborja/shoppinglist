import { useEffect } from 'react';
import { App } from '@capacitor/app';

// Global stack of handlers. LIFO (Last In First Out).
// The last registered handler is the one that gets executed.
const backHandlingStack: Array<() => void> = [];

export function useBackButton(handler: () => void) {
    useEffect(() => {
        // Push handler to stack on mount
        backHandlingStack.push(handler);

        // Update listener to always use the top of the stack
        const updateListener = async () => {
            await App.removeAllListeners();
            App.addListener('backButton', () => {
                if (backHandlingStack.length > 0) {
                    const topHandler = backHandlingStack[backHandlingStack.length - 1];
                    topHandler();
                } else {
                    App.exitApp();
                }
            });
        };

        updateListener();

        return () => {
            // Pop handler significantly from stack on unmount
            const index = backHandlingStack.indexOf(handler);
            if (index > -1) {
                backHandlingStack.splice(index, 1);
            }
            // Re-bind listener to updated stack state (optional but safe)
            if (backHandlingStack.length === 0) {
                // Consider resetting or leaving default behavior?
                // Ideally we keep the listener alive but empty stack logic handles exit.
            }
        };
    }, [handler]);
}
