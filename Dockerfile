# Multi-stage build for SACRED Bible Study App

# ===========================================
# Stage 1: Builder
# ===========================================
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source files
COPY . .

# Build frontend with Vite
RUN npm run build

# ===========================================
# Stage 2: Production
# ===========================================
FROM node:20-slim AS production

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only (skip postinstall which requires electron-builder)
RUN npm ci --omit=dev --ignore-scripts

# Rebuild better-sqlite3 for this environment
RUN npm rebuild better-sqlite3

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy server code
COPY server ./server

# Copy bundled data files (systematic theology and WEB Bible)
# These are optional - app works without them
COPY myfiles ./myfiles

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Default database path (can be overridden with volume mount)
ENV DB_PATH=/app/data/sacred.db

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server/index.cjs"]
