import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { useShopStore } from '../store/shopStore';

export const useStatusBarSync = () => {
    const { isDark, isAmoled } = useShopStore();

    useEffect(() => {
        const syncStatusBar = async () => {
            if (!Capacitor.isNativePlatform()) return;

            // Ensure content doesn't go under status bar on Android
            if (Capacitor.getPlatform() === 'android') {
                await StatusBar.setOverlaysWebView({ overlay: false });
            }

            try {
                if (isAmoled) {
                    // Pure Black
                    await StatusBar.setStyle({ style: Style.Dark }); // Light text
                    await StatusBar.setBackgroundColor({ color: '#000000' });
                } else if (isDark) {
                    // Dark Mode (matches darkBg #0f172a or darkSurface #1e293b)
                    // Since Header is transparent/glass, picking the main background color is safest
                    await StatusBar.setStyle({ style: Style.Dark }); // Light text
                    await StatusBar.setBackgroundColor({ color: '#0f172a' });
                } else {
                    // Light Mode
                    await StatusBar.setStyle({ style: Style.Light }); // Dark text
                    // Our light background starts with blue-50 (#eff6ff)
                    await StatusBar.setBackgroundColor({ color: '#eff6ff' });
                }
            } catch (error) {
                console.error('Failed to sync status bar:', error);
            }
        };

        syncStatusBar();
    }, [isDark, isAmoled]);
};
