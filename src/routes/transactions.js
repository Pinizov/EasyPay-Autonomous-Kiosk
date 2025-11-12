/**
 * Transaction Routes
 * General transaction operations and history
 */

const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/transactions/history
 * Get all transactions for user
 */
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const type = req.query.type; // Optional filter by transaction type

    let queryText = `
      SELECT t.*, bp.provider_name
      FROM transactions t
      LEFT JOIN bill_providers bp ON t.bill_provider = bp.provider_code
      WHERE t.user_id = $1
    `;

    const params = [userId];

    if (type) {
      queryText += ' AND t.transaction_type = $2';
      params.push(type.toUpperCase());
    }

    queryText += ' ORDER BY t.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({
      success: true,
      transactions: result.rows.map(row => ({
        id: row.id,
        type: row.transaction_type,
        amount: parseFloat(row.amount),
        currency: row.currency,
        status: row.status,
        recipientAccount: row.recipient_account,
        recipientName: row.recipient_name,
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
    logger.error('Error fetching transaction history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction history',
    });
  }
});

/**
 * GET /api/transactions/:id
 * Get specific transaction details
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT t.*, bp.provider_name
       FROM transactions t
       LEFT JOIN bill_providers bp ON t.bill_provider = bp.provider_code
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    const tx = result.rows[0];

    res.json({
      success: true,
      transaction: {
        id: tx.id,
        type: tx.transaction_type,
        amount: parseFloat(tx.amount),
        currency: tx.currency,
        status: tx.status,
        recipientAccount: tx.recipient_account,
        recipientName: tx.recipient_name,
        providerCode: tx.bill_provider,
        providerName: tx.provider_name,
        billAccountNumber: tx.bill_account_number,
        reference: tx.reference_number,
        easyPayTransactionId: tx.easypay_transaction_id,
        description: tx.description,
        errorMessage: tx.error_message,
        createdAt: tx.created_at,
        completedAt: tx.completed_at,
      },
    });
  } catch (error) {
    logger.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction',
    });
  }
});

/**
 * GET /api/transactions/summary
 * Get transaction summary statistics
 */
router.get('/stats/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN transaction_type = 'DEPOSIT' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_deposits,
        SUM(CASE WHEN transaction_type = 'WITHDRAWAL' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_withdrawals,
        SUM(CASE WHEN transaction_type = 'TRANSFER' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_transfers,
        SUM(CASE WHEN transaction_type = 'BILL_PAYMENT' AND status = 'COMPLETED' THEN amount ELSE 0 END) as total_bill_payments,
        MAX(created_at) as last_transaction_date
       FROM transactions
       WHERE user_id = $1`,
      [userId]
    );

    const stats = result.rows[0];

    res.json({
      success: true,
      summary: {
        totalTransactions: parseInt(stats.total_transactions),
        totalDeposits: parseFloat(stats.total_deposits) || 0,
        totalWithdrawals: parseFloat(stats.total_withdrawals) || 0,
        totalTransfers: parseFloat(stats.total_transfers) || 0,
        totalBillPayments: parseFloat(stats.total_bill_payments) || 0,
        lastTransactionDate: stats.last_transaction_date,
      },
    });
  } catch (error) {
    logger.error('Error fetching transaction summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction summary',
    });
  }
});

module.exports = router;
