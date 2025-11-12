/**
 * Authentication Routes
 * 3-Factor Authentication: EГН + PIN + Face Recognition
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');
const { generateToken, createSession, logout } = require('../middleware/auth');
const { enrollFace, verifyFace } = require('../services/ai-service');
const { logAuthAttempt } = require('../utils/audit');
const {
  registerValidation,
  loginValidation,
  handleValidationErrors,
} = require('../middleware/validation');
const { authLimiter } = require('../middleware/security');
const logger = require('../config/logger');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register new user with 3FA
 */
router.post(
  '/register',
  authLimiter,
  registerValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        egn,
        full_name,
        pin,
        account_number,
        phone_number,
        email,
        face_image,
      } = req.body;

      // Check if user already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE egn = $1 OR account_number = $2',
        [egn, account_number]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'User with this EГН or account number already exists',
        });
      }

      // Hash PIN
      const pinHash = await bcrypt.hash(pin, 10);

      // Create user in database
      const userId = uuidv4();

      await transaction(async (client) => {
        // Insert user
        await client.query(
          `INSERT INTO users (id, egn, full_name, pin_hash, account_number, phone_number, email)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, egn, full_name, pinHash, account_number, phone_number, email]
        );

        // Enroll face if provided
        if (face_image) {
          try {
            await enrollFace(userId, face_image);
            logger.info(`Face enrolled for user ${userId}`);
          } catch (error) {
            logger.error('Face enrollment failed during registration:', error);
            throw new Error('Face enrollment failed. Please try again.');
          }
        }
      });

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await logAuthAttempt(egn, true, ipAddress, userAgent);

      logger.info(`New user registered: ${egn}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        userId,
      });
    } catch (error) {
      logger.error('Registration error:', error);

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      await logAuthAttempt(req.body.egn, false, ipAddress, userAgent, error.message);

      res.status(500).json({
        success: false,
        error: error.message || 'Registration failed',
      });
    }
  }
);

/**
 * POST /api/auth/verify
 * 3-Factor Authentication login
 */
router.post(
  '/verify',
  authLimiter,
  loginValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { egn, pin, face_image } = req.body;

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      // Get user by EГН
      const userResult = await query(
        'SELECT * FROM users WHERE egn = $1',
        [egn]
      );

      if (userResult.rows.length === 0) {
        await logAuthAttempt(egn, false, ipAddress, userAgent, 'User not found');
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        });
      }

      const user = userResult.rows[0];

      // Check if account is active
      if (!user.is_active) {
        await logAuthAttempt(egn, false, ipAddress, userAgent, 'Account deactivated');
        return res.status(403).json({
          success: false,
          error: 'Account is deactivated',
        });
      }

      // Check failed login attempts
      if (user.failed_login_attempts >= 5) {
        await logAuthAttempt(egn, false, ipAddress, userAgent, 'Account locked');
        return res.status(403).json({
          success: false,
          error: 'Account locked due to too many failed attempts. Please contact support.',
        });
      }

      // Factor 1: Verify PIN
      const pinValid = await bcrypt.compare(pin, user.pin_hash);

      if (!pinValid) {
        // Increment failed attempts
        await query(
          'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1',
          [user.id]
        );

        await logAuthAttempt(egn, false, ipAddress, userAgent, 'Invalid PIN');
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        });
      }

      // Factor 2: Verify Face (if image provided)
      if (face_image) {
        try {
          const faceResult = await verifyFace(user.id, face_image);

          if (!faceResult.verified) {
            await query(
              'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1',
              [user.id]
            );

            await logAuthAttempt(egn, false, ipAddress, userAgent, 'Face verification failed');
            return res.status(401).json({
              success: false,
              error: 'Face verification failed',
              confidence: faceResult.confidence,
            });
          }

          logger.info(`Face verified for user ${user.id} with confidence ${faceResult.confidence}`);
        } catch (error) {
          logger.error('Face verification error:', error);
          // Don't fail login if face verification service is down
          logger.warn('Proceeding with login without face verification');
        }
      }

      // Reset failed attempts on successful login
      await query(
        'UPDATE users SET failed_login_attempts = 0, last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      // Generate JWT token
      const token = generateToken(user.id, user.egn);

      // Create session
      await createSession(user.id, token, ipAddress, userAgent);

      await logAuthAttempt(egn, true, ipAddress, userAgent);

      logger.info(`User logged in: ${egn}`);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          egn: user.egn,
          fullName: user.full_name,
          accountNumber: user.account_number,
          balance: parseFloat(user.balance),
        },
      });
    } catch (error) {
      logger.error('Login error:', error);

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      await logAuthAttempt(req.body.egn, false, ipAddress, userAgent, error.message);

      res.status(500).json({
        success: false,
        error: 'Authentication failed',
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        await logout(decoded.userId);
        logger.info(`User logged out: ${decoded.userId}`);
      } catch (error) {
        logger.warn('Invalid token during logout:', error.message);
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
  }
});

/**
 * POST /api/auth/enroll-face
 * Enroll or update face data for existing user
 */
router.post('/enroll-face', async (req, res) => {
  try {
    const { egn, pin, face_image } = req.body;

    if (!egn || !pin || !face_image) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Verify user credentials
    const userResult = await query(
      'SELECT * FROM users WHERE egn = $1',
      [egn]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const user = userResult.rows[0];
    const pinValid = await bcrypt.compare(pin, user.pin_hash);

    if (!pinValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Enroll face
    await enrollFace(user.id, face_image);

    logger.info(`Face enrolled/updated for user ${user.id}`);

    res.json({
      success: true,
      message: 'Face enrolled successfully',
    });
  } catch (error) {
    logger.error('Face enrollment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Face enrollment failed',
    });
  }
});

module.exports = router;
