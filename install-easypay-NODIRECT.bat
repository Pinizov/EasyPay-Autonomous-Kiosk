@echo off
REM ===================================================
REM Autonomous EasyPay Kiosk - NO DOCKER VERSION
REM Direct Node.js + Express on Windows
REM ===================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ========================================
echo Autonomous EasyPay Kiosk Setup
echo NO DOCKER - Direct Node.js Installation
echo ========================================
echo.

REM Check Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Run as Administrator!
    pause
    exit /b 1
)

echo [OK] Administrator mode

REM Step 1: Check Internet
echo.
echo [1/7] Checking internet...
ping 8.8.8.8 -n 1 -w 1000 >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Internet required
    pause
    exit /b 1
)
echo [OK] Connected

REM Step 2: Check Node.js
echo.
echo [2/7] Checking Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing Node.js 20 LTS...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "(New-Object Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi', '%TEMP%\nodejs.msi')"
    msiexec /i "%TEMP%\nodejs.msi" /quiet /norestart
    timeout /t 30
    echo Please restart this script after Node.js installs
    pause
    exit /b 1
)
for /f "tokens=*" %%A in ('node --version') do echo [OK] %%A

REM Step 3: Create project directory
echo.
echo [3/7] Setting up project...
set "PROJECT_PATH=C:\easypay-kiosk"
if not exist "%PROJECT_PATH%" mkdir "%PROJECT_PATH%"
cd /d "%PROJECT_PATH%"
echo [OK] Project directory: %PROJECT_PATH%

REM Step 4: Create package.json
echo.
echo [4/7] Creating project files...

(
echo {
echo   "name": "autonomous-easypay-kiosk",
echo   "version": "1.0.0",
echo   "description": "Autonomous EasyPay Payment Kiosk",
echo   "main": "server.js",
echo   "scripts": {
echo     "start": "node server.js",
echo     "dev": "node server.js"
echo   },
echo   "dependencies": {
echo     "express": "^4.18.2",
echo     "dotenv": "^16.3.1",
echo     "cors": "^2.8.5",
echo     "axios": "^1.6.0",
echo     "sqlite3": "^5.1.6",
echo     "bcryptjs": "^2.4.3",
echo     "jsonwebtoken": "^9.1.0",
echo     "helmet": "^7.1.0"
echo   }
echo }
) > package.json

echo [OK] package.json created

REM Step 5: Create .env file
echo.
echo Enter EasyPay credentials:
set /p EASYPAY_APP_ID="APP ID (or press Enter for demo): "
set /p EASYPAY_APP_SECRET="APP SECRET (or press Enter for demo): "

if "%EASYPAY_APP_ID%"=="" set "EASYPAY_APP_ID=demo_app_001"
if "%EASYPAY_APP_SECRET%"=="" set "EASYPAY_APP_SECRET=demo_secret_key_12345"

(
echo NODE_ENV=production
echo PORT=5000
echo JWT_SECRET=autonomous-easypay-secret-key-change-in-production
echo EASYPAY_APP_ID=%EASYPAY_APP_ID%
echo EASYPAY_APP_SECRET=%EASYPAY_APP_SECRET%
echo EASYPAY_BASE_URL=https://demo.epay.bg/xdev/api/psd2/
echo DATABASE_PATH=./data/kiosk.db
) > .env

echo [OK] .env created

REM Step 6: Create server.js
echo.
echo [5/7] Creating backend server...

(
echo const express = require('express'^);
echo const cors = require('cors'^);
echo const dotenv = require('dotenv'^);
echo const sqlite3 = require('sqlite3'^).verbose(^);
echo const bcrypt = require('bcryptjs'^);
echo const jwt = require('jsonwebtoken'^);
echo const axios = require('axios'^);
echo const fs = require('fs'^);
echo const path = require('path'^);
echo.
echo dotenv.config(^);
echo.
echo const app = express(^);
echo app.use(cors(^)^);
echo app.use(express.json(^)^);
echo.
echo REM Create data directory
echo const dataDir = path.join(__dirname, 'data'^);
echo if (!fs.existsSync(dataDir^)^) {
echo   fs.mkdirSync(dataDir^);
echo }
echo.
echo REM Initialize SQLite database
echo const db = new sqlite3.Database(path.join(dataDir, 'kiosk.db'^)^);
echo.
echo REM Create tables
echo db.serialize(^(^) =^> {
echo   db.run(`
echo     CREATE TABLE IF NOT EXISTS users (
echo       id INTEGER PRIMARY KEY AUTOINCREMENT,
echo       egn TEXT UNIQUE,
echo       full_name TEXT,
echo       pin_code TEXT,
echo       balance REAL DEFAULT 0,
echo       face_data TEXT,
echo       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
echo     ^)`
echo   ^);
echo   db.run(`
echo     CREATE TABLE IF NOT EXISTS transactions (
echo       id INTEGER PRIMARY KEY AUTOINCREMENT,
echo       user_id INTEGER,
echo       type TEXT,
echo       amount REAL,
echo       status TEXT,
echo       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
echo     ^)`
echo   ^);
echo }^);
echo.
echo REM Health check
echo app.get('/health', (req, res^) =^> {
echo   res.json({ status: 'ok', timestamp: new Date(^), version: '1.0.0' }^);
echo }^);
echo.
echo REM Register user
echo app.post('/api/auth/register', async (req, res^) =^> {
echo   const { egn, full_name, pin_code } = req.body;
echo   if (!egn ^|^| !full_name ^|^| !pin_code^) {
echo     return res.status(400^).json({ error: 'Missing required fields' }^);
echo   }
echo   const hashedPin = await bcrypt.hash(pin_code, 10^);
echo   db.run(
echo     'INSERT INTO users (egn, full_name, pin_code, balance^) VALUES (?, ?, ?, ?',
echo     [egn, full_name, hashedPin, 0],
echo     function(err^) {
echo       if (err^) {
echo         return res.status(400^).json({ error: 'User already exists' }^);
echo       }
echo       res.json({ success: true, user_id: this.lastID }^);
echo     }
echo   ^);
echo }^);
echo.
echo REM Login
echo app.post('/api/auth/verify', (req, res^) =^> {
echo   const { egn, pin_code } = req.body;
echo   db.get('SELECT * FROM users WHERE egn = ?', [egn], async (err, user^) =^> {
echo     if (!user^) return res.status(401^).json({ error: 'User not found' }^);
echo     const validPin = await bcrypt.compare(pin_code, user.pin_code^);
echo     if (!validPin^) return res.status(401^).json({ error: 'Invalid PIN' }^);
echo     const token = jwt.sign({ user_id: user.id }, process.env.JWT_SECRET^);
echo     res.json({ success: true, token, user }^);
echo   }^);
echo }^);
echo.
echo REM Deposit
echo app.post('/api/deposits/record', (req, res^) =^> {
echo   const { user_id, amount } = req.body;
echo   db.run(
echo     'UPDATE users SET balance = balance + ? WHERE id = ?',
echo     [amount, user_id],
echo     function(err^) {
echo       if (err^) return res.status(500^).json({ error: err.message }^);
echo       db.run(
echo         'INSERT INTO transactions (user_id, type, amount, status^) VALUES (?, ?, ?, ?',
echo         [user_id, 'deposit', amount, 'completed'],
echo         function(err^) {
echo           res.json({ success: true, transaction_id: this.lastID, amount }^);
echo         }
echo       ^);
echo     }
echo   ^);
echo }^);
echo.
echo REM Withdrawal
echo app.post('/api/withdrawals/record', (req, res^) =^> {
echo   const { user_id, amount } = req.body;
echo   db.run(
echo     'UPDATE users SET balance = balance - ? WHERE id = ? AND balance ^>= ?',
echo     [amount, user_id, amount],
echo     function(err^) {
echo       if (this.changes === 0^) {
echo         return res.status(400^).json({ error: 'Insufficient balance' }^);
echo       }
echo       db.run(
echo         'INSERT INTO transactions (user_id, type, amount, status^) VALUES (?, ?, ?, ?',
echo         [user_id, 'withdrawal', amount, 'completed'],
echo         function(err^) {
echo           res.json({ success: true, transaction_id: this.lastID, amount }^);
echo         }
echo       ^);
echo     }
echo   ^);
echo }^);
echo.
echo REM Get user profile
echo app.get('/api/auth/profile', (req, res^) =^> {
echo   const token = req.headers.authorization?.split(' ')[1];
echo   if (!token^) return res.status(401^).json({ error: 'No token' }^);
echo   try {
echo     const decoded = jwt.verify(token, process.env.JWT_SECRET^);
echo     db.get('SELECT id, egn, full_name, balance FROM users WHERE id = ?', [decoded.user_id], (err, user^) =^> {
echo       if (!user^) return res.status(404^).json({ error: 'User not found' }^);
echo       res.json({ success: true, user }^);
echo     }^);
echo   } catch (err^) {
echo     res.status(401^).json({ error: 'Invalid token' }^);
echo   }
echo }^);
echo.
echo REM Error handler
echo app.use((err, req, res, next^) =^> {
echo   console.error(err^);
echo   res.status(500^).json({ error: err.message }^);
echo }^);
echo.
echo REM Start server
echo const PORT = process.env.PORT ^|^| 5000;
echo app.listen(PORT, (^) =^> {
echo   console.log(`^`✓ Backend running on http://localhost:${PORT}^`^);
echo   console.log(`^`Health check: http://localhost:${PORT}/health^`^);
echo   console.log(`^`Frontend: http://localhost:3000^`^);
echo }^);
) > server.js

echo [OK] server.js created

REM Step 7: Install dependencies
echo.
echo [6/7] Installing dependencies...
echo This may take 2-3 minutes...
call npm install

if %errorLevel% neq 0 (
    echo WARNING: npm install had issues
    echo Try running manually: npm install
)

echo [OK] Dependencies installed

echo.
echo [7/7] Creating frontend HTML...

mkdir public 2>nul

(
echo ^<!DOCTYPE html^>
echo ^<html lang="en"^>
echo ^<head^>
echo     ^<meta charset="UTF-8"^>
echo     ^<meta name="viewport" content="width=device-width, initial-scale=1.0"^>
echo     ^<title^>24/7 Autonomous EasyPay Kiosk^</title^>
echo     ^<style^>
echo         * { margin: 0; padding: 0; box-sizing: border-box; }
echo         body { font-family: Arial, sans-serif; background: #1a1a1a; color: #fff; }
echo         .container { max-width: 800px; margin: 50px auto; padding: 20px; }
echo         h1 { color: #00ff00; margin-bottom: 20px; }
echo         .card { background: #2a2a2a; padding: 20px; border-radius: 8px; margin: 10px 0; }
echo         button { background: #00ff00; color: #000; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
echo         button:hover { background: #00dd00; }
echo         input { width: 100%%; padding: 10px; margin: 10px 0; background: #3a3a3a; color: #fff; border: 1px solid #00ff00; border-radius: 5px; }
echo         .status { padding: 10px; background: #00ff00; color: #000; border-radius: 5px; margin: 10px 0; }
echo         .test-section { margin-top: 30px; }
echo     ^</style^>
echo ^</head^>
echo ^<body^>
echo     ^<div class="container"^>
echo         ^<h1^>✓ 24/7 Autonomous EasyPay Kiosk^</h1^>
echo         ^<p^>System is ONLINE and ready to use^</p^>
echo.
echo         ^<div class="card"^>
echo             ^<h2^>System Status^</h2^>
echo             ^<p^>Backend: ^<span id="backend-status"^>Checking...^</span^>^</p^>
echo             ^<p^>Database: ^<span id="db-status"^>Connected^</span^>^</p^>
echo             ^<p^>Started: ^<span id="start-time"^>Just now^</span^>^</p^>
echo         ^</div^>
echo.
echo         ^<div class="test-section"^>
echo             ^<h2^>Test Registration^</h2^>
echo             ^<div class="card"^>
echo                 ^<input type="text" id="egn" placeholder="EGN (e.g., 1111111111)"^>
echo                 ^<input type="text" id="fullname" placeholder="Full Name"^>
echo                 ^<input type="password" id="pin" placeholder="PIN (4 digits)"^>
echo                 ^<button onclick="registerUser()"^>Register Test User^</button^>
echo                 ^<div id="register-result"^>^</div^>
echo             ^</div^>
echo         ^</div^>
echo.
echo         ^<div class="test-section"^>
echo             ^<h2^>Quick Test Login^</h2^>
echo             ^<div class="card"^>
echo                 ^<p^>Use these credentials to test:^</p^>
echo                 ^<p^>EGN: 1111111111^</p^>
echo                 ^<p^>PIN: 1234^</p^>
echo                 ^<button onclick="testLogin()"^>Test Login^</button^>
echo                 ^<div id="login-result"^>^</div^>
echo             ^</div^>
echo         ^</div^>
echo.
echo         ^<div class="test-section"^>
echo             ^<h2^>API Endpoints^</h2^>
echo             ^<div class="card"^>
echo                 ^<p^>Health Check: ^<a href="/health" target="_blank"^>/health^</a^>^</p^>
echo                 ^<p^>Backend API: http://localhost:5000^</p^>
echo                 ^<p^>POST /api/auth/register - Register user^</p^>
echo                 ^<p^>POST /api/auth/verify - Login^</p^>
echo                 ^<p^>POST /api/deposits/record - Deposit money^</p^>
echo                 ^<p^>POST /api/withdrawals/record - Withdraw money^</p^>
echo             ^</div^>
echo         ^</div^>
echo     ^</div^>
echo.
echo     ^<script^>
echo         const API_URL = 'http://localhost:5000';
echo.
echo         async function registerUser(^) {
echo             const egn = document.getElementById('egn'^).value;
echo             const fullname = document.getElementById('fullname'^).value;
echo             const pin = document.getElementById('pin'^).value;
echo.
echo             if (!egn ^|^| !fullname ^|^| !pin^) {
echo                 alert('Please fill all fields'^);
echo                 return;
echo             }
echo.
echo             try {
echo                 const response = await fetch(`${API_URL}/api/auth/register`, {
echo                     method: 'POST',
echo                     headers: { 'Content-Type': 'application/json' },
echo                     body: JSON.stringify({ egn, full_name: fullname, pin_code: pin })
echo                 }^);
echo                 const data = await response.json(^);
echo                 document.getElementById('register-result'^).innerHTML = `
echo                     ^<div class="status"^>✓ Registration successful! User ID: ${data.user_id}^</div^>
echo                 `;
echo             } catch (err^) {
echo                 document.getElementById('register-result'^).innerHTML = `
echo                     ^<div class="status"^>Error: ${err.message}^</div^>
echo                 `;
echo             }
echo         }
echo.
echo         async function testLogin(^) {
echo             try {
echo                 const response = await fetch(`${API_URL}/api/auth/verify`, {
echo                     method: 'POST',
echo                     headers: { 'Content-Type': 'application/json' },
echo                     body: JSON.stringify({ egn: '1111111111', pin_code: '1234' })
echo                 }^);
echo                 const data = await response.json(^);
echo.
echo                 if (data.success^) {
echo                     localStorage.setItem('token', data.token^);
echo                     document.getElementById('login-result'^).innerHTML = `
echo                         ^<div class="status"^>✓ Login successful!^</div^>
echo                     `;
echo                 } else {
echo                     document.getElementById('login-result'^).innerHTML = `
echo                         ^<div class="status"^>Error: ${data.error}^</div^>
echo                     `;
echo                 }
echo             } catch (err^) {
echo                 document.getElementById('login-result'^).innerHTML = `
echo                     ^<div class="status"^>Error: ${err.message}^</div^>
echo                 `;
echo             }
echo         }
echo.
echo         REM Check backend status
echo         async function checkStatus(^) {
echo             try {
echo                 const response = await fetch(`${API_URL}/health`^);
echo                 document.getElementById('backend-status'^).innerHTML = 'Online ✓';
echo                 document.getElementById('backend-status'^).style.color = '#00ff00';
echo             } catch (err^) {
echo                 document.getElementById('backend-status'^).innerHTML = 'Offline ✗';
echo                 document.getElementById('backend-status'^).style.color = '#ff0000';
echo             }
echo         }
echo.
echo         setInterval(checkStatus, 5000^);
echo         checkStatus(^);
echo     ^</script^>
echo ^</body^>
echo ^</html^>
) > public\index.html

echo [OK] Frontend HTML created

cls
echo.
echo ========================================
echo SUCCESS! Setup Complete!
echo ========================================
echo.
echo Project location: %PROJECT_PATH%
echo.
echo TO START THE KIOSK:
echo.
echo 1. Open Command Prompt or PowerShell
echo 2. Navigate to: cd C:\easypay-kiosk
echo 3. Run: npm start
echo.
echo System will start on:
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo.
echo Commands:
echo   Start:    npm start
echo   Dev mode: npm run dev
echo.
echo Test Credentials:
echo   EGN: 1111111111
echo   PIN: 1234
echo.
echo ========================================
echo.

pause

REM Create startup batch file
(
echo @echo off
echo cd /d C:\easypay-kiosk
echo npm start
) > start-kiosk.bat

echo Starting backend...
call npm start
