import React from 'react';
import { useTheme } from './ThemeContext';

const ThemeToggle = () => {
  const { theme, changeTheme, colors } = useTheme();

  const handleToggle = () => {
    // Toggle between light and dark
    changeTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleSystemClick = () => {
    changeTheme('system');
  };

  return (
    <div className="d-flex align-items-center theme-toggle-container">
      <div className="me-3 d-flex align-items-center">
        <span className="me-2">Theme:</span>
        <div className="theme-switch-container">
          <label className="theme-switch">
            <input 
              type="checkbox" 
              checked={theme === 'dark'} 
              onChange={handleToggle}
            />
            <span className="theme-slider">
              <span className="theme-icon theme-icon-sun">☀️</span>
              <span className="theme-icon theme-icon-moon">🌙</span>
            </span>
          </label>
        </div>
      </div>
      
      <button 
        className={`btn btn-sm system-theme-btn ${theme === 'system' ? 'active' : ''}`}
        onClick={handleSystemClick}
        title="Use system theme"
        style={{
          backgroundColor: theme === 'system' ? colors.primary : 'transparent',
          color: theme === 'system' ? colors.textOnPrimary : colors.primary,
          borderColor: colors.primary
        }}
      >
        <span className="system-icon">🖥️</span>
      </button>
    </div>
  );
};

export default ThemeToggle; 