const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const os = require('os');

// Find the desktop path for any PC
const desktopPath = path.join(os.homedir(), 'Desktop');
const dbFolderPath = path.join(desktopPath, 'bss-wp-db');
const usersFilePath = path.join(dbFolderPath, 'users.json');
const settingsFilePath = path.join(dbFolderPath, 'settings.json');
const contactsFilePath = path.join(dbFolderPath, 'contacts.json');

// Create database folder if it doesn't exist
if (!fs.existsSync(dbFolderPath)) {
  fs.mkdirSync(dbFolderPath, { recursive: true });
}

// Initialize database files if they don't exist
if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, JSON.stringify({
    users: [],
    nextId: 1
  }));
}

if (!fs.existsSync(settingsFilePath)) {
  fs.writeFileSync(settingsFilePath, JSON.stringify({
    settings: []
  }));
}

if (!fs.existsSync(contactsFilePath)) {
  fs.writeFileSync(contactsFilePath, JSON.stringify({
    contacts: [],
    nextId: 1
  }));
}

console.log('Connected to the JSON database.');

// Helper functions to read and write data
function readUsers() {
  try {
    const data = fs.readFileSync(usersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading users file:', err);
    return { users: [], nextId: 1 };
  }
}

function writeUsers(data) {
  fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2));
}

function readSettings() {
  try {
    const data = fs.readFileSync(settingsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading settings file:', err);
    return { settings: [] };
  }
}

function writeSettings(data) {
  fs.writeFileSync(settingsFilePath, JSON.stringify(data, null, 2));
}

function readContacts() {
  try {
    const data = fs.readFileSync(contactsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading contacts file:', err);
    return { contacts: [], nextId: 1 };
  }
}

function writeContacts(data) {
  fs.writeFileSync(contactsFilePath, JSON.stringify(data, null, 2));
}

// User registration
function registerUser(username, password) {
  return new Promise((resolve, reject) => {
    try {
      const usersData = readUsers();
      
      // Check if username exists
      if (usersData.users.some(user => user.username === username)) {
        reject(new Error('Username already exists'));
        return;
      }
      
      // Hash the password
      const hash = bcrypt.hashSync(password, 10);
      
      // Create new user
      const newUser = {
        id: usersData.nextId,
        username,
        password: hash,
        created_at: new Date().toISOString()
      };
      
      // Add user to database
      usersData.users.push(newUser);
      usersData.nextId++;
      writeUsers(usersData);
      
      // Create default settings
      const settingsData = readSettings();
      const newSettings = {
        user_id: newUser.id,
        theme: 'system',
        remember_me: 0
      };
      
      settingsData.settings.push(newSettings);
      writeSettings(settingsData);
      
      resolve({ id: newUser.id, username });
    } catch (err) {
      reject(err);
    }
  });
}

// User login
function loginUser(username, password) {
  return new Promise((resolve, reject) => {
    try {
      const usersData = readUsers();
      
      // Find user by username
      const user = usersData.users.find(user => user.username === username);
      
      if (!user) {
        reject(new Error('User not found'));
        return;
      }
      
      // Compare password
      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) {
        reject(new Error('Invalid password'));
        return;
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        'bss-secret-key', // In a real app, use environment variable
        { expiresIn: '24h' }
      );
      
      resolve({ token, user: { id: user.id, username: user.username } });
    } catch (err) {
      reject(err);
    }
  });
}

// Get user settings
function getUserSettings(userId) {
  return new Promise((resolve, reject) => {
    try {
      const settingsData = readSettings();
      
      // Find settings by user ID
      const settings = settingsData.settings.find(s => s.user_id === userId);
      
      resolve(settings || { theme: 'system', remember_me: 0 });
    } catch (err) {
      reject(err);
    }
  });
}

// Update user settings
function updateUserSettings(userId, settings) {
  return new Promise((resolve, reject) => {
    try {
      const settingsData = readSettings();
      
      // Find index of settings
      const settingsIndex = settingsData.settings.findIndex(s => s.user_id === userId);
      
      if (settingsIndex >= 0) {
        // Update existing settings
        settingsData.settings[settingsIndex] = {
          user_id: userId,
          theme: settings.theme,
          remember_me: settings.remember_me ? 1 : 0
        };
      } else {
        // Create new settings
        settingsData.settings.push({
          user_id: userId,
          theme: settings.theme,
          remember_me: settings.remember_me ? 1 : 0
        });
      }
      
      writeSettings(settingsData);
      
      resolve({ changes: 1 });
    } catch (err) {
      reject(err);
    }
  });
}

// Verify JWT token
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, 'bss-secret-key', (err, decoded) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(decoded);
    });
  });
}

// Contact Management Functions

// Get all contacts (with pagination and search for optimal performance)
function getContacts(page = 1, limit = 100, search = "") {
  return new Promise((resolve, reject) => {
    try {
      const contactsData = readContacts();
      let filteredContacts = contactsData.contacts;
      
      // If search term is provided, filter contacts
      if (search) {
        const searchLower = search.toLowerCase();
        filteredContacts = filteredContacts.filter(contact => {
          return (
            (contact.name && contact.name.toLowerCase().includes(searchLower)) ||
            (contact.surname && contact.surname.toLowerCase().includes(searchLower)) ||
            (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
            (contact.phone && contact.phone.includes(searchLower)) ||
            (contact.birthday && contact.birthday.includes(searchLower)) ||
            (contact.source && contact.source.toLowerCase().includes(searchLower))
          );
        });
      }
      
      // Calculate pagination
      const totalContacts = filteredContacts.length;
      const totalPages = Math.ceil(totalContacts / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedContacts = filteredContacts.slice(startIndex, endIndex);
      
      resolve({
        contacts: paginatedContacts,
        pagination: {
          total: totalContacts,
          page,
          limit,
          totalPages
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Add a new contact
function addContact(contactData) {
  return new Promise((resolve, reject) => {
    try {
      const contactsData = readContacts();
      
      // Validate phone number (required field)
      if (!contactData.phone) {
        reject(new Error('Phone number is required'));
        return;
      }
      
      // Check for duplicate phone number
      if (contactsData.contacts.some(c => c.phone === contactData.phone)) {
        reject(new Error('Phone number already exists'));
        return;
      }
      
      // Create new contact
      const newContact = {
        id: contactsData.nextId,
        name: contactData.name || null,
        surname: contactData.surname || null,
        email: contactData.email || null,
        phone: contactData.phone,
        birthday: contactData.birthday || null,
        source: contactData.source || 'manually added',
        created_at: new Date().toISOString()
      };
      
      // Add contact to database
      contactsData.contacts.push(newContact);
      contactsData.nextId++;
      writeContacts(contactsData);
      
      resolve(newContact);
    } catch (err) {
      reject(err);
    }
  });
}

// Update an existing contact
function updateContact(contactId, contactData) {
  return new Promise((resolve, reject) => {
    try {
      const contactsData = readContacts();
      
      // Find index of contact
      const contactIndex = contactsData.contacts.findIndex(c => c.id === contactId);
      
      if (contactIndex === -1) {
        reject(new Error('Contact not found'));
        return;
      }
      
      // Validate phone number (required field)
      if (!contactData.phone) {
        reject(new Error('Phone number is required'));
        return;
      }
      
      // Check for duplicate phone number (excluding this contact)
      if (contactsData.contacts.some(c => c.phone === contactData.phone && c.id !== contactId)) {
        reject(new Error('Phone number already exists'));
        return;
      }
      
      // Update contact
      const updatedContact = {
        ...contactsData.contacts[contactIndex],
        name: contactData.name !== undefined ? contactData.name : contactsData.contacts[contactIndex].name,
        surname: contactData.surname !== undefined ? contactData.surname : contactsData.contacts[contactIndex].surname,
        email: contactData.email !== undefined ? contactData.email : contactsData.contacts[contactIndex].email,
        phone: contactData.phone,
        birthday: contactData.birthday !== undefined ? contactData.birthday : contactsData.contacts[contactIndex].birthday,
        // Don't update source as it's read-only
        updated_at: new Date().toISOString()
      };
      
      contactsData.contacts[contactIndex] = updatedContact;
      writeContacts(contactsData);
      
      resolve(updatedContact);
    } catch (err) {
      reject(err);
    }
  });
}

// Delete contact(s)
function deleteContacts(contactIds) {
  return new Promise((resolve, reject) => {
    try {
      const contactsData = readContacts();
      
      // Filter out contacts to be deleted
      contactsData.contacts = contactsData.contacts.filter(c => !contactIds.includes(c.id));
      writeContacts(contactsData);
      
      resolve({ deletedCount: contactIds.length });
    } catch (err) {
      reject(err);
    }
  });
}

// Batch import contacts
function importContacts(contacts, skipDuplicates = true) {
  return new Promise((resolve, reject) => {
    try {
      console.time('importContacts');
      const contactsData = readContacts();
      
      const results = {
        added: 0,
        skipped: 0,
        errors: [],
        performance: {
          startTime: Date.now(),
          endTime: null,
          duration: null,
          contactsPerSecond: null
        }
      };
      
      // Optimize for large imports:
      // 1. Create a Set of existing phone numbers for O(1) lookup
      // 2. Process contacts in chunks to avoid memory issues
      // 3. Minimize disk writes by writing only once at the end
      
      // Create a Map of existing phone numbers -> id for fast duplicate checking
      const existingPhoneMap = new Map();
      contactsData.contacts.forEach(c => {
        if (c.phone) {
          existingPhoneMap.set(c.phone, c.id);
        }
      });
      
      // Process contacts in chunks for better performance
      const chunkSize = 2000; // Increased chunk size for faster processing
      const newContacts = [];
      let nextId = contactsData.nextId;
      
      console.log(`Processing ${contacts.length} contacts in chunks of ${chunkSize}`);
      
      for (let i = 0; i < contacts.length; i += chunkSize) {
        const chunk = contacts.slice(i, i + chunkSize);
        console.log(`Processing chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(contacts.length/chunkSize)}`);
        
        chunk.forEach(contact => {
          // Skip if no phone number
          if (!contact.phone) {
            results.skipped++;
            results.errors.push({ contact, reason: 'Missing phone number' });
            return;
          }
          
          // Normalize phone number (remove non-digit characters if needed)
          const phoneNormalized = contact.phone.toString().trim();
          
          // Check for duplicates
          if (existingPhoneMap.has(phoneNormalized)) {
            if (skipDuplicates) {
              results.skipped++;
              // Only store the phone number in errors to save memory
              results.errors.push({ 
                contact: { phone: phoneNormalized },
                reason: 'Duplicate phone number'
              });
              return;
            }
          }
          
          // Create new contact
          const newContact = {
            id: nextId++,
            name: contact.name || null,
            surname: contact.surname || null,
            email: contact.email || null,
            phone: phoneNormalized,
            birthday: contact.birthday || null,
            source: contact.source || 'imported',
            created_at: new Date().toISOString()
          };
          
          // Add to new contacts array
          newContacts.push(newContact);
          // Update map to prevent duplicates within the import
          existingPhoneMap.set(phoneNormalized, newContact.id);
          results.added++;
        });
        
        // Force garbage collection between chunks if available
        if (global.gc) {
          global.gc();
        }
      }
      
      // Append all new contacts at once
      contactsData.contacts = contactsData.contacts.concat(newContacts);
      contactsData.nextId = nextId;
      
      // Write to file
      writeContacts(contactsData);
      
      // Calculate performance metrics
      results.performance.endTime = Date.now();
      results.performance.duration = results.performance.endTime - results.performance.startTime;
      results.performance.contactsPerSecond = Math.floor(results.added / (results.performance.duration / 1000));
      
      console.log(`Import complete: ${results.added} contacts added, ${results.skipped} skipped`);
      console.log(`Import performance: ${results.performance.duration}ms, ${results.performance.contactsPerSecond} contacts/second`);
      console.timeEnd('importContacts');
      
      resolve(results);
    } catch (err) {
      console.error('Error importing contacts:', err);
      reject(err);
    }
  });
}

// Export contacts
function exportContacts(format = 'json') {
  return new Promise((resolve, reject) => {
    try {
      const contactsData = readContacts();
      const contacts = contactsData.contacts;
      
      if (format === 'json') {
        resolve({ data: contacts, format: 'json' });
      } else {
        // For CSV/Excel formats, we'll handle this in the API
        resolve({ data: contacts, format: format });
      }
    } catch (err) {
      reject(err);
    }
  });
}

// Get all contact IDs (for bulk operations)
function getAllContactIds(search = "") {
  return new Promise((resolve, reject) => {
    try {
      const contactsData = readContacts();
      let filteredContacts = contactsData.contacts;
      
      // If search term is provided, filter contacts
      if (search) {
        const searchLower = search.toLowerCase();
        filteredContacts = filteredContacts.filter(contact => {
          return (
            (contact.name && contact.name.toLowerCase().includes(searchLower)) ||
            (contact.surname && contact.surname.toLowerCase().includes(searchLower)) ||
            (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
            (contact.phone && contact.phone.includes(searchLower)) ||
            (contact.birthday && contact.birthday.includes(searchLower)) ||
            (contact.source && contact.source.toLowerCase().includes(searchLower))
          );
        });
      }
      
      // Return only the IDs
      const contactIds = filteredContacts.map(contact => contact.id);
      resolve(contactIds);
    } catch (err) {
      reject(err);
    }
  });
}

// Mock database object for API compatibility
const db = {
  exec: (sql) => console.log('Mock SQL exec:', sql),
  prepare: (sql) => ({
    run: (...args) => console.log('Mock SQL run:', sql, args),
    get: (...args) => console.log('Mock SQL get:', sql, args),
    all: (...args) => console.log('Mock SQL all:', sql, args)
  })
};

module.exports = {
  db,
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
}; 