# <img src="web/public/icon.png" width="48" height="48" valign="middle"> ShopList

A modern, self-hosted shopping list application with real-time synchronization.

**Tech Stack:** Go (PocketBase) + React (Vite, TypeScript, TailwindCSS v4) + Docker

![ShopList Logo](web/public/icon.png)

![ShopList Screenshot](./docs/screenshot.png)

---

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/llista_compra.git
cd llista_compra

# Copy environment file and configure (optional)
cp .env.example .env

# Start the application
docker-compose up -d
```

**Access the app:** http://localhost:8090  
**Admin Panel:** http://localhost:8090/_/

---

## 📦 Docker Hub

Pre-built images are available on Docker Hub:

```bash
docker pull YOUR_USERNAME/llista_compra:latest
docker run -d -p 8090:8090 -v shoplist_data:/pb_data YOUR_USERNAME/llista_compra:latest
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATA_DIR` | Database storage path | `/pb_data` |
| `SMTP_ENABLED` | Enable email sending | `false` |
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASSWORD` | SMTP password | - |
| `SMTP_SENDER_NAME` | Email sender name | `ShopList` |
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
docker build -t shoplist .
```

### Manual Build

```bash
# Build frontend
cd web && npm install && npm run build && cd ..

# Build backend (embeds frontend)
go build -o shoplist ./cmd/server
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
