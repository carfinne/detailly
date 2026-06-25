# =============================================================
# Detailly - Single-App Multi-stage Dockerfile
# Build-Kontext = Repo-Wurzel (docker-compose: context: .), weil das Frontend
# unter ../frontend liegt und in dasselbe Image (client/) gebaut wird.
#
# Betriebsmodell: Das NestJS-Backend liefert den statischen Next.js-Export
# unter client/ aus -> EIN Container, EINE Origin. Kein getrennter Frontend-
# Container.
# =============================================================

# ---- Stage 1: Frontend-Build (statischer Export -> frontend/out) ----
FROM node:20-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
# erzeugt frontend/out (next.config.js: output:'export')
RUN npm run build

# ---- Stage 2: Backend-Build (NestJS -> dist) ----
FROM node:20-bookworm-slim AS backend-build
WORKDIR /app/backend
# build-essential + python3, weil better-sqlite3 nativ kompiliert wird.
# Im Image (Debian/Node20) baut better-sqlite3 sauber - das ist NUR lokal
# (Windows/Node24) heikel. Daher hier KEIN --ignore-scripts.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build
# Frontend-Export ins client/-Verzeichnis (entspricht build:client)
COPY --from=frontend /app/frontend/out ./client

# ---- Stage 3: Runtime ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
# native better-sqlite3-Build laeuft IM Container (Linux/Node20) - nicht das
# heikle lokale Windows/Node24. Daher bewusst KEIN --ignore-scripts.
RUN npm install --omit=dev
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/client ./client
# Backup-Skript verfuegbar machen (POSIX, laeuft via System-Cron im Container)
COPY scripts ./scripts
# Persistenz fuer SQLite-Datei + Foto-Uploads (oeffentlich + DSGVO-privat)
RUN mkdir -p uploads private-uploads && chown -R node:node /app/backend
# Nicht als root laufen: das node:20-Image bringt den unprivilegierten 'node'-User.
USER node
EXPOSE 3001
CMD ["node", "dist/main"]
