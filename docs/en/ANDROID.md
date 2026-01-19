# 🤖 Android Application (Capacitor)

This document explains how to manage and build the native Android application.

## 🏗 Project Structure

We use **Capacitor** to wrap the web application in a native container.
- The Android project resides in the `web/android/` folder.
- The Capacitor configuration is in `web/capacitor.config.ts`.

## 🛠 Environment Preparation

1.  Make sure you have **Android Studio** installed.
2.  Install the dependencies in the `web/` folder:
    ```bash
    npm install
    ```
3.  Generate the web build:
    ```bash
    npm run build
    ```
4.  Sync with the native project:
    ```bash
    npx cap sync android
    ```

## 🚀 Building and Running

To open the project in Android Studio:
```bash
npx cap open android
```

From Android Studio you can:
- Run the app on an emulator or real device.
- Generate an **APK** for testing.
- Generate an **AAB** (App Bundle) to upload to the Play Store.

## 🔑 App Signing (Release)

To publish the app, it must be signed.

1.  **Generate Keystore**:
    ```bash
    keytool -genkey -v -keystore my-release-key.keystore -alias shoppinglist -keyalg RSA -keysize 2048 -validity 10000
    ```
2.  **Configure Build**:
    In Android Studio, go to `Build > Generate Signed Bundle / APK`.

> [!IMPORTANT]
> For more details on the store publishing process (Google Play, F-Droid), consult the specific guide: **[STORE_PUBLISHING.md](STORE_PUBLISHING.md)**.

## 🔄 Syncing Changes

Every time you modify the code in `web/src/`, you must follow these steps to see the changes on Android:
1. `npm run build`
2. `npx cap copy android`
