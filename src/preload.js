// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Expose API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Auth API
  registerUser: (userData) => ipcRenderer.invoke('register-user', userData),
  loginUser: (credentials) => ipcRenderer.invoke('login-user', credentials),
  verifyToken: (token) => ipcRenderer.invoke('verify-token', token),
  
  // User settings API
  getUserSettings: (userId) => ipcRenderer.invoke('get-user-settings', { userId }),
  updateUserSettings: (userId, settings) => 
    ipcRenderer.invoke('update-user-settings', { userId, settings }),
  
  // Theme API
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  
  // App control
  minimizeApp: () => ipcRenderer.invoke('minimize-app'),
  maximizeApp: () => ipcRenderer.invoke('maximize-app'),
  closeApp: () => ipcRenderer.invoke('close-app'),
  
  // System info
  getPlatform: () => process.platform,
  
  // Get app version
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
