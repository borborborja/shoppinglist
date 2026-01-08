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
# Stage 2: Build Backend (Go)
# -----------------------------------------------------------------------------
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy Go module files
COPY go.mod ./
RUN go mod tidy

# Copy main.go from project root
COPY main.go ./

# Copy built frontend assets to web/dist (as expected by embed)
COPY --from=frontend-builder /app/web/dist ./web/dist

# Build static binary
RUN CGO_ENABLED=0 go build \
    -ldflags="-s -w" \
    -o /shoplist \
    ./main.go

# -----------------------------------------------------------------------------
# Stage 3: Final Image 
# -----------------------------------------------------------------------------
FROM alpine:latest

WORKDIR /app

# Install CA certificates for HTTPS
RUN apk add --no-cache ca-certificates

# Copy binary
COPY --from=backend-builder /shoplist /app/shoplist

# Create data directory
RUN mkdir /pb_data

# Expose port
EXPOSE 8090

# Persistence Volume
VOLUME /pb_data

# Run
CMD ["/app/shoplist", "serve", "--http=0.0.0.0:8090"]
