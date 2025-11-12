/**
 * Admin Routes
 * Dashboard statistics and administrative functions
 */

const express = require('express');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { ipWhitelist } = require('../middleware/security');
const { logAdminAction } = require('../utils/audit');
const logger = require('../config/logger');

const router = express.Router();

// Admin middleware (in production, add role-based access control)
const isAdmin = async (req, res, next) => {
  // TODO: Implement proper admin role checking
  // For now, just require authentication
  next();
};

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Total users
    const usersResult = await query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
    const totalUsers = parseInt(usersResult.rows[0].count);

    // Total transactions
    const txResult = await query('SELECT COUNT(*) as count FROM transactions');
    const totalTransactions = parseInt(txResult.rows[0].count);

    // Transaction volume by type
    const volumeResult = await query(`
      SELECT 
        transaction_type,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as total_amount
      FROM transactions
      GROUP BY transaction_type
    `);

    // Recent transactions
    const recentResult = await query(`
      SELECT t.*, u.egn, u.full_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    // Failed transactions (last 24 hours)
    const failedResult = await query(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE status = 'FAILED' AND created_at > NOW() - INTERVAL '24 hours'
    `);

    await logAdminAction(userId, 'VIEW_STATS', null, ipAddress, userAgent);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalTransactions,
        failedTransactions24h: parseInt(failedResult.rows[0].count),
        volumeByType: volumeResult.rows.map(row => ({
          type: row.transaction_type,
          count: parseInt(row.count),
          totalAmount: parseFloat(row.total_amount) || 0,
        })),
        recentTransactions: recentResult.rows.map(row => ({
          id: row.id,
          type: row.transaction_type,
          amount: parseFloat(row.amount),
          status: row.status,
          userEgn: row.egn,
          userName: row.full_name,
          createdAt: row.created_at,
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

/**
 * GET /api/admin/users
 * Get all users
 */
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(
      `SELECT id, egn, full_name, account_number, balance, is_active, created_at, last_login_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      success: true,
      users: result.rows.map(row => ({
        id: row.id,
        egn: row.egn,
        fullName: row.full_name,
        accountNumber: row.account_number,
        balance: parseFloat(row.balance),
        isActive: row.is_active,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
      })),
      total: result.rowCount,
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
});

/**
 * GET /api/admin/audit-logs
 * Get audit logs
 */
router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const action = req.query.action;
    const status = req.query.status;

    let queryText = `
      SELECT al.*, u.egn, u.full_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (action) {
      params.push(action);
      queryText += ` AND al.action = $${params.length}`;
    }

    if (status) {
      params.push(status);
      queryText += ` AND al.status = $${params.length}`;
    }

    params.push(limit, offset);
    queryText += ` ORDER BY al.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(queryText, params);

    res.json({
      success: true,
      logs: result.rows.map(row => ({
        id: row.id,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        status: row.status,
        userEgn: row.egn,
        userName: row.full_name,
        ipAddress: row.ip_address,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      })),
      total: result.rowCount,
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
    });
  }
});

/**
 * POST /api/admin/users/:id/deactivate
 * Deactivate a user account
 */
router.post('/users/:id/deactivate', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await query('UPDATE users SET is_active = false WHERE id = $1', [id]);

    await logAdminAction(userId, 'DEACTIVATE_USER', id, ipAddress, userAgent);

    logger.info(`User deactivated: ${id} by admin ${userId}`);

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    logger.error('Error deactivating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate user',
    });
  }
});

/**
 * POST /api/admin/users/:id/activate
 * Activate a user account
 */
router.post('/users/:id/activate', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await query('UPDATE users SET is_active = true, failed_login_attempts = 0 WHERE id = $1', [id]);

    await logAdminAction(userId, 'ACTIVATE_USER', id, ipAddress, userAgent);

    logger.info(`User activated: ${id} by admin ${userId}`);

    res.json({
      success: true,
      message: 'User activated successfully',
    });
  } catch (error) {
    logger.error('Error activating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate user',
    });
  }
});

module.exports = router;
