# 🚀 Guía de Instalación y Desarrollo

Este documento detalla cómo configurar tu entorno local para desarrollar o desplegar **ShoppingList**.

## 📋 Requisitos Previos

Asegúrate de tener instalados los siguientes componentes:

- **Go** (v1.21 o superior) - Para el backend (PocketBase).
- **Node.js** (v18 o superior) y **npm** - Para el frontend (React + Vite).
- **Docker** y **Docker Compose** - Para despliegue en contenedores.
- **Android Studio** (Opcional) - Si vas a compilar la aplicación para Android.

---

## 💻 Desarrollo Local

### 1. Clonar el Repositorio

```bash
git clone https://github.com/borborborja/shoppinglist.git
cd shoppinglist
```

### 2. Configurar el Backend (PocketBase)

El backend es un único binario escrito en Go.

```bash
# Descargar dependencias
go mod download

# Ejecutar el servidor en modo desarrollo
go run main.go serve
```

El panel de PocketBase estará disponible en: `http://127.0.0.1:8090/_/`

### 3. Configurar el Frontend (Web)

```bash
cd web

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo de Vite
npm run dev
```

La aplicación web estará disponible en: `http://localhost:5173`

---

## 🐳 Despliegue con Docker

### Usando Docker Hub (Recomendado)

Si solo quieres usar la aplicación, utiliza el siguiente `docker-compose.yml`:

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

Ejecuta: `docker-compose up -d`

---

## ⚙️ Configuración Avanzada

### Variables de Entorno

Puedes crear un archivo `.env` en la raíz (para Docker) o en la carpeta `web/` (para Vite):

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `DATA_DIR` | Ubicación de la BBDD (SQLite) | `./pb_data` |
| `VITE_API_URL` | URL de la API de PocketBase | `http://localhost:8090` |
| `PORT` | Puerto del servidor | `8090` |

---

## 💾 Migraciones

La base de datos se gestiona mediante migraciones en `pb_migrations/`. PocketBase las aplicará automáticamente al arrancar.

Si añades nuevas migraciones mediante el panel de administración, puedes generarlas localmente:
```bash
./pocketbase migrate collections
```
