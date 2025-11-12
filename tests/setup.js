/**
 * Test Setup
 * Initialize test environment
 */

require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'easypay_test';
process.env.JWT_SECRET = 'test-secret-key';

// Global test timeout
jest.setTimeout(10000);

// Cleanup after all tests
afterAll(async () => {
  // Close database connections
  const { pool } = require('../src/config/database');
  await pool.end();
  
  // Close Redis connection
  const { redisClient } = require('../src/config/redis');
  await redisClient.quit();
});
