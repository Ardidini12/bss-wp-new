import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { getAsset } from '../utils/assetUtils';

const SplashScreen = ({ onFinish }) => {
  const { colors, isLoading } = useTheme();
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    // Wait for theme colors to load and then additional timeout for splash effect
    if (!isLoading) {
      const timer = setTimeout(() => {
        // Start fade out
        setVisible(false);
        
        // Call onFinish after animation completes
        setTimeout(() => {
          if (onFinish) onFinish();
        }, 500); // Match transition time in CSS
      }, 2000); // Show splash for 2 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, onFinish]);
  
  return (
    <div 
      className="splash-screen" 
      style={{ 
        opacity: visible ? 1 : 0,
        backgroundColor: colors.primary
      }}
    >
      <img 
        src={getAsset('Logo-BSS')} 
        alt="BSS Logo" 
        className="splash-logo"
      />
      <div className="splash-spinner"></div>
    </div>
  );
};

export default SplashScreen; 