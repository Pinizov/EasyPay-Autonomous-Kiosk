/**
 * EasyPay Service Tests
 * Tests for EasyPay API integration
 */

const {
  getAccountBalance,
  createSepaTransfer,
  processBillPayment,
  checkTransactionStatus,
  getBillProviderDetails,
  validateAccount
} = require('../src/services/easypay-service');

// Mock axios
jest.mock('axios');
const axios = require('axios');

describe('EasyPay Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccountBalance', () => {
    it('should retrieve account balance successfully', async () => {
      const mockResponse = {
        data: {
          accountNumber: 'BG80BNBG96611020345678',
          balance: 1500.50,
          currency: 'BGN',
          status: 'ACTIVE'
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const result = await getAccountBalance('user-123');

      expect(result.balance).toBe(1500.50);
      expect(result.currency).toBe('BGN');
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/accounts/'),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(getAccountBalance('user-123')).rejects.toThrow();
    });

    it('should retry on temporary failures', async () => {
      axios.get
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          data: { balance: 1000, currency: 'BGN' }
        });

      const result = await getAccountBalance('user-123');

      expect(result.balance).toBe(1000);
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('createSepaTransfer', () => {
    it('should create SEPA transfer successfully', async () => {
      const transferData = {
        fromAccount: 'BG80BNBG96611020111111',
        toAccount: 'BG80BNBG96611020222222',
        amount: 250.00,
        recipientName: 'John Doe',
        description: 'Test transfer'
      };

      const mockResponse = {
        data: {
          transactionId: 'EP-TX-12345',
          status: 'COMPLETED',
          timestamp: new Date().toISOString(),
          referenceNumber: 'REF-67890'
        }
      };

      axios.post.mockResolvedValueOnce(mockResponse);

      const result = await createSepaTransfer(transferData);

      expect(result.transactionId).toBe('EP-TX-12345');
      expect(result.status).toBe('COMPLETED');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/transfers/sepa'),
        expect.objectContaining({
          amount: 250.00,
          toAccount: transferData.toAccount
        }),
        expect.any(Object)
      );
    });

    it('should validate transfer amount', async () => {
      const transferData = {
        fromAccount: 'BG80BNBG96611020111111',
        toAccount: 'BG80BNBG96611020222222',
        amount: -100, // Invalid negative amount
        recipientName: 'John Doe'
      };

      await expect(createSepaTransfer(transferData)).rejects.toThrow();
    });

    it('should handle insufficient funds error', async () => {
      const transferData = {
        fromAccount: 'BG80BNBG96611020111111',
        toAccount: 'BG80BNBG96611020222222',
        amount: 10000,
        recipientName: 'John Doe'
      };

      const mockError = {
        response: {
          status: 400,
          data: { error: 'Insufficient funds' }
        }
      };

      axios.post.mockRejectedValueOnce(mockError);

      await expect(createSepaTransfer(transferData)).rejects.toThrow('Insufficient funds');
    });
  });

  describe('processBillPayment', () => {
    it('should process bill payment successfully', async () => {
      const paymentData = {
        providerCode: 'CEZ',
        billAccountNumber: '1234567890',
        amount: 85.50,
        customerName: 'Jane Smith'
      };

      const mockResponse = {
        data: {
          transactionId: 'EP-BILL-54321',
          status: 'COMPLETED',
          providerConfirmation: 'CONF-98765'
        }
      };

      axios.post.mockResolvedValueOnce(mockResponse);

      const result = await processBillPayment(paymentData);

      expect(result.transactionId).toBe('EP-BILL-54321');
      expect(result.status).toBe('COMPLETED');
      expect(result.providerConfirmation).toBeDefined();
    });

    it('should validate bill provider code', async () => {
      const paymentData = {
        providerCode: 'INVALID',
        billAccountNumber: '1234567890',
        amount: 50.00
      };

      await expect(processBillPayment(paymentData)).rejects.toThrow();
    });
  });

  describe('checkTransactionStatus', () => {
    it('should check transaction status', async () => {
      const mockResponse = {
        data: {
          transactionId: 'EP-TX-12345',
          status: 'COMPLETED',
          completedAt: new Date().toISOString()
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const result = await checkTransactionStatus('EP-TX-12345');

      expect(result.status).toBe('COMPLETED');
      expect(result.completedAt).toBeDefined();
    });

    it('should handle pending transactions', async () => {
      const mockResponse = {
        data: {
          transactionId: 'EP-TX-99999',
          status: 'PENDING'
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const result = await checkTransactionStatus('EP-TX-99999');

      expect(result.status).toBe('PENDING');
    });
  });

  describe('getBillProviderDetails', () => {
    it('should retrieve bill provider details', async () => {
      const mockResponse = {
        data: {
          providerCode: 'CEZ',
          name: 'ЧЕЗ Разпределение',
          category: 'ELECTRICITY',
          accountNumberFormat: '^[0-9]{10}$',
          minAmount: 1.00,
          maxAmount: 5000.00
        }
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const result = await getBillProviderDetails('CEZ');

      expect(result.providerCode).toBe('CEZ');
      expect(result.category).toBe('ELECTRICITY');
      expect(result.maxAmount).toBe(5000.00);
    });
  });

  describe('validateAccount', () => {
    it('should validate IBAN format', async () => {
      const validIban = 'BG80BNBG96611020345678';
      
      const mockResponse = {
        data: { valid: true, accountExists: true }
      };

      axios.post.mockResolvedValueOnce(mockResponse);

      const result = await validateAccount(validIban);

      expect(result.valid).toBe(true);
      expect(result.accountExists).toBe(true);
    });

    it('should reject invalid IBAN', async () => {
      const invalidIban = 'INVALID';

      const mockResponse = {
        data: { valid: false, error: 'Invalid IBAN format' }
      };

      axios.post.mockResolvedValueOnce(mockResponse);

      const result = await validateAccount(invalidIban);

      expect(result.valid).toBe(false);
    });
  });
});
