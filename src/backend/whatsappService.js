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

// Cache for client info to maintain state between client status checks
const clientInfoCache = new Map();

// Track client initialization state to prevent multiple initialize calls
const clientInitializing = new Map();

// Track client connection state to avoid unnecessary re-connections
const clientConnectionState = new Map();

// Initialize WhatsApp client for a specific user
function initWhatsAppClient(userId, forceInit = false) {
  // If a client is already initializing, don't start another initialization
  if (clientInitializing.get(userId) && !forceInit) {
    console.log(`WhatsApp client for user ${userId} is already initializing, skipping duplicate initialization`);
    return clientInstances.get(userId);
  }
  
  // If a client instance already exists and is connected, return it without re-initializing
  if (clientInstances.has(userId) && clientConnectionState.get(userId) === 'CONNECTED' && !forceInit) {
    console.log(`WhatsApp client for user ${userId} is already connected, skipping initialization`);
    return clientInstances.get(userId);
  }

  // Mark client as initializing to prevent duplicate initializations
  clientInitializing.set(userId, true);
  console.log(`Initializing WhatsApp client for user ${userId}`);

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
  // Set initial connection state
  clientConnectionState.set(userId, 'INITIALIZING');

  // Set up event handlers
  client.on('qr', (qr) => {
    // Send QR code to renderer
    console.log(`QR code generated for user ${userId}`);
    clientConnectionState.set(userId, 'QR_READY');
    global.mainWindow.webContents.send('whatsapp-qr', { userId, qr });
  });

  client.on('ready', async () => {
    // Get client info when ready
    try {
      console.log(`WhatsApp client ready for user ${userId}`);
      clientConnectionState.set(userId, 'CONNECTED');
      clientInitializing.set(userId, false); // Client is no longer initializing
      
      // Get the contact information and profile picture
      const contact = await client.getContactById(client.info.wid._serialized);
      const profilePicUrl = await contact.getProfilePicUrl();
      
      // Create client info object
      const clientInfo = {
        name: contact.name || contact.pushname || 'WhatsApp User',
        number: client.info.wid.user,
        profilePic: profilePicUrl || ''
      };
      
      // Cache the client info
      clientInfoCache.set(userId, clientInfo);
      
      // Send client info to renderer
      global.mainWindow.webContents.send('whatsapp-ready', {
        userId,
        info: clientInfo
      });
    } catch (error) {
      console.error('Error getting WhatsApp contact info:', error);
      
      // Send basic info even if we couldn't get all details
      const basicInfo = {
        name: 'WhatsApp User',
        number: 'Unknown',
        profilePic: ''
      };
      
      clientInfoCache.set(userId, basicInfo);
      
      global.mainWindow.webContents.send('whatsapp-ready', {
        userId,
        info: basicInfo
      });
    }
  });

  client.on('authenticated', () => {
    console.log(`WhatsApp client authenticated for user ${userId}`);
    clientConnectionState.set(userId, 'AUTHENTICATED');
    global.mainWindow.webContents.send('whatsapp-authenticated', { userId });
    
    // If we have cached info, send ready event again to ensure UI is updated
    if (clientInfoCache.has(userId)) {
      setTimeout(() => {
        global.mainWindow.webContents.send('whatsapp-ready', {
          userId,
          info: clientInfoCache.get(userId)
        });
      }, 1000);
    }
  });

  client.on('auth_failure', (message) => {
    console.error(`WhatsApp authentication failed for user ${userId}:`, message);
    
    // Update state
    clientConnectionState.set(userId, 'AUTH_FAILURE');
    clientInitializing.set(userId, false); // No longer initializing
    
    // Clear cached info
    clientInfoCache.delete(userId);
    
    global.mainWindow.webContents.send('whatsapp-auth-failure', { userId, message });
  });

  client.on('disconnected', () => {
    console.log(`WhatsApp client disconnected for user ${userId}`);
    
    // Update state
    clientConnectionState.set(userId, 'DISCONNECTED');
    clientInitializing.set(userId, false); // No longer initializing
    
    // Clear cached info
    clientInfoCache.delete(userId);
    
    global.mainWindow.webContents.send('whatsapp-disconnected', { userId });
  });

  // Initialize the client
  client.initialize().catch(err => {
    console.error(`Error initializing WhatsApp client for user ${userId}:`, err);
    clientConnectionState.set(userId, 'ERROR');
    clientInitializing.set(userId, false); // No longer initializing
  });

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
      console.log(`Logging out WhatsApp for user ${userId}`);
      
      // Clear all states
      clientInfoCache.delete(userId);
      clientConnectionState.set(userId, 'LOGGING_OUT');
      clientInitializing.set(userId, false);
      
      // Properly logout using client's logout method
      await client.logout();
      
      // Destroy the client
      await client.destroy();
      
      // Remove from all maps
      clientInstances.delete(userId);
      clientConnectionState.delete(userId);
      clientInitializing.delete(userId);
      
      return { success: true };
    } catch (error) {
      console.error('Error during WhatsApp logout:', error);
      
      // Clean up instance even if logout failed
      clientInstances.delete(userId);
      clientInfoCache.delete(userId);
      clientConnectionState.delete(userId);
      clientInitializing.delete(userId);
      
      return { success: false, error: error.message };
    }
  }
  
  return { success: false, error: 'No active WhatsApp session' };
}

// Helper function to get client info from cache or try to fetch it
async function getClientInfo(userId, client) {
  // If we have cached info, return it
  if (clientInfoCache.has(userId)) {
    return clientInfoCache.get(userId);
  }
  
  // If client is not ready or initialized, return null
  if (!client || !client.info || !client.info.wid) {
    return null;
  }
  
  try {
    // Try to fetch client info
    const contact = await client.getContactById(client.info.wid._serialized);
    const profilePicUrl = await contact.getProfilePicUrl();
    
    const clientInfo = {
      name: contact.name || contact.pushname || 'WhatsApp User',
      number: client.info.wid.user,
      profilePic: profilePicUrl || ''
    };
    
    // Cache the client info
    clientInfoCache.set(userId, clientInfo);
    
    return clientInfo;
  } catch (error) {
    console.error('Error getting client info:', error);
    return null;
  }
}

// Initialize IPC handlers
function initWhatsAppHandlers() {
  // Initialize WhatsApp for a user
  ipcMain.handle('init-whatsapp', async (event, { userId }) => {
    try {
      // Check if client is already connected or initializing
      const currentState = clientConnectionState.get(userId);
      const isInitializing = clientInitializing.get(userId);
      
      // If client is already connected and initialized, don't reinitialize
      if (currentState === 'CONNECTED' && !isInitializing) {
        console.log(`WhatsApp for user ${userId} is already connected, skipping init request`);
        
        // If we have cached info, send ready event again to ensure UI is updated
        if (clientInfoCache.has(userId)) {
          global.mainWindow.webContents.send('whatsapp-ready', {
            userId,
            info: clientInfoCache.get(userId)
          });
        }
        
        return { 
          success: true, 
          connected: true, 
          state: 'CONNECTED',
          hasSession: sessionExists(userId) 
        };
      }
      
      // If client is initializing, don't start another initialization
      if (isInitializing) {
        console.log(`WhatsApp for user ${userId} is already initializing, waiting for completion`);
        return { 
          success: true, 
          connected: false, 
          state: 'INITIALIZING',
          hasSession: sessionExists(userId) 
        };
      }
      
      console.log(`Initializing WhatsApp for user ${userId} (IPC request)`);
      const client = initWhatsAppClient(userId);
      return { 
        success: true, 
        connected: false, 
        state: clientConnectionState.get(userId) || 'INITIALIZING',
        hasSession: sessionExists(userId) 
      };
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
      return { 
        success: true, 
        connected: false, 
        state: 'NOT_INITIALIZED',
        hasSession: sessionExists(userId) 
      };
    }
    
    try {
      // First check our cached connection state
      const cachedState = clientConnectionState.get(userId);
      
      // If we know the client is already connected, use cached info
      if (cachedState === 'CONNECTED' && clientInfoCache.has(userId)) {
        return {
          success: true,
          connected: true,
          state: 'CONNECTED',
          hasSession: sessionExists(userId),
          info: clientInfoCache.get(userId)
        };
      }
      
      // Check if client is still initializing
      if (clientInitializing.get(userId)) {
        return { 
          success: true, 
          connected: false, 
          state: 'INITIALIZING',
          hasSession: sessionExists(userId)
        };
      }
      
      // Check if client is initialized properly
      if (!client.pupPage || !client.pupBrowser) {
        console.log(`WhatsApp client for user ${userId} is still initializing (missing page/browser)`);
        return { 
          success: true, 
          connected: false, 
          state: 'INITIALIZING',
          hasSession: sessionExists(userId)
        };
      }
      
      // Get client state directly from the client
      const state = await client.getState();
      
      // Only log state changes, not every status check
      const previousState = clientConnectionState.get(userId);
      if (previousState !== state) {
        console.log(`WhatsApp state for user ${userId} changed: ${previousState || 'UNKNOWN'} -> ${state}`);
        clientConnectionState.set(userId, state);
      }
      
      // If connected, make sure we have client info
      if (state === 'CONNECTED') {
        const clientInfo = await getClientInfo(userId, client);
        
        // If we have client info, send it to the frontend
        if (clientInfo) {
          global.mainWindow.webContents.send('whatsapp-ready', {
            userId,
            info: clientInfo
          });
        } else {
          // Try to fetch client info in the background if we don't have it
          setTimeout(async () => {
            try {
              const info = await getClientInfo(userId, client);
              if (info) {
                global.mainWindow.webContents.send('whatsapp-ready', {
                  userId,
                  info
                });
              }
            } catch (error) {
              console.error('Error fetching delayed client info:', error);
            }
          }, 2000);
        }
      }
      
      return {
        success: true,
        connected: state === 'CONNECTED',
        state: state,
        hasSession: sessionExists(userId)
      };
    } catch (error) {
      console.error('Error getting WhatsApp status:', error);
      
      // Handle specific error about evaluate
      if (error.message && error.message.includes("Cannot read properties of null (reading 'evaluate')")) {
        console.log(`WhatsApp client for user ${userId} is still initializing (evaluate error)`);
        return { 
          success: true,
          connected: false, 
          state: 'INITIALIZING',
          hasSession: sessionExists(userId)
        };
      }
      
      // If we get a different error, check if the client is still usable
      try {
        // Check for cached info
        const cachedInfo = clientInfoCache.get(userId);
        if (cachedInfo) {
          return {
            success: true,
            connected: true, // Assume connected if we have cached info
            state: 'CONNECTED',
            hasSession: sessionExists(userId)
          };
        }
        
        return { 
          success: true,
          connected: false,
          state: 'ERROR',
          hasSession: sessionExists(userId),
          error: error.message
        };
      } catch (innerError) {
        console.error('Error handling WhatsApp status error:', innerError);
        return { success: false, error: error.message };
      }
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