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
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // WhatsApp API
  initWhatsApp: (userId) => ipcRenderer.invoke('init-whatsapp', { userId }),
  logoutWhatsApp: (userId) => ipcRenderer.invoke('logout-whatsapp', { userId }),
  getWhatsAppStatus: (userId) => ipcRenderer.invoke('get-whatsapp-status', { userId }),
  
  // Contacts API
  getContacts: (page, limit, search) => 
    ipcRenderer.invoke('get-contacts', { page, limit, search }),
  getAllContactIds: (search) => 
    ipcRenderer.invoke('get-all-contact-ids', { search }),
  addContact: (contactData) => 
    ipcRenderer.invoke('add-contact', contactData),
  updateContact: (contactId, contactData) => 
    ipcRenderer.invoke('update-contact', { contactId, contactData }),
  deleteContacts: (contactIds) => 
    ipcRenderer.invoke('delete-contacts', { contactIds }),
  importContactsFile: (filePath) => 
    ipcRenderer.invoke('import-contacts-file', filePath),
  importContacts: (contacts, skipDuplicates) => 
    ipcRenderer.invoke('import-contacts', { contacts, skipDuplicates }),
  exportContacts: (format) => 
    ipcRenderer.invoke('export-contacts', { format }),
  
  // File system access
  openFileDialog: (options) => 
    ipcRenderer.invoke('open-file-dialog', options)
});

// Set up listeners for WhatsApp events
contextBridge.exposeInMainWorld('whatsappEvents', {
  onQrCode: (callback) => ipcRenderer.on('whatsapp-qr', (_, data) => callback(data)),
  onReady: (callback) => ipcRenderer.on('whatsapp-ready', (_, data) => callback(data)),
  onAuthenticated: (callback) => ipcRenderer.on('whatsapp-authenticated', (_, data) => callback(data)),
  onAuthFailure: (callback) => ipcRenderer.on('whatsapp-auth-failure', (_, data) => callback(data)),
  onDisconnected: (callback) => ipcRenderer.on('whatsapp-disconnected', (_, data) => callback(data)),
  
  // Clean up listeners
  removeListeners: () => {
    ipcRenderer.removeAllListeners('whatsapp-qr');
    ipcRenderer.removeAllListeners('whatsapp-ready');
    ipcRenderer.removeAllListeners('whatsapp-authenticated');
    ipcRenderer.removeAllListeners('whatsapp-auth-failure');
    ipcRenderer.removeAllListeners('whatsapp-disconnected');
  }
});
