# -----------------------------------------------------------------------------
# Stage 1: Build Frontend (Node)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web

# Copy package files
COPY web/package*.json ./
RUN npm ci

# Copy source and build
COPY web/ .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Final Image with PocketBase
# -----------------------------------------------------------------------------
FROM alpine:latest

WORKDIR /app

# Install dependencies
RUN apk add --no-cache ca-certificates wget unzip

# Download and install PocketBase
ARG POCKETBASE_VERSION=0.22.21
ARG TARGETARCH
RUN wget -q https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip \
    && unzip pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip -d /app \
    && rm pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip \
    && chmod +x /app/pocketbase

# Copy frontend build to pb_public (PocketBase serves this automatically)
COPY --from=frontend-builder /app/web/dist /app/pb_public

# Copy migrations if they exist
COPY pb_migrations /app/pb_migrations

# Create data directory
RUN mkdir -p /pb_data

# Expose port
EXPOSE 8090

# Persistence Volume
VOLUME /pb_data

# Run PocketBase
CMD ["/app/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data"]
