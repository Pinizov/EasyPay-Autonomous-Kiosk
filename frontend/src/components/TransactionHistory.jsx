import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import { format } from 'date-fns';

const TransactionHistory = ({ user, token, apiUrl }) => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = filter !== 'ALL' ? `?type=${filter}` : '';
      const response = await axios.get(`${apiUrl}/transactions/history${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setTransactions(response.data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Грешка при зареждане на история');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'DEPOSIT':
        return '💵';
      case 'TRANSFER':
        return '💸';
      case 'BILL_PAYMENT':
        return '📄';
      case 'WITHDRAWAL':
        return '🏧';
      default:
        return '📊';
    }
  };

  const getTransactionLabel = (type) => {
    switch (type) {
      case 'DEPOSIT':
        return 'Депозит';
      case 'TRANSFER':
        return 'Превод';
      case 'BILL_PAYMENT':
        return 'Плащане на Сметка';
      case 'WITHDRAWAL':
        return 'Теглене';
      default:
        return type;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      COMPLETED: { background: '#D4EDDA', color: '#155724' },
      PENDING: { background: '#FFF3CD', color: '#856404' },
      FAILED: { background: '#F8D7DA', color: '#721C24' },
    };

    return (
      <span
        style={{
          padding: '5px 15px',
          borderRadius: '20px',
          fontSize: '1rem',
          fontWeight: '600',
          ...styles[status],
        }}
      >
        {status === 'COMPLETED' ? 'Завършено' : status === 'PENDING' ? 'В процес' : 'Неуспешно'}
      </span>
    );
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">📊 История на Транзакции</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/menu')}>
          Назад
        </button>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '1.2rem', marginBottom: '15px', fontWeight: '600' }}>Филтър:</p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {['ALL', 'DEPOSIT', 'TRANSFER', 'BILL_PAYMENT'].map((type) => (
            <button
              key={type}
              className={`btn ${filter === type ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(type)}
              style={{ padding: '15px 30px' }}
            >
              {type === 'ALL' ? 'Всички' : getTransactionLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <div className="loading-spinner"></div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card card-large" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.5rem', color: '#6C757D' }}>
            Няма налични транзакции
          </p>
        </div>
      ) : (
        <div className="transaction-list">
          {transactions.map((tx) => (
            <div key={tx.id} className="transaction-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                <div style={{ fontSize: '3rem' }}>{getTransactionIcon(tx.type)}</div>
                <div className="transaction-info">
                  <div className="transaction-type">{getTransactionLabel(tx.type)}</div>
                  <div className="transaction-date">
                    {format(new Date(tx.createdAt), 'dd.MM.yyyy HH:mm')}
                  </div>
                  {tx.recipientName && (
                    <div style={{ fontSize: '1.1rem', color: '#6C757D', marginTop: '5px' }}>
                      До: {tx.recipientName}
                    </div>
                  )}
                  {tx.providerName && (
                    <div style={{ fontSize: '1.1rem', color: '#6C757D', marginTop: '5px' }}>
                      {tx.providerName}
                    </div>
                  )}
                  {tx.reference && (
                    <div style={{ fontSize: '0.9rem', color: '#ADB5BD', marginTop: '3px' }}>
                      Ref: {tx.reference}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  className={`transaction-amount ${
                    tx.type === 'DEPOSIT' ? 'amount-positive' : 'amount-negative'
                  }`}
                >
                  {tx.type === 'DEPOSIT' ? '+' : '-'}
                  {tx.amount.toFixed(2)} лв
                </div>
                <div style={{ marginTop: '10px' }}>{getStatusBadge(tx.status)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
