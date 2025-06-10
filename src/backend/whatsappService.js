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

// Import necessary modules
const { 
  getUnsentScheduledMessages, 
  getSenderSettings, 
  updateMessageStatus,
  getAllScheduledMessages,
  canSendMessageNow
} = require('./db');

// For direct access to db functions
const db = require('./db');

// Track scheduler intervals by user ID
const schedulerIntervals = new Map();

// Track message statuses for sales
const salesMessageTracking = new Map();

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
  
  // If client exists but we're forcing reinitialization, clean up the old client first
  if (clientInstances.has(userId) && forceInit) {
    try {
      const oldClient = clientInstances.get(userId);
      oldClient.removeAllListeners(); // Remove all event listeners to prevent memory leaks
      oldClient.destroy().catch(err => console.error(`Error destroying old client: ${err}`));
      clientInstances.delete(userId);
    } catch (err) {
      console.error(`Error cleaning up old client: ${err}`);
    }
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
  
  // Set a higher max listeners value to avoid warnings
  client.setMaxListeners(25);

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
  
  // Handle message status updates for sales messages
  client.on('message_ack', async (message, ack) => {
    try {
      // Handle ack codes (3 = delivered, 4 = read)
      // For more info: https://docs.wwebjs.dev/Message.html#.ACK_TYPES
      
      // Get WhatsApp message ID
      const whatsappMessageId = message.id._serialized;
      
      // Check if this is a tracked sales message
      if (salesMessageTracking.has(whatsappMessageId)) {
        const { salesMessageId } = salesMessageTracking.get(whatsappMessageId);
        const db = require('./db');
        
        // Update status based on ack code
        if (ack === 2) {
          // Message sent to server (but we already handle this when sending)
          console.log(`Sales message ${salesMessageId} sent to server`);
        } else if (ack === 3) {
          // Message delivered to recipient
          console.log(`Sales message ${salesMessageId} delivered to recipient`);
          await db.updateSalesMessageStatus(salesMessageId, 'DELIVERED', whatsappMessageId);
        } else if (ack === 4) {
          // Message read by recipient
          console.log(`Sales message ${salesMessageId} read by recipient`);
          await db.updateSalesMessageStatus(salesMessageId, 'READ', whatsappMessageId);
        }
      }
      
    } catch (error) {
      console.error('Error handling message status update:', error);
    }
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
  
  for (const userId of userIds) {
    try {
      initWhatsAppWithScheduler(userId);
    } catch (error) {
      console.error(`Error initializing WhatsApp for user ${userId}:`, error);
    }
  }
  
  return userIds.length;
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
      
      // Stop the message scheduler if it's running
      stopMessageScheduler(userId);
      
      // Remove all event listeners before logout to prevent memory leaks
      client.removeAllListeners();
      
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
      
      // Try to clean up even if logout failed
      try {
        client.removeAllListeners();
        await client.destroy();
      } catch (cleanupError) {
        console.error('Error during cleanup after failed logout:', cleanupError);
      }
      
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

// Send a text message to a specific number
async function sendMessage(userId, phoneNumber, message) {
  try {
    const client = clientInstances.get(userId);
    
    if (!client || clientConnectionState.get(userId) !== 'CONNECTED') {
      throw new Error('WhatsApp client not ready');
    }
    
    // Format the phone number with country code if needed
    let formattedNumber = phoneNumber;
    if (!phoneNumber.includes('@')) {
      // Remove any non-digit characters
      formattedNumber = phoneNumber.replace(/\D/g, '');
      // Append @c.us to make it a valid WhatsApp ID
      formattedNumber = `${formattedNumber}@c.us`;
    }
    
    // Send the message
    const sentMessage = await client.sendMessage(formattedNumber, message);
    
    return {
      success: true,
      messageId: sentMessage.id._serialized,
      timestamp: sentMessage.timestamp,
    };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Send a message with media
async function sendMessageWithMedia(userId, contactNumber, message, media) {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if client exists for user
      const client = clientInstances.get(userId);
      
      if (!client) {
        return resolve({
          success: false,
          error: 'WhatsApp client not initialized'
        });
      }
      
      // Make sure we have a valid number format (add @ if needed)
      let formattedNumber = contactNumber;
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }
      
      // Try to get contact by number
      try {
        const contact = await client.getContactById(formattedNumber);
        
        if (!contact) {
          return resolve({
            success: false,
            error: 'Contact not found'
          });
        }
        
        // For images, handle base64 data
        if (media && media.data) {
          // If this is a base64 string, properly process it
          let mediaData = media.data;
          let mimetype = media.mimetype || 'image/png';
          let filename = media.filename || 'image.png';
          
          try {
            // For simple message with just text
            if (!mediaData) {
              const sentMessage = await client.sendMessage(formattedNumber, message);
              
              return resolve({
                success: true,
                messageId: sentMessage.id._serialized
              });
            }
            
            console.log(`Preparing to send media message to ${formattedNumber}`);
            console.log(`Media mimetype: ${mimetype}`);
            
            // Import MessageMedia class
            const { MessageMedia } = require('whatsapp-web.js');
            let messageMedia;
            
            // Check if it's a base64 string
            if (typeof mediaData === 'string') {
              // If it has data:image prefix, remove it for MessageMedia
              if (mediaData.includes(';base64,')) {
                const parts = mediaData.split(';base64,');
                if (parts.length === 2) {
                  // Update mimetype if available from the data URI
                  if (parts[0].startsWith('data:')) {
                    mimetype = parts[0].substring(5);
                  }
                  mediaData = parts[1];
                }
              }
              
              // Create MessageMedia object
              messageMedia = new MessageMedia(mimetype, mediaData, filename);
              
              // Send the message with media
              console.log(`Sending media message to ${formattedNumber}`);
              const sentMessage = await client.sendMessage(formattedNumber, messageMedia, {
                caption: message
              });
              
              return resolve({
                success: true,
                messageId: sentMessage.id._serialized
              });
            } else {
              console.log('Media data is not in the expected format');
              
              // Fallback to just sending the text
              const sentMessage = await client.sendMessage(formattedNumber, message);
              
              return resolve({
                success: true,
                messageId: sentMessage.id._serialized
              });
            }
          } catch (mediaError) {
            console.error('Error sending WhatsApp message with media:', mediaError);
            
            // Try to send just the text message as fallback
            try {
              console.log(`Falling back to text-only message for ${formattedNumber}`);
              const sentMessage = await client.sendMessage(formattedNumber, message);
              
              return resolve({
                success: true,
                messageId: sentMessage.id._serialized
              });
            } catch (textError) {
              console.error('Error sending text fallback message:', textError);
              return resolve({
                success: false,
                error: `Failed to send message: ${textError.message}`
              });
            }
          }
        } else {
          // Just send text message
          const sentMessage = await client.sendMessage(formattedNumber, message);
          
          return resolve({
            success: true,
            messageId: sentMessage.id._serialized
          });
        }
      } catch (contactError) {
        console.error('Error getting contact:', contactError);
        return resolve({
          success: false,
          error: `Contact error: ${contactError.message}`
        });
      }
    } catch (err) {
      console.error('Error in sendMessageWithMedia:', err);
      resolve({
        success: false,
        error: err.message
      });
    }
  });
}

// Get message status
async function getMessageStatus(userId, messageId) {
  try {
    const client = clientInstances.get(userId);
    
    if (!client || clientConnectionState.get(userId) !== 'CONNECTED') {
      throw new Error('WhatsApp client not ready');
    }
    
    // Get message info
    const messageInfo = await client.getMessageById(messageId);
    if (!messageInfo) {
      throw new Error('Message not found');
    }
    
    const status = messageInfo.ack;
    
    // Convert status code to readable status
    let statusText;
    switch (status) {
      case -1:
        statusText = 'ERROR';
        break;
      case 0:
        statusText = 'PENDING';
        break;
      case 1:
        statusText = 'SENT';
        break;
      case 2:
        statusText = 'DELIVERED';
        break;
      case 3:
        statusText = 'READ';
        break;
      case 4:
        statusText = 'PLAYED';
        break;
      default:
        statusText = 'UNKNOWN';
        }
        
        return { 
          success: true, 
      status,
      statusText
    };
  } catch (error) {
    console.error('Error getting message status:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Check if current time is within working hours
function isWithinWorkingHours(currentTime, startHour, endHour) {
  // Parse start and end hours
  const [startHours, startMinutes] = startHour.split(':').map(Number);
  const [endHours, endMinutes] = endHour.split(':').map(Number);
  
  // Create Date objects for start and end times today
  const startTime = new Date(currentTime);
  startTime.setHours(startHours, startMinutes, 0, 0);
  
  const endTime = new Date(currentTime);
  endTime.setHours(endHours, endMinutes, 0, 0);
  
  // If end time is earlier than start time, it spans over midnight
  if (endTime < startTime) {
    endTime.setDate(endTime.getDate() + 1);
  }
  
  // Check if current time is between start and end times
  const isWithin = currentTime >= startTime && currentTime <= endTime;
  
  // Verbose logging to help with debugging
  console.log(`Working hours check: ${currentTime.toLocaleTimeString()} is ${isWithin ? 'within' : 'outside'} ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`);
  
  return isWithin;
}

// Start message scheduler for a specific user
async function startMessageScheduler(userId) {
  try {
    // Check if scheduler already running for this user
    if (schedulerIntervals.has(userId)) {
      console.log(`Message scheduler for user ${userId} is already running`);
      return;
    }
    
    console.log(`Starting message scheduler for user ${userId}`);
    
    // Set up interval to check for pending messages
    const intervalId = setInterval(async () => {
      try {
        await processPendingMessages(userId);
      } catch (error) {
        console.error(`Error processing pending messages for user ${userId}:`, error);
      }
    }, 10000); // Check every 10 seconds
    
    // Store interval ID
    schedulerIntervals.set(userId, intervalId);
    
    // Do an initial process immediately
    await processPendingMessages(userId);
  } catch (error) {
    console.error(`Error starting message scheduler for user ${userId}:`, error);
  }
}

// Stop the message scheduler for a specific user
function stopMessageScheduler(userId) {
  const interval = schedulerIntervals.get(userId);
  if (interval) {
    clearInterval(interval);
    schedulerIntervals.delete(userId);
    console.log(`Stopped message scheduler for user ${userId}`);
  }
}

// Process pending messages for a specific user
async function processPendingMessages(userId) {
  try {
    // Get user's sender settings
    const settings = await getSenderSettings(userId);
    
    if (!settings.enabled) {
      console.log(`Message scheduler for user ${userId} is disabled`);
      return; // Scheduler is disabled
    }
    
    // Check if the client is connected
    const client = clientInstances.get(userId);
    if (!client || clientConnectionState.get(userId) !== 'CONNECTED') {
      console.log(`WhatsApp client for user ${userId} is not connected, skipping message processing`);
      return;
    }
    
    // Get unsent messages
    const unsentMessages = await getUnsentScheduledMessages(userId);
    
    if (unsentMessages.length === 0) {
      return; // No messages to send
    }
    
    console.log(`Processing ${unsentMessages.length} unsent messages for user ${userId}`);
    
    // Get all messages that have been sent to find the most recent one
    const allMessages = await db.getAllScheduledMessages();
    
    // Filter for sent messages by this user
    const sentMessages = allMessages.filter(
      m => m.user_id === userId && ['SENT', 'DELIVERED', 'READ'].includes(m.status)
    );
    
    // Find the most recent sent message timestamp
    let lastSentMessageTime = null;
    if (sentMessages.length > 0) {
      // Sort by timestamp (most recent first)
      sentMessages.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      
      // Get the most recent message
      const lastSentMessage = sentMessages[0];
      lastSentMessageTime = new Date(lastSentMessage.updated_at);
      
      console.log(`Last message sent at ${lastSentMessageTime.toLocaleTimeString()}`);
    } else {
      console.log(`No previously sent messages found for user ${userId}`);
    }
    
    // Check if we can send a message now based on working hours and interval
    const sendCheck = await db.canSendMessageNow(userId, settings, lastSentMessageTime);
    
    if (!sendCheck.canSend) {
      console.log(`Cannot send message now. Reason: ${sendCheck.reason}`);
      
      if (sendCheck.reason === 'interval_not_elapsed') {
        console.log(`Will check again in the next processing cycle. Need to wait ${sendCheck.waitSeconds} more seconds.`);
      } else if (sendCheck.nextTime) {
        console.log(`Next possible send time: ${sendCheck.nextTime.toLocaleString()}`);
      }
      
      return; // Cannot send now
    }
    
    // Get the next message to send
    const nextMessage = unsentMessages[0];
    
    // Mark message as sending
    await updateMessageStatus(nextMessage.id, 'SENDING');
    console.log(`Sending message ${nextMessage.id} to ${nextMessage.contact_phone}`);
    
    // Process template variables
    let messageText = nextMessage.message_content.text || '';
    
    // Replace contact variables
    if (messageText.includes('{')) {
      const contact = {
        name: nextMessage.contact_name || '',
        surname: nextMessage.contact_surname || '',
        phone: nextMessage.contact_phone || '',
        email: nextMessage.contact_email || '',
        birthday: nextMessage.contact_birthday || '',
        // Add any other contact fields here
      };
      
      // Replace contact variables
      for (const [key, value] of Object.entries(contact)) {
        messageText = messageText.replace(new RegExp(`{${key}}`, 'g'), value);
      }
      
      // Replace date/time variables
      const currentDate = new Date();
      const dateVars = {
        date: currentDate.toLocaleDateString(),
        time: currentDate.toLocaleTimeString(),
        datetime: currentDate.toLocaleString(),
        day: currentDate.getDate(),
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        hours: currentDate.getHours(),
        minutes: currentDate.getMinutes(),
        seconds: currentDate.getSeconds()
      };
      
      for (const [key, value] of Object.entries(dateVars)) {
        messageText = messageText.replace(new RegExp(`{${key}}`, 'g'), value);
      }
      
      // Clean up any remaining unmatched variables
      messageText = messageText.replace(/{[^}]+}/g, '');
    }
    
    // Send the message
    try {
      let result;
      
      // Check if the message has images
      if (nextMessage.message_content.images && nextMessage.message_content.images.length > 0) {
        console.log(`Message ${nextMessage.id} has images, sending as media message`);
        
        // Send message with media
        const media = {
          data: nextMessage.message_content.images[0],
          mimetype: nextMessage.message_content.images[0].split(';')[0].split(':')[1],
          filename: 'image.png'
        };
        
        result = await sendMessageWithMedia(
          userId,
          nextMessage.contact_phone,
          messageText,
          media
        );
      } else {
        console.log(`Message ${nextMessage.id} is text only`);
        
        // Send text message
        result = await sendMessage(
          userId,
          nextMessage.contact_phone,
          messageText
        );
      }
      
      if (result.success) {
        // Update message status to sent
        await updateMessageStatus(nextMessage.id, 'SENT', result.messageId);
        console.log(`Message ${nextMessage.id} sent successfully, WhatsApp message ID: ${result.messageId}`);
        
        // Set up message status tracking
        trackMessageStatus(userId, result.messageId, nextMessage.id);
      } else {
        // Update message status to failed
        await updateMessageStatus(nextMessage.id, 'FAILED');
        console.error(`Failed to send message ${nextMessage.id}:`, result.error);
      }
    } catch (error) {
      // Update message status to failed
      await updateMessageStatus(nextMessage.id, 'FAILED');
      console.error(`Error sending message ${nextMessage.id}:`, error);
    }
  } catch (error) {
    console.error(`Error processing pending messages for user ${userId}:`, error);
  }
}

// Get recently sent messages for a user
async function getRecentlySentMessages(userId) {
  try {
    // Use the DB function directly, not the reference
    const scheduledMessagesData = await db.readScheduledMessages();
    
    // Filter messages by user ID and status (only get messages that have been sent)
    const sentMessages = scheduledMessagesData.scheduledMessages.filter(
      m => m.user_id === userId && ['SENT', 'DELIVERED', 'READ'].includes(m.status)
    );
    
    return sentMessages;
  } catch (error) {
    console.error(`Error getting recently sent messages for user ${userId}:`, error);
    return [];
  }
}

// Track message status changes
function trackMessageStatus(userId, whatsappMessageId, messageId) {
  try {
    const client = clientInstances.get(userId);
    
    if (!client) {
      console.error(`Cannot track message status: WhatsApp client not found for user ${userId}`);
      return;
    }

    // Set max listeners to avoid memory leak warnings
    if (client.getMaxListeners() <= 10) {
      client.setMaxListeners(5000);  // Increase max listeners to accommodate multiple message tracking
    }
    
    // Log that we're starting to track this message
    console.log(`Setting up status tracking for message ${messageId} (WhatsApp ID: ${whatsappMessageId})`);
    
    // Create named handler functions for later removal
    const messageAckHandler = async (msg, ack) => {
      if (msg.id && msg.id._serialized === whatsappMessageId) {
        console.log(`Message ${messageId} received ACK update: ${ack}`);
        
        // WhatsApp-Web.js ACK codes:
        // ACK_ERROR = -1
        // ACK_PENDING = 0
        // ACK_SERVER = 1
        // ACK_DEVICE = 2
        // ACK_READ = 3
        // ACK_PLAYED = 4
        
        let newStatus;
        switch (ack) {
          case 2:
            newStatus = 'DELIVERED';
            break;
          case 3:
            newStatus = 'READ';
            // When message is read, we can remove the event listeners
            client.removeListener('message_ack', messageAckHandler);
            client.removeListener('message_error', messageErrorHandler);
            break;
          case -1:
            newStatus = 'FAILED';
            // When message fails, we can remove the event listeners
            client.removeListener('message_ack', messageAckHandler);
            client.removeListener('message_error', messageErrorHandler);
            break;
          default:
            // Don't update for other statuses
            return;
        }
        
        // Update message status
        try {
          await updateMessageStatus(messageId, newStatus);
          console.log(`Updated message ${messageId} status to ${newStatus}`);
        } catch (error) {
          console.error(`Error updating message ${messageId} status:`, error);
        }
      }
    };
    
    const messageErrorHandler = async (msg, error) => {
      if (msg.id && msg.id._serialized === whatsappMessageId) {
        console.error(`Error with message ${messageId}:`, error);
        
        // Update message status to FAILED
        try {
          await updateMessageStatus(messageId, 'FAILED');
          console.log(`Updated message ${messageId} status to FAILED due to error`);
          
          // Remove event listeners
          client.removeListener('message_ack', messageAckHandler);
          client.removeListener('message_error', messageErrorHandler);
        } catch (updateError) {
          console.error(`Error updating message ${messageId} status:`, updateError);
        }
      }
    };
    
    // Set up event listeners for this specific message
    client.on('message_ack', messageAckHandler);
    client.on('message_error', messageErrorHandler);
    
    // Set a timeout to automatically remove listeners after a reasonable time (30 minutes)
    setTimeout(() => {
      client.removeListener('message_ack', messageAckHandler);
      client.removeListener('message_error', messageErrorHandler);
      console.log(`Auto-removed event listeners for message ${messageId} after timeout`);
    }, 30 * 60 * 1000);
  } catch (error) {
    console.error(`Error setting up message tracking for message ${messageId}:`, error);
  }
}

// Initialize WhatsApp client and message scheduler for a user
async function initWhatsAppWithScheduler(userId) {
  // Initialize WhatsApp client
      const client = initWhatsAppClient(userId);
  
  // Create named handler for clean removal
  const readyHandler = async () => {
    try {
      await startMessageScheduler(userId);
    } catch (error) {
      console.error(`Error starting message scheduler:`, error);
    }
  };
  
  // Start message scheduler when client is ready
  client.on('ready', readyHandler);
  
  // Create named handler for clean removal
  const disconnectedHandler = () => {
    stopMessageScheduler(userId);
    
    // Clean up event listeners to prevent memory leaks
    client.removeListener('ready', readyHandler);
    client.removeListener('disconnected', disconnectedHandler);
  };
  
  // Stop scheduler when client is disconnected
  client.on('disconnected', disconnectedHandler);
  
  return client;
}

// Track sales message status
function trackSalesMessageStatus(userId, whatsappMessageId, salesMessageId) {
  try {
    const client = clientInstances.get(userId);
    if (!client) {
      console.error(`Cannot track sales message status: No client for user ${userId}`);
      return false;
    }
    
    console.log(`Setting up tracking for sales message ${salesMessageId} with WhatsApp ID ${whatsappMessageId}`);
    
    // Create a key for tracking
    const trackingKey = `${userId}_${whatsappMessageId}`;
    
    // Store tracking info
    salesMessageTracking.set(trackingKey, {
      userId,
      messageId: whatsappMessageId,
      salesMessageId,
      setupTime: new Date().toISOString()
    });
    
    // Set up event handlers
    const handleAck = async (msg, ack) => {
      // Make sure this is our message
      if (msg.id._serialized !== whatsappMessageId) return;
      
      console.log(`Message ACK received for sales message ${salesMessageId}: ${ack}`);
      
      let newStatus;
      // ACK 1 = SENT
      // ACK 2 = DELIVERED
      // ACK 3 = READ
      if (ack === 2) {
        newStatus = 'DELIVERED';
        await db.updateSalesMessageStatus(salesMessageId, newStatus);
      } else if (ack === 3) {
        newStatus = 'READ';
        await db.updateSalesMessageStatus(salesMessageId, newStatus);
        
        // Remove handler when read
        client.removeListener('message_ack', handleAck);
      }
    };
    
    // Add listeners
    client.on('message_ack', handleAck);
    
    return true;
  } catch (error) {
    console.error('Error setting up sales message tracking:', error);
    return false;
  }
}

// Initialize IPC handlers
function initWhatsAppHandlers() {
  // Initialize WhatsApp client
  ipcMain.handle('init-whatsapp', async (event, { userId }) => {
    try {
      const client = initWhatsAppWithScheduler(userId);
      
      return { 
        success: true, 
        status: clientConnectionState.get(userId) || 'INITIALIZING'
      };
    } catch (error) {
      console.error('Error initializing WhatsApp:', error);
      return {
        success: false,
        error: error.message
      };
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

  // Send a text message
  ipcMain.handle('send-whatsapp-message', async (event, { userId, phoneNumber, message }) => {
    return await sendMessage(userId, phoneNumber, message);
  });
  
  // Send a message with media
  ipcMain.handle('send-whatsapp-message-with-media', async (event, { userId, phoneNumber, message, media }) => {
    return await sendMessageWithMedia(userId, phoneNumber, message, media);
  });
  
  // Get message status
  ipcMain.handle('get-whatsapp-message-status', async (event, { userId, messageId }) => {
    return await getMessageStatus(userId, messageId);
  });

  // Track sales message status (direct method for executeJavaScript calls)
  ipcMain.handle('trackSalesMessageStatus', async (event, userId, whatsappMessageId, salesMessageId) => {
    return trackSalesMessageStatus(userId, whatsappMessageId, salesMessageId);
  });
}

module.exports = {
  initWhatsAppHandlers,
  initWhatsAppClient,
  logoutWhatsApp,
  sessionExists,
  initWhatsAppForExistingSessions,
  initWhatsAppWithScheduler,
  sendMessage,
  sendMessageWithMedia,
  getMessageStatus,
  startMessageScheduler,
  stopMessageScheduler,
  findExistingSessionUserIds
}; 