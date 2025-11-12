const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api/auth/profile', (req, res) => {
  res.json({ 
    success: true, 
    user: { 
      user_id: 1, 
      egn: '1111111111',
      full_name: 'Test User',
      account_balance: 5000
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  res.json({ success: true, message: 'User registered' });
});

app.post('/api/auth/verify', (req, res) => {
  res.json({ 
    success: true, 
    token: 'test-token-123',
    user: { user_id: 1, egn: '1111111111' }
  });
});

app.post('/api/deposits/record', (req, res) => {
  res.json({ 
    success: true, 
    transaction_id: Math.random(),
    amount: req.body.amount,
    message: 'Deposit recorded'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
