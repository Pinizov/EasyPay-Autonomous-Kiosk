/**
 * Audit Utility Functions
 * Helper functions for audit logging
 */

const { createAuditLog } = require('../middleware/auditLogger');

/**
 * Log authentication attempt
 */
const logAuthAttempt = async (egn, success, ipAddress, userAgent, errorMessage = null) => {
  await createAuditLog({
    userId: null,
    action: 'AUTH_ATTEMPT',
    resource: 'authentication',
    resourceId: egn,
    status: success ? 'SUCCESS' : 'FAILURE',
    ipAddress,
    userAgent,
    errorMessage,
  });
};

/**
 * Log transaction
 */
const logTransaction = async (userId, transactionType, transactionId, status, amount, errorMessage = null) => {
  await createAuditLog({
    userId,
    action: `TRANSACTION_${transactionType.toUpperCase()}`,
    resource: 'transaction',
    resourceId: transactionId,
    status,
    requestData: { amount, type: transactionType },
    errorMessage,
  });
};

/**
 * Log admin action
 */
const logAdminAction = async (userId, action, resourceId, ipAddress, userAgent) => {
  await createAuditLog({
    userId,
    action: `ADMIN_${action.toUpperCase()}`,
    resource: 'admin',
    resourceId,
    status: 'SUCCESS',
    ipAddress,
    userAgent,
  });
};

module.exports = {
  createAuditLog,
  logAuthAttempt,
  logTransaction,
  logAdminAction,
};
