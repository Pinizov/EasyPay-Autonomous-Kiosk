/**
 * Input Validation Middleware
 * Validate and sanitize user inputs
 */

const { body, param, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  
  next();
};

/**
 * EГН validation function
 */
const validateEGN = (egn) => {
  if (!/^\d{10}$/.test(egn)) {
    return false;
  }
  
  // Validate checksum
  const weights = [2, 4, 8, 5, 10, 9, 7, 3, 6];
  let sum = 0;
  
  for (let i = 0; i < 9; i++) {
    sum += parseInt(egn[i]) * weights[i];
  }
  
  let checksum = sum % 11;
  if (checksum === 10) {
    checksum = 0;
  }
  
  return checksum === parseInt(egn[9]);
};

/**
 * IBAN validation function
 */
const validateIBAN = (iban) => {
  // Remove spaces and convert to uppercase
  const cleanedIBAN = iban.replace(/\s/g, '').toUpperCase();
  
  // Check length (Bulgaria IBAN is 22 characters)
  if (!/^BG\d{2}[A-Z0-9]{4}\d{14}$/.test(cleanedIBAN)) {
    return false;
  }
  
  // Validate checksum using mod 97
  const rearranged = cleanedIBAN.slice(4) + cleanedIBAN.slice(0, 4);
  const numericString = rearranged.replace(/[A-Z]/g, char => 
    (char.charCodeAt(0) - 55).toString()
  );
  
  // Calculate mod 97
  let remainder = '';
  for (let i = 0; i < numericString.length; i++) {
    remainder += numericString[i];
    if (remainder.length >= 9) {
      remainder = (parseInt(remainder) % 97).toString();
    }
  }
  
  return parseInt(remainder) % 97 === 1;
};

// Validation rules for different endpoints

const registerValidation = [
  body('egn')
    .trim()
    .custom(validateEGN)
    .withMessage('Invalid EГН'),
  body('full_name')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Full name must be between 3 and 255 characters'),
  body('pin')
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage('PIN must be 4-6 digits'),
  body('account_number')
    .trim()
    .custom(validateIBAN)
    .withMessage('Invalid IBAN'),
  body('phone_number')
    .optional()
    .matches(/^(\+359|0)\d{9}$/)
    .withMessage('Invalid Bulgarian phone number'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email address'),
];

const loginValidation = [
  body('egn')
    .trim()
    .custom(validateEGN)
    .withMessage('Invalid EГН'),
  body('pin')
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage('Invalid PIN'),
];

const depositValidation = [
  body('amount')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Amount must be between 0.01 and 10000'),
  body('currency')
    .optional()
    .isIn(['BGN', 'EUR', 'USD'])
    .withMessage('Invalid currency'),
  body('reference')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference too long'),
];

const transferValidation = [
  body('amount')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Amount must be between 0.01 and 10000'),
  body('recipient_account')
    .trim()
    .custom(validateIBAN)
    .withMessage('Invalid recipient IBAN'),
  body('recipient_name')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Recipient name must be between 3 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description too long'),
];

const billPaymentValidation = [
  body('amount')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Amount must be between 0.01 and 10000'),
  body('provider_code')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Invalid provider code'),
  body('bill_account_number')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Invalid bill account number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description too long'),
];

const uuidValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
];

module.exports = {
  handleValidationErrors,
  validateEGN,
  validateIBAN,
  registerValidation,
  loginValidation,
  depositValidation,
  transferValidation,
  billPaymentValidation,
  uuidValidation,
};
