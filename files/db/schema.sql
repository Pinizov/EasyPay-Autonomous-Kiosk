CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    egn VARCHAR(10) UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    pin_code TEXT NOT NULL, -- bcrypt hash
    face_data TEXT, -- AES-256 encrypted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(32),
    amount NUMERIC(12,2),
    status VARCHAR(32),
    easypay_tx_id VARCHAR(64),
    reference VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    event TEXT,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_tx_user ON transactions(user_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);