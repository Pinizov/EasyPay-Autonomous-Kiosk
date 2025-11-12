// ДОБАВИ ТОВА В server.js (СЛЕД ДРУГИТЕ IMPORTS)

const easypay = require('./easypayService'); // Ако го направиш service

// =====================================================
// EASYPAY ENDPOINTS
// =====================================================

// 1. SEPA MONEY TRANSFER
app.post('/api/transfers/send', (req, res) => {
  const { user_id, to_iban, amount, purpose } = req.body;
  
  // Валидация
  if (!user_id || !to_iban || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (amount <= 0 || amount > 100000) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // Намери потребител
  db.get('SELECT * FROM users WHERE id = ?', [user_id], async (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });

    try {
      // Инициализирай трансфера през EasyPay
      const result = await easypay.sendTransfer(
        user.account_number || 'default_account',
        to_iban,
        amount,
        purpose
      );

      // Запиши трансакцията в БД като pending
      db.run(
        'INSERT INTO transactions (user_id, type, amount, status, easypay_tx_id) VALUES (?, ?, ?, ?, ?)',
        [user_id, 'transfer', amount, 'pending', result.transaction_id],
        function(err) {
          res.json({
            success: true,
            transaction_id: result.transaction_id,
            status: 'pending',
            message: 'Transfer initialized. Awaiting OTP confirmation.'
          });
        }
      );
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// 2. CONFIRM TRANSFER WITH OTP
app.post('/api/transfers/confirm', (req, res) => {
  const { transaction_id, otp_code } = req.body;

  if (!transaction_id || !otp_code) {
    return res.status(400).json({ error: 'Missing transaction_id or otp_code' });
  }

  easypay.confirmTransfer(transaction_id, otp_code)
    .then(result => {
      if (result.success) {
        // Обновяване статус на БД
        db.run(
          'UPDATE transactions SET status = ? WHERE easypay_tx_id = ?',
          ['completed', transaction_id]
        );
      }
      res.json(result);
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

// 3. PAY UTILITY BILL
app.post('/api/bills/pay', (req, res) => {
  const { user_id, account_number, biller_code, amount } = req.body;

  if (!user_id || !account_number || !biller_code || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [user_id], async (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    try {
      // Pay через EasyPay
      const result = await easypay.payBill(
        account_number,
        biller_code,
        amount,
        `Bill payment for account ${account_number}`
      );

      if (result.success) {
        // Намали баланса
        db.run(
          'UPDATE users SET balance = balance - ? WHERE id = ?',
          [amount, user_id]
        );

        // Запиши трансакцията
        db.run(
          'INSERT INTO transactions (user_id, type, amount, status, reference) VALUES (?, ?, ?, ?, ?)',
          [user_id, 'bill_payment', amount, 'completed', result.payment_reference]
        );
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// 4. CHECK BALANCE
app.get('/api/balance/:user_id', (req, res) => {
  const { user_id } = req.params;

  db.get('SELECT balance FROM users WHERE id = ?', [user_id], async (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });

    try {
      // Провери баланса през EasyPay (ако има интеграция с банка)
      const easypayBalance = await easypay.checkBalance('default_account');

      res.json({
        local_balance: user.balance,
        easypay_balance: easypayBalance.balance,
        currency: 'BGN'
      });
    } catch (error) {
      // Върни локален баланс ако EasyPay е недостъпна
      res.json({ local_balance: user.balance, currency: 'BGN' });
    }
  });
});

// 5. GET TRANSACTION STATUS
app.get('/api/transactions/status/:tx_id', (req, res) => {
  const { tx_id } = req.params;

  db.get('SELECT * FROM transactions WHERE easypay_tx_id = ?', [tx_id], async (err, tx) => {
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    try {
      const status = await easypay.getTransactionStatus(tx_id);
      res.json(status);
    } catch (error) {
      res.json({ transaction_id: tx_id, status: tx.status, amount: tx.amount });
    }
  });
});

// 6. MOBILE RECHARGE
app.post('/api/mobile/recharge', (req, res) => {
  const { user_id, phone_number, amount, operator } = req.body;

  if (!user_id || !phone_number || !amount || !operator) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [user_id], async (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    try {
      const result = await easypay.mobileRecharge(phone_number, amount, operator);

      if (result.success) {
        db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, user_id]);
        db.run(
          'INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, ?)',
          [user_id, 'mobile_recharge', amount, 'completed']
        );
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// 7. GET AVAILABLE BILLERS
app.get('/api/billers', async (req, res) => {
  try {
    const billers = await easypay.getAvailableBillers();
    res.json({ success: true, billers });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 8. GET EXCHANGE RATES
app.get('/api/rates', async (req, res) => {
  try {
    const rates = await easypay.getExchangeRates();
    res.json({ success: true, rates });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 9. TRANSACTION HISTORY
app.get('/api/transactions/:user_id', (req, res) => {
  const { user_id } = req.params;

  db.all(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, transactions: rows });
    }
  );
});

// 10. UPDATE .env SETTINGS
app.post('/api/config/easypay', (req, res) => {
  const { app_id, app_secret } = req.body;

  if (!app_id || !app_secret) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  // Update environment variables (в production използвай по-безопасен метод)
  process.env.EASYPAY_APP_ID = app_id;
  process.env.EASYPAY_APP_SECRET = app_secret;

  res.json({ success: true, message: 'EasyPay credentials updated' });
});
