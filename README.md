# <img src="web/public/icon.png" width="48" height="48" valign="middle"> ShoppingList

A modern, self-hosted shopping list application with real-time synchronization.

**Tech Stack:** Go (PocketBase) + React (Vite, TypeScript, TailwindCSS v4) + Docker

![ShoppingList Logo](web/public/icon.png)

![ShoppingList Screenshot](./docs/screenshot.png)

---

## 🚀 Quick Start

### Using Docker Hub (Recommended)

The easiest way to run ShoppingList is using the pre-built image from Docker Hub.

```bash
# Download the hub compose file
curl -O https://raw.githubusercontent.com/borborborja/shoppinglist/main/docker-compose.hub.yml

# Start the application
docker-compose -f docker-compose.hub.yml up -d
```

### Using Docker (Build from source)

If you have cloned the repository and want to build the images locally:

```bash
# Start the application (local build)
docker-compose up -d
```

**App Public:** [http://localhost:8090](http://localhost:8090)  
**App Admin:** [http://localhost:8090/admin](http://localhost:8090/admin) (Requires Admin Login)  
**System Admin (PocketBase):** [http://localhost:8090/_/](http://localhost:8090/_/)

---

## 👑 Admin Panel

The application includes a custom administration dashboard at `/admin` to manage the catalog and application state.

### Tabs & Features
- **📊 Listas**: Monitor all active shopping lists. Support for bulk selection and mass deletion.
- **📦 Categorías**: Manage the catalog structure.
    - Customize icon (emoji) and color.
    - Localize names (Catalan, Spanish, English).
    - **Bulk Actions**: Select multiple categories to Hide, Show, or Delete.
    - **Visibility Dependency**: Hiding a category automatically hides all its products from the catalog.
- **🛒 Productos**: Manage individual items.
    - Search by name and filter by category.
    - **Bulk Actions**: Hide/Show/Delete multiple products.
    - **Smart Locking**: Products belonging to a hidden category are forced-hidden and cannot be unhidden individually.
- **👥 Usuarios**: Manage administrator accounts.
- **⚙️ Configuración**: Global application settings.
    - **Server Name**: Set a custom name for your instance (displayed in the header).

---

## ⚙️ Configuration

### App Settings (via Admin UI)
You can change these via the `/admin` settings tab:
- **Server Name**: The name displayed in the top header for all users.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATA_DIR` | Database storage path | `/pb_data` |
| `SMTP_ENABLED` | Enable email sending | `false` |
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASSWORD` | SMTP password | - |
| `SMTP_SENDER_NAME` | Email sender name | `ShoppingList` |
| `SMTP_SENDER_ADDRESS` | Email sender address | `noreply@example.com` |

### Email Verification

To enable email verification for user registration:

1. Configure SMTP variables in `.env`
2. Set `SMTP_ENABLED=true`
3. Restart the container

---

## 🔧 Development

### Prerequisites

- Node.js 20+
- Go 1.23+

### Frontend

```bash
cd web
npm install
npm run dev  # http://localhost:5173
```

### Backend

```bash
go run cmd/server/main.go serve  # http://localhost:8090
```

---

## 🏗️ Building

### Docker Build

```bash
docker build -t shoppinglist .
```

### Manual Build

```bash
# Build frontend
cd web && npm install && npm run build && cd ..

# Build backend (embeds frontend)
go build -o shoppinglist ./cmd/server
```

---

## 🔄 GitHub Actions (CI/CD)

This repository includes a GitHub Actions workflow that automatically builds and pushes Docker images to Docker Hub.

### Required Secrets

Configure these in your GitHub repository settings (`Settings > Secrets > Actions`):

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token ([create one here](https://hub.docker.com/settings/security)) |

### Triggers

- **Push to main/master:** Builds and tags as `latest`
- **Push tags (v*):** Builds and tags with version
- **Manual:** Use "Run workflow" button

---

## 📱 Features

- ✅ **PWA Support** - Install as app on mobile/desktop
- ✅ **Offline Mode** - Works without internet
- ✅ **Real-time Sync** - Share lists with family
- ✅ **Multi-language** - Spanish, Catalan, English
- ✅ **Dark Mode** - Including AMOLED pure black
- ✅ **Custom Categories** - Create your own with emojis
- ✅ **Data Backup** - Export/Import JSON

---

## 📄 License

MIT
