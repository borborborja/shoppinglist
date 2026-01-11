# Guia de Publicación: F-Droid y Google Play Store

Esta guía detalla los pasos necesarios para preparar tu aplicación **ShoppingList** para ser publicada en tiendas de aplicaciones.

## 🟢 1. Google Play Store

Google Play requiere un archivo firmado digitalmente y optimizado (.aab).

### A. Generar Keystore (Firma Digital)
Necesitas una llave criptográfica para firmar tu app. **¡No la pierdas nunca!**

1.  Generar archivo `.keystore`:
    ```bash
    keytool -genkey -v -keystore my-release-key.keystore -alias shoppinglist -keyalg RSA -keysize 2048 -validity 10000
    ```
2.  Mueve este archivo a `web/android/app/`.

### B. Configurar Gradle
Edita `web/android/app/build.gradle` para añadir la configuración de firma (o hazlo vía variables de entorno, más seguro para CI/CD).

### C. Generar App Bundle (AAB)
Google Play ya no usa APKs para subir, usa AAB (Android App Bundle).

```bash
cd web/android
./gradlew bundleRelease
```
El archivo se generará en: `web/android/app/build/outputs/bundle/release/app-release.aab`.

### D. Subir a Google Play Console
1.  Crea una cuenta de desarrollador ($25 pago único).
2.  Crea una nueva App.
3.  Sube el archivo `.aab` en "Testing" o "Production".

---

## 🔵 2. F-Droid (Open Source)

F-Droid es diferente: ellos **compilan tu código fuente** desde tu repositorio. No subes un APK.

### A. Requisitos de Limpieza
1.  **Sin Blobs**: No puede haber archivos `.jar`, `.so`, o `.aar` pre-compilados en el repo. (Capacitor usa librerías nativas, esto puede ser complejo para F-Droid "puro", pero aceptan dependencias maven estándar).
2.  **Licencia**: Asegúrate de tener un archivo `LICENSE` (MIT/GPL) en la raíz.

### B. Estructura para F-Droid
F-Droid usa una "Recipe" (receta) en formato YAML/TXT que les dice cómo compilar.
Como tu app es React (Web) + Capacitor (Android), la receta debe:
1.  Instalar node/npm.
2.  Ejecutar `npm run build`.
3.  Ejecutar `npx cap sync`.
4.  Compilar con Gradle.

### C. Request for Packaging (RFP)
1.  Abre una issue en el repositorio [fdroiddata](https://gitlab.com/fdroid/fdroiddata).
2.  Ellos revisarán tu código. Si usas librerías propietarias (Google Services, Analytics), te rechazarán.
    *   *Nota:* ShoppingList usa Capacitor. Si tienes plugins de Firebase o Google Analytics, debes quitarlos para F-Droid.

---

## 🚀 Resumen Rápido

| Tienda | Formato | Proceso | Coste |
| :--- | :--- | :--- | :--- |
| **Play Store** | `.aab` (Firmado) | Tú construyes y subes el archivo | $25 |
| **F-Droid** | Código Fuente (Git) | Ellos construyen desde tu GitHub | Gratis |
