# 📱 Web Application and PWA

**ShoppingList** is designed as a Progressive Web Application (PWA), which allows it to be used like a native application on mobile or desktop from the browser.

## ✨ Technical Features

- **Framework**: React 18 with TypeScript.
- **Build Tool**: Vite.
- **State**: Zustand (lightweight and persistent management).
- **Styles**: TailwindCSS with theme support.

## 📶 Offline Mode and Synchronization

The application uses **Offline-First** strategies:

1.  **Cache**: Static resources are cached by a Service Worker (via Vite PWA Plugin).
2.  **Local Persistence**: The status of the shopping list is saved in `localStorage` through Zustand.
3.  **Efficient Synchronization**: 
    - When connected, changes are sent to PocketBase via WebSockets/SSE.
    - When offline, you can continue using the app. Changes will synchronize the next time you open the app with a connection.

## 🎨 Themes and Customization

We support multiple visual modes configurable from settings:

- **Light / Dark**: Based on system preferences or manually forced.
- **AMOLED**: A pure black mode optimized for OLED screens.
- **Multi-language**: Built-in translations for Spanish, Catalan, and English.

## 🏠 PWA Installation

### On Android (Chrome)
1. Open your instance's URL.
2. Tap the three dots (menu).
3. Select **"Install application"** or **"Add to home screen"**.

### On iOS (Safari)
1. Open the URL in Safari.
2. Tap the **Share** button (square with arrow).
3. Select **"Add to home screen"**.

---

## 🛠 Web Development

If you want to modify the frontend:

- The entry point is `web/src/main.tsx`.
- Views are in `web/src/components/views/`.
- Shared components are in `web/src/components/common/`.
- Data logic resides in `web/src/store/shopStore.ts`.
