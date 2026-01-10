import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.borja.shoplist',
  appName: 'ShoppingList',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1000,
      backgroundColor: "#ffffff",
      androidScaleType: "CENTER_CROP"
    }
  }
};

export default config;
