import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';
import { getAsset } from '../utils/assetUtils';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const { register, error, currentUser } = useAuth();
  const { colors, animations } = useTheme();
  const navigate = useNavigate();

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  // Form validation
  const validateForm = () => {
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }
    
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return false;
    }
    
    setValidationError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const success = await register(username, password);
      if (success) {
        navigate('/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Animation style for the card
  const cardStyle = animations.enabled ? {
    transform: 'translateY(0)',
    opacity: 1,
    transition: `all ${animations.speed}s ease`
  } : {};
  
  // Initial load animation
  useEffect(() => {
    if (animations.enabled) {
      const element = document.getElementById('register-card');
      if (element) {
        element.style.transform = 'translateY(20px)';
        element.style.opacity = '0';
        
        setTimeout(() => {
          element.style.transform = 'translateY(0)';
          element.style.opacity = '1';
        }, 100);
      }
    }
  }, [animations.enabled]);

  return (
    <div className="auth-container">
      <div 
        id="register-card"
        className="auth-form card"
        style={cardStyle}
      >
        <img 
          src={getAsset('Logo-BSS')} 
          alt="BSS Logo" 
          className="auth-logo app-logo" 
        />
        
        <h2 className="text-center mb-4" style={{ color: colors.primary }}>Create BSS Account</h2>
        
        {(error || validationError) && (
          <div className="alert alert-danger" role="alert">
            {error || validationError}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="username" className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
            <input
              type="password"
              className="form-control"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          
          <button
            type="submit"
            className="btn w-100 mb-3"
            disabled={isLoading}
            style={{ 
              backgroundColor: colors.primary, 
              borderColor: colors.primaryDark,
              color: colors.textOnPrimary 
            }}
          >
            {isLoading ? (
              <span>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Registering...
              </span>
            ) : 'Register'}
          </button>
          
          <p className="text-center">
            Already have an account? <Link to="/login" style={{ color: colors.secondary }}>Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register; 