import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';

const TransferScreen = ({ user, token, balance, updateBalance, apiUrl }) => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    const transferAmount = parseFloat(amount);

    if (!recipientAccount || recipientAccount.length < 15) {
      toast.error('Моля, въведете валиден IBAN');
      return;
    }

    if (!recipientName || recipientName.length < 3) {
      toast.error('Моля, въведете име на получател');
      return;
    }

    if (!transferAmount || transferAmount < 1) {
      toast.error('Моля, въведете валидна сума');
      return;
    }

    if (transferAmount > balance) {
      toast.error('Недостатъчна наличност');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${apiUrl}/transfers/send`,
        {
          amount: transferAmount,
          recipient_account: recipientAccount,
          recipient_name: recipientName,
          description: description || 'SEPA превод',
          currency: 'BGN',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        toast.success('Успешен превод!');
        updateBalance(response.data.transaction.newBalance);
        setTimeout(() => navigate('/menu'), 2000);
      }
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error(error.response?.data?.error || 'Грешка при превод');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">💸 SEPA Превод</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/menu')}>
          Назад
        </button>
      </div>

      <div className="balance-display" style={{ marginBottom: '30px' }}>
        <div className="balance-label">Налична Сума</div>
        <div className="balance-amount">{balance.toFixed(2)} лв</div>
      </div>

      <div className="card card-large">
        <div className="input-group">
          <label>IBAN на Получател:</label>
          <input
            type="text"
            value={recipientAccount}
            onChange={(e) => setRecipientAccount(e.target.value.toUpperCase())}
            placeholder="BG00 XXXX 0000 0000 0000 00"
            maxLength="34"
          />
        </div>

        <div className="input-group">
          <label>Име на Получател:</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Име и Фамилия"
            maxLength="255"
          />
        </div>

        <div className="input-group">
          <label>Сума (лв):</label>
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

        <div className="input-group">
          <label>Основание (незадължително):</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Основание за плащане"
            maxLength="500"
          />
        </div>

        <div className="alert alert-info" style={{ marginBottom: '20px' }}>
          <strong>Такса:</strong> 0.50 лв за SEPA превод
        </div>

        <button
          className="btn btn-success btn-large"
          onClick={handleTransfer}
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Обработка...' : `Изпрати ${amount || '0.00'} лв`}
        </button>
      </div>
    </div>
  );
};

export default TransferScreen;
