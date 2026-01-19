# 🤖 Aplicación Android (Capacitor)

Este documento explica cómo gestionar y compilar la aplicación nativa para Android.

## 🏗 Estructura del Proyecto

Usamos **Capacitor** para envolver la aplicación web en un contenedor nativo.
- El proyecto de Android reside en la carpeta `web/android/`.
- La configuración de Capacitor está en `web/capacitor.config.ts`.

## 🛠 Preparación del Entorno

1.  Asegúrate de tener instalado **Android Studio**.
2.  Instala las dependencias en la carpeta `web/`:
    ```bash
    npm install
    ```
3.  Genera el build de la web:
    ```bash
    npm run build
    ```
4.  Sincroniza con el proyecto nativo:
    ```bash
    npx cap sync android
    ```

## 🚀 Compilación y Ejecución

Para abrir el proyecto en Android Studio:
```bash
npx cap open android
```

Desde Android Studio puedes:
- Ejecutar la app en un emulador o dispositivo real.
- Generar un **APK** para pruebas.
- Generar un **AAB** (App Bundle) para subir a la Play Store.

## 🔑 Firma de la Aplicación (Release)

Para publicar la app, debe estar firmada.

1.  **Generar Keystore**:
    ```bash
    keytool -genkey -v -keystore my-release-key.keystore -alias shoppinglist -keyalg RSA -keysize 2048 -validity 10000
    ```
2.  **Configurar Build**:
    En Android Studio, ve a `Build > Generate Signed Bundle / APK`.

> [!IMPORTANT]
> Para más detalles sobre el proceso de publicación en tiendas (Google Play, F-Droid), consulta la guía específica: **[STORE_PUBLISHING.md](STORE_PUBLISHING.md)**.

## 🔄 Sincronización de Cambios

Cada vez que modifiques el código en `web/src/`, debes seguir estos pasos para ver los cambios en Android:
1. `npm run build`
2. `npx cap copy android`
