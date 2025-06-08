import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import Settings from '../components/Settings';
import WhatsAppContact from '../components/WhatsAppContact';
import BulkContacts from '../components/BulkContacts';
import BulkTemplates from '../components/BulkTemplates';
import BulkSender from '../components/BulkSender';
import { getAsset } from '../utils/assetUtils';

const Dashboard = () => {
  const { currentUser, logout, loading } = useAuth();
  const { theme, colors, animations } = useTheme();
  const navigate = useNavigate();
  const [userSettings, setUserSettings] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');

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

  // Initialize WhatsApp when user logs in
  useEffect(() => {
    if (currentUser) {
      // Initialize WhatsApp for current user
      window.electronAPI.initWhatsApp(currentUser.id)
        .catch(err => console.error('Error initializing WhatsApp:', err));
    }
  }, [currentUser]);
  
  // Listen for dashboard state changes from WhatsAppContact
  useEffect(() => {
    const handleViewChange = (event) => {
      if (event.detail && event.detail.view) {
        setActiveView(event.detail.view);
      }
    };
    
    window.addEventListener('dashboard-set-active-view', handleViewChange);
    
    return () => {
      window.removeEventListener('dashboard-set-active-view', handleViewChange);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
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
  }, [animations.enabled, activeView]);

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
      {/* WhatsApp Contact Info (Draggable) - Now positioned independently */}
      <WhatsAppContact />
      
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
          <ThemeToggle />
          
          <button 
            className="btn btn-sm ms-3"
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
      
      <div className="dashboard-body d-flex">
        {/* Left Sidebar */}
        <div 
          className="sidebar"
          style={{ 
            backgroundColor: theme === 'dark' ? colors.primaryDark : colors.primaryLight,
            color: colors.textOnPrimary
          }}
        >
          <ul className="sidebar-menu">
            <li 
              className={`sidebar-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
              style={{ 
                backgroundColor: activeView === 'dashboard' 
                  ? colors.primary 
                  : 'transparent'
              }}
            >
              <span className="sidebar-icon">📊</span>
              <span className="sidebar-text">Dashboard</span>
            </li>
            <li 
              className={`sidebar-item ${activeView === 'contacts' ? 'active' : ''}`}
              onClick={() => setActiveView('contacts')}
              style={{ 
                backgroundColor: activeView === 'contacts' 
                  ? colors.primary 
                  : 'transparent'
              }}
            >
              <span className="sidebar-icon">👥</span>
              <span className="sidebar-text">Bulk Contacts</span>
            </li>
            <li 
              className={`sidebar-item ${activeView === 'templates' ? 'active' : ''}`}
              onClick={() => setActiveView('templates')}
              style={{ 
                backgroundColor: activeView === 'templates' 
                  ? colors.primary 
                  : 'transparent'
              }}
            >
              <span className="sidebar-icon">📝</span>
              <span className="sidebar-text">Bulk Templates</span>
            </li>
            <li 
              className={`sidebar-item ${activeView === 'sender' ? 'active' : ''}`}
              onClick={() => setActiveView('sender')}
              style={{ 
                backgroundColor: activeView === 'sender' 
                  ? colors.primary 
                  : 'transparent'
              }}
            >
              <span className="sidebar-icon">📨</span>
              <span className="sidebar-text">Bulk Sender</span>
            </li>
            <li 
              className={`sidebar-item ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveView('settings')}
              style={{ 
                backgroundColor: activeView === 'settings' 
                  ? colors.primary 
                  : 'transparent'
              }}
            >
              <span className="sidebar-icon">⚙️</span>
              <span className="sidebar-text">Settings</span>
            </li>
          </ul>
        </div>
        
        {/* Main Content */}
        <div className="dashboard-content p-4">
          {activeView === 'dashboard' && (
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
          )}
          
          {activeView === 'contacts' && <BulkContacts />}
          {activeView === 'templates' && <BulkTemplates />}
          {activeView === 'sender' && <BulkSender />}
          {activeView === 'settings' && <Settings />}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 