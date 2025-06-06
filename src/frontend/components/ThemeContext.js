import React, { createContext, useContext, useEffect, useState } from 'react';
import { extractColors, generateColorScheme } from '../utils/colorUtils';
import { getAsset } from '../utils/assetUtils';

// Define default theme colors in case we can't extract from logo
const defaultColors = {
  primary: '#3366cc', // A blue shade
  primaryLight: '#5c85d6',
  primaryDark: '#244c99',
  secondary: '#ff9900', // Orange accent
  secondaryLight: '#ffb13d',
  secondaryDark: '#cc7a00',
  accent: '#33cc99', // Teal accent
  textOnPrimary: '#ffffff',
  textOnSecondary: '#000000',
};

// Create the theme context
const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(true);
  const [colors, setColors] = useState(defaultColors);
  const [animations, setAnimations] = useState({
    enabled: true,
    speed: 'normal', // slow, normal, fast
  });

  // Load the user's theme preference from electron-store
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Get theme from electron-store via IPC
        const response = await window.electronAPI.getTheme();
        if (response.success) {
          setTheme(response.theme);
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    };

    loadTheme();
  }, []);

  // Extract colors from the logo
  useEffect(() => {
    const loadLogoColors = async () => {
      setIsLoading(true);
      try {
        // Use the imported logo
        const logoUrl = getAsset('Logo-BSS');
        const { dominantColor, palette } = await extractColors(logoUrl);
        const generatedColors = generateColorScheme(dominantColor, palette);
        setColors(generatedColors);
      } catch (error) {
        console.error('Failed to extract colors from logo:', error);
        // Fall back to default colors
        setColors(defaultColors);
      } finally {
        setIsLoading(false);
      }
    };

    loadLogoColors();
  }, []);

  // Apply theme to body element
  useEffect(() => {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(`${theme}-theme`);
    
    // Apply CSS variables for theme colors
    const root = document.documentElement;
    
    // Set color variables
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Set animation variables
    const speeds = {
      slow: '0.5s',
      normal: '0.3s',
      fast: '0.15s'
    };
    
    root.style.setProperty('--transition-speed', speeds[animations.speed]);
    root.style.setProperty('--animations-enabled', animations.enabled ? '1' : '0');
    
    // Call to backend to save theme choice
    window.electronAPI.setTheme(theme);
  }, [theme, colors, animations]);

  // Function to change the theme
  const changeTheme = (newTheme) => {
    setTheme(newTheme);
  };
  
  // Toggle animations
  const toggleAnimations = () => {
    setAnimations(prev => ({
      ...prev,
      enabled: !prev.enabled
    }));
  };
  
  // Change animation speed
  const setAnimationSpeed = (speed) => {
    setAnimations(prev => ({
      ...prev,
      speed
    }));
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      changeTheme, 
      colors, 
      isLoading,
      animations: {
        ...animations,
        toggle: toggleAnimations,
        setSpeed: setAnimationSpeed
      }
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext; 