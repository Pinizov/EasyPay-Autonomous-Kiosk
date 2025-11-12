/**
 * EasyPay Autonomous Kiosk - Main Application
 * Touch-screen optimized React interface for 27" display
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Import components (we'll create these)
import LoginScreen from './components/LoginScreen';
import MainMenu from './components/MainMenu';
import DepositScreen from './components/DepositScreen';
import TransferScreen from './components/TransferScreen';
import BillPaymentScreen from './components/BillPaymentScreen';
import TransactionHistory from './components/TransactionHistory';
import LoadingScreen from './components/LoadingScreen';

// API Base URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);

  // Auto-logout after inactivity
  useEffect(() => {
    let timeout;
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        handleLogout();
      }, 15 * 60 * 1000); // 15 minutes
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimeout);
    });

    resetTimeout();

    return () => {
      clearTimeout(timeout);
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, []);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setBalance(userData.balance || 0);
    localStorage.setItem('token', authToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setBalance(0);
    localStorage.removeItem('token');
  };

  const updateBalance = (newBalance) => {
    setBalance(newBalance);
    if (user) {
      setUser({ ...user, balance: newBalance });
    }
  };

  // Protected Route Component
  const ProtectedRoute = ({ children }) => {
    if (!token || !user) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route 
            path="/login" 
            element={
              token ? (
                <Navigate to="/menu" replace />
              ) : (
                <LoginScreen onLogin={handleLogin} setLoading={setLoading} apiUrl={API_URL} />
              )
            } 
          />
          
          <Route 
            path="/menu" 
            element={
              <ProtectedRoute>
                <MainMenu user={user} balance={balance} onLogout={handleLogout} />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/deposit" 
            element={
              <ProtectedRoute>
                <DepositScreen 
                  user={user} 
                  token={token} 
                  balance={balance}
                  updateBalance={updateBalance}
                  apiUrl={API_URL}
                />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/transfer" 
            element={
              <ProtectedRoute>
                <TransferScreen 
                  user={user} 
                  token={token} 
                  balance={balance}
                  updateBalance={updateBalance}
                  apiUrl={API_URL}
                />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/bills" 
            element={
              <ProtectedRoute>
                <BillPaymentScreen 
                  user={user} 
                  token={token} 
                  balance={balance}
                  updateBalance={updateBalance}
                  apiUrl={API_URL}
                />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/history" 
            element={
              <ProtectedRoute>
                <TransactionHistory 
                  user={user} 
                  token={token}
                  apiUrl={API_URL}
                />
              </ProtectedRoute>
            } 
          />
          
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        
        <ToastContainer
          position="top-center"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss={false}
          draggable={false}
          pauseOnHover
          theme="light"
          style={{ fontSize: '1.5rem' }}
        />
      </div>
    </Router>
  );
}

export default App;

