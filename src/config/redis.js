/**
 * Redis Configuration
 * Redis client for caching and session management
 */

const Redis = require('ioredis');
const logger = require('./logger');

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || '',
  db: 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error:', err);
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

// Helper functions
const setCache = async (key, value, expirationSeconds = 3600) => {
  try {
    await redisClient.setex(key, expirationSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Redis set error:', error);
    return false;
  }
};

const getCache = async (key) => {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
};

const deleteCache = async (key) => {
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error('Redis delete error:', error);
    return false;
  }
};

const incrementCounter = async (key, expirationSeconds = 3600) => {
  try {
    const value = await redisClient.incr(key);
    if (value === 1) {
      await redisClient.expire(key, expirationSeconds);
    }
    return value;
  } catch (error) {
    logger.error('Redis increment error:', error);
    return 0;
  }
};

module.exports = {
  redisClient,
  setCache,
  getCache,
  deleteCache,
  incrementCounter,
};
