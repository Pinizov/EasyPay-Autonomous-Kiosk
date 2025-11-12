/**
 * Audit Logger Middleware
 * Log all actions for security and compliance
 */

const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * Create audit log entry
 */
const createAuditLog = async ({
  userId = null,
  action,
  resource,
  resourceId = null,
  status,
  ipAddress = null,
  userAgent = null,
  requestData = null,
  responseData = null,
  errorMessage = null,
}) => {
  try {
    await query(
      `INSERT INTO audit_logs 
       (user_id, action, resource, resource_id, status, ip_address, user_agent, 
        request_data, response_data, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        action,
        resource,
        resourceId,
        status,
        ipAddress,
        userAgent,
        requestData ? JSON.stringify(requestData) : null,
        responseData ? JSON.stringify(responseData) : null,
        errorMessage,
      ]
    );
  } catch (error) {
    logger.error('Error creating audit log:', error);
  }
};

/**
 * Audit middleware - logs all requests
 */
const auditMiddleware = (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = function (data) {
    // Log after response is sent
    const userId = req.user ? req.user.id : null;
    const action = `${req.method} ${req.path}`;
    const resource = req.path.split('/')[2] || 'unknown';
    const status = data.success ? 'SUCCESS' : 'FAILURE';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Don't log sensitive data
    const sanitizedBody = { ...req.body };
    delete sanitizedBody.pin;
    delete sanitizedBody.password;
    delete sanitizedBody.image;
    
    const sanitizedResponse = { ...data };
    delete sanitizedResponse.token;
    delete sanitizedResponse.face_encoding;
    
    createAuditLog({
      userId,
      action,
      resource,
      status,
      ipAddress,
      userAgent,
      requestData: sanitizedBody,
      responseData: sanitizedResponse,
      errorMessage: data.error || null,
    }).catch((err) => {
      logger.error('Audit log creation failed:', err);
    });
    
    return originalJson(data);
  };
  
  next();
};

module.exports = {
  createAuditLog,
  auditMiddleware,
};
