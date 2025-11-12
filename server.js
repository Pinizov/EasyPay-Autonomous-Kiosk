const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Create data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Initialize SQLite database
const db = new sqlite3.Database(path.join(dataDir, 'kiosk.db'));

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      egn TEXT UNIQUE,
      full_name TEXT,
      pin_code TEXT,
      balance REAL DEFAULT 0,
      account_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      amount REAL,
      status TEXT,
      easypay_tx_id TEXT,
      reference TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), version: '1.0.0' });
});

// ===== AUTH ENDPOINTS =====

// Register user
app.post('/api/auth/register', async (req, res) => {
  const { egn, full_name, pin_code } = req.body;
  if (!egn || !full_name || !pin_code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const hashedPin = await bcrypt.hash(pin_code, 10);
  db.run(
    'INSERT INTO users (egn, full_name, pin_code, balance, account_number) VALUES (?, ?, ?, ?, ?)',
    [egn, full_name, hashedPin, 0, `ACC_${egn}`],
    function(err) {
      if (err) {
        return res.status(400).json({ error: 'User already exists' });
      }
      res.json({ success: true, user_id: this.lastID });
    }
  );
});

// Verify/Login
app.post('/api/auth/verify', (req, res) => {
  const { egn, pin_code } = req.body;
  db.get('SELECT * FROM users WHERE egn = ?', [egn], async (err, user) => {
    if (!user) return res.status(401).json({ error: 'User not found' });
    const validPin = await bcrypt.compare(pin_code, user.pin_code);
    if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });
    const token = jwt.sign({ user_id: user.id }, process.env.JWT_SECRET || 'secret');
    res.json({ success: true, token, user });
  });
});

// Get profile
app.get('/api/auth/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    db.get('SELECT id, egn, full_name, balance, account_number FROM users WHERE id = ?', [decoded.user_id], (err, user) => {
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true, user });
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ===== DEPOSIT/WITHDRAWAL =====

// Record deposit
app.post('/api/deposits/record', (req, res) => {
  const { user_id, amount } = req.body;
  db.run(
    'UPDATE users SET balance = balance + ? WHERE id = ?',
    [amount, user_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.run(
        'INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, ?)',
        [user_id, 'deposit', amount, 'completed'],
        function(err) {
          res.json({ success: true, transaction_id: this.lastID, amount });
        }
      );
    }
  );
});

// Record withdrawal
app.post('/api/withdrawals/record', (req, res) => {
  const { user_id, amount } = req.body;
  db.run(
    'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
    [amount, user_id, amount],
    function(err) {
      if (this.changes === 0) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      db.run(
        'INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, ?)',
        [user_id, 'withdrawal', amount, 'completed'],
        function(err) {
          res.json({ success: true, transaction_id: this.lastID, amount });
        }
      );
    }
  );
});

// ===== EASYPAY ENDPOINTS =====

// 1. Money Transfer (SEPA)
app.post('/api/transfers/send', (req, res) => {
  const { user_id, to_iban, amount, purpose } = req.body;
  if (!user_id || !to_iban || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (amount <= 0 || amount > 100000) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  db.get('SELECT * FROM users WHERE id = ?', [user_id], (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });
    const transactionId = `TX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    db.run(
      'INSERT INTO transactions (user_id, type, amount, status, easypay_tx_id) VALUES (?, ?, ?, ?, ?)',
      [user_id, 'transfer', amount, 'pending', transactionId],
      function(err) {
        res.json({
          success: true,
          transaction_id: transactionId,
          status: 'pending',
          to_iban: to_iban,
          amount: amount,
          message: 'Transfer initialized. Awaiting OTP confirmation.'
        });
      }
    );
  });
});

// 2. Confirm Transfer with OTP
app.post('/api/transfers/confirm', (req, res) => {
  const { transaction_id, otp_code } = req.body;
  if (!transaction_id || !otp_code) {
    return res.status(400).json({ error: 'Missing transaction_id or otp_code' });
  }
  // Simulate OTP confirmation (in real system, verify with EasyPay)
  db.run(
    'UPDATE transactions SET status = ? WHERE easypay_tx_id = ?',
    ['completed', transaction_id],
    (err) => {
      res.json({
        success: true,
        transaction_id: transaction_id,
        status: 'completed',
        message: 'Transfer completed successfully'
      });
    }
  );
});

// 3. Pay Bill (EBN, utilities, etc.)
app.post('/api/bills/pay', (req, res) => {
  const { user_id, account_number, biller_code, amount } = req.body;
  if (!user_id || !account_number || !biller_code || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  db.get('SELECT * FROM users WHERE id = ?', [user_id], (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
    
    db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, user_id]);
    db.run(
      'INSERT INTO transactions (user_id, type, amount, status, reference) VALUES (?, ?, ?, ?, ?)',
      [user_id, 'bill_payment', amount, 'completed', `BILL_${account_number}`],
      function(err) {
        res.json({
          success: true,
          payment_reference: `BILL_${account_number}`,
          biller: biller_code,
          amount: amount,
          account: account_number,
          status: 'completed'
        });
      }
    );
  });
});

// 4. Mobile Recharge (Telenor, Vodafone, etc.)
app.post('/api/mobile/recharge', (req, res) => {
  const { user_id, phone_number, amount, operator } = req.body;
  if (!user_id || !phone_number || !amount || !operator) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  db.get('SELECT * FROM users WHERE id = ?', [user_id], (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
    
    db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, user_id]);
    db.run(
      'INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, ?)',
      [user_id, 'mobile_recharge', amount, 'completed'],
      (err) => {
        res.json({
          success: true,
          phone: phone_number,
          amount: amount,
          operator: operator,
          status: 'completed'
        });
      }
    );
  });
});

// 5. Check Balance
app.get('/api/balance/:user_id', (req, res) => {
  const { user_id } = req.params;
  db.get('SELECT balance, account_number FROM users WHERE id = ?', [user_id], (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      user_id: user_id,
      balance: user.balance,
      account: user.account_number,
      currency: 'BGN'
    });
  });
});

// 6. Get Transaction Status
app.get('/api/transactions/status/:tx_id', (req, res) => {
  const { tx_id } = req.params;
  db.get('SELECT * FROM transactions WHERE easypay_tx_id = ?', [tx_id], (err, tx) => {
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json({
      transaction_id: tx_id,
      status: tx.status,
      type: tx.type,
      amount: tx.amount,
      created_at: tx.created_at
    });
  });
});

// 7. Transaction History
app.get('/api/transactions/:user_id', (req, res) => {
  const { user_id } = req.params;
  db.all(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, transactions: rows || [] });
    }
  );
});

// 8. Available Billers
app.get('/api/billers', (req, res) => {
  const billers = [
    { code: 'evn', name: 'ЕВН - Electrification' },
    { code: 'water', name: 'Water Supply' },
    { code: 'telenor', name: 'Telenor Mobile' },
    { code: 'vodafone', name: 'Vodafone Mobile' },
    { code: 'bgmobile', name: 'Bulgarian Mobile' },
    { code: 'gas', name: 'Gas Supply' },
    { code: 'internet', name: 'Internet Services' }
  ];
  res.json({ success: true, billers });
});

// ===== STATIC FILES =====
app.use(express.static('public'));

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Backend running on http://localhost:${PORT}`);
  console.log(`✓ Frontend: http://localhost:${PORT}`);
  console.log(`✓ Health: http://localhost:${PORT}/health`);
  console.log(`✓ EasyPay endpoints: READY`);
});
