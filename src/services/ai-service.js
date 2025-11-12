/**
 * AI Service Integration
 * Face recognition service client
 */

const axios = require('axios');
const logger = require('../config/logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Create axios instance for AI service
 */
const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Enroll face for user
 */
const enrollFace = async (userId, imageBase64) => {
  try {
    logger.info(`Enrolling face for user ${userId}`);
    
    const response = await aiClient.post('/api/face/enroll', {
      user_id: userId,
      image: imageBase64,
    });
    
    return response.data;
  } catch (error) {
    logger.error('Face enrollment error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Face enrollment failed');
  }
};

/**
 * Verify face for user
 */
const verifyFace = async (userId, imageBase64) => {
  try {
    logger.info(`Verifying face for user ${userId}`);
    
    const response = await aiClient.post('/api/face/verify', {
      user_id: userId,
      image: imageBase64,
    });
    
    return response.data;
  } catch (error) {
    logger.error('Face verification error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Face verification failed');
  }
};

/**
 * Delete face data for user
 */
const deleteFaceData = async (userId) => {
  try {
    logger.info(`Deleting face data for user ${userId}`);
    
    const response = await aiClient.delete(`/api/face/delete/${userId}`);
    
    return response.data;
  } catch (error) {
    logger.error('Face deletion error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Face deletion failed');
  }
};

/**
 * Detect face in image (quality check)
 */
const detectFace = async (imageBase64) => {
  try {
    const response = await aiClient.post('/api/face/detect', {
      image: imageBase64,
    });
    
    return response.data;
  } catch (error) {
    logger.error('Face detection error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Face detection failed');
  }
};

/**
 * Check AI service health
 */
const checkHealth = async () => {
  try {
    const response = await aiClient.get('/health');
    return response.data;
  } catch (error) {
    logger.error('AI service health check failed:', error.message);
    return { status: 'unhealthy' };
  }
};

module.exports = {
  enrollFace,
  verifyFace,
  deleteFaceData,
  detectFace,
  checkHealth,
};
