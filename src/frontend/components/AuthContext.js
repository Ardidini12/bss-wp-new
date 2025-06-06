import React, { createContext, useState, useEffect, useContext } from 'react';

// Create auth context
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user from session storage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const response = await window.electronAPI.verifyToken({ token });
          if (response.success) {
            setCurrentUser(response.user);
          } else {
            // If token is invalid, clear it
            localStorage.removeItem('auth_token');
          }
        }
      } catch (err) {
        console.error('Error loading user:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Register a new user
  const register = async (username, password) => {
    try {
      setError(null);
      const response = await window.electronAPI.registerUser({ username, password });
      if (response.success) {
        return true;
      } else {
        setError(response.error || 'Registration failed');
        return false;
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
      return false;
    }
  };

  // Login user
  const login = async (username, password, rememberMe) => {
    try {
      setError(null);
      const response = await window.electronAPI.loginUser({ username, password });
      
      if (response.success) {
        setCurrentUser(response.user);
        // Store token in localStorage
        localStorage.setItem('auth_token', response.token);
        
        // If remember me is checked, store credentials
        if (rememberMe) {
          localStorage.setItem('remember_me', JSON.stringify({ username, password }));
        } else {
          localStorage.removeItem('remember_me');
        }
        
        return true;
      } else {
        setError(response.error || 'Login failed');
        return false;
      }
    } catch (err) {
      setError(err.message || 'Login failed');
      return false;
    }
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem('auth_token');
    setCurrentUser(null);
  };

  // Get remembered credentials
  const getRememberedCredentials = () => {
    const savedCredentials = localStorage.getItem('remember_me');
    if (savedCredentials) {
      return JSON.parse(savedCredentials);
    }
    return null;
  };

  const value = {
    currentUser,
    loading,
    error,
    register,
    login,
    logout,
    getRememberedCredentials
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 