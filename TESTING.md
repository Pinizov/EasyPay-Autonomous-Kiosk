# Testing Guide

## Overview
This project includes comprehensive unit and integration tests for both backend and frontend components.

## Backend Tests

### Test Structure
```
tests/
├── setup.js              # Global test configuration
├── auth.test.js          # Authentication tests
├── easypay-service.test.js  # EasyPay API integration tests
└── validation.test.js    # Validation middleware tests
```

### Running Backend Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Database Setup

1. Create test database:
```bash
psql -U postgres
CREATE DATABASE easypay_test;
\c easypay_test
\i db/schema.sql
```

2. Configure test environment:
```bash
cp .env.test .env.test.local
# Edit .env.test.local with your test database credentials
```

### Backend Test Coverage

#### Authentication Tests (`tests/auth.test.js`)
- ✅ User registration with valid EGN and PIN
- ✅ EGN validation (length, format, checksum)
- ✅ Duplicate user prevention
- ✅ Login with valid credentials
- ✅ Failed login attempts tracking
- ✅ JWT token generation and verification
- ✅ Session management

#### Deposit Tests (`tests/auth.test.js`)
- ✅ Deposit recording with valid amount
- ✅ Balance update after deposit
- ✅ Authentication requirement
- ✅ Invalid amount rejection (negative, zero)
- ✅ Transaction history logging

#### EasyPay Service Tests (`tests/easypay-service.test.js`)
- ✅ Account balance retrieval
- ✅ SEPA transfer creation
- ✅ Bill payment processing
- ✅ Transaction status checking
- ✅ Provider details retrieval
- ✅ IBAN validation
- ✅ Retry logic on temporary failures
- ✅ Error handling for API failures
- ✅ Insufficient funds detection

#### Validation Tests (`tests/validation.test.js`)
- ✅ EGN validation (Bulgarian ID number)
  - Format validation (10 digits)
  - Checksum algorithm verification
  - Date components validation (month, day)
- ✅ IBAN validation
  - Length validation (country-specific)
  - Check digit verification
  - Character validation
  - Multiple country formats (BG, DE, GB, FR)
- ✅ Input sanitization (XSS prevention)

### Example Test Output

```bash
$ npm test

PASS  tests/validation.test.js
  ✓ validates correct EGN (5 ms)
  ✓ rejects invalid EGN checksum (2 ms)
  ✓ validates Bulgarian IBAN (3 ms)
  ✓ validates international IBANs (4 ms)

PASS  tests/auth.test.js
  ✓ registers new user (125 ms)
  ✓ prevents duplicate registration (89 ms)
  ✓ logs in with valid credentials (112 ms)
  ✓ rejects invalid PIN (95 ms)

PASS  tests/easypay-service.test.js
  ✓ retrieves account balance (45 ms)
  ✓ creates SEPA transfer (67 ms)
  ✓ processes bill payment (58 ms)
  ✓ retries on API failure (134 ms)

Test Suites: 3 passed, 3 total
Tests:       24 passed, 24 total
Coverage:    87.5% Statements 456/521
             82.3% Branches 89/108
             91.2% Functions 52/57
             87.1% Lines 442/507
```

## Frontend Tests

### Test Structure
```
frontend/src/components/__tests__/
└── components.test.jsx   # React component tests
```

### Running Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode (interactive)
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Frontend Test Coverage

#### LoginScreen Tests
- ✅ Renders EGN input field
- ✅ Validates 10-digit EGN format
- ✅ Shows PIN keypad after EGN entry
- ✅ Accepts PIN via numeric keypad
- ✅ Captures face image with webcam
- ✅ Calls authentication API
- ✅ Handles login success/failure

#### MainMenu Tests
- ✅ Displays user name and balance
- ✅ Renders all menu options (Deposit, Transfer, Bills, History)
- ✅ Navigation to different screens
- ✅ Logout functionality

#### DepositScreen Tests
- ✅ Renders amount input and keypad
- ✅ Numeric keypad input
- ✅ Quick amount buttons (10, 20, 50, 100, 200, 500 лв)
- ✅ Deposit submission
- ✅ Balance update after deposit
- ✅ Maximum amount validation (10,000 лв)

#### TransferScreen Tests
- ✅ Renders IBAN, recipient name, amount fields
- ✅ IBAN format validation
- ✅ Insufficient balance detection
- ✅ Transfer submission
- ✅ Balance update after transfer
- ✅ Error handling

### Mock Setup

#### Axios Mocking
```javascript
jest.mock('axios');
axios.post.mockResolvedValueOnce({ data: { success: true } });
```

#### Webcam Mocking
```javascript
jest.mock('react-webcam', () => {
  return function Webcam() {
    return <div data-testid="webcam-mock">Webcam</div>;
  };
});
```

#### LocalStorage Mocking
```javascript
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
global.localStorage = localStorageMock;
```

## Integration Testing

### Full Flow Tests

#### 3-Factor Authentication Flow
1. Enter valid EGN
2. Enter 4-digit PIN via keypad
3. Capture face image with webcam
4. Verify with backend API
5. Receive JWT token
6. Navigate to main menu

#### Deposit Flow
1. Authenticate user
2. Navigate to Deposit screen
3. Enter amount (via keypad or quick buttons)
4. Submit deposit
5. Verify transaction recorded in database
6. Check balance updated
7. View transaction in history

#### Transfer Flow
1. Authenticate user
2. Navigate to Transfer screen
3. Enter recipient IBAN
4. Enter recipient name
5. Enter amount
6. Verify sufficient balance
7. Submit transfer to EasyPay API
8. Check transaction status
9. Update balance
10. Log transaction

#### Bill Payment Flow
1. Authenticate user
2. Navigate to Bills screen
3. Select provider category (Electricity, Water, Telecom, etc.)
4. Select specific provider
5. Enter bill account number
6. Enter amount
7. Submit payment to EasyPay API
8. Receive provider confirmation
9. Update balance
10. Store receipt

## Continuous Integration

### GitHub Actions Workflow (Example)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: easypay_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v3
  
  frontend:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm ci
      - run: cd frontend && npm test -- --coverage
```

## Test Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach` and `afterEach` for setup/cleanup
- Clean up test data after each test

### 2. Descriptive Test Names
```javascript
it('should reject deposit with negative amount', async () => {
  // Clear test intention
});
```

### 3. AAA Pattern (Arrange, Act, Assert)
```javascript
it('should create SEPA transfer', async () => {
  // Arrange
  const transferData = { amount: 100, iban: 'BG...' };
  
  // Act
  const result = await createSepaTransfer(transferData);
  
  // Assert
  expect(result.status).toBe('COMPLETED');
});
```

### 4. Mock External Dependencies
- Mock EasyPay API calls
- Mock AI face recognition service
- Mock Redis for unit tests
- Use test database for integration tests

### 5. Coverage Goals
- Aim for >80% code coverage
- Focus on critical paths (auth, transactions)
- Test edge cases and error conditions

## Troubleshooting

### Test Database Connection Fails
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify test database exists
psql -U postgres -l | grep easypay_test

# Recreate test database
dropdb easypay_test
createdb easypay_test
psql -U postgres -d easypay_test -f db/schema.sql
```

### Frontend Tests Timeout
```javascript
// Increase timeout in jest.config.json
{
  "testTimeout": 10000
}
```

### Mock Not Working
```javascript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Coverage Not Accurate
```bash
# Clear Jest cache
npm test -- --clearCache

# Run with coverage
npm test -- --coverage --verbose
```

## Performance Testing

### Load Testing with Artillery

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery quick --count 10 --num 50 http://localhost:5000/api/auth/verify
```

### Example Artillery Config
```yaml
# artillery-test.yml
config:
  target: 'http://localhost:5000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
    - post:
        url: '/api/auth/verify'
        json:
          egn: '1234567890'
          pin: '1234'
```

## Security Testing

### SQL Injection Tests
```javascript
it('should prevent SQL injection in EGN field', async () => {
  const maliciousInput = "1234567890' OR '1'='1";
  
  const response = await request(app)
    .post('/api/auth/verify')
    .send({ egn: maliciousInput, pin: '1234' })
    .expect(401);
  
  expect(response.body.success).toBe(false);
});
```

### XSS Prevention Tests
```javascript
it('should sanitize script tags', () => {
  const dangerous = '<script>alert("XSS")</script>';
  const sanitized = sanitizeInput(dangerous);
  
  expect(sanitized).not.toContain('<script>');
});
```

## Conclusion

This testing suite ensures:
- ✅ Authentication security (3FA)
- ✅ Data validation (EGN, IBAN)
- ✅ Transaction integrity
- ✅ API integration reliability
- ✅ UI component functionality
- ✅ Error handling robustness
- ✅ Security vulnerability prevention

Run tests regularly during development and before deployment!
