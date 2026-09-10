# Stage 1: Build production assets with Node.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Install clean production and build dependencies
RUN npm ci --legacy-peer-deps

# Copy application sources
COPY . .

# Build production bundle with TypeScript check
RUN npm run build

# Stage 2: Serve with lightweight, hardened Nginx Alpine
FROM nginx:alpine

# Remove default configuration
RUN rm -rf /etc/nginx/conf.d/* /etc/nginx/nginx.conf

# Copy hardened nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built static game assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Healthcheck to ensure container reliability
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
