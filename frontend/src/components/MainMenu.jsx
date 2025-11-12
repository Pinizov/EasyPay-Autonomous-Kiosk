import React from 'react';
import { useNavigate } from 'react-router-dom';

const MainMenu = ({ user, balance, onLogout }) => {
  const navigate = useNavigate();

  const menuItems = [
    { icon: '💵', label: 'Депозит', color: '#28A745', path: '/deposit' },
    { icon: '💸', label: 'Превод', color: '#0066CC', path: '/transfer' },
    { icon: '📄', label: 'Плащане на Сметки', color: '#FFC107', path: '/bills' },
    { icon: '📊', label: 'История', color: '#6C757D', path: '/history' },
  ];

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Добре дошли, {user?.fullName}!</h1>
          <p style={{ fontSize: '1.2rem', color: '#6C757D', marginTop: '10px' }}>
            ЕГН: {user?.egn}
          </p>
        </div>
        <button className="btn btn-danger" onClick={onLogout}>
          Изход
        </button>
      </div>

      <div className="balance-display">
        <div className="balance-label">Текущ Баланс</div>
        <div className="balance-amount">{balance.toFixed(2)} лв</div>
      </div>

      <div className="menu-grid" style={{ flex: 1, marginTop: '40px' }}>
        {menuItems.map((item, index) => (
          <div
            key={index}
            className="menu-item"
            onClick={() => navigate(item.path)}
            style={{ borderTop: `5px solid ${item.color}` }}
          >
            <div className="menu-icon">{item.icon}</div>
            <div className="menu-label">{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '30px', color: '#6C757D' }}>
        <p style={{ fontSize: '1.1rem' }}>
          За помощ се свържете с: 0700 12 345 | 24/7 поддръжка
        </p>
      </div>
    </div>
  );
};

export default MainMenu;
