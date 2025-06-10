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
  sendWhatsAppMessage: (userId, phoneNumber, message) => 
    ipcRenderer.invoke('send-whatsapp-message', { userId, phoneNumber, message }),
  sendWhatsAppMessageWithMedia: (userId, phoneNumber, message, media) => 
    ipcRenderer.invoke('send-whatsapp-message-with-media', { userId, phoneNumber, message, media }),
  getWhatsAppMessageStatus: (userId, messageId) => 
    ipcRenderer.invoke('get-whatsapp-message-status', { userId, messageId }),
  
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
  
  // Templates API
  getTemplates: (page, limit, search) => 
    ipcRenderer.invoke('get-templates', page, limit, search),
  addTemplate: (templateData) => 
    ipcRenderer.invoke('add-template', templateData),
  updateTemplate: (templateId, templateData) => 
    ipcRenderer.invoke('update-template', templateId, templateData),
  deleteTemplates: (templateIds) => 
    ipcRenderer.invoke('delete-templates', templateIds),
  getAllTemplateIds: (search) => 
    ipcRenderer.invoke('get-all-template-ids', search),
  
  // Bulk Sender API
  getSenderSettings: (userId) => ipcRenderer.invoke('get-sender-settings', userId),
  updateSenderSettings: (userId, settings) => ipcRenderer.invoke('update-sender-settings', userId, settings),
  scheduleMessages: (userId, contactIds, templateId, scheduledTime) => 
    ipcRenderer.invoke('schedule-messages', userId, contactIds, templateId, scheduledTime),
  getScheduledMessages: (userId, page, limit, status) => 
    ipcRenderer.invoke('get-scheduled-messages', userId, page, limit, status),
  updateMessageStatus: (messageId, status, whatsappMessageId) => 
    ipcRenderer.invoke('update-message-status', messageId, status, whatsappMessageId),
  cancelScheduledMessage: (messageId) => 
    ipcRenderer.invoke('cancel-scheduled-message', messageId),
  
  // File system access
  openFileDialog: (options) => 
    ipcRenderer.invoke('open-file-dialog', options),
  
  // Scheduled message operations
  getScheduledMessages: (userId, page, limit, status) => ipcRenderer.invoke('get-scheduled-messages', userId, page, limit, status),
  cancelScheduledMessage: (messageId) => ipcRenderer.invoke('cancel-scheduled-message', messageId),
  deleteScheduledMessages: (messageIds) => ipcRenderer.invoke('delete-scheduled-messages', messageIds),
  
  // Message statistics
  getMessageStatistics: (userId, startDate, endDate) => ipcRenderer.invoke('get-message-statistics', userId, startDate, endDate),
  
  // Sales API
  getSales: (page, limit, filters) => ipcRenderer.invoke('getSales', page, limit, filters),
  updateSale: (saleId, saleData) => ipcRenderer.invoke('updateSale', saleId, saleData),
  deleteSales: (saleIds) => ipcRenderer.invoke('deleteSales', saleIds),
  getLastFetchTime: () => ipcRenderer.invoke('getLastFetchTime'),
  fetchSalesNow: () => ipcRenderer.invoke('fetchSalesNow'),
  fetchHistoricalSales: () => ipcRenderer.invoke('fetchHistoricalSales'),
  getSalesTowns: () => ipcRenderer.invoke('getSalesTowns'),
  
  // Sales Settings and Scheduled Messages
  getSalesSettings: () => ipcRenderer.invoke('getSalesSettings'),
  updateSalesSettings: (settings) => ipcRenderer.invoke('updateSalesSettings', settings),
  getSalesScheduledMessages: (page, limit, filters) => 
    ipcRenderer.invoke('getSalesScheduledMessages', page, limit, filters),
  cancelSalesScheduledMessage: (messageId) => 
    ipcRenderer.invoke('cancelSalesScheduledMessage', messageId),
  deleteSalesScheduledMessages: (messageIds) => 
    ipcRenderer.invoke('deleteSalesScheduledMessages', messageIds),
  getSalesMessageStatistics: (startDate, endDate) => 
    ipcRenderer.invoke('getSalesMessageStatistics', startDate, endDate),
  
  // Track WhatsApp message status for sales messages
  trackSalesMessageStatus: (userId, whatsappMessageId, salesMessageId) =>
    ipcRenderer.invoke('trackSalesMessageStatus', userId, whatsappMessageId, salesMessageId),
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
