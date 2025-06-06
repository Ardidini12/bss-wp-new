import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';
import { getAsset } from '../utils/assetUtils';

const Dashboard = () => {
  const { currentUser, logout, loading } = useAuth();
  const { theme, changeTheme, colors, animations } = useTheme();
  const navigate = useNavigate();
  const [userSettings, setUserSettings] = useState(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !currentUser) {
      navigate('/login');
    }
  }, [currentUser, loading, navigate]);

  // Load user settings
  useEffect(() => {
    const loadSettings = async () => {
      if (currentUser) {
        try {
          const response = await window.electronAPI.getUserSettings(currentUser.id);
          if (response.success) {
            setUserSettings(response.settings);
          }
        } catch (err) {
          console.error('Error loading settings:', err);
        }
      }
    };

    loadSettings();
  }, [currentUser]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleThemeChange = (newTheme) => {
    changeTheme(newTheme);
    
    // Update user settings if logged in
    if (currentUser && userSettings) {
      const updatedSettings = { ...userSettings, theme: newTheme };
      window.electronAPI.updateUserSettings(currentUser.id, updatedSettings);
    }
  };

  // Card animation style
  const cardStyle = animations.enabled ? {
    transform: 'translateY(0)',
    opacity: 1,
    transition: `all ${animations.speed}s ease`
  } : {};
  
  // Initial load animation
  useEffect(() => {
    if (animations.enabled) {
      const cards = document.querySelectorAll('.dashboard-card');
      cards.forEach((card, index) => {
        card.style.transform = 'translateY(20px)';
        card.style.opacity = '0';
        
        setTimeout(() => {
          card.style.transform = 'translateY(0)';
          card.style.opacity = '1';
        }, 100 + (index * 100)); // Stagger the animations
      });
    }
  }, [animations.enabled]);

  if (loading || !currentUser) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border" role="status" style={{ color: colors.primary }}>
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div 
        className="dashboard-header"
        style={{ borderColor: theme === 'dark' ? colors.primaryDark : colors.primaryLight }}
      >
        <div className="d-flex align-items-center">
          <img 
            src={getAsset('Logo-BSS')} 
            alt="BSS Logo" 
            height="30" 
            className="me-3 app-logo" 
          />
          <h1 style={{ color: colors.primary, margin: 0 }}>BSS Dashboard</h1>
        </div>
        
        <div className="d-flex">
          <div className="theme-toggle me-3">
            <label className="me-2">Theme:</label>
            <select 
              className="form-select form-select-sm" 
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              style={{ 
                borderColor: colors.primary,
                minWidth: '100px'
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
          
          <button 
            className="btn btn-sm"
            onClick={handleLogout}
            style={{ 
              backgroundColor: colors.secondary,
              borderColor: colors.secondaryDark,
              color: colors.textOnSecondary
            }}
          >
            Logout
          </button>
        </div>
      </div>
      
      <div className="dashboard-content p-4">
        <div className="card dashboard-card" style={cardStyle}>
          <div className="card-body">
            <h2 className="card-title" style={{ color: colors.primary }}>
              Welcome, {currentUser.username}!
            </h2>
            <p className="card-text">
              You have successfully logged in to the BSS Desktop Application.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 