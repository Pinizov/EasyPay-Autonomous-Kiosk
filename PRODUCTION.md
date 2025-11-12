# Production Deployment Guide (Free Tools)

This guide shows how to deploy the EasyPay Autonomous Kiosk using only free tools: Docker Desktop (Windows/macOS) or VS Code + Docker.

## 1) Prerequisites
- Docker Desktop (latest) with Docker Compose v2
- Git
- PowerShell (Windows) or bash (macOS/Linux)
- Optional: Visual Studio Code + Docker extension

## 2) Prepare Environment

1. Clone the repository
```powershell
git clone https://github.com/Pinizov/EasyPay-Autonomous-Kiosk.git
cd EasyPay-Autonomous-Kiosk
```

2. Create env file
```powershell
Copy-Item .env.example .env
# Edit .env with strong secrets and real API URLs
```

3. Place SSL certificates (for production HTTPS)
- Put `fullchain.pem` and `privkey.pem` into `nginx/ssl/`
- Or use a reverse proxy/load balancer that terminates TLS

## 3) Build Images (one-time)
```powershell
# Backend
docker build -f Dockerfile.backend -t easypay/backend:latest .

# Frontend (builds React and serves via nginx)
docker build -f frontend/Dockerfile -t easypay/frontend:latest ./frontend

# AI service
docker build -f ai_service/Dockerfile -t easypay/ai:latest ./ai_service
```

## 4) Start Stack (Production)
Docker Compose spins up Postgres, Redis, AI service, Backend, Frontend, and Nginx reverse proxy (when the production profile is enabled).

```powershell
# Start database/cache/core services
docker compose up -d postgres redis ai_service

# Start backend + frontend
docker compose up -d backend frontend

# Start Nginx reverse proxy (production only)
docker compose --profile production up -d nginx

# Check status
docker compose ps
```

Health checks:
```powershell
# Backend health
Invoke-WebRequest http://localhost:5000/health -UseBasicParsing

# Frontend
Start-Process http://localhost:3000
```

## 5) Logs & Maintenance
```powershell
# Tail logs
docker compose logs -f backend

# Restart a service
docker compose restart backend

# Update images
docker compose pull
docker compose up -d
```

## 6) VS Code (optional)
- Install extensions: Docker, Remote Development
- Open folder in VS Code
- Use "Docker" view to start/stop containers
- Use integrated terminal to run the same commands

## 7) CI/CD (GitHub Actions)
A workflow is provided at `.github/workflows/main.yml` to:
- Run tests
- Build container images
- Push to GHCR and/or Docker Hub (requires secrets)
- Deploy via SSH to a server (optional)

Set these repository secrets if you want full automation:
- DOCKER_USERNAME, DOCKER_PASSWORD
- PRODUCTION_HOST, PRODUCTION_USER, PRODUCTION_SSH_KEY, PRODUCTION_DOMAIN
- SLACK_WEBHOOK (optional)

## 8) Notes
- The reverse proxy config is at `nginx/nginx.conf`. It proxies `/api` to backend and serves the frontend build.
- SSL files live in `nginx/ssl/`.
- If you prefer another proxy (Caddy/Traefik/Cloud provider LB), disable the `nginx` service and point your proxy to `backend:5000` and `frontend:80` inside the Compose network or publish only one of them as needed.

## 9) Troubleshooting
- Containers not starting: `docker compose logs --no-log-prefix --since 10m <service>`
- Port conflicts: change published ports in `docker-compose.yml`
- SSL issues: verify certificate/key permissions and filenames
- DB connection: ensure Postgres is healthy and env vars match
