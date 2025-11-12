/**
 * Frontend Component Tests
 * Tests for React UI components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import axios from 'axios';

import LoginScreen from '../src/components/LoginScreen';
import MainMenu from '../src/components/MainMenu';
import DepositScreen from '../src/components/DepositScreen';
import TransferScreen from '../src/components/TransferScreen';

// Mock axios
jest.mock('axios');

// Mock react-webcam
jest.mock('react-webcam', () => {
  return function Webcam(props) {
    return <div data-testid="webcam-mock">Webcam Mock</div>;
  };
});

describe('LoginScreen Component', () => {
  const mockOnLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login form with EGN input', () => {
    render(<LoginScreen onLogin={mockOnLogin} />);
    
    expect(screen.getByPlaceholderText(/ЕГН/i)).toBeInTheDocument();
  });

  it('should validate EGN input (10 digits)', () => {
    render(<LoginScreen onLogin={mockOnLogin} />);
    
    const egnInput = screen.getByPlaceholderText(/ЕГН/i);
    fireEvent.change(egnInput, { target: { value: '1234567890' } });
    
    expect(egnInput.value).toBe('1234567890');
  });

  it('should show PIN keypad when EGN is entered', () => {
    render(<LoginScreen onLogin={mockOnLogin} />);
    
    const egnInput = screen.getByPlaceholderText(/ЕГН/i);
    fireEvent.change(egnInput, { target: { value: '1234567890' } });
    
    const continueButton = screen.getByText(/Продължи/i);
    fireEvent.click(continueButton);
    
    expect(screen.getByText('Въведете ПИН')).toBeInTheDocument();
  });

  it('should accept PIN input via keypad', () => {
    render(<LoginScreen onLogin={mockOnLogin} />);
    
    // Enter EGN
    const egnInput = screen.getByPlaceholderText(/ЕГН/i);
    fireEvent.change(egnInput, { target: { value: '1234567890' } });
    fireEvent.click(screen.getByText(/Продължи/i));
    
    // Enter PIN
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));
    
    const pinDisplay = screen.getByText('••••');
    expect(pinDisplay).toBeInTheDocument();
  });

  it('should call API on successful face capture', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        token: 'test-token',
        user: {
          id: 'user-123',
          full_name: 'Test User',
          balance: 1000
        }
      }
    });

    render(<LoginScreen onLogin={mockOnLogin} />);
    
    // Complete login flow
    const egnInput = screen.getByPlaceholderText(/ЕГН/i);
    fireEvent.change(egnInput, { target: { value: '1234567890' } });
    fireEvent.click(screen.getByText(/Продължи/i));
    
    // Enter PIN
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));
    
    // Wait for API call
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/verify'),
        expect.objectContaining({
          egn: '1234567890',
          pin: '1234'
        })
      );
    });
  });
});

describe('MainMenu Component', () => {
  const mockUser = {
    full_name: 'Test User',
    balance: 1500.50
  };

  it('should display user name and balance', () => {
    render(
      <BrowserRouter>
        <MainMenu user={mockUser} onLogout={jest.fn()} />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    expect(screen.getByText(/1,500.50/)).toBeInTheDocument();
  });

  it('should render all menu options', () => {
    render(
      <BrowserRouter>
        <MainMenu user={mockUser} onLogout={jest.fn()} />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Депозит/i)).toBeInTheDocument();
    expect(screen.getByText(/Превод/i)).toBeInTheDocument();
    expect(screen.getByText(/Плащане на сметки/i)).toBeInTheDocument();
    expect(screen.getByText(/История/i)).toBeInTheDocument();
  });

  it('should call onLogout when logout button clicked', () => {
    const mockLogout = jest.fn();
    
    render(
      <BrowserRouter>
        <MainMenu user={mockUser} onLogout={mockLogout} />
      </BrowserRouter>
    );
    
    const logoutButton = screen.getByText(/Изход/i);
    fireEvent.click(logoutButton);
    
    expect(mockLogout).toHaveBeenCalled();
  });
});

describe('DepositScreen Component', () => {
  const mockUser = { balance: 500 };
  const mockToken = 'test-token';
  const mockOnBalanceUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render amount input and keypad', () => {
    render(
      <BrowserRouter>
        <DepositScreen 
          user={mockUser} 
          token={mockToken} 
          onBalanceUpdate={mockOnBalanceUpdate} 
        />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Сума/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('should allow amount input via keypad', () => {
    render(
      <BrowserRouter>
        <DepositScreen 
          user={mockUser} 
          token={mockToken} 
          onBalanceUpdate={mockOnBalanceUpdate} 
        />
      </BrowserRouter>
    );
    
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('0'));
    
    const amountDisplay = screen.getByDisplayValue('100');
    expect(amountDisplay).toBeInTheDocument();
  });

  it('should use quick amount buttons', () => {
    render(
      <BrowserRouter>
        <DepositScreen 
          user={mockUser} 
          token={mockToken} 
          onBalanceUpdate={mockOnBalanceUpdate} 
        />
      </BrowserRouter>
    );
    
    const button50 = screen.getByText('50 лв');
    fireEvent.click(button50);
    
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
  });

  it('should submit deposit and update balance', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        transaction: {
          id: 'tx-123',
          amount: 100,
          newBalance: 600
        }
      }
    });

    render(
      <BrowserRouter>
        <DepositScreen 
          user={mockUser} 
          token={mockToken} 
          onBalanceUpdate={mockOnBalanceUpdate} 
        />
      </BrowserRouter>
    );
    
    // Enter amount
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('0'));
    
    // Submit
    const submitButton = screen.getByText(/Потвърди/i);
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/deposits/record'),
        expect.objectContaining({ amount: 100 }),
        expect.any(Object)
      );
      expect(mockOnBalanceUpdate).toHaveBeenCalledWith(600);
    });
  });
});

describe('TransferScreen Component', () => {
  const mockUser = { balance: 1000 };
  const mockToken = 'test-token';
  const mockOnBalanceUpdate = jest.fn();

  it('should render transfer form fields', () => {
    render(
      <BrowserRouter>
        <TransferScreen 
          user={mockUser} 
          token={mockToken} 
          onBalanceUpdate={mockOnBalanceUpdate} 
        />
      </BrowserRouter>
    );
    
    expect(screen.getByPlaceholderText(/IBAN/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Име на получател/i)).toBeInTheDocument();
  });

  it('should validate insufficient balance', () => {
    render(
      <BrowserRouter>
        <TransferScreen 
          user={mockUser} 
          token={mockToken} 
          onBalanceUpdate={mockOnBalanceUpdate} 
        />
      </BrowserRouter>
    );
    
    const amountInput = screen.getByPlaceholderText(/Сума/i);
    fireEvent.change(amountInput, { target: { value: '2000' } }); // More than balance
    
    const submitButton = screen.getByText(/Изпрати/i);
    fireEvent.click(submitButton);
    
    // Should show error
    expect(screen.getByText(/Недостатъчна наличност/i)).toBeInTheDocument();
  });

  it('should submit transfer successfully', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        transaction: {
          id: 'tx-456',
          amount: 250,
          newBalance: 750
        }
      }
    });

    render(
      <BrowserRouter>
        <TransferScreen 
          user={mockUser} 
          token={mockToken} 
          onBalanceUpdate={mockOnBalanceUpdate} 
        />
      </BrowserRouter>
    );
    
    // Fill form
    fireEvent.change(screen.getByPlaceholderText(/IBAN/i), {
      target: { value: 'BG80BNBG96611020345678' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Име на получател/i), {
      target: { value: 'John Doe' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Сума/i), {
      target: { value: '250' }
    });
    
    // Submit
    const submitButton = screen.getByText(/Изпрати/i);
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/transfers/send'),
        expect.objectContaining({
          iban: 'BG80BNBG96611020345678',
          recipient_name: 'John Doe',
          amount: 250
        }),
        expect.any(Object)
      );
    });
  });
});
