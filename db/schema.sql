-- EasyPay Autonomous Kiosk Database Schema
-- PostgreSQL 15+

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table with 3FA (EГН + PIN + Face)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    egn VARCHAR(10) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    face_encoding TEXT,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    account_number VARCHAR(34) UNIQUE NOT NULL, -- IBAN format
    phone_number VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT egn_length CHECK (LENGTH(egn) = 10),
    CONSTRAINT balance_positive CHECK (balance >= 0)
);

-- Transactions table (complete audit trail)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- DEPOSIT, WITHDRAWAL, TRANSFER, BILL_PAYMENT
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'BGN',
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED, CANCELLED
    easypay_transaction_id VARCHAR(255),
    reference_number VARCHAR(100),
    recipient_account VARCHAR(34),
    recipient_name VARCHAR(255),
    bill_provider VARCHAR(100),
    bill_account_number VARCHAR(100),
    description TEXT,
    error_message TEXT,
    ip_address VARCHAR(45),
    device_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    CONSTRAINT amount_positive CHECK (amount > 0),
    CONSTRAINT valid_transaction_type CHECK (
        transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'BILL_PAYMENT')
    ),
    CONSTRAINT valid_status CHECK (
        status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')
    )
);

-- Audit logs table (security events)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(255),
    status VARCHAR(50) NOT NULL, -- SUCCESS, FAILURE
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_audit_status CHECK (status IN ('SUCCESS', 'FAILURE'))
);

-- Sessions table for JWT token management
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bill providers table
CREATE TABLE IF NOT EXISTS bill_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_code VARCHAR(50) UNIQUE NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- ELECTRICITY, WATER, TELECOM, INTERNET, etc.
    easypay_code VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_egn ON users(egn);
CREATE INDEX idx_users_account_number ON users(account_number);
CREATE INDEX idx_users_is_active ON users(is_active);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_easypay_id ON transactions(easypay_transaction_id);
CREATE INDEX idx_transactions_reference ON transactions(reference_number);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX idx_bill_providers_code ON bill_providers(provider_code);
CREATE INDEX idx_bill_providers_active ON bill_providers(is_active);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample bill providers
INSERT INTO bill_providers (provider_code, provider_name, category, easypay_code, is_active) VALUES
('CEZ_BG', 'ЧЕЗ България', 'ELECTRICITY', 'CEZ001', true),
('EVN_BG', 'EVN България', 'ELECTRICITY', 'EVN001', true),
('VIVACOM', 'Vivacom', 'TELECOM', 'VIV001', true),
('A1_BG', 'А1 България', 'TELECOM', 'A1001', true),
('YETTEL', 'Yettel', 'TELECOM', 'YET001', true),
('SOFIA_WATER', 'Софийска вода', 'WATER', 'SW001', true),
('BULSATCOM', 'Bulsatcom', 'TV_INTERNET', 'BUL001', true)
ON CONFLICT (provider_code) DO NOTHING;

-- Create view for user transaction summary
CREATE OR REPLACE VIEW user_transaction_summary AS
SELECT 
    u.id as user_id,
    u.egn,
    u.full_name,
    u.balance,
    COUNT(t.id) as total_transactions,
    SUM(CASE WHEN t.transaction_type = 'DEPOSIT' AND t.status = 'COMPLETED' THEN t.amount ELSE 0 END) as total_deposits,
    SUM(CASE WHEN t.transaction_type = 'WITHDRAWAL' AND t.status = 'COMPLETED' THEN t.amount ELSE 0 END) as total_withdrawals,
    SUM(CASE WHEN t.transaction_type = 'TRANSFER' AND t.status = 'COMPLETED' THEN t.amount ELSE 0 END) as total_transfers,
    SUM(CASE WHEN t.transaction_type = 'BILL_PAYMENT' AND t.status = 'COMPLETED' THEN t.amount ELSE 0 END) as total_bill_payments,
    MAX(t.created_at) as last_transaction_date
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id
GROUP BY u.id, u.egn, u.full_name, u.balance;

-- Create function to validate EGN checksum
CREATE OR REPLACE FUNCTION validate_egn(egn_input VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    weights INTEGER[] := ARRAY[2,4,8,5,10,9,7,3,6];
    sum INTEGER := 0;
    checksum INTEGER;
    i INTEGER;
BEGIN
    -- Check length
    IF LENGTH(egn_input) != 10 THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate checksum
    FOR i IN 1..9 LOOP
        sum := sum + (SUBSTRING(egn_input FROM i FOR 1)::INTEGER * weights[i]);
    END LOOP;
    
    checksum := sum % 11;
    IF checksum = 10 THEN
        checksum := 0;
    END IF;
    
    RETURN checksum = SUBSTRING(egn_input FROM 10 FOR 1)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust user as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO easypay_admin;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO easypay_admin;
