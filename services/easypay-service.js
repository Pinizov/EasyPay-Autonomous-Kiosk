// backend/services/easypayService.js
// Complete EasyPay API Integration

const axios = require('axios');

class EasyPayService {
  constructor() {
    this.baseURL = process.env.EASYPAY_BASE_URL || 'https://demo.epay.bg/xdev/api/psd2/';
    this.appId = process.env.EASYPAY_APP_ID;
    this.appSecret = process.env.EASYPAY_APP_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get Access Token
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(`${this.baseURL}oauth/token`, {
        grant_type: 'client_credentials',
        client_id: this.appId,
        client_secret: this.appSecret
      }, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + ((response.data.expires_in - 60) * 1000);

      console.log('✓ EasyPay access token obtained');
      return this.accessToken;
    } catch (error) {
      console.error(`EasyPay auth error: ${error.message}`);
      throw new Error('Failed to authenticate with EasyPay');
    }
  }

  // Send Money Transfer (SEPA)
  async sendTransfer(fromAccount, toIBAN, amount, purpose, userId) {
    try {
      const token = await this.getAccessToken();

      // Step 1: Initialize transfer
      const initResponse = await axios.post(
        `${this.baseURL}send/init`,
        {
          from_account: fromAccount,
          to_iban: toIBAN,
          amount: amount,
          purpose: purpose || 'Payment from Autonomous Kiosk',
          currency: 'BGN'
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );

      console.log(`✓ Transfer initialized: ${initResponse.data.transaction_id}`);

      return {
        success: true,
        transaction_id: initResponse.data.transaction_id,
        status: 'awaiting_confirmation',
        message: 'Transfer initialized. Awaiting OTP confirmation.'
      };
    } catch (error) {
      console.error(`Transfer init error: ${error.message}`);
      throw error;
    }
  }

  // Confirm Transfer with OTP
  async confirmTransfer(transactionId, otpCode) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseURL}send/pay`,
        {
          transaction_id: transactionId,
          confirmation_code: otpCode
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );

      if (response.data.status === 'completed') {
        console.log(`✓ Transfer completed: ${transactionId}`);
        return {
          success: true,
          status: 'completed',
          transaction_id: transactionId,
          completion_time: response.data.completion_time
        };
      }

      return {
        success: false,
        status: response.data.status,
        message: 'Transfer not completed'
      };
    } catch (error) {
      console.error(`Transfer confirm error: ${error.message}`);
      throw error;
    }
  }

  // Pay Utility Bills (ЕВН, Булгартелеком и т.н.)
  async payBill(accountNumber, billerCode, amount, description) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseURL}bills/pay`,
        {
          account_number: accountNumber,
          biller_code: billerCode,
          amount: amount,
          currency: 'BGN',
          description: description || 'Bill payment from Autonomous Kiosk'
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );

      console.log(`✓ Bill paid: ${billerCode} - ${accountNumber}`);

      return {
        success: true,
        payment_reference: response.data.reference,
        status: 'completed',
        amount: amount,
        biller: billerCode,
        message: 'Bill payment successful'
      };
    } catch (error) {
      console.error(`Bill payment error: ${error.message}`);
      throw error;
    }
  }

  // Check Account Balance
  async checkBalance(accountId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseURL}accounts/${accountId}/balance`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        }
      );

      console.log(`✓ Balance checked: ${response.data.balance} ${response.data.currency}`);

      return {
        balance: response.data.balance,
        currency: response.data.currency,
        available: response.data.available || response.data.balance
      };
    } catch (error) {
      console.error(`Balance check error: ${error.message}`);
      return { balance: 0, currency: 'BGN', available: 0 };
    }
  }

  // Get Transaction Status
  async getTransactionStatus(transactionId) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseURL}send/check?transaction_id=${transactionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        }
      );

      return {
        transaction_id: transactionId,
        status: response.data.status,
        amount: response.data.amount,
        timestamp: response.data.timestamp
      };
    } catch (error) {
      console.error(`Status check error: ${error.message}`);
      throw error;
    }
  }

  // List Available Billers
  async getAvailableBillers() {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseURL}billers/list`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );

      return response.data.billers || [];
    } catch (error) {
      console.error(`Billers list error: ${error.message}`);
      return [];
    }
  }

  // Mobile Recharge (Теглене на мобилен)
  async mobileRecharge(phoneNumber, amount, operator) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseURL}mobile/recharge`,
        {
          phone_number: phoneNumber,
          amount: amount,
          operator: operator, // 'telenor', 'vodafone', 'bgmobile', etc.
          currency: 'BGN'
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );

      console.log(`✓ Mobile recharge: ${phoneNumber} - ${amount} BGN`);

      return {
        success: true,
        phone: phoneNumber,
        amount: amount,
        operator: operator,
        status: 'completed'
      };
    } catch (error) {
      console.error(`Mobile recharge error: ${error.message}`);
      throw error;
    }
  }

  // Get Exchange Rates
  async getExchangeRates() {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseURL}rates/current`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        }
      );

      return response.data.rates || {};
    } catch (error) {
      console.error(`Exchange rates error: ${error.message}`);
      return {};
    }
  }
}

module.exports = new EasyPayService();
