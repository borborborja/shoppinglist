<p align="center">
  <img src="../banner.png" alt="ShoppingList Banner" width="100%">
</p>

# ShoppingList

<p align="center">
  <img src="https://img.shields.io/github/v/release/borborborja/shoppinglist?style=flat-square&color=blue" alt="Latest Release">
  <img src="https://img.shields.io/docker/pulls/borborbor/shoppinglist?style=flat-square&color=blue" alt="Docker Pulls">
  <img src="https://img.shields.io/badge/pwa-supported-purple?style=flat-square" alt="PWA Supported">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
</p>

**ShoppingList** is a modern, self-hostable shopping list application designed for speed. It syncs in real-time across all your family's devices, works offline, and offers a first-class visual experience.

---

## 📚 Documentation

For detailed information on specific parts of the project, consult the following documents:

*   🚀 **[Installation](SETUP.md)**: Step-by-step guide to setting up your development environment and deploying the server.
*   📱 **[Web App / PWA](WEB.md)**: Web client features, offline mode, and synchronization.
*   👑 **[Admin Panel](ADMIN.md)**: How to manage the catalog, users, and server settings.
*   🤖 **[Android App](ANDROID.md)**: Build, signing, and store publishing process.
*   🏗️ **[Architecture](ARCHITECTURE.md)**: Technical details about the stack, data model, and information flow.
*   📖 **[API & Database](API.md)**: The "Bible" for external developers who want to connect to the server.

---

## ✨ Key Features

### 📱 For Users
*   **Real-time Sync**: Changes appear instantly on all connected devices.
*   **Offline Mode (PWA)**: Works perfectly without a connection. Changes are saved and synced when internet returns.
*   **Smart Sorting**: Products are automatically sorted by category (Greengrocer, Frozen, etc.) to optimize your route in the supermarket.
*   **Visual Themes**:
    *   ☀️ **Light**: Fresh and clean.
    *   🌑 **Dark**: Elegant and easy on the eyes.
    *   🖤 **AMOLED**: Pure black to save battery on OLED screens.
    *   🤖 **Auto**: Adapts to your system.
*   **Multi-language**: Spanish 🇪🇸, Catalan 🏴, English 🇬🇧.
*   **Native Apps**: Support for Android and iOS via Capacitor.

### 👑 Admin Panel (`/admin`)
Manage your instance with a powerful integrated control panel.

*   **📦 Catalog Management**:
    *   Create, edit, and delete categories with custom emojis and colors.
    *   Manage products and their translations.
    *   **Batch Actions**: Select multiple items to delete or hide quickly.
*   **👥 User Management (Beta)**:
    *   Control who is connected to your list through the Presence system.
*   **🔒 Security and Configuration**:
    *   Change server name.
    *   Change admin password.
    *   **New: Backend-Only Mode**: Deactivate the public web with one click to use the server only as an API for mobile apps.
    *   **Import/Export**: Full backups of your catalog in JSON.
*   **🔄 Updates**:
    *   Integrated version checker: Notifies you if there is a new version on GitHub.

---

## 🚀 Quick Deployment

### Option 1: Docker Hub (Recommended)

The easiest way to start. Automatically updated with GitHub Actions.

```bash
# 1. Download the docker-compose file
curl -O https://raw.githubusercontent.com/borborborja/shoppinglist/main/docker-compose.hub.yml

# 2. Start the service
docker-compose -f docker-compose.hub.yml up -d
```

### Option 2: Build from Source

If you prefer to build your own image:

```bash
git clone https://github.com/borborborja/shoppinglist.git
cd shoppinglist
docker-compose up -d --build
```

---

## 🛠 Tech Stack

This application uses a modern and efficient stack:

*   **Backend**: [PocketBase](https://pocketbase.io/) (Go) - Real-time database, Auth, and API in a single binary.
*   **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) - Fast and reactive.
*   **Styles**: [TailwindCSS](https://tailwindcss.com/) - Modern and responsive design.
*   **Mobile**: [Capacitor](https://capacitorjs.com/) - Turns the web into native Android and iOS apps.
*   **Infrastructure**: Docker + GitHub Actions.

---

## ⚙️ Environment Variables

You can configure these variables in your `docker-compose.yml`:

| Variable | Description | Default Value |
|----------|-------------|-------------------|
| `DATA_DIR` | DB files | `/pb_data` |
| `SMTP_ENABLED` | Enable emails | `false` |
| `SMTP_HOST` | SMTP Server | - |
| `SMTP_PORT` | SMTP Port | `587` |
| `SMTP_USER` | SMTP User | - |
| `SMTP_PASSWORD` | SMTP Password | - |

---

## 📄 License

This project is under the [MIT](LICENSE) license. Feel free to fork, modify, and use it.

---
<p align="center">
  <sub>Made with ❤️ and a lot of caffeine.</sub>
</p>
