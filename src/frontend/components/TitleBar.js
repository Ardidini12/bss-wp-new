import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { getAsset } from '../utils/assetUtils';

const TitleBar = () => {
  const { colors } = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  
  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const response = await window.electronAPI.maximizeApp();
        setIsMaximized(response.maximized);
      } catch (error) {
        console.error('Failed to check window state:', error);
      }
    };
    
    const getVersion = async () => {
      try {
        const response = await window.electronAPI.getAppVersion();
        if (response.success) {
          setAppVersion(response.version);
        }
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    };
    
    checkMaximized();
    getVersion();
  }, []);
  
  const handleMinimize = async () => {
    await window.electronAPI.minimizeApp();
  };
  
  const handleMaximize = async () => {
    const response = await window.electronAPI.maximizeApp();
    setIsMaximized(response.maximized);
  };
  
  const handleClose = async () => {
    await window.electronAPI.closeApp();
  };
  
  return (
    <div className="title-bar" style={{ backgroundColor: colors.primary }}>
      <div className="d-flex align-items-center">
        <img 
          src={getAsset('Logo-BSS')} 
          alt="BSS Logo" 
          height="20" 
          className="me-2 app-logo"
        />
        <h1 className="title-bar-title">BSS Desktop App {appVersion && `v${appVersion}`}</h1>
      </div>
      
      <div className="title-bar-controls">
        <button 
          className="title-bar-button" 
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <path d="M0 0h10v1H0z" fill="currentColor" />
          </svg>
        </button>
        
        <button 
          className="title-bar-button" 
          onClick={handleMaximize}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 3h8v6H1V3zm0-2h8v1H1V1z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M0 0v10h10V0H0zm9 9H1V1h8v8z" fill="currentColor" />
            </svg>
          )}
        </button>
        
        <button 
          className="title-bar-button close" 
          onClick={handleClose}
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M6.4 5l3.3-3.3c.4-.4.4-1 0-1.4-.4-.4-1-.4-1.4 0L5 3.6 1.7.3C1.3-.1.7-.1.3.3c-.4.4-.4 1 0 1.4L3.6 5 .3 8.3c-.4.4-.4 1 0 1.4.2.2.4.3.7.3.3 0 .5-.1.7-.3L5 6.4l3.3 3.3c.2.2.4.3.7.3.3 0 .5-.1.7-.3.4-.4.4-1 0-1.4L6.4 5z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar; 