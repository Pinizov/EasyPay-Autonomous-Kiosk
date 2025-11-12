# EasyPay Autonomous Kiosk

## Features

- Node.js/Express backend (JWT, OAuth2, PostgreSQL, Redis)
- 3FA login (EGN, PIN, Face Recognition)
- EasyPay API integration (SEPA, bills)
- Python AI microservice for face
- Frontend: React, touchscreen/full accessibility
- Full Docker deployment with SSL, Nginx, config via .env

## Deployment

1. Copy `.env.example` → `.env`
2. Fill in real credentials
3. `docker-compose up --build`
4. Access:
    - Backend: http://localhost:5000
    - Frontend: http://localhost:3000
    - AI face: http://localhost:8000
    - Health: /health

## Database

- Tables: users, transactions, audit_log (PostgreSQL)
- Migrations in `db/schema.sql`

## API Endpoints

- `/api/auth/register` — Register user (EGN, PIN, face)
- `/api/auth/verify` — 3FA login
- `/api/deposits/record` — Record deposit
- `/api/transfers/send` — Transfer money
- `/api/bills/pay` — Pay bill
- `/api/admin/stats` — Admin dashboard

## Security

- AES-256, bcryptjs, SQLi prevention, rate limiting, CORS

## Tests

- Jest for backend, pytest for AI face

---
