## 🧪 Testing

### Backend Tests

```bash
# Run all backend tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Frontend Tests


## 🚀 Production Deployment

Two free options:
- Docker Desktop (recommended)
- VS Code + Docker extension

Quick start (Windows PowerShell):

```powershell
# 1) Configure environment
```bash
cd frontend

# Run React component tests
npm test

# Run with coverage
npm test -- --coverage
```

### Test Coverage

- **Authentication**: User registration, 3FA login, session management
- **Deposits**: Amount validation, balance updates
- **Transfers**: SEPA transfers, IBAN validation, insufficient funds
- **Bill Payments**: Provider selection, payment processing
- **Validation**: EGN checksum, IBAN format
- **EasyPay API**: Mock integration, retry logic, error handling

Nginx reverse proxy configuration is provided in `nginx/nginx.conf`. Place SSL certs in `nginx/ssl/` (fullchain.pem, privkey.pem) or terminate TLS upstream.

See PRODUCTION.md for full details, CI/CD, and troubleshooting.

- **UI Components**: LoginScreen, MainMenu, DepositScreen, TransferScreen

See [TESTING.md](TESTING.md) for comprehensive testing guide.

---

# 🏦 EasyPay Autonomous Kiosk - Production System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)

Пълна production-ready система за автономна 24/7 EasyPay каса с 3-факторна автентикация, SEPA преводи и плащане на сметки.

## ✨ Характеристики

### 🔐 Сигурност
- **3-факторна верификация**: ЕГН + PIN + Face Recognition
- OAuth 2.0 + JWT authentication
- AES-256 encryption
- SQL injection защита
- Rate limiting & CORS

### 💰 Финансови Операции
- Депозити в брой
- SEPA преводи
- Плащане на сметки (ток, вода, телекомуникации)
- Real-time баланс updates
- Пълна история на транзакции

### 🎯 UI/UX
- Touch-screen optimized за 27" дисплеи
- Face recognition с live camera
- Интуитивен български интерфейс
- Auto-logout след inactivity

## 🚀 Бърз Старт

```bash
# Clone repository
git clone https://github.com/Pinizov/EasyPay-Autonomous-Kiosk.git
cd EasyPay-Autonomous-Kiosk

# Конфигурация
cp .env.example .env
# Редактирайте .env с вашите стойности

# Стартиране с Docker
docker-compose up -d

# Проверка
curl http://localhost:5000/health
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Регистрация с 3FA
- `POST /api/auth/verify` - Login с ЕГН + PIN + Face
- `POST /api/auth/logout` - Logout

### Transactions
- `POST /api/deposits/record` - Депозит
- `POST /api/transfers/send` - SEPA превод
- `POST /api/bills/pay` - Плащане на сметка
- `GET /api/transactions/history` - История

### Admin
- `GET /api/admin/stats` - Dashboard статистики
- `GET /api/admin/audit-logs` - Audit logs

## 🛠 Технологии

**Backend**: Node.js, Express, PostgreSQL, Redis  
**Frontend**: React, React Router, Axios, Webcam  
**AI**: Python, Flask, face_recognition, dlib  
**DevOps**: Docker, Nginx, Docker Compose

## 📦 Project Structure

```
├── src/                    # Backend (Node.js)
│   ├── config/            # Database, Redis, Logger
│   ├── middleware/        # Auth, Security, Validation
│   ├── routes/            # API endpoints
│   └── services/          # Business logic
├── frontend/              # React UI
│   └── src/components/    # Touch-screen components
├── ai_service/            # Python Face Recognition
├── db/schema.sql          # PostgreSQL schema
└── docker-compose.yml     # Infrastructure
```

## 🔒 Сигурност

- ✅ HTTPS/TLS encryption
- ✅ JWT token authentication
- ✅ AES-256 data encryption
- ✅ Bcrypt password hashing
- ✅ SQL injection prevention
- ✅ XSS & CSRF protection
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Face recognition biometrics

## 🚢 Production Deployment

```bash
# Setup SSL
sudo certbot --nginx -d yourdomain.com

# Start with production profile
docker-compose --profile production up -d

# Monitor logs
docker-compose logs -f
```

## 📞 Support

**Logs**: `logs/combined.log`, `logs/error.log`  
**Health**: `curl http://localhost:5000/health`  
**Database Backup**: `docker exec easypay_postgres pg_dump`

## 📄 License

MIT License

---

**Made with ❤️ for autonomous financial services**
 
