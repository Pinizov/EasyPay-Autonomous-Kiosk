/**
 * Authentication Tests
 * Tests for user registration and login
 */

const request = require('supertest');
const app = require('../src/server');
const { query } = require('../src/config/database');

describe('Authentication API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        egn: '1234567890',
        full_name: 'Test User',
        pin: '1234',
        account_number: 'BG80BNBG96611020345678',
        phone_number: '+359888123456',
        email: 'test@example.com',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBeDefined();

      // Cleanup
      await query('DELETE FROM users WHERE egn = $1', [userData.egn]);
    });

    it('should reject registration with invalid EGN', async () => {
      const userData = {
        egn: '123', // Invalid length
        full_name: 'Test User',
        pin: '1234',
        account_number: 'BG80BNBG96611020345678',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('EГН');
    });

    it('should reject duplicate user registration', async () => {
      const userData = {
        egn: '9876543210',
        full_name: 'Duplicate User',
        pin: '1234',
        account_number: 'BG80BNBG96611020123456',
      };

      // First registration
      await request(app).post('/api/auth/register').send(userData);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');

      // Cleanup
      await query('DELETE FROM users WHERE egn = $1', [userData.egn]);
    });
  });

  describe('POST /api/auth/verify', () => {
    beforeAll(async () => {
      // Create test user
      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');
      
      const userId = uuidv4();
      const pinHash = await bcrypt.hash('1234', 10);

      await query(
        `INSERT INTO users (id, egn, full_name, pin_hash, account_number, balance)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, '1111111111', 'Test User', pinHash, 'BG80BNBG96611020111111', 1000]
      );
    });

    afterAll(async () => {
      // Cleanup
      await query('DELETE FROM users WHERE egn = $1', ['1111111111']);
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        egn: '1111111111',
        pin: '1234',
      };

      const response = await request(app)
        .post('/api/auth/verify')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.egn).toBe(loginData.egn);
    });

    it('should reject login with invalid PIN', async () => {
      const loginData = {
        egn: '1111111111',
        pin: '9999', // Wrong PIN
      };

      const response = await request(app)
        .post('/api/auth/verify')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with non-existent user', async () => {
      const loginData = {
        egn: '0000000000',
        pin: '1234',
      };

      const response = await request(app)
        .post('/api/auth/verify')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Deposit API', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Create and login test user
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const { generateToken } = require('../src/middleware/auth');

    userId = uuidv4();
    const pinHash = await bcrypt.hash('1234', 10);

    await query(
      `INSERT INTO users (id, egn, full_name, pin_hash, account_number, balance)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, '2222222222', 'Deposit User', pinHash, 'BG80BNBG96611020222222', 500]
    );

    authToken = generateToken(userId, '2222222222');
  });

  afterAll(async () => {
    await query('DELETE FROM transactions WHERE user_id = $1', [userId]);
    await query('DELETE FROM users WHERE id = $1', [userId]);
  });

  it('should record a deposit successfully', async () => {
    const depositData = {
      amount: 100.50,
      currency: 'BGN',
      description: 'Test deposit',
    };

    const response = await request(app)
      .post('/api/deposits/record')
      .set('Authorization', `Bearer ${authToken}`)
      .send(depositData)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.transaction).toBeDefined();
    expect(response.body.transaction.amount).toBe(depositData.amount);
    expect(response.body.transaction.newBalance).toBe(600.50); // 500 + 100.50
  });

  it('should reject deposit without authentication', async () => {
    const depositData = {
      amount: 50.00,
    };

    const response = await request(app)
      .post('/api/deposits/record')
      .send(depositData)
      .expect(401);

    expect(response.body.success).toBe(false);
  });

  it('should reject deposit with invalid amount', async () => {
    const depositData = {
      amount: -50, // Negative amount
    };

    const response = await request(app)
      .post('/api/deposits/record')
      .set('Authorization', `Bearer ${authToken}`)
      .send(depositData)
      .expect(400);

    expect(response.body.success).toBe(false);
  });
});

// Add more tests for transfers, bill payments, etc.
