/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import contexts
import { AuthProvider } from './frontend/components/AuthContext';
import { ThemeProvider } from './frontend/components/ThemeContext';

// Import components
import ProtectedRoute from './frontend/components/ProtectedRoute';
import TitleBar from './frontend/components/TitleBar';
import SplashScreen from './frontend/components/SplashScreen';

// Import pages
import Login from './frontend/pages/Login';
import Register from './frontend/pages/Register';
import Dashboard from './frontend/pages/Dashboard';

// Main App component
const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  
  const handleSplashFinish = () => {
    setShowSplash(false);
  };
  
  return (
    <AuthProvider>
      <ThemeProvider>
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
        
        <div style={{ visibility: showSplash ? 'hidden' : 'visible', height: '100vh' }}>
          <TitleBar />
          
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
};

// Initialize React app
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
