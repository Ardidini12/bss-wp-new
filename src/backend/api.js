const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const csv = require('csv-parser');
const { stringify } = require('csv-stringify/sync');
const XLSX = require('xlsx');
const { 
  registerUser, 
  loginUser, 
  getUserSettings, 
  updateUserSettings,
  verifyToken,
  getContacts,
  addContact,
  updateContact,
  deleteContacts,
  importContacts,
  exportContacts,
  getAllContactIds,
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplates,
  getAllTemplateIds,
  getSenderSettings,
  updateSenderSettings,
  scheduleMessages,
  getScheduledMessages,
  updateMessageStatus,
  cancelScheduledMessage,
  deleteScheduledMessages,
  getAllScheduledMessages,
  getAllUserIds
} = require('./db');
const { getAppTheme, setAppTheme, getAnimationPrefs, setAnimationPrefs } = require('./store');
const { app } = require('electron');

// Find the desktop path for any PC
const desktopPath = path.join(os.homedir(), 'Desktop');
const dbFolderPath = path.join(desktopPath, 'bss-wp-db');
const exportsFolderPath = path.join(dbFolderPath, 'exports');

// Create exports folder if it doesn't exist
if (!fs.existsSync(exportsFolderPath)) {
  fs.mkdirSync(exportsFolderPath, { recursive: true });
}

// Initialize API
function initApi() {
  // Handle user registration
  ipcMain.handle('register-user', async (event, { username, password }) => {
    try {
      const result = await registerUser(username, password);
      return { success: true, user: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handle user login
  ipcMain.handle('login-user', async (event, { username, password }) => {
    try {
      const result = await loginUser(username, password);
      return { 
        success: true, 
        token: result.token, 
        user: result.user 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Verify token and get user
  ipcMain.handle('verify-token', async (event, { token }) => {
    try {
      const user = await verifyToken(token);
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get user settings
  ipcMain.handle('get-user-settings', async (event, { userId }) => {
    try {
      const settings = await getUserSettings(userId);
      return { success: true, settings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Update user settings
  ipcMain.handle('update-user-settings', async (event, { userId, settings }) => {
    try {
      await updateUserSettings(userId, settings);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // Get theme from settings
  ipcMain.handle('get-theme', async (event) => {
    try {
      const theme = getAppTheme();
      return { success: true, theme };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // Get animation preferences
  ipcMain.handle('get-animation-prefs', async (event) => {
    try {
      const prefs = getAnimationPrefs();
      return { success: true, prefs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // CONTACTS API

  // Get all contacts (with pagination and search)
  ipcMain.handle('get-contacts', async (event, { page, limit, search, source }) => {
    try {
      const result = await getContacts(page, limit, search, source);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get all contact IDs (for bulk operations like select all)
  ipcMain.handle('get-all-contact-ids', async (event, { search, source }) => {
    try {
      const contactIds = await getAllContactIds(search, source);
      return { success: true, contactIds };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Add a new contact
  ipcMain.handle('add-contact', async (event, contactData) => {
    try {
      const contact = await addContact(contactData);
      return { success: true, contact };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Update an existing contact
  ipcMain.handle('update-contact', async (event, { contactId, contactData }) => {
    try {
      const contact = await updateContact(contactId, contactData);
      return { success: true, contact };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Delete contact(s)
  ipcMain.handle('delete-contacts', async (event, { contactIds }) => {
    try {
      const result = await deleteContacts(contactIds);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Import contacts from file
  ipcMain.handle('import-contacts-file', async (event, data) => {
    try {
      console.log('Import contacts file request received with data type:', typeof data);
      
      // Extract file path - handle all possible formats
      let filePathStr = '';
      
      if (typeof data === 'string') {
        // Direct string path
        filePathStr = data;
        console.log('Direct string path received:', filePathStr);
      } else if (typeof data === 'object' && data !== null) {
        // Object format
        if (data.filePath) {
          if (typeof data.filePath === 'string') {
            filePathStr = data.filePath;
          } else if (typeof data.filePath === 'object' && data.filePath !== null) {
            // Try all possible properties
            filePathStr = data.filePath.path || data.filePath.toString() || '';
          }
        }
        console.log('Object path extracted:', filePathStr);
      }
      
      if (!filePathStr || typeof filePathStr !== 'string' || filePathStr.trim() === '') {
        throw new Error('Invalid or empty file path provided');
      }
      
      // Check if file exists
      if (!fs.existsSync(filePathStr)) {
        console.error(`File not found at path: ${filePathStr}`);
        throw new Error(`File not found at path: ${filePathStr}`);
      }
      
      console.log(`File exists, importing from: ${filePathStr}`);
      
      // Check file permissions
      try {
        fs.accessSync(filePathStr, fs.constants.R_OK);
      } catch (err) {
        console.error(`Cannot access file (permission denied): ${filePathStr}`);
        throw new Error(`Cannot access file (permission denied): ${filePathStr}`);
      }
      
      // Determine file type
      const fileExt = path.extname(filePathStr).toLowerCase();
      let contacts = [];
      
      // Create a new temporary folder for processing files
      const tempDir = path.join(app.getPath('temp'), 'bss-wp-temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Create a temporary copy of the file to avoid lock issues
      const tempFile = path.join(tempDir, `temp-import-${Date.now()}${fileExt}`);
      try {
        console.log(`Copying file to temporary location: ${tempFile}`);
        fs.copyFileSync(filePathStr, tempFile);
        console.log(`Created temporary copy at: ${tempFile}`);
      } catch (copyError) {
        console.error('Error copying file:', copyError);
        
        // Try an alternative method using streams
        try {
          console.log('Trying alternative copy method...');
          await new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(filePathStr);
            const writeStream = fs.createWriteStream(tempFile);
            
            readStream.on('error', (err) => {
              console.error('Read stream error:', err);
              reject(new Error(`Cannot read file: ${err.message}`));
            });
            
            writeStream.on('error', (err) => {
              console.error('Write stream error:', err);
              reject(new Error(`Cannot write temporary file: ${err.message}`));
            });
            
            writeStream.on('finish', () => {
              console.log('File copy completed via streams');
              resolve();
            });
            
            readStream.pipe(writeStream);
          });
        } catch (streamCopyError) {
          console.error('Stream copy error:', streamCopyError);
          throw new Error(`Cannot access file: ${filePathStr}. The file might be in use by another program. Please close any programs that might be using this file and try again.`);
        }
      }

      if (fileExt === '.csv') {
        console.log('Processing CSV file');
        
        // Read CSV file using streams to avoid memory issues
        contacts = await new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(tempFile)
            .on('error', (error) => {
              console.error('CSV read stream error:', error);
              reject(new Error(`Error reading CSV file: ${error.message}`));
            })
            .pipe(csv())
            .on('data', (data) => {
              // Basic field normalization
              const normalizedData = {};
              Object.keys(data).forEach(key => {
                // Convert all keys to lowercase for consistency
                const lowerKey = key.toLowerCase();
                let value = data[key];
                
                // Trim string values
                if (typeof value === 'string') {
                  value = value.trim();
                }
                
                normalizedData[lowerKey] = value;
              });
              
              results.push(normalizedData);
            })
            .on('end', () => {
              console.log(`Successfully read ${results.length} rows from CSV file`);
              resolve(results);
            })
            .on('error', (error) => {
              console.error('CSV parsing error:', error);
              reject(new Error(`Error parsing CSV: ${error.message}`));
            });
        });
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        console.log('Processing Excel file');
        
        try {
          // Use buffer approach which is more reliable in Electron
          const fileBuffer = fs.readFileSync(tempFile);
          const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Excel file contains no sheets');
          }
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          if (!worksheet) {
            throw new Error('Excel sheet is empty or invalid');
          }
          
          // Convert to JSON with header mapping
          const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
          
          if (!rawData || rawData.length === 0) {
            throw new Error('No data found in Excel file');
          }
          
          // Normalize field names
          contacts = rawData.map(row => {
            const normalizedRow = {};
            Object.keys(row).forEach(key => {
              // Convert all keys to lowercase for consistency
              const lowerKey = key.toLowerCase();
              let value = row[key];
              
              // Trim string values
              if (typeof value === 'string') {
                value = value.trim();
              }
              
              normalizedRow[lowerKey] = value;
            });
            return normalizedRow;
          });
          
          console.log(`Successfully read ${contacts.length} rows from Excel file`);
        } catch (excelError) {
          console.error('Excel reading error:', excelError);
          throw new Error(`Failed to read Excel file: ${excelError.message}`);
        }
      } else if (fileExt === '.json') {
        console.log('Processing JSON file');
        
        try {
          // Read file as buffer then convert to string
          const fileBuffer = fs.readFileSync(tempFile);
          const fileContent = fileBuffer.toString('utf8');
          
          // Parse JSON data
          let jsonData;
          try {
            jsonData = JSON.parse(fileContent);
          } catch (jsonError) {
            throw new Error(`Invalid JSON format: ${jsonError.message}`);
          }
          
          // Handle different JSON structures
          if (Array.isArray(jsonData)) {
            contacts = jsonData;
          } else if (jsonData.contacts && Array.isArray(jsonData.contacts)) {
            contacts = jsonData.contacts;
          } else {
            throw new Error('Invalid JSON format. Expected an array of contacts or an object with a contacts array.');
          }
          
          // Normalize field names
          contacts = contacts.map(contact => {
            const normalizedContact = {};
            Object.keys(contact).forEach(key => {
              // Convert all keys to lowercase for consistency
              const lowerKey = key.toLowerCase();
              let value = contact[key];
              
              // Trim string values
              if (typeof value === 'string') {
                value = value.trim();
              }
              
              normalizedContact[lowerKey] = value;
            });
            return normalizedContact;
          });
          
          console.log(`Successfully read ${contacts.length} contacts from JSON file`);
        } catch (jsonError) {
          console.error('JSON reading error:', jsonError);
          throw new Error(`Failed to read JSON file: ${jsonError.message}`);
        }
      } else {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (err) {
          console.error('Error deleting temp file:', err);
        }
        
        throw new Error(`Unsupported file format: ${fileExt}. Please use CSV, Excel, or JSON.`);
      }
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (err) {
        console.error('Error deleting temp file:', err);
      }
      
      // Map common field names for consistency
      const mappedContacts = contacts.map(contact => {
        const mappedContact = {};
        
        // Map name fields
        if (contact.name || contact.firstname || contact.first_name || contact.first) {
          mappedContact.name = contact.name || contact.firstname || contact.first_name || contact.first || '';
        }
        
        // Map surname fields
        if (contact.surname || contact.lastname || contact.last_name || contact.last) {
          mappedContact.surname = contact.surname || contact.lastname || contact.last_name || contact.last || '';
        }
        
        // Map phone fields - required field
        mappedContact.phone = contact.phone || contact.phonenumber || contact.phone_number || 
                              contact.mobile || contact.cell || contact.telephone || '';
        
        // Map email fields
        mappedContact.email = contact.email || contact.emailaddress || contact.email_address || '';
        
        // Map birthday fields
        mappedContact.birthday = contact.birthday || contact.birthdate || contact.birth_date || contact.dob || '';
        
        return mappedContact;
      });
      
      console.log(`Successfully mapped ${mappedContacts.length} contacts`);
      
      // Return contacts for preview
      return { 
        success: true, 
        contacts: mappedContacts,
        fileName: path.basename(filePathStr)
      };
    } catch (error) {
      console.error('Error importing contacts file:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred during import'
      };
    }
  });

  // Import contacts after preview
  ipcMain.handle('import-contacts', async (event, { contacts, skipDuplicates }) => {
    try {
      const result = await importContacts(contacts, skipDuplicates);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Export contacts
  ipcMain.handle('export-contacts', async (event, { format }) => {
    try {
      const result = await exportContacts(format);
      const { data, format: exportFormat } = result;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `contacts_export_${timestamp}`;
      let filePath;
      
      if (exportFormat === 'csv') {
        filePath = path.join(exportsFolderPath, `${fileName}.csv`);
        const csvData = stringify(data, { header: true });
        fs.writeFileSync(filePath, csvData);
      } else if (exportFormat === 'excel') {
        filePath = path.join(exportsFolderPath, `${fileName}.xlsx`);
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
        XLSX.writeFile(workbook, filePath);
      } else {
        // JSON format
        filePath = path.join(exportsFolderPath, `${fileName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
      
      return { 
        success: true, 
        filePath,
        fileName: path.basename(filePath)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Template operations
  ipcMain.handle('get-templates', async (event, page = 1, limit = 100, search = "") => {
    try {
      const result = await getTemplates(page, limit, search);
      return { success: true, ...result };
    } catch (err) {
      console.error('Error getting templates:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('add-template', async (event, templateData) => {
    try {
      const newTemplate = await addTemplate(templateData);
      return { success: true, template: newTemplate };
    } catch (err) {
      console.error('Error adding template:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update-template', async (event, templateId, templateData) => {
    try {
      const updatedTemplate = await updateTemplate(templateId, templateData);
      return { success: true, template: updatedTemplate };
    } catch (err) {
      console.error('Error updating template:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('delete-templates', async (event, templateIds) => {
    try {
      const result = await deleteTemplates(templateIds);
      return { success: true, ...result };
    } catch (err) {
      console.error('Error deleting templates:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-all-template-ids', async (event, search = "") => {
    try {
      const templateIds = await getAllTemplateIds(search);
      return { success: true, templateIds };
    } catch (err) {
      console.error('Error getting all template IDs:', err);
      return { success: false, error: err.message };
    }
  });

  // Sender settings operations
  ipcMain.handle('get-sender-settings', async (event, userId) => {
    try {
      const response = await getSenderSettings(userId);
      return {
        success: true,
        settings: response
      };
    } catch (error) {
      console.error('Error getting sender settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('update-sender-settings', async (event, userId, settings) => {
    try {
      const response = await updateSenderSettings(userId, settings);
      return {
        success: true,
        settings: response
      };
    } catch (error) {
      console.error('Error updating sender settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Scheduled messages operations
  ipcMain.handle('schedule-messages', async (event, userId, contactIds, templateId, scheduledTime) => {
    try {
      const response = await scheduleMessages(userId, contactIds, templateId, scheduledTime);
      return {
        success: true,
        count: response.count,
        messages: response.messages
      };
    } catch (error) {
      console.error('Error scheduling messages:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('get-scheduled-messages', async (event, userId, page, limit, status) => {
    try {
      const response = await getScheduledMessages(userId, page, limit, status);
      return {
        success: true,
        messages: response.messages,
        pagination: response.pagination
      };
    } catch (error) {
      console.error('Error getting scheduled messages:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Update message status
  ipcMain.handle('update-message-status', async (event, messageId, status, whatsappMessageId) => {
    try {
      const response = await updateMessageStatus(messageId, status, whatsappMessageId);
      return {
        success: true,
        message: response
      };
    } catch (error) {
      console.error('Error updating message status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('cancel-scheduled-message', async (event, messageId) => {
    try {
      const response = await cancelScheduledMessage(messageId);
      return response;
    } catch (error) {
      console.error('Error canceling scheduled message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('delete-scheduled-messages', async (event, messageIds) => {
    try {
      const response = await deleteScheduledMessages(messageIds);
      return response;
    } catch (error) {
      console.error('Error deleting scheduled messages:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('get-message-statistics', async (event, userId, startDate, endDate) => {
    try {
      // Convert date strings to Date objects
      const start = startDate ? new Date(startDate) : new Date(0); // Default to Unix epoch
      const end = endDate ? new Date(endDate) : new Date(); // Default to current time
      
      // Get all messages for this user
      const allMessages = await getAllScheduledMessages();
      
      // Filter messages by user and date range
      const userMessages = allMessages.filter(message => {
        const messageDate = new Date(message.scheduled_time);
        return message.user_id === userId && 
               messageDate >= start && 
               messageDate <= end;
      });
      
      // Count messages by status
      const statusCounts = {
        SCHEDULED: 0,
        SENDING: 0,
        SENT: 0,
        DELIVERED: 0,
        READ: 0,
        FAILED: 0,
        CANCELED: 0
      };
      
      userMessages.forEach(message => {
        if (statusCounts.hasOwnProperty(message.status)) {
          statusCounts[message.status]++;
        }
      });
      
      // Calculate percentages
      const total = userMessages.length;
      const statusPercentages = {};
      
      if (total > 0) {
        for (const [status, count] of Object.entries(statusCounts)) {
          statusPercentages[status] = Math.round((count / total) * 100);
        }
      }
      
      // Group messages by day for daily statistics
      const dailyStats = {};
      userMessages.forEach(message => {
        const day = new Date(message.scheduled_time).toISOString().split('T')[0];
        
        if (!dailyStats[day]) {
          dailyStats[day] = {
            SCHEDULED: 0,
            SENDING: 0,
            SENT: 0,
            DELIVERED: 0,
            READ: 0,
            FAILED: 0,
            CANCELED: 0,
            total: 0
          };
        }
        
        dailyStats[day][message.status]++;
        dailyStats[day].total++;
      });
      
      return {
        success: true,
        total,
        statusCounts,
        statusPercentages,
        dailyStats
      };
    } catch (error) {
      console.error('Error getting message statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Get sales scheduled messages
  ipcMain.handle('getSalesScheduledMessages', async (event, page, limit, filters, options) => {
    try {
      const db = require('./db');
      const result = await db.getSalesScheduledMessages(page, limit, filters, options);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error getting sales scheduled messages:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}

// Sales API Service
function setupSalesAPI(ipcMain) {
  const axios = require('axios');
  let salesFetchInterval = null;
  let lastFetchTime = null;
  
  // Function to get authentication token
  const getAuthToken = async () => {
    try {
      const response = await axios.post('https://crm-api.bss.com.al/authentication/login', {
        password: "T3aWy<[3dq07",
        userName: "Admin"
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Extract token from response
      if (response.data && response.data.accessToken) {
        return response.data.accessToken;
      } else {
        console.error('Token not found in authentication response:', response.data);
        throw new Error('Authentication token not found in response');
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
      throw new Error('Failed to authenticate with sales API');
    }
  };
  
  // Function to fetch sales data for a specific town
  const fetchSalesForTown = async (token, town) => {
    try {
      // Get current date in MM/DD/YYYY format
      const today = new Date();
      const dateString = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`;
      
      const response = await axios.get(`https://crm-api.bss.com.al/11120/Sales?Date=${dateString}&PageNumber=&PageSize=&HasPhone=true&CustomerGroup=PAKICE&Town=${town}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching sales for town ${town}:`, error);
      return [];
    }
  };
  
  // Function to fetch sales for all towns
  const fetchAllSales = async () => {
    try {
      // Get auth token
      const token = await getAuthToken();
      
      // Fetch sales for each town
      const towns = ['tirane', 'fier', 'vlore'];
      const allSalesPromises = towns.map(town => fetchSalesForTown(token, town));
      const salesResults = await Promise.all(allSalesPromises);
      
      // Combine all sales
      let allSales = [];
      salesResults.forEach(result => {
        if (Array.isArray(result)) {
          allSales = [...allSales, ...result];
        }
      });
      
      // Save new sales to database
      const db = require('./db');
      const saveResult = await db.saveSales(allSales);
      
      // Update last fetch time
      lastFetchTime = saveResult.lastFetchTime;
      
      // Check if autoscheduler is enabled and schedule messages for new sales
      await scheduleMessagesForNewSales(saveResult.newSales);
      
      return saveResult;
    } catch (error) {
      console.error('Error fetching all sales:', error);
      return {
        error: error.message,
        newSalesCount: 0,
        newSales: []
      };
    }
  };
  
  // Function to schedule messages for new sales
  const scheduleMessagesForNewSales = async (newSales) => {
    try {
      if (!newSales || newSales.length === 0) {
        return;
      }
      
      const db = require('./db');
      
      // Get current user ID (using the first one found for now)
      // In a real app, you'd get the active user ID from the session
      const activeUserId = 1; // Default to first user for testing
      
      // Schedule messages for each new sale
      for (const sale of newSales) {
        try {
          await db.scheduleSalesMessages(sale.id, activeUserId);
        } catch (error) {
          console.error(`Error scheduling messages for sale ${sale.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error scheduling messages for new sales:', error);
    }
  };
  
  // Start message processor interval
  let messageProcessorInterval = null;

  // Function to start message processor
  const startMessageProcessor = () => {
    // Clear existing interval if any
    if (messageProcessorInterval) {
      clearInterval(messageProcessorInterval);
    }
    
    // Check for due messages every 100ms
    // This ensures extremely precise timing for sending messages exactly when scheduled
    messageProcessorInterval = setInterval(processDueSalesMessages, 100);
    
    // Also run immediately
    processDueSalesMessages();
    
    console.log('Sales message processor started with 100ms interval for millisecond-precision timing');
    
    return true;
  };

  // Function to stop the message processor
  const stopMessageProcessor = () => {
    if (messageProcessorInterval) {
      console.log('Stopping sales message processor');
      clearInterval(messageProcessorInterval);
      messageProcessorInterval = null;
      return true;
    }
    return false;
  };

  // Process due sales messages
  const processDueSalesMessages = async (userId = null) => {
    try {
      const db = require('./db');
      
      // Get all users if none specified
      const usersToProcess = userId ? [userId] : await db.getAllUserIds();
      
      for (const activeUserId of usersToProcess) {
        // Get due messages for this user
        const dueMessages = await db.getDueSalesMessages(activeUserId);
        
        if (dueMessages.length === 0) {
          continue; // No messages to send for this user
        }
        
        console.log(`Processing ${dueMessages.length} due sales messages for user ${activeUserId}`);
        
        // Check if WhatsApp is connected
        let whatsappStatus;
        try {
          whatsappStatus = await global.mainWindow.webContents.executeJavaScript(`
            window.electronAPI.getWhatsAppStatus(${activeUserId})
          `);
        } catch (error) {
          console.error('Error checking WhatsApp status:', error);
          continue; // Skip this user if we can't check WhatsApp status
        }
        
        if (!whatsappStatus || !whatsappStatus.connected) {
          console.log(`WhatsApp client for user ${activeUserId} is not connected, skipping message processing`);
          continue; // Skip this user if WhatsApp is not connected
        }
        
        // Process each due message, respecting exact timing
        for (const message of dueMessages) {
          try {
            // Calculate how many seconds past the scheduled time
            const scheduledTime = new Date(message.scheduledTime);
            const now = new Date();
            const secondsPastScheduled = Math.floor((now - scheduledTime) / 1000);
            
            console.log(`Processing sales message ${message.id} (Type: ${message.messageNumber}, Status: ${message.status}, Scheduled: ${scheduledTime.toLocaleString()}, Current: ${now.toLocaleString()}, Seconds past scheduled: ${secondsPastScheduled})`);
            
            // Skip future messages - should never happen with our new exact timing filter,
            // but keeping as a safeguard
            if (secondsPastScheduled < 0) {
              console.log(`Message ${message.id} is scheduled for the future (${Math.abs(secondsPastScheduled)} seconds from now), skipping for now`);
              continue;
            }
            
            // Ensure we're processing the message at exactly the right time
            // This adds extra protection to make sure messages respect their timing
            if (message.messageNumber === 1 && secondsPastScheduled > 1) {
              console.log(`Warning: Message ${message.id} (Msg1) is being processed ${secondsPastScheduled} seconds after scheduled time`);
            }
            
            // Update status to SENDING
            await db.updateSalesMessageStatus(message.id, 'SENDING');
            
            // Send message with detailed error tracking
            try {
              console.log(`Attempting to send message ${message.id} to ${message.phoneNumber}`);
              
              const sendResult = await global.mainWindow.webContents.executeJavaScript(`
                window.electronAPI.sendWhatsAppMessage(
                  ${activeUserId},
                  "${message.phoneNumber}",
                  "${message.messageContent.replace(/"/g, '\\"')}"
                )
              `);
              
              if (sendResult && sendResult.success) {
                console.log(`Message ${message.id} sent successfully with WhatsApp ID: ${sendResult.messageId}`);
                
                // Update status to SENT with the WhatsApp message ID for tracking
                await db.updateSalesMessageStatus(message.id, 'SENT', sendResult.messageId);
                
                // Set up message status tracking for real-time delivery/read updates
                await global.mainWindow.webContents.executeJavaScript(`
                  window.electronAPI.trackSalesMessageStatus(
                    ${activeUserId},
                    "${sendResult.messageId}",
                    ${message.id}
                  )
                `);
                
                console.log(`Tracking set up for message ${message.id} with WhatsApp ID ${sendResult.messageId}`);
              } else {
                // Handle failed sending with detailed reason
                const errorReason = sendResult?.error || 'Unknown error during message sending';
                console.error(`Failed to send message ${message.id}: ${errorReason}`);
                
                // Update status to FAILED with the error reason
                await db.updateSalesMessageStatus(message.id, 'FAILED');
              }
            } catch (sendError) {
              console.error(`Exception during message sending for message ${message.id}:`, sendError);
              await db.updateSalesMessageStatus(message.id, 'FAILED');
            }
          } catch (error) {
            console.error(`Error processing sales message ${message.id}:`, error);
            
            // Update status to FAILED
            await db.updateSalesMessageStatus(message.id, 'FAILED');
          }
        }
      }
    } catch (error) {
      console.error('Error processing due sales messages:', error);
    }
  };
  
  // Function to start periodic sales fetching
  const startSalesFetching = () => {
    // Clear existing interval if any
    if (salesFetchInterval) {
      clearInterval(salesFetchInterval);
    }
    
    // Fetch immediately on start
    fetchAllSales();
    
    // Set up interval to fetch every 2 minutes
    salesFetchInterval = setInterval(fetchAllSales, 2 * 60 * 1000);
    
    return true;
  };
  
  // Function to stop periodic sales fetching
  const stopSalesFetching = () => {
    if (salesFetchInterval) {
      clearInterval(salesFetchInterval);
      salesFetchInterval = null;
      return true;
    }
    return false;
  };
  
  // Initialize last fetch time from database
  const initSalesAPI = async () => {
    const db = require('./db');
    const result = await db.getLastFetchTime();
    lastFetchTime = result.lastFetchTime;
    
    // Start fetching sales
    startSalesFetching();
    
    // Start message processor
    startMessageProcessor();
    
    // Check for any expired messages on startup
    try {
      console.log('Checking for expired messages on startup...');
      const allUserIds = await db.getAllUserIds();
      
      // Process each user to check for expired messages
      for (const userId of allUserIds) {
        // This will automatically mark expired messages as canceled
        const expiredMessages = await db.getDueSalesMessages(userId);
        
        if (expiredMessages.length > 0) {
          console.log(`Found ${expiredMessages.length} messages ready to be sent for user ${userId}`);
          
          // Process these messages immediately
          await processDueSalesMessages(userId);
        }
      }
      
      console.log('Expired message check completed');
    } catch (error) {
      console.error('Error checking for expired messages on startup:', error);
    }
    
    // Start historical data recovery process for past 30 days
    try {
      console.log('Starting historical sales data recovery...');
      
      // Run in background to not block app startup
      setTimeout(async () => {
        try {
          const result = await fetchHistoricalSales();
          console.log('Historical data recovery completed in background:', result);
        } catch (error) {
          console.error('Error in background historical data recovery:', error);
        }
      }, 5000); // Start after 5 seconds to allow app to initialize
      
    } catch (error) {
      console.error('Error starting historical data recovery:', error);
    }
  };
  
  // IPC handlers for sales API
  
  // Get sales with filtering and pagination
  ipcMain.handle('getSales', async (event, page, limit, filters) => {
    try {
      const db = require('./db');
      const result = await db.getSales(page, limit, filters);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error getting sales:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Update a sale
  ipcMain.handle('updateSale', async (event, saleId, saleData) => {
    try {
      const db = require('./db');
      const result = await db.updateSale(saleId, saleData);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error updating sale:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Delete sales
  ipcMain.handle('deleteSales', async (event, saleIds) => {
    try {
      const db = require('./db');
      const result = await db.deleteSales(saleIds);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error deleting sales:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Get last fetch time
  ipcMain.handle('getLastFetchTime', async () => {
    return {
      success: true,
      lastFetchTime
    };
  });
  
  // Force fetch sales now
  ipcMain.handle('fetchSalesNow', async () => {
    try {
      const result = await fetchAllSales();
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error fetching sales now:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Get all towns from sales data
  ipcMain.handle('getSalesTowns', async () => {
    try {
      const db = require('./db');
      const result = await db.getSalesTowns();
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error getting sales towns:', error);
      return {
        success: false,
        error: error.message,
        towns: []
      };
    }
  });
  
  // Get sales settings
  ipcMain.handle('getSalesSettings', async () => {
    try {
      const db = require('./db');
      const settings = await db.getSalesSettings();
      return {
        success: true,
        settings
      };
    } catch (error) {
      console.error('Error getting sales settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Update sales settings
  ipcMain.handle('updateSalesSettings', async (event, settings) => {
    try {
      const db = require('./db');
      await db.updateSalesSettings(settings);
      return {
        success: true
      };
    } catch (error) {
      console.error('Error updating sales settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Cancel sales scheduled message
  ipcMain.handle('cancelSalesScheduledMessage', async (event, messageId) => {
    try {
      const db = require('./db');
      const result = await db.cancelSalesScheduledMessage(messageId);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error canceling sales scheduled message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Delete sales scheduled messages
  ipcMain.handle('deleteSalesScheduledMessages', async (event, messageIds) => {
    try {
      const db = require('./db');
      const result = await db.deleteSalesScheduledMessages(messageIds);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error deleting sales scheduled messages:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Get sales message statistics
  ipcMain.handle('getSalesMessageStatistics', async (event, startDate, endDate) => {
    try {
      const db = require('./db');
      const result = await db.getSalesMessageStatistics(startDate, endDate);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error getting sales message statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Manually fetch historical sales data
  ipcMain.handle('fetchHistoricalSales', async () => {
    try {
      const result = await fetchHistoricalSales();
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error('Error fetching historical sales:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Function to fetch sales data for a specific town and date
  const fetchSalesForTownAndDate = async (token, town, date) => {
    try {
      // Format date as MM/DD/YYYY for API
      const dateString = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
      
      console.log(`Fetching sales for ${town} on ${dateString}`);
      
      const response = await axios.get(`https://crm-api.bss.com.al/11120/Sales?Date=${dateString}&PageNumber=&PageSize=&HasPhone=true&CustomerGroup=PAKICE&Town=${town}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching sales for town ${town} on date ${date}:`, error);
      return [];
    }
  };

  // Function to fetch historical sales data for the past 30 days
  const fetchHistoricalSales = async () => {
    console.log('Starting historical sales recovery for past 30 days...');
    try {
      // Get auth token
      const token = await getAuthToken();
      
      // Get current date
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of day
      
      // Towns to fetch for
      const towns = ['tirane', 'fier', 'vlore'];
      
      // Fetch sales for each day in the past 30 days
      let allHistoricalSales = [];
      let processedDays = 0;
      let totalSalesFetched = 0;
      
      // Loop through each day
      for (let i = 1; i <= 30; i++) {
        // Calculate the date (i days ago)
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - i);
        
        // Fetch for each town on this date
        for (const town of towns) {
          const salesForTown = await fetchSalesForTownAndDate(token, town, targetDate);
          
          if (Array.isArray(salesForTown) && salesForTown.length > 0) {
            console.log(`Found ${salesForTown.length} sales for ${town} on ${targetDate.toLocaleDateString()}`);
            allHistoricalSales = [...allHistoricalSales, ...salesForTown];
            totalSalesFetched += salesForTown.length;
          }
        }
        
        processedDays++;
        
        // Log progress every 5 days
        if (processedDays % 5 === 0) {
          console.log(`Historical data recovery progress: ${processedDays}/30 days processed, ${totalSalesFetched} sales found so far`);
        }
      }
      
      // Save all fetched sales to database (this will automatically handle duplicates)
      const db = require('./db');
      const saveResult = await db.saveSales(allHistoricalSales);
      
      console.log(`Historical data recovery complete: ${saveResult.newSalesCount} new sales added to database out of ${totalSalesFetched} total fetched`);
      
      // Important: Only schedule messages for today's sales
      // We extract just today's sales from the newly saved ones
      const todayDateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const todayNewSales = saveResult.newSales.filter(sale => {
        // Check if documentDate matches today's date
        const saleDate = new Date(sale.documentDate).toISOString().split('T')[0];
        return saleDate === todayDateStr;
      });
      
      // Only schedule WhatsApp messages for today's sales
      if (todayNewSales.length > 0) {
        console.log(`Scheduling WhatsApp messages only for ${todayNewSales.length} sales from today`);
        await scheduleMessagesForNewSales(todayNewSales);
      }
      
      return {
        daysProcessed: processedDays,
        totalSalesFetched,
        newSalesCount: saveResult.newSalesCount
      };
    } catch (error) {
      console.error('Error fetching historical sales:', error);
      return {
        error: error.message,
        daysProcessed: 0,
        totalSalesFetched: 0,
        newSalesCount: 0
      };
    }
  };
  
  // Initialize the sales API
  initSalesAPI();
}

module.exports = { initApi, setupSalesAPI }; 