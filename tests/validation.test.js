/**
 * Validation Middleware Tests
 * Tests for EGN and IBAN validation
 */

const { validateEGN, validateIBAN } = require('../src/middleware/validation');

describe('Validation Middleware', () => {
  describe('validateEGN', () => {
    it('should validate correct EGN', () => {
      // Valid Bulgarian EGNs with correct checksums
      const validEgns = [
        '7523169263',
        '8032056031',
        '7501020018'
      ];

      validEgns.forEach(egn => {
        expect(validateEGN(egn)).toBe(true);
      });
    });

    it('should reject EGN with incorrect length', () => {
      const invalidEgns = [
        '123',        // Too short
        '12345678901' // Too long
      ];

      invalidEgns.forEach(egn => {
        expect(validateEGN(egn)).toBe(false);
      });
    });

    it('should reject EGN with invalid characters', () => {
      const invalidEgns = [
        '123456789A',  // Contains letter
        '1234-67890',  // Contains dash
        '1234 67890'   // Contains space
      ];

      invalidEgns.forEach(egn => {
        expect(validateEGN(egn)).toBe(false);
      });
    });

    it('should reject EGN with invalid checksum', () => {
      const invalidEgns = [
        '1234567890', // Invalid checksum
        '9999999999'  // Invalid checksum
      ];

      invalidEgns.forEach(egn => {
        expect(validateEGN(egn)).toBe(false);
      });
    });

    it('should validate EGN date components', () => {
      // EGN with invalid month (13)
      expect(validateEGN('7513169263')).toBe(false);
      
      // EGN with invalid day (32)
      expect(validateEGN('7503329263')).toBe(false);
    });
  });

  describe('validateIBAN', () => {
    it('should validate correct Bulgarian IBAN', () => {
      const validIbans = [
        'BG80BNBG96611020345678',
        'BG18RZBB91550123456789',
        'BG86UNCR70001524167531'
      ];

      validIbans.forEach(iban => {
        expect(validateIBAN(iban)).toBe(true);
      });
    });

    it('should accept IBAN with spaces', () => {
      const iban = 'BG80 BNBG 9661 1020 3456 78';
      expect(validateIBAN(iban)).toBe(true);
    });

    it('should reject IBAN with incorrect length', () => {
      const invalidIbans = [
        'BG80',                    // Too short
        'BG80BNBG966110203456781234' // Too long
      ];

      invalidIbans.forEach(iban => {
        expect(validateIBAN(iban)).toBe(false);
      });
    });

    it('should reject IBAN with invalid country code', () => {
      expect(validateIBAN('XX80BNBG96611020345678')).toBe(false);
    });

    it('should reject IBAN with invalid check digits', () => {
      expect(validateIBAN('BG00BNBG96611020345678')).toBe(false);
    });

    it('should reject IBAN with invalid characters', () => {
      const invalidIbans = [
        'BG80BNBG9661102034567@', // Special character
        'BG80BNBG96611020345678!' // Special character
      ];

      invalidIbans.forEach(iban => {
        expect(validateIBAN(iban)).toBe(false);
      });
    });

    it('should validate non-Bulgarian IBANs', () => {
      const validIbans = [
        'DE89370400440532013000', // German IBAN (22 chars)
        'GB29NWBK60161331926819',  // UK IBAN (22 chars)
        'FR1420041010050500013M02606' // French IBAN (27 chars)
      ];

      validIbans.forEach(iban => {
        expect(validateIBAN(iban)).toBe(true);
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize potentially dangerous input', () => {
      const { sanitizeInput } = require('../src/middleware/security');

      const dangerousInputs = [
        '<script>alert("XSS")</script>',
        'SELECT * FROM users;',
        '../../etc/passwd',
        '<img src=x onerror=alert(1)>'
      ];

      dangerousInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('onerror');
      });
    });
  });
});
