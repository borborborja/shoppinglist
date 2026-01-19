# Publishing Guide: F-Droid and Google Play Store

This guide details the steps necessary to prepare your **ShoppingList** application for publication in app stores.

## 🟢 1. Google Play Store

Google Play requires a digitally signed and optimized file (.aab).

### A. Generate Keystore (Digital Signature)
You need a cryptographic key to sign your app. **Never lose it!**

1.  Generate `.keystore` file:
    ```bash
    keytool -genkey -v -keystore my-release-key.keystore -alias shoppinglist -keyalg RSA -keysize 2048 -validity 10000
    ```
2.  Move this file to `web/android/app/`.

### B. Configure Gradle
Edit `web/android/app/build.gradle` to add the signing configuration (or do it via environment variables, more secure for CI/CD).

### C. Generate App Bundle (AAB)
Google Play no longer uses APKs for uploading; it uses AAB (Android App Bundle).

```bash
cd web/android
./gradlew bundleRelease
```
The file will be generated in: `web/android/app/build/outputs/bundle/release/app-release.aab`.

### D. Upload to Google Play Console
1.  Create a developer account ($25 one-time fee).
2.  Create a new App.
3.  Upload the `.aab` file to "Testing" or "Production".

---

## 🔵 2. F-Droid (Open Source)

F-Droid is different: they **compile your source code** from your repository. You don't upload an APK.

### A. Cleanup Requirements
1.  **No Blobs**: There can be no pre-compiled `.jar`, `.so`, or `.aar` files in the repo. (Capacitor uses native libraries; this can be complex for "pure" F-Droid, but they accept standard maven dependencies).
2.  **License**: Make sure to have a `LICENSE` file (MIT/GPL) in the root.

### B. Structure for F-Droid
F-Droid uses a "Recipe" in YAML/TXT format that tells them how to compile.
Since your app is React (Web) + Capacitor (Android), the recipe must:
1.  Install node/npm.
2.  Run `npm run build`.
3.  Run `npx cap sync`.
4.  Compile with Gradle.

### C. Request for Packaging (RFP)
1.  Open an issue in the [fdroiddata](https://gitlab.com/fdroid/fdroiddata) repository.
2.  They will review your code. If you use proprietary libraries (Google Services, Analytics), you will be rejected.
    *   *Note:* ShoppingList uses Capacitor. If you have Firebase or Google Analytics plugins, you must remove them for F-Droid.

---

## 🚀 Quick Summary

| Store | Format | Process | Cost |
| :--- | :--- | :--- | :--- |
| **Play Store** | `.aab` (Signed) | You build and upload the file | $25 |
| **F-Droid** | Source Code (Git) | They build from your GitHub | Free |
