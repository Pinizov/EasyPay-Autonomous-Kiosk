/**
 * EasyPay API Service
 * Integration with EasyPay for SEPA transfers and bill payments
 * Production-ready with retry logic and error handling
 */

const axios = require('axios');
const logger = require('../config/logger');
const { setCache, getCache } = require('../config/redis');

const EASYPAY_BASE_URL = process.env.EASYPAY_API_URL || 'https://api.easypay.bg/v1';
const EASYPAY_API_KEY = process.env.EASYPAY_API_KEY || '';
const EASYPAY_SECRET = process.env.EASYPAY_API_SECRET || '';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // milliseconds

/**
 * Create axios instance with default config
 */
const easyPayClient = axios.create({
  baseURL: EASYPAY_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': EASYPAY_API_KEY,
  },
});

/**
 * Add request interceptor for authentication
 */
easyPayClient.interceptors.request.use(
  (config) => {
    // Add timestamp and signature for request authentication
    const timestamp = Date.now();
    config.headers['X-Timestamp'] = timestamp;
    
    // In production, implement proper HMAC signature
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', EASYPAY_SECRET)
      .update(`${timestamp}${config.method}${config.url}`)
      .digest('hex');
    
    config.headers['X-Signature'] = signature;
    
    return config;
  },
  (error) => {
    logger.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

/**
 * Add response interceptor for error handling
 */
easyPayClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      logger.error('EasyPay API error:', {
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.request) {
      logger.error('EasyPay API no response:', error.message);
    } else {
      logger.error('EasyPay API request error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Retry helper function
 */
const retryRequest = async (requestFn, retries = MAX_RETRIES) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      
      // Exponential backoff
      const delay = RETRY_DELAY * Math.pow(2, i);
      logger.warn(`Request failed, retrying in ${delay}ms... (${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Get account balance
 */
const getAccountBalance = async (accountNumber) => {
  try {
    // Check cache first
    const cacheKey = `balance:${accountNumber}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      logger.debug('Balance retrieved from cache');
      return cached;
    }
    
    const response = await retryRequest(() =>
      easyPayClient.get(`/accounts/${accountNumber}/balance`)
    );
    
    const balance = {
      account: accountNumber,
      available: response.data.available_balance,
      currency: response.data.currency,
      timestamp: new Date().toISOString(),
    };
    
    // Cache for 60 seconds
    await setCache(cacheKey, balance, 60);
    
    return balance;
  } catch (error) {
    logger.error('Error getting account balance:', error);
    throw new Error('Failed to retrieve account balance');
  }
};

/**
 * Create SEPA transfer
 */
const createSepaTransfer = async ({
  fromAccount,
  toAccount,
  amount,
  currency = 'BGN',
  recipientName,
  description = '',
  reference = '',
}) => {
  try {
    const transferData = {
      from_account: fromAccount,
      to_account: toAccount,
      amount: parseFloat(amount),
      currency,
      recipient_name: recipientName,
      description,
      reference,
      transaction_type: 'SEPA_TRANSFER',
      timestamp: new Date().toISOString(),
    };
    
    logger.info('Creating SEPA transfer:', { fromAccount, toAccount, amount });
    
    const response = await retryRequest(() =>
      easyPayClient.post('/transfers/sepa', transferData)
    );
    
    const result = {
      success: true,
      transactionId: response.data.transaction_id,
      status: response.data.status,
      reference: response.data.reference_number,
      timestamp: response.data.timestamp,
      fee: response.data.fee || 0,
    };
    
    logger.info('SEPA transfer created:', result);
    
    return result;
  } catch (error) {
    logger.error('Error creating SEPA transfer:', error);
    
    if (error.response) {
      throw new Error(error.response.data.message || 'Transfer failed');
    }
    
    throw new Error('Failed to create transfer. Please try again.');
  }
};

/**
 * Process bill payment
 */
const processBillPayment = async ({
  fromAccount,
  providerCode,
  billAccountNumber,
  amount,
  currency = 'BGN',
  description = '',
}) => {
  try {
    const paymentData = {
      from_account: fromAccount,
      provider_code: providerCode,
      bill_account_number: billAccountNumber,
      amount: parseFloat(amount),
      currency,
      description,
      transaction_type: 'BILL_PAYMENT',
      timestamp: new Date().toISOString(),
    };
    
    logger.info('Processing bill payment:', { providerCode, amount });
    
    const response = await retryRequest(() =>
      easyPayClient.post('/bills/pay', paymentData)
    );
    
    const result = {
      success: true,
      transactionId: response.data.transaction_id,
      status: response.data.status,
      reference: response.data.reference_number,
      timestamp: response.data.timestamp,
      fee: response.data.fee || 0,
      providerName: response.data.provider_name,
    };
    
    logger.info('Bill payment processed:', result);
    
    return result;
  } catch (error) {
    logger.error('Error processing bill payment:', error);
    
    if (error.response) {
      throw new Error(error.response.data.message || 'Payment failed');
    }
    
    throw new Error('Failed to process payment. Please try again.');
  }
};

/**
 * Check transaction status
 */
const checkTransactionStatus = async (transactionId) => {
  try {
    // Check cache first
    const cacheKey = `transaction:${transactionId}`;
    const cached = await getCache(cacheKey);
    
    if (cached && cached.status !== 'PENDING') {
      logger.debug('Transaction status retrieved from cache');
      return cached;
    }
    
    const response = await retryRequest(() =>
      easyPayClient.get(`/transactions/${transactionId}`)
    );
    
    const status = {
      transactionId,
      status: response.data.status,
      amount: response.data.amount,
      currency: response.data.currency,
      timestamp: response.data.timestamp,
      details: response.data.details,
    };
    
    // Cache completed transactions for 5 minutes
    if (status.status !== 'PENDING') {
      await setCache(cacheKey, status, 300);
    }
    
    return status;
  } catch (error) {
    logger.error('Error checking transaction status:', error);
    throw new Error('Failed to check transaction status');
  }
};

/**
 * Get bill provider details
 */
const getBillProviderDetails = async (providerCode) => {
  try {
    // Check cache first
    const cacheKey = `provider:${providerCode}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const response = await retryRequest(() =>
      easyPayClient.get(`/bills/providers/${providerCode}`)
    );
    
    const provider = {
      code: providerCode,
      name: response.data.name,
      category: response.data.category,
      minAmount: response.data.min_amount,
      maxAmount: response.data.max_amount,
      fee: response.data.fee,
      active: response.data.active,
    };
    
    // Cache for 1 hour
    await setCache(cacheKey, provider, 3600);
    
    return provider;
  } catch (error) {
    logger.error('Error getting provider details:', error);
    throw new Error('Failed to get provider information');
  }
};

/**
 * Validate account number
 */
const validateAccount = async (accountNumber) => {
  try {
    const response = await retryRequest(() =>
      easyPayClient.post('/accounts/validate', { account_number: accountNumber })
    );
    
    return {
      valid: response.data.valid,
      accountName: response.data.account_name || null,
      bank: response.data.bank || null,
    };
  } catch (error) {
    logger.error('Error validating account:', error);
    return {
      valid: false,
      accountName: null,
      bank: null,
    };
  }
};

/**
 * Get transaction receipt
 */
const getTransactionReceipt = async (transactionId) => {
  try {
    const response = await retryRequest(() =>
      easyPayClient.get(`/transactions/${transactionId}/receipt`, {
        responseType: 'blob',
      })
    );
    
    return {
      success: true,
      receipt: response.data,
      contentType: response.headers['content-type'],
    };
  } catch (error) {
    logger.error('Error getting transaction receipt:', error);
    throw new Error('Failed to generate receipt');
  }
};

/**
 * Mock functions for development/testing
 * Remove these in production and use actual EasyPay API
 */
const mockGetAccountBalance = async (accountNumber) => {
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
  return {
    account: accountNumber,
    available: 1000.00 + Math.random() * 5000,
    currency: 'BGN',
    timestamp: new Date().toISOString(),
  };
};

const mockCreateSepaTransfer = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    success: true,
    transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`,
    status: 'COMPLETED',
    reference: `REF${Date.now()}`,
    timestamp: new Date().toISOString(),
    fee: 0.50,
  };
};

const mockProcessBillPayment = async (data) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    success: true,
    transactionId: `BILL${Date.now()}${Math.floor(Math.random() * 1000)}`,
    status: 'COMPLETED',
    reference: `BILLREF${Date.now()}`,
    timestamp: new Date().toISOString(),
    fee: 0.30,
    providerName: data.providerCode,
  };
};

// Export functions - use mock in development
const useMock = process.env.USE_MOCK_EASYPAY === 'true';

module.exports = {
  getAccountBalance: useMock ? mockGetAccountBalance : getAccountBalance,
  createSepaTransfer: useMock ? mockCreateSepaTransfer : createSepaTransfer,
  processBillPayment: useMock ? mockProcessBillPayment : processBillPayment,
  checkTransactionStatus,
  getBillProviderDetails,
  validateAccount,
  getTransactionReceipt,
};
