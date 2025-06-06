import React, { createContext, useState, useEffect, useContext } from 'react';

// Create theme context
const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('system');

  // Load theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = localStorage.getItem('app_theme');
        if (savedTheme) {
          setTheme(savedTheme);
          await applyTheme(savedTheme);
        }
      } catch (err) {
        console.error('Error loading theme:', err);
      }
    };

    loadTheme();
  }, []);

  // Apply theme to body classes and electron
  const applyTheme = async (newTheme) => {
    // Apply to electron
    await window.electronAPI.setTheme(newTheme);
    
    // Apply to body classes
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');
    
    if (newTheme === 'light') {
      body.classList.add('light-theme');
    } else if (newTheme === 'dark') {
      body.classList.add('dark-theme');
    } else {
      // For system theme, use media query to determine
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        body.classList.add('dark-theme');
      } else {
        body.classList.add('light-theme');
      }
    }
  };

  // Change theme
  const changeTheme = async (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    await applyTheme(newTheme);
  };

  const value = {
    theme,
    changeTheme
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}; 