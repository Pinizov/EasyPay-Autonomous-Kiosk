import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';

const BillPaymentScreen = ({ user, token, balance, updateBalance, apiUrl }) => {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [billAccountNumber, setBillAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await axios.get(`${apiUrl}/bills/providers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setProviders(response.data.providers);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast.error('Грешка при зареждане на доставчици');
    }
  };

  const handlePayment = async () => {
    const paymentAmount = parseFloat(amount);

    if (!selectedProvider) {
      toast.error('Моля, изберете доставчик');
      return;
    }

    if (!billAccountNumber) {
      toast.error('Моля, въведете номер на сметка');
      return;
    }

    if (!paymentAmount || paymentAmount < 1) {
      toast.error('Моля, въведете валидна сума');
      return;
    }

    if (paymentAmount > balance) {
      toast.error('Недостатъчна наличност');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${apiUrl}/bills/pay`,
        {
          amount: paymentAmount,
          provider_code: selectedProvider.code,
          bill_account_number: billAccountNumber,
          description: `Плащане на ${selectedProvider.name}`,
          currency: 'BGN',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        toast.success('Успешно плащане!');
        updateBalance(response.data.transaction.newBalance);
        setTimeout(() => navigate('/menu'), 2000);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.response?.data?.error || 'Грешка при плащане');
    } finally {
      setLoading(false);
    }
  };

  const providersByCategory = providers.reduce((acc, provider) => {
    const category = provider.category || 'OTHER';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(provider);
    return acc;
  }, {});

  const categoryLabels = {
    ELECTRICITY: '⚡ Ток',
    WATER: '💧 Вода',
    TELECOM: '📱 Телекомуникации',
    TV_INTERNET: '📺 ТВ и Интернет',
    OTHER: '📄 Други',
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">📄 Плащане на Сметки</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/menu')}>
          Назад
        </button>
      </div>

      <div className="balance-display" style={{ marginBottom: '30px' }}>
        <div className="balance-label">Налична Сума</div>
        <div className="balance-amount">{balance.toFixed(2)} лв</div>
      </div>

      <div className="card card-large">
        {!selectedProvider ? (
          <>
            <h3 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>
              Изберете Доставчик:
            </h3>
            {Object.entries(providersByCategory).map(([category, categoryProviders]) => (
              <div key={category} style={{ marginBottom: '30px' }}>
                <h4 style={{ fontSize: '1.4rem', marginBottom: '15px', color: '#6C757D' }}>
                  {categoryLabels[category] || category}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                  {categoryProviders.map((provider) => (
                    <button
                      key={provider.code}
                      className="btn btn-primary"
                      onClick={() => setSelectedProvider(provider)}
                      style={{ padding: '25px', fontSize: '1.3rem' }}
                    >
                      {provider.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="alert alert-info" style={{ marginBottom: '25px' }}>
              <strong>Избран доставчик:</strong> {selectedProvider.name}
            </div>

            <div className="input-group">
              <label>Номер на Клиент/Абонат:</label>
              <input
                type="text"
                value={billAccountNumber}
                onChange={(e) => setBillAccountNumber(e.target.value)}
                placeholder="Въведете номер"
                maxLength="100"
              />
            </div>

            <div className="input-group">
              <label>Сума за Плащане (лв):</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="1"
                max={balance}
              />
            </div>

            <div className="alert alert-info" style={{ marginBottom: '20px' }}>
              <strong>Такса:</strong> 0.30 лв
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedProvider(null);
                  setBillAccountNumber('');
                  setAmount('');
                }}
                style={{ flex: 1 }}
              >
                Смяна на Доставчик
              </button>
              <button
                className="btn btn-success btn-large"
                onClick={handlePayment}
                disabled={loading}
                style={{ flex: 2 }}
              >
                {loading ? 'Обработка...' : `Плати ${amount || '0.00'} лв`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BillPaymentScreen;
