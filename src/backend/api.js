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
  getAllContactIds
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
  ipcMain.handle('get-contacts', async (event, { page, limit, search }) => {
    try {
      const result = await getContacts(page, limit, search);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get all contact IDs (for bulk operations like select all)
  ipcMain.handle('get-all-contact-ids', async (event, { search }) => {
    try {
      const contactIds = await getAllContactIds(search);
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
}

module.exports = { initApi }; 