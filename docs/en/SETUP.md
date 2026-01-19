# 🚀 Installation and Development Guide

This document details how to configure your local environment to develop or deploy **ShoppingList**.

## 📋 Prerequisites

Ensure you have the following components installed:

- **Go** (v1.21 or higher) - For the backend (PocketBase).
- **Node.js** (v18 or higher) and **npm** - For the frontend (React + Vite).
- **Docker** and **Docker Compose** - For container deployment.
- **Android Studio** (Optional) - If you are going to build the application for Android.

---

## 💻 Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/borborborja/shoppinglist.git
cd shoppinglist
```

### 2. Configure the Backend (PocketBase)

The backend is a single binary written in Go.

```bash
# Download dependencies
go mod download

# Run the server in development mode
go run main.go serve
```

The PocketBase panel will be available at: `http://127.0.0.1:8090/_/`

### 3. Configure the Frontend (Web)

```bash
cd web

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

The web application will be available at: `http://localhost:5173`

---

## 🐳 Docker Deployment

### Using Docker Hub (Recommended)

If you only want to use the application, use the following `docker-compose.yml`:

```yaml
version: '3.8'
services:
  shoppinglist:
    image: borborbor/shoppinglist:latest
    container_name: shoppinglist
    ports:
      - "8090:8090"
    volumes:
      - ./pb_data:/pb_data
    restart: unless-stopped
```

Run: `docker-compose up -d`

---

## ⚙️ Advanced Configuration

### Environment Variables

You can create a `.env` file in the root (for Docker) or in the `web/` folder (for Vite):

| Variable | Description | Default Value |
|----------|-------------|-------------------|
| `DATA_DIR` | DB location (SQLite) | `./pb_data` |
| `VITE_API_URL` | PocketBase API URL | `http://localhost:8090` |
| `PORT` | Server port | `8090` |

---

## 💾 Migrations

The database is managed through migrations in `pb_migrations/`. PocketBase will apply them automatically at startup.

If you add new migrations through the administration panel, you can generate them locally:
```bash
./pocketbase migrate collections
```
