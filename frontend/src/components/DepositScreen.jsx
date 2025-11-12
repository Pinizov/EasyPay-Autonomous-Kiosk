import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';

const DepositScreen = ({ user, token, balance, updateBalance, apiUrl }) => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAmountInput = (digit) => {
    const newAmount = amount + digit;
    if (parseFloat(newAmount) <= 10000) {
      setAmount(newAmount);
    }
  };

  const handleClear = () => {
    setAmount('');
  };

  const handleBackspace = () => {
    setAmount(amount.slice(0, -1));
  };

  const quickAmounts = [10, 20, 50, 100, 200, 500];

  const handleDeposit = async () => {
    const depositAmount = parseFloat(amount);

    if (!depositAmount || depositAmount < 1) {
      toast.error('Моля, въведете валидна сума');
      return;
    }

    if (depositAmount > 10000) {
      toast.error('Максималната сума за депозит е 10000 лв');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${apiUrl}/deposits/record`,
        {
          amount: depositAmount,
          currency: 'BGN',
          description: 'Депозит в брой',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        toast.success(`Успешен депозит на ${depositAmount.toFixed(2)} лв`);
        updateBalance(response.data.transaction.newBalance);
        setAmount('');
        
        // Navigate back to menu after 2 seconds
        setTimeout(() => {
          navigate('/menu');
        }, 2000);
      }
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error(error.response?.data?.error || 'Грешка при депозит');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">💵 Депозит</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/menu')}>
          Назад
        </button>
      </div>

      <div className="balance-display" style={{ marginBottom: '30px' }}>
        <div className="balance-label">Текущ Баланс</div>
        <div className="balance-amount">{balance.toFixed(2)} лв</div>
      </div>

      <div className="card card-large">
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h3 style={{ fontSize: '1.8rem', marginBottom: '15px' }}>Въведете Сума</h3>
          <div
            style={{
              fontSize: '4rem',
              fontWeight: '700',
              color: '#28A745',
              padding: '30px',
              background: '#F8F9FA',
              borderRadius: '12px',
              minHeight: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {amount || '0.00'} лв
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '15px', fontWeight: '600' }}>
            Бързи суми:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            {quickAmounts.map((qty) => (
              <button
                key={qty}
                className="btn btn-primary"
                onClick={() => setAmount(qty.toString())}
                style={{ fontSize: '1.5rem' }}
              >
                {qty} лв
              </button>
            ))}
          </div>
        </div>

        <div className="keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              className="keypad-btn"
              onClick={() => handleAmountInput(num.toString())}
            >
              {num}
            </button>
          ))}
          <button className="keypad-btn" onClick={handleClear}>
            C
          </button>
          <button className="keypad-btn" onClick={() => handleAmountInput('0')}>
            0
          </button>
          <button className="keypad-btn" onClick={handleBackspace}>
            ⌫
          </button>
        </div>

        <button
          className="btn btn-success btn-large"
          onClick={handleDeposit}
          disabled={!amount || parseFloat(amount) < 1 || loading}
          style={{ width: '100%', marginTop: '30px' }}
        >
          {loading ? 'Обработка...' : `Депозирай ${amount || '0.00'} лв`}
        </button>

        <div className="alert alert-info" style={{ marginTop: '20px' }}>
          <strong>Инструкции:</strong> Моля, поставете банкноти една по една в приемника.
          Максимална сума: 10,000 лв
        </div>
      </div>
    </div>
  );
};

export default DepositScreen;
