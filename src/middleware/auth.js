/**
 * Authentication Middleware
 * JWT token verification and user session management
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../config/logger');
const { createAuditLog } = require('../utils/audit');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

/**
 * Generate JWT token for user
 */
const generateToken = (userId, egn) => {
  return jwt.sign(
    { userId, egn },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Verify JWT token from request
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if session exists and is valid
    const sessionResult = await query(
      `SELECT s.*, u.is_active, u.egn, u.full_name
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = $1 AND s.expires_at > NOW()
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [decoded.userId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid',
      });
    }
    
    const session = sessionResult.rows[0];
    
    if (!session.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Account is deactivated',
      });
    }
    
    // Update last activity
    await query(
      'UPDATE sessions SET last_activity_at = NOW() WHERE id = $1',
      [session.id]
    );
    
    // Attach user info to request
    req.user = {
      id: decoded.userId,
      egn: session.egn,
      fullName: session.full_name,
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }
    
    logger.error('Token verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

/**
 * Create user session
 */
const createSession = async (userId, token, ipAddress, userAgent) => {
  try {
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour session
    
    await query(
      `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tokenHash, ipAddress, userAgent, expiresAt]
    );
    
    return true;
  } catch (error) {
    logger.error('Error creating session:', error);
    return false;
  }
};

/**
 * Logout - invalidate session
 */
const logout = async (userId) => {
  try {
    await query(
      'DELETE FROM sessions WHERE user_id = $1',
      [userId]
    );
    return true;
  } catch (error) {
    logger.error('Error during logout:', error);
    return false;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  createSession,
  logout,
  JWT_SECRET,
};
