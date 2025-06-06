import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';

const Dashboard = () => {
  const { currentUser, logout, loading } = useAuth();
  const { theme, changeTheme } = useTheme();
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

  if (loading || !currentUser) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>BSS Dashboard</h1>
        
        <div className="d-flex">
          <div className="theme-toggle me-3">
            <label className="me-2">Theme:</label>
            <select 
              className="form-select form-select-sm" 
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
          
          <button 
            className="btn btn-outline-secondary btn-sm" 
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className="card">
          <div className="card-body">
            <h2 className="card-title">Welcome to BSS, {currentUser.username}!</h2>
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