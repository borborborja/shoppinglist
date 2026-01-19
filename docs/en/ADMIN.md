# 👑 Admin Panel

The Admin Panel allows you to manage all aspects of the server and the product catalog.

## 🔑 Access

You can access the panel via the `/admin` path in your browser.
- **URL**: `http://your-server/admin`
- **Authentication**: Requires a configured admin password.

---

## 📦 Catalog Management

### Categories
You can create categories to organize products. Each category has:
- **Name**: In three languages (ES, CA, EN).
- **Emoji**: A visual icon that helps identify the section quickly.
- **Color**: Used in UI borders and accents.
- **Aisle Order**: A number (0-100) that determines how products are sorted in the main list to optimize your route through the supermarket.

### Products
The master product catalog. When a user types a name, the app searches here to automatically assign the correct category.
- Supports translations in the three main languages.
- Products can be marked as "hidden" so they don't appear in search suggestions.

---

## ⚙️ System Configuration

In the **Settings** tab, you can configure:

- **Server Name**: The name that appears at the top of the app.
- **Backend-Only Mode**: If activated, the public web interface is disabled, serving only as a server for mobile apps. Useful for increased privacy.
- **User Management**: See who is connected and manage who has access.
- **Import/Export**: Allows you to download a backup of your entire catalog in JSON format and restore it easily.

---

## 🔄 Updates

The panel includes a **Version Checker**:
1. Compares your current version with the latest available in the GitHub repository.
2. If there is an update, it will show you a notice and the release notes (Changelog).

---

## 🛠 Database and Migrations

ShoppingList uses PocketBase as its engine. Data is saved in the `pb_data/` folder.
- **Backups**: It is recommended to make periodic backups of this folder.
- **Migrations**: Never delete the `pb_migrations/` folder, as it contains the necessary structure for the server to function.
