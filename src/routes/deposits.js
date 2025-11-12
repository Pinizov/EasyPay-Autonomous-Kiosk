/**
 * Deposit Routes
 * Handle cash deposits
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { depositValidation, handleValidationErrors } = require('../middleware/validation');
const { transactionLimiter } = require('../middleware/security');
const { logTransaction } = require('../utils/audit');
const logger = require('../config/logger');

const router = express.Router();

/**
 * POST /api/deposits/record
 * Record a cash deposit
 */
router.post(
  '/record',
  verifyToken,
  transactionLimiter,
  depositValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { amount, currency = 'BGN', reference, description } = req.body;
      const userId = req.user.id;

      const transactionId = uuidv4();
      const ipAddress = req.ip || req.connection.remoteAddress;
      const deviceId = req.headers['x-device-id'] || 'unknown';

      await transaction(async (client) => {
        // Create transaction record
        await client.query(
          `INSERT INTO transactions 
           (id, user_id, transaction_type, amount, currency, status, reference_number, 
            description, ip_address, device_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            transactionId,
            userId,
            'DEPOSIT',
            amount,
            currency,
            'COMPLETED',
            reference || `DEP${Date.now()}`,
            description,
            ipAddress,
            deviceId,
          ]
        );

        // Update user balance
        await client.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [amount, userId]
        );

        // Set completion timestamp
        await client.query(
          'UPDATE transactions SET completed_at = NOW() WHERE id = $1',
          [transactionId]
        );
      });

      await logTransaction(userId, 'DEPOSIT', transactionId, 'SUCCESS', amount);

      logger.info(`Deposit recorded: ${transactionId}, amount: ${amount}`);

      // Get updated balance
      const userResult = await query('SELECT balance FROM users WHERE id = $1', [userId]);
      const newBalance = parseFloat(userResult.rows[0].balance);

      res.json({
        success: true,
        message: 'Deposit recorded successfully',
        transaction: {
          id: transactionId,
          type: 'DEPOSIT',
          amount: parseFloat(amount),
          currency,
          status: 'COMPLETED',
          newBalance,
        },
      });
    } catch (error) {
      logger.error('Deposit error:', error);

      await logTransaction(
        req.user.id,
        'DEPOSIT',
        'N/A',
        'FAILURE',
        req.body.amount,
        error.message
      );

      res.status(500).json({
        success: false,
        error: 'Deposit failed. Please try again.',
      });
    }
  }
);

/**
 * GET /api/deposits/history
 * Get deposit history for user
 */
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(
      `SELECT id, amount, currency, status, reference_number, description, created_at, completed_at
       FROM transactions
       WHERE user_id = $1 AND transaction_type = 'DEPOSIT'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      deposits: result.rows.map(row => ({
        id: row.id,
        amount: parseFloat(row.amount),
        currency: row.currency,
        status: row.status,
        reference: row.reference_number,
        description: row.description,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      })),
      total: result.rowCount,
    });
  } catch (error) {
    logger.error('Error fetching deposit history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deposit history',
    });
  }
});

module.exports = router;
