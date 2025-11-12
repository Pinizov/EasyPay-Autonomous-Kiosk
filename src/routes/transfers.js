/**
 * Transfer Routes
 * Handle SEPA money transfers via EasyPay
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { transferValidation, handleValidationErrors } = require('../middleware/validation');
const { transactionLimiter } = require('../middleware/security');
const { createSepaTransfer, checkTransactionStatus } = require('../services/easypay-service');
const { logTransaction } = require('../utils/audit');
const logger = require('../config/logger');

const router = express.Router();

/**
 * POST /api/transfers/send
 * Send money via SEPA transfer
 */
router.post(
  '/send',
  verifyToken,
  transactionLimiter,
  transferValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        amount,
        recipient_account,
        recipient_name,
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
        await logTransaction(userId, 'TRANSFER', transactionId, 'FAILURE', amount, 'Insufficient balance');
        return res.status(400).json({
          success: false,
          error: 'Insufficient balance',
        });
      }

      await transaction(async (client) => {
        // Create pending transaction
        await client.query(
          `INSERT INTO transactions 
           (id, user_id, transaction_type, amount, currency, status, recipient_account, 
            recipient_name, description, ip_address, device_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            transactionId,
            userId,
            'TRANSFER',
            amount,
            currency,
            'PENDING',
            recipient_account,
            recipient_name,
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
          // Process transfer via EasyPay
          const transferResult = await createSepaTransfer({
            fromAccount: user.account_number,
            toAccount: recipient_account,
            amount,
            currency,
            recipientName: recipient_name,
            description,
            reference: transactionId,
          });

          // Update transaction with EasyPay details
          await client.query(
            `UPDATE transactions 
             SET status = $1, easypay_transaction_id = $2, reference_number = $3, completed_at = NOW()
             WHERE id = $4`,
            [transferResult.status, transferResult.transactionId, transferResult.reference, transactionId]
          );

          await logTransaction(userId, 'TRANSFER', transactionId, 'SUCCESS', amount);

          logger.info(`Transfer completed: ${transactionId}, EasyPay ID: ${transferResult.transactionId}`);
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

          await logTransaction(userId, 'TRANSFER', transactionId, 'FAILURE', amount, easypayError.message);

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
        message: 'Transfer completed successfully',
        transaction: {
          id: tx.id,
          type: 'TRANSFER',
          amount: parseFloat(tx.amount),
          currency: tx.currency,
          status: tx.status,
          recipientAccount: tx.recipient_account,
          recipientName: tx.recipient_name,
          reference: tx.reference_number,
          easyPayTransactionId: tx.easypay_transaction_id,
          newBalance,
        },
      });
    } catch (error) {
      logger.error('Transfer error:', error);

      res.status(500).json({
        success: false,
        error: error.message || 'Transfer failed. Please try again.',
      });
    }
  }
);

/**
 * GET /api/transfers/history
 * Get transfer history for user
 */
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(
      `SELECT id, amount, currency, status, recipient_account, recipient_name, 
              reference_number, easypay_transaction_id, description, created_at, completed_at
       FROM transactions
       WHERE user_id = $1 AND transaction_type = 'TRANSFER'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      transfers: result.rows.map(row => ({
        id: row.id,
        amount: parseFloat(row.amount),
        currency: row.currency,
        status: row.status,
        recipientAccount: row.recipient_account,
        recipientName: row.recipient_name,
        reference: row.reference_number,
        easyPayTransactionId: row.easypay_transaction_id,
        description: row.description,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      })),
      total: result.rowCount,
    });
  } catch (error) {
    logger.error('Error fetching transfer history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transfer history',
    });
  }
});

/**
 * GET /api/transfers/status/:transactionId
 * Check transfer status
 */
router.get('/status/:transactionId', verifyToken, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
      [transactionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    const tx = result.rows[0];

    // If pending, check with EasyPay
    if (tx.status === 'PENDING' && tx.easypay_transaction_id) {
      try {
        const easyPayStatus = await checkTransactionStatus(tx.easypay_transaction_id);

        // Update local status if changed
        if (easyPayStatus.status !== tx.status) {
          await query(
            'UPDATE transactions SET status = $1, completed_at = NOW() WHERE id = $2',
            [easyPayStatus.status, transactionId]
          );
          tx.status = easyPayStatus.status;
        }
      } catch (error) {
        logger.error('Error checking EasyPay status:', error);
      }
    }

    res.json({
      success: true,
      transaction: {
        id: tx.id,
        status: tx.status,
        amount: parseFloat(tx.amount),
        currency: tx.currency,
        recipientAccount: tx.recipient_account,
        recipientName: tx.recipient_name,
        reference: tx.reference_number,
        easyPayTransactionId: tx.easypay_transaction_id,
        createdAt: tx.created_at,
        completedAt: tx.completed_at,
      },
    });
  } catch (error) {
    logger.error('Error checking transfer status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check transfer status',
    });
  }
});

module.exports = router;
