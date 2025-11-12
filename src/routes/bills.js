/**
 * Bill Payment Routes
 * Handle utility bill payments via EasyPay
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { billPaymentValidation, handleValidationErrors } = require('../middleware/validation');
const { transactionLimiter } = require('../middleware/security');
const { processBillPayment, getBillProviderDetails } = require('../services/easypay-service');
const { logTransaction } = require('../utils/audit');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/bills/providers
 * Get list of available bill providers
 */
router.get('/providers', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT provider_code, provider_name, category, logo_url
       FROM bill_providers
       WHERE is_active = true
       ORDER BY category, provider_name`
    );

    res.json({
      success: true,
      providers: result.rows.map(row => ({
        code: row.provider_code,
        name: row.provider_name,
        category: row.category,
        logoUrl: row.logo_url,
      })),
    });
  } catch (error) {
    logger.error('Error fetching bill providers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bill providers',
    });
  }
});

/**
 * POST /api/bills/pay
 * Pay a utility bill
 */
router.post(
  '/pay',
  verifyToken,
  transactionLimiter,
  billPaymentValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        amount,
        provider_code,
        bill_account_number,
        description = '',
        currency = 'BGN',
      } = req.body;

      const userId = req.user.id;
      const transactionId = uuidv4();
      const ipAddress = req.ip || req.connection.remoteAddress;
      const deviceId = req.headers['x-device-id'] || 'unknown';

      // Get user account info
      const userResult = await query(
        'SELECT account_number, balance FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const user = userResult.rows[0];

      // Check sufficient balance
      if (parseFloat(user.balance) < parseFloat(amount)) {
        await logTransaction(userId, 'BILL_PAYMENT', transactionId, 'FAILURE', amount, 'Insufficient balance');
        return res.status(400).json({
          success: false,
          error: 'Insufficient balance',
        });
      }

      // Get provider info
      const providerResult = await query(
        'SELECT provider_name FROM bill_providers WHERE provider_code = $1 AND is_active = true',
        [provider_code]
      );

      if (providerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Bill provider not found or inactive',
        });
      }

      const providerName = providerResult.rows[0].provider_name;

      await transaction(async (client) => {
        // Create pending transaction
        await client.query(
          `INSERT INTO transactions 
           (id, user_id, transaction_type, amount, currency, status, bill_provider, 
            bill_account_number, description, ip_address, device_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            transactionId,
            userId,
            'BILL_PAYMENT',
            amount,
            currency,
            'PENDING',
            provider_code,
            bill_account_number,
            description,
            ipAddress,
            deviceId,
          ]
        );

        // Deduct from user balance immediately
        await client.query(
          'UPDATE users SET balance = balance - $1 WHERE id = $2',
          [amount, userId]
        );

        try {
          // Process bill payment via EasyPay
          const paymentResult = await processBillPayment({
            fromAccount: user.account_number,
            providerCode: provider_code,
            billAccountNumber: bill_account_number,
            amount,
            currency,
            description,
          });

          // Update transaction with EasyPay details
          await client.query(
            `UPDATE transactions 
             SET status = $1, easypay_transaction_id = $2, reference_number = $3, completed_at = NOW()
             WHERE id = $4`,
            [paymentResult.status, paymentResult.transactionId, paymentResult.reference, transactionId]
          );

          await logTransaction(userId, 'BILL_PAYMENT', transactionId, 'SUCCESS', amount);

          logger.info(`Bill payment completed: ${transactionId}, EasyPay ID: ${paymentResult.transactionId}`);
        } catch (easypayError) {
          // Rollback balance if EasyPay fails
          await client.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [amount, userId]
          );

          await client.query(
            'UPDATE transactions SET status = $1, error_message = $2 WHERE id = $3',
            ['FAILED', easypayError.message, transactionId]
          );

          await logTransaction(userId, 'BILL_PAYMENT', transactionId, 'FAILURE', amount, easypayError.message);

          throw easypayError;
        }
      });

      // Get updated transaction
      const txResult = await query(
        'SELECT * FROM transactions WHERE id = $1',
        [transactionId]
      );

      const tx = txResult.rows[0];

      // Get updated balance
      const balanceResult = await query('SELECT balance FROM users WHERE id = $1', [userId]);
      const newBalance = parseFloat(balanceResult.rows[0].balance);

      res.json({
        success: true,
        message: 'Bill payment completed successfully',
        transaction: {
          id: tx.id,
          type: 'BILL_PAYMENT',
          amount: parseFloat(tx.amount),
          currency: tx.currency,
          status: tx.status,
          provider: providerName,
          billAccountNumber: tx.bill_account_number,
          reference: tx.reference_number,
          easyPayTransactionId: tx.easypay_transaction_id,
          newBalance,
        },
      });
    } catch (error) {
      logger.error('Bill payment error:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Bill payment failed. Please try again.',
      });
    }
  }
);

/**
 * GET /api/bills/history
 * Get bill payment history for user
 */
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(
      `SELECT t.id, t.amount, t.currency, t.status, t.bill_provider, t.bill_account_number,
              t.reference_number, t.easypay_transaction_id, t.description, t.created_at, t.completed_at,
              bp.provider_name
       FROM transactions t
       LEFT JOIN bill_providers bp ON t.bill_provider = bp.provider_code
       WHERE t.user_id = $1 AND t.transaction_type = 'BILL_PAYMENT'
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      payments: result.rows.map(row => ({
        id: row.id,
        amount: parseFloat(row.amount),
        currency: row.currency,
        status: row.status,
        providerCode: row.bill_provider,
        providerName: row.provider_name,
        billAccountNumber: row.bill_account_number,
        reference: row.reference_number,
        easyPayTransactionId: row.easypay_transaction_id,
        description: row.description,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      })),
      total: result.rowCount,
    });
  } catch (error) {
    logger.error('Error fetching bill payment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bill payment history',
    });
  }
});

module.exports = router;
