# 📱 Aplicación Web y PWA

**ShoppingList** está diseñada como una Aplicación Web Progresiva (PWA), lo que permite usarla como una aplicación nativa en el móvil o escritorio desde el navegador.

## ✨ Características Técnicas

- **Framework**: React 18 con TypeScript.
- **Build Tool**: Vite.
- **Estado**: Zustand (gestión ligera y persistente).
- **Estilos**: TailwindCSS con soporte para temas.

## 📶 Modo Offline y Sincronización

La aplicación utiliza estrategias de **Offline-First**:

1.  **Cache**: Los recursos estáticos se cachean mediante un Service Worker (vía Vite PWA Plugin).
2.  **Persistencia Local**: El estado de la lista de la compra se guarda en `localStorage` mediante Zustand.
3.  **Sincronización Eficiente**: 
    - Cuando estás conectado, los cambios se envían a PocketBase vía WebSockets/SSE.
    - Cuando estás offline, puedes seguir usando la app. Los cambios se sincronizarán la próxima vez que abras la app con conexión.

## 🎨 Temas y Personalización

Soportamos múltiples modos visuales configurables desde los ajustes:

- **Claro / Oscuro**: Basado en las preferencias del sistema o forzado manualmente.
- **AMOLED**: Un modo negro puro optimizado para pantallas OLED.
- **Multi-idioma**: Traducciones integradas para Castellano, Catalán e Inglés.

## 🏠 Instalación como PWA

### En Android (Chrome)
1. Abre la URL de tu instancia.
2. Pulsa en los tres puntos (menú).
3. Selecciona **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**.

### En iOS (Safari)
1. Abre la URL en Safari.
2. Pulsa el botón **Compartir** (cuadrado con flecha).
3. Selecciona **"Añadir a la pantalla de inicio"**.

---

## 🛠 Desarrollo de la Web

Si quieres modificar el frontend:

- El punto de entrada es `web/src/main.tsx`.
- Las vistas están en `web/src/components/views/`.
- Los componentes compartidos en `web/src/components/common/`.
- La lógica de datos reside en `web/src/store/shopStore.ts`.
