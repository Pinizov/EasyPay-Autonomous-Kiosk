// backend/services/easypay-service.js
const axios = require('axios');
class EasyPayService {
  constructor() {
    this.baseURL = process.env.EASYPAY_BASE_URL || 'https://demo.epay.bg/xdev/api/psd2/';
    this.appId = process.env.EASYPAY_APP_ID;
    this.appSecret = process.env.EASYPAY_APP_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry > Date.now()) return this.accessToken;
    const response = await axios.post(`${this.baseURL}oauth/token`, {
      grant_type: 'client_credentials',
      client_id: this.appId,
      client_secret: this.appSecret,
    }, { headers: { 'Content-Type': 'application/json' } });
    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + ((response.data.expires_in - 60) * 1000);
    return this.accessToken;
  }
  async sendTransfer(fromAccount, toIBAN, amount, purpose) {
    const token = await this.getAccessToken();
    const initRes = await axios.post(
      `${this.baseURL}send/init`,
      { from_account: fromAccount, to_iban: toIBAN, amount, purpose, currency: 'BGN' },
      { headers: { Authorization: `Bearer ${token}` }}
    );
    return {
      success: true,
      transaction_id: initRes.data.transaction_id,
      status: 'awaiting_confirmation',
      message: 'Transfer initialized. Awaiting OTP confirmation.'
    };
  }
  async payBill(accountNumber, billerCode, amount) {
    const token = await this.getAccessToken();
    const response = await axios.post(
      `${this.baseURL}bills/pay`,
      { account_number: accountNumber, biller_code: billerCode, amount, currency: 'BGN' },
      { headers: { Authorization: `Bearer ${token}` }}
    );
    return {
      success: true,
      payment_reference: response.data.reference,
      status: 'completed',
      amount: amount,
      biller: billerCode,
      message: 'Bill payment successful'
    };
  }
  // ...other methods (see full file above)
}
module.exports = new EasyPayService();