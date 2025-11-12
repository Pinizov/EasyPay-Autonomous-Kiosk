import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { toast } from 'react-toastify';
import axios from 'axios';

const LoginScreen = ({ onLogin, setLoading, apiUrl }) => {
  const [egn, setEgn] = useState('');
  const [pin, setPin] = useState('');
  const [showFaceAuth, setShowFaceAuth] = useState(false);
  const webcamRef = useRef(null);

  const handlePinInput = (digit) => {
    if (pin.length < 6) {
      setPin(pin + digit);
    }
  };

  const handlePinClear = () => {
    setPin('');
  };

  const handlePinBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleEgnSubmit = () => {
    if (egn.length !== 10) {
      toast.error('ЕГН трябва да е 10 цифри');
      return;
    }
    setShowFaceAuth(true);
  };

  const captureFaceAndLogin = async () => {
    if (!webcamRef.current) {
      toast.error('Камерата не е готова');
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      toast.error('Неуспешно заснемане на изображение');
      return;
    }

    if (pin.length < 4) {
      toast.error('Моля, въведете PIN код');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${apiUrl}/auth/verify`, {
        egn,
        pin,
        face_image: imageSrc,
      });

      if (response.data.success) {
        toast.success('Успешно влизане!');
        onLogin(response.data.user, response.data.token);
      } else {
        toast.error(response.data.error || 'Неуспешно влизане');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.error || 'Грешка при влизане');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <div className="card card-large" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 className="screen-title" style={{ textAlign: 'center', marginBottom: '40px' }}>
          🏦 EasyPay Автономна Каса
        </h1>

        {!showFaceAuth ? (
          <>
            <div className="input-group">
              <label>Въведете ЕГН:</label>
              <input
                type="text"
                value={egn}
                onChange={(e) => setEgn(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="0000000000"
                maxLength="10"
                autoFocus
                style={{ fontSize: '2rem', textAlign: 'center', letterSpacing: '5px' }}
              />
            </div>

            <button 
              className="btn btn-primary btn-large" 
              onClick={handleEgnSubmit}
              style={{ width: '100%', marginTop: '20px' }}
            >
              Напред
            </button>
          </>
        ) : (
          <>
            <div className="webcam-container">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  width: 640,
                  height: 480,
                  facingMode: 'user',
                }}
                style={{ width: '100%', borderRadius: '16px' }}
              />
              <div className="webcam-overlay"></div>
            </div>

            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <p style={{ fontSize: '1.3rem', color: '#6C757D' }}>
                Позиционирайте лицето си в центъра
              </p>
            </div>

            <div className="pin-display">
              {pin ? '•'.repeat(pin.length) : 'Въведете PIN'}
            </div>

            <div className="keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  className="keypad-btn"
                  onClick={() => handlePinInput(num.toString())}
                >
                  {num}
                </button>
              ))}
              <button className="keypad-btn" onClick={handlePinClear}>
                C
              </button>
              <button className="keypad-btn" onClick={() => handlePinInput('0')}>
                0
              </button>
              <button className="keypad-btn" onClick={handlePinBackspace}>
                ⌫
              </button>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowFaceAuth(false);
                  setPin('');
                }}
                style={{ flex: 1 }}
              >
                Назад
              </button>
              <button
                className="btn btn-success btn-large"
                onClick={captureFaceAndLogin}
                disabled={pin.length < 4}
                style={{ flex: 2 }}
              >
                Влез
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
