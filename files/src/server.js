const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const redis = require('redis');
const axios = require('axios');
const easypay = require('./services/easypay-service');
dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(helmet());
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));

const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASS,
});

function encryptFace(data) {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.AES256_KEY), Buffer.from(process.env.AES_IV));
  let enc = cipher.update(data, 'utf8');
  enc = Buffer.concat([enc, cipher.final()]);
  return enc.toString('hex');
}

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), version: '1.0.0' });
});

// ===== AUTH ENDPOINTS =====
// Register user
app.post('/api/auth/register', async (req, res) => {
  const { egn, full_name, pin_code, face_data } = req.body;
  if (!egn || !full_name || !pin_code || !face_data) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const hashedPin = await bcrypt.hash(pin_code, 12);
  const encryptedFace = encryptFace(face_data);
  try {
    const { rows } = await db.query(
      'INSERT INTO users (egn, full_name, pin_code, face_data) VALUES ($1, $2, $3, $4) RETURNING id',
      [egn, full_name, hashedPin, encryptedFace]
    );
    res.json({ success: true, user_id: rows[0].id });
  } catch (err) {
    res.status(400).json({ error: 'User already exists' });
  }
});

// 3FA Verification
app.post('/api/auth/verify', async (req, res) => {
  const { egn, pin_code, face_image } = req.body;
  const userRes = await db.query('SELECT * FROM users WHERE egn = $1', [egn]);
  const user = userRes.rows[0];
  if (!user) return res.status(401).json({ error: 'User not found' });
  const validPin = await bcrypt.compare(pin_code, user.pin_code);
  if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });
  // Face verify
  const aiResp = await axios.post(`${process.env.AI_SERVICE_URL}/api/face/verify`, {
    image: face_image, known_embedding: user.face_data
  });
  if (!aiResp.data.verified) return res.status(401).json({ error: 'Face verification failed' });
  const token = jwt.sign({ user_id: user.id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ success: true, token, user: { user_id: user.id, egn, full_name: user.full_name } });
});

// ===== TRANSACTIONS CRUD =====
app.post('/api/deposits/record', async (req, res) => {
  const { user_id, amount } = req.body;
  await db.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, user_id]);
  const { rows } = await db.query(
    'INSERT INTO transactions (user_id, type, amount, status) VALUES ($1, $2, $3, $4) RETURNING id',
    [user_id, 'deposit', amount, 'completed']
  );
  res.json({ success: true, transaction_id: rows[0].id, amount });
});

// Money Transfer (SEPA, via EasyPay API)
app.post('/api/transfers/send', async (req, res) => {
  const { user_id, to_iban, amount, purpose } = req.body;
  if (!user_id || !to_iban || !amount) return res.status(400).json({ error: 'Missing required fields' });
  const userRes = await db.query('SELECT * FROM users WHERE id = $1', [user_id]);
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const result = await easypay.sendTransfer(
    user.account_number || 'default_account',
    to_iban, amount, purpose
  );
  await db.query(
    'INSERT INTO transactions (user_id, type, amount, status, easypay_tx_id) VALUES ($1, $2, $3, $4, $5)',
    [user_id, 'transfer', amount, 'pending', result.transaction_id]
  );
  res.json(result);
});

// Pay Bill
app.post('/api/bills/pay', async (req, res) => {
  const { user_id, account_number, biller_code, amount } = req.body;
  const userRes = await db.query('SELECT * FROM users WHERE id = $1', [user_id]);
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
  await db.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, user_id]);
  const result = await easypay.payBill(account_number, biller_code, amount);
  await db.query(
    'INSERT INTO transactions (user_id, type, amount, status, reference) VALUES ($1, $2, $3, $4, $5)',
    [user_id, 'bill_payment', amount, 'completed', result.payment_reference]
  );
  res.json(result);
});

// ========== STATIC & ERROR HANDLER ==========
app.use(express.static('public'));
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Backend running on http://localhost:${PORT}`);
});