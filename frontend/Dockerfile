FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./

ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_DATA_SERVICE_URL=http://localhost:8090
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DATA_SERVICE_URL=$VITE_DATA_SERVICE_URL

RUN npm run build

# ── Serve with nginx ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

RUN apk add --no-cache curl

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback — all routes serve index.html
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
