const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcMain } = require('electron');

// Base directory for WhatsApp data
const desktopPath = path.join(os.homedir(), 'Desktop');
const whatsappDataPath = path.join(desktopPath, 'bss-wp-whatsapp');

// Ensure the directory exists
if (!fs.existsSync(whatsappDataPath)) {
  fs.mkdirSync(whatsappDataPath, { recursive: true });
}

// WhatsApp client instances mapped to user IDs
const clientInstances = new Map();

// Initialize WhatsApp client for a specific user
function initWhatsAppClient(userId) {
  // If a client instance already exists, return it
  if (clientInstances.has(userId)) {
    return clientInstances.get(userId);
  }

  // Create new client instance with LocalAuth strategy
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `user-${userId}`,
      dataPath: whatsappDataPath
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    }
  });

  // Store client instance
  clientInstances.set(userId, client);

  // Set up event handlers
  client.on('qr', (qr) => {
    // Send QR code to renderer
    global.mainWindow.webContents.send('whatsapp-qr', { userId, qr });
  });

  client.on('ready', async () => {
    // Get client info when ready
    try {
      const info = await client.getState();
      const contact = await client.getContactById(client.info.wid._serialized);
      
      const profilePicUrl = await contact.getProfilePicUrl();
      
      // Send client info to renderer
      global.mainWindow.webContents.send('whatsapp-ready', {
        userId,
        info: {
          name: contact.name || contact.pushname,
          number: client.info.wid.user,
          profilePic: profilePicUrl || ''
        }
      });
    } catch (error) {
      console.error('Error getting WhatsApp contact info:', error);
    }
  });

  client.on('authenticated', () => {
    global.mainWindow.webContents.send('whatsapp-authenticated', { userId });
  });

  client.on('auth_failure', (message) => {
    console.error('WhatsApp authentication failed:', message);
    global.mainWindow.webContents.send('whatsapp-auth-failure', { userId, message });
  });

  client.on('disconnected', () => {
    global.mainWindow.webContents.send('whatsapp-disconnected', { userId });
  });

  // Initialize the client
  client.initialize();

  return client;
}

// Check if a session exists for a user
function sessionExists(userId) {
  const sessionDirPath = path.join(whatsappDataPath, `session-user-${userId}`);
  return fs.existsSync(sessionDirPath);
}

// Find all existing WhatsApp sessions and return their user IDs
function findExistingSessionUserIds() {
  try {
    const sessionDirs = fs.readdirSync(whatsappDataPath);
    const userIds = [];
    
    for (const dir of sessionDirs) {
      // Match directories that follow the pattern "session-user-123"
      const match = dir.match(/^session-user-(\d+)$/);
      if (match) {
        userIds.push(parseInt(match[1], 10));
      }
    }
    
    return userIds;
  } catch (error) {
    console.error('Error finding existing WhatsApp sessions:', error);
    return [];
  }
}

// Initialize WhatsApp for all users with existing sessions
function initWhatsAppForExistingSessions() {
  const userIds = findExistingSessionUserIds();
  console.log(`Found ${userIds.length} existing WhatsApp sessions`);
  
  for (const userId of userIds) {
    console.log(`Auto-initializing WhatsApp for user ID: ${userId}`);
    initWhatsAppClient(userId);
  }
}

// Logout from WhatsApp and remove session data
async function logoutWhatsApp(userId) {
  const client = clientInstances.get(userId);
  
  if (client) {
    try {
      // Properly logout using client's logout method
      await client.logout();
      
      // Destroy the client
      await client.destroy();
      
      // Remove from our instances map
      clientInstances.delete(userId);
      
      return { success: true };
    } catch (error) {
      console.error('Error during WhatsApp logout:', error);
      return { success: false, error: error.message };
    }
  }
  
  return { success: false, error: 'No active WhatsApp session' };
}

// Initialize IPC handlers
function initWhatsAppHandlers() {
  // Initialize WhatsApp for a user
  ipcMain.handle('init-whatsapp', async (event, { userId }) => {
    try {
      const client = initWhatsAppClient(userId);
      return { success: true, hasSession: sessionExists(userId) };
    } catch (error) {
      console.error('Error initializing WhatsApp:', error);
      return { success: false, error: error.message };
    }
  });

  // Logout from WhatsApp
  ipcMain.handle('logout-whatsapp', async (event, { userId }) => {
    return await logoutWhatsApp(userId);
  });

  // Get WhatsApp connection status
  ipcMain.handle('get-whatsapp-status', async (event, { userId }) => {
    const client = clientInstances.get(userId);
    
    if (!client) {
      return { success: true, connected: false, hasSession: sessionExists(userId) };
    }
    
    try {
      const state = await client.getState();
      return {
        success: true,
        connected: state === 'CONNECTED',
        state: state
      };
    } catch (error) {
      console.error('Error getting WhatsApp status:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  initWhatsAppHandlers,
  initWhatsAppClient,
  logoutWhatsApp,
  sessionExists,
  initWhatsAppForExistingSessions
}; 