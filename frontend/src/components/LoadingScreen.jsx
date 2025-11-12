import React from 'react';

const LoadingScreen = () => {
  return (
    <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="loading-spinner"></div>
      <h2 style={{ marginTop: '30px', fontSize: '2rem' }}>Зареждане...</h2>
    </div>
  );
};

export default LoadingScreen;
