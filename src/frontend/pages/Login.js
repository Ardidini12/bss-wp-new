import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';
import { getAsset } from '../utils/assetUtils';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, error, getRememberedCredentials, currentUser } = useAuth();
  const { colors, animations } = useTheme();
  const navigate = useNavigate();

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  // Check for remembered credentials
  useEffect(() => {
    const rememberedCredentials = getRememberedCredentials();
    if (rememberedCredentials) {
      setUsername(rememberedCredentials.username);
      setPassword(rememberedCredentials.password);
      setRememberMe(true);
    }
  }, [getRememberedCredentials]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const success = await login(username, password, rememberMe);
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
      const element = document.getElementById('login-card');
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
        id="login-card"
        className="auth-form card" 
        style={cardStyle}
      >
        <img 
          src={getAsset('Logo-BSS')} 
          alt="BSS Logo" 
          className="auth-logo app-logo" 
        />
        
        <h2 className="text-center mb-4" style={{ color: colors.primary }}>Login to BSS</h2>
        
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
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
          
          <div className="mb-3 form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ borderColor: colors.primary }}
            />
            <label className="form-check-label" htmlFor="rememberMe">
              Remember me
            </label>
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
                Logging in...
              </span>
            ) : 'Login'}
          </button>
          
          <p className="text-center">
            Don't have an account? <Link to="/register" style={{ color: colors.secondary }}>Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login; 