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
const templatesFilePath = path.join(dbFolderPath, 'templates.json');
const scheduledMessagesFilePath = path.join(dbFolderPath, 'scheduled_messages.json');
const senderSettingsFilePath = path.join(dbFolderPath, 'sender_settings.json');

// Sales database
const salesFilePath = path.join(dbFolderPath, 'sales.json');
const salesSettingsFilePath = path.join(dbFolderPath, 'sales_settings.json');
const salesScheduledMessagesFilePath = path.join(dbFolderPath, 'sales_scheduled_messages.json');

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

if (!fs.existsSync(templatesFilePath)) {
  fs.writeFileSync(templatesFilePath, JSON.stringify({
    templates: [],
    nextId: 1
  }));
}

if (!fs.existsSync(scheduledMessagesFilePath)) {
  fs.writeFileSync(scheduledMessagesFilePath, JSON.stringify({
    scheduledMessages: [],
    nextId: 1
  }));
}

if (!fs.existsSync(senderSettingsFilePath)) {
  fs.writeFileSync(senderSettingsFilePath, JSON.stringify({
    senderSettings: []
  }));
}

// Initialize sales database file if it doesn't exist
if (!fs.existsSync(salesFilePath)) {
  fs.writeFileSync(salesFilePath, JSON.stringify({
    sales: [],
    nextId: 1,
    lastFetchTime: null
  }));
}

// Initialize sales settings file if it doesn't exist
if (!fs.existsSync(salesSettingsFilePath)) {
  fs.writeFileSync(salesSettingsFilePath, JSON.stringify({
    autoSchedulerEnabled: false,
    firstMessageDelay: 2,
    firstMessageDelayUnit: 'hours',
    secondMessageDelay: 180,
    secondMessageDelayUnit: 'days',
    firstMessageTemplate: "Hello {{name}}, thank you for your purchase of {{amount}}. We appreciate your business!",
    secondMessageTemplate: "Hello {{name}}, it's been a while since your purchase. How are you enjoying our product? We'd love to hear your feedback!"
  }));
}

// Initialize sales scheduled messages file if it doesn't exist
if (!fs.existsSync(salesScheduledMessagesFilePath)) {
  fs.writeFileSync(salesScheduledMessagesFilePath, JSON.stringify({
    scheduledMessages: [],
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

function readTemplates() {
  try {
    const data = fs.readFileSync(templatesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading templates file:', err);
    return { templates: [], nextId: 1 };
  }
}

function writeTemplates(data) {
  fs.writeFileSync(templatesFilePath, JSON.stringify(data, null, 2));
}

function readScheduledMessages() {
  try {
    const data = fs.readFileSync(scheduledMessagesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading scheduled messages file:', err);
    return { scheduledMessages: [], nextId: 1 };
  }
}

function writeScheduledMessages(data) {
  fs.writeFileSync(scheduledMessagesFilePath, JSON.stringify(data, null, 2));
}

function readSenderSettings() {
  try {
    const data = fs.readFileSync(senderSettingsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading sender settings file:', err);
    return { senderSettings: [] };
  }
}

function writeSenderSettings(data) {
  fs.writeFileSync(senderSettingsFilePath, JSON.stringify(data, null, 2));
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

// Get contacts with pagination and search
function getContacts(page = 1, limit = 100, search = "", source = null) {
  return new Promise((resolve, reject) => {
    try {
      const contactsData = readContacts();
      let filteredContacts = contactsData.contacts;
      
      // Filter by source if provided
      if (source) {
        filteredContacts = filteredContacts.filter(contact => contact.source === source);
      }
      
      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        filteredContacts = filteredContacts.filter(contact => 
          (contact.name && contact.name.toLowerCase().includes(searchLower)) || 
          (contact.surname && contact.surname.toLowerCase().includes(searchLower)) || 
          (contact.email && contact.email.toLowerCase().includes(searchLower)) || 
          (contact.phone && contact.phone.toLowerCase().includes(searchLower))
        );
      }
      
      // Make sure all contacts have a source property
      filteredContacts = filteredContacts.map(contact => ({
        ...contact,
        source: contact.source || 'Manually Added'
      }));
      
      // Get unique sources for grouping
      const sources = [...new Set(filteredContacts.map(contact => contact.source))];
      
      // Calculate pagination
      const total = filteredContacts.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      
      // Get contacts for current page
      const paginatedContacts = filteredContacts.slice(startIndex, endIndex);
      
      resolve({
        contacts: paginatedContacts,
        sources,
        pagination: {
          page,
          limit,
          total,
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
function getAllContactIds(search = "", source = null) {
  return new Promise((resolve, reject) => {
    try {
      const contactsData = readContacts();
      let filteredContacts = contactsData.contacts;
      
      // Filter by source if provided
      if (source) {
        filteredContacts = filteredContacts.filter(contact => contact.source === source);
      }
      
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

// Get templates with pagination and search
function getTemplates(page = 1, limit = 100, search = "") {
  return new Promise((resolve, reject) => {
    try {
      const templatesData = readTemplates();
      let filteredTemplates = templatesData.templates;
      
      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        filteredTemplates = filteredTemplates.filter(template => 
          template.name.toLowerCase().includes(searchLower) || 
          template.content.text.toLowerCase().includes(searchLower)
        );
      }
      
      // Calculate pagination
      const total = filteredTemplates.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      
      // Get templates for current page
      const paginatedTemplates = filteredTemplates.slice(startIndex, endIndex);
      
      resolve({
        templates: paginatedTemplates,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Add template
function addTemplate(templateData) {
  return new Promise((resolve, reject) => {
    try {
      const templatesData = readTemplates();
      
      // Create new template
      const newTemplate = {
        id: templatesData.nextId,
        name: templateData.name,
        content: {
          text: templateData.content.text || '',
          images: templateData.content.images || []
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Add template to database
      templatesData.templates.push(newTemplate);
      templatesData.nextId++;
      writeTemplates(templatesData);
      
      resolve(newTemplate);
    } catch (err) {
      reject(err);
    }
  });
}

// Update template
function updateTemplate(templateId, templateData) {
  return new Promise((resolve, reject) => {
    try {
      const templatesData = readTemplates();
      
      // Find template by ID
      const templateIndex = templatesData.templates.findIndex(t => t.id === templateId);
      
      if (templateIndex === -1) {
        reject(new Error('Template not found'));
        return;
      }
      
      // Update template
      const updatedTemplate = {
        ...templatesData.templates[templateIndex],
        name: templateData.name,
        content: {
          text: templateData.content.text || templatesData.templates[templateIndex].content.text,
          images: templateData.content.images || templatesData.templates[templateIndex].content.images
        },
        updated_at: new Date().toISOString()
      };
      
      templatesData.templates[templateIndex] = updatedTemplate;
      writeTemplates(templatesData);
      
      resolve(updatedTemplate);
    } catch (err) {
      reject(err);
    }
  });
}

// Delete templates
function deleteTemplates(templateIds) {
  return new Promise((resolve, reject) => {
    try {
      const templatesData = readTemplates();
      
      // Filter out templates with IDs in templateIds
      templatesData.templates = templatesData.templates.filter(
        template => !templateIds.includes(template.id)
      );
      
      writeTemplates(templatesData);
      
      resolve({ deletedCount: templateIds.length });
    } catch (err) {
      reject(err);
    }
  });
}

// Get all template IDs (for select all functionality)
function getAllTemplateIds(search = "") {
  return new Promise((resolve, reject) => {
    try {
      const templatesData = readTemplates();
      let filteredTemplates = templatesData.templates;
      
      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        filteredTemplates = filteredTemplates.filter(template => 
          template.name.toLowerCase().includes(searchLower) || 
          template.content.text.toLowerCase().includes(searchLower)
        );
      }
      
      // Extract IDs
      const templateIds = filteredTemplates.map(template => template.id);
      
      resolve(templateIds);
    } catch (err) {
      reject(err);
    }
  });
}

// Get sender settings for a user
function getSenderSettings(userId) {
  return new Promise((resolve, reject) => {
    try {
      const senderSettingsData = readSenderSettings();
      
      // Find settings by user ID
      const settings = senderSettingsData.senderSettings.find(s => s.user_id === userId);
      
      // If no settings found, return default values
      if (!settings) {
        resolve({
          startHour: '09:00',
          endHour: '17:00',
          interval: 60, // seconds
          enabled: false,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
      } else {
        resolve(settings);
      }
    } catch (err) {
      reject(err);
    }
  });
}

// Update sender settings for a user
function updateSenderSettings(userId, settings) {
  return new Promise((resolve, reject) => {
    try {
      const senderSettingsData = readSenderSettings();
      
      // Find index of settings for this user
      const settingsIndex = senderSettingsData.senderSettings.findIndex(s => s.user_id === userId);
      
      // Validate settings
      if (!settings.startHour || !settings.endHour || settings.interval === undefined) {
        reject(new Error('Missing required settings'));
        return;
      }
      
      // Create settings object
      const updatedSettings = {
        user_id: userId,
        startHour: settings.startHour,
        endHour: settings.endHour,
        interval: parseInt(settings.interval, 10),
        enabled: settings.enabled === true || settings.enabled === 'true',
        timeZone: settings.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        updated_at: new Date().toISOString()
      };
      
      if (settingsIndex >= 0) {
        // Update existing settings
        senderSettingsData.senderSettings[settingsIndex] = updatedSettings;
      } else {
        // Add new settings
        senderSettingsData.senderSettings.push(updatedSettings);
      }
      
      writeSenderSettings(senderSettingsData);
      resolve(updatedSettings);
    } catch (err) {
      reject(err);
    }
  });
}

// Schedule messages for sending
function scheduleMessages(userId, contactIds, templateId, scheduledTime = null) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get contacts
      const contactsData = readContacts();
      
      // Get template
      const templatesData = readTemplates();
      const template = templatesData.templates.find(t => t.id === templateId);
      
      if (!template) {
        reject(new Error('Template not found'));
        return;
      }
      
      // Get user's sender settings
      const senderSettings = await getSenderSettings(userId);
      
      // Current timestamp
      const now = new Date();
      
      // Get scheduled messages data
      const scheduledMessagesData = readScheduledMessages();
      
      // Array to store newly created messages
      const newMessages = [];
      
      // Process each contact
      for (const contactId of contactIds) {
        // Find contact
        const contact = contactsData.contacts.find(c => c.id === contactId);
        
        if (!contact) {
          continue; // Skip if contact not found
        }
        
        // Create scheduled time if not provided
        // This will be refined by the scheduling system later
        const messageScheduledTime = scheduledTime || now.toISOString();
        
        // Create scheduled message
        const scheduledMessage = {
          id: scheduledMessagesData.nextId++,
          user_id: userId,
          contact_id: contact.id,
          contact_name: contact.name || '',
          contact_surname: contact.surname || '',
          contact_phone: contact.phone,
          template_id: template.id,
          template_name: template.name,
          message_content: {
            text: template.content.text || '',
            images: template.content.images || []
          },
          scheduled_time: messageScheduledTime,
          scheduled_date: new Date(messageScheduledTime).toDateString(),
          status: 'SCHEDULED', // SCHEDULED, SENDING, SENT, DELIVERED, READ, FAILED, CANCELED
          message_id: null, // Will be filled when the message is sent
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        };
        
        // Add to scheduled messages
        scheduledMessagesData.scheduledMessages.push(scheduledMessage);
        newMessages.push(scheduledMessage);
      }
      
      // Save scheduled messages
      writeScheduledMessages(scheduledMessagesData);
      
      resolve({
        success: true,
        messages: newMessages,
        count: newMessages.length
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Get scheduled messages for a user
function getScheduledMessages(userId, page = 1, limit = 20, status = 'ALL') {
  return new Promise((resolve, reject) => {
    try {
      const scheduledMessagesData = readScheduledMessages();
      let filteredMessages = scheduledMessagesData.scheduledMessages;
      
      // Filter by user ID
      if (userId) {
        filteredMessages = filteredMessages.filter(m => m.user_id === userId);
      }
      
      // Filter by status
      if (status && status !== 'ALL') {
        filteredMessages = filteredMessages.filter(m => m.status === status);
      }
      
      // Sort messages by created time (newest first)
      filteredMessages.sort((a, b) => new Date(b.created_at || b.scheduled_time) - new Date(a.created_at || a.scheduled_time));
      
      // Calculate pagination
      const total = filteredMessages.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      
      // Get messages for current page
      const paginatedMessages = filteredMessages.slice(startIndex, endIndex);
      
      resolve({
        messages: paginatedMessages,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Update scheduled message status
function updateMessageStatus(messageId, status, whatsappMessageId = null) {
  return new Promise((resolve, reject) => {
    try {
      const scheduledMessagesData = readScheduledMessages();
      const messageIndex = scheduledMessagesData.scheduledMessages.findIndex(m => m.id === messageId);
      
      if (messageIndex === -1) {
        reject(new Error('Message not found'));
        return;
      }
      
      const message = scheduledMessagesData.scheduledMessages[messageIndex];
      
      // Create status history if it doesn't exist
      if (!message.status_history) {
        message.status_history = [];
      }
      
      // Add current status to history
      if (message.status !== status) {
        message.status_history.push({
          status: message.status,
          timestamp: message.updated_at
        });
      }
      
      // Update message
      message.status = status;
      message.updated_at = new Date().toISOString();
      
      // If a WhatsApp message ID is provided, store it
      if (whatsappMessageId) {
        message.whatsapp_message_id = whatsappMessageId;
      }
      
      // Write updated data
      fs.writeFileSync(
        scheduledMessagesFilePath,
        JSON.stringify(scheduledMessagesData, null, 2)
      );
      
      resolve(message);
    } catch (err) {
      reject(err);
    }
  });
}

// Delete scheduled messages
function deleteScheduledMessages(messageIds) {
  return new Promise((resolve, reject) => {
    try {
      const scheduledMessagesData = readScheduledMessages();
      
      // Track how many messages were actually deleted
      let deletedCount = 0;
      
      // Filter out the messages to be deleted
      scheduledMessagesData.scheduledMessages = scheduledMessagesData.scheduledMessages.filter(message => {
        if (messageIds.includes(message.id)) {
          deletedCount++;
          return false; // Remove this message
        }
        return true; // Keep this message
      });
      
      // Write updated data
      fs.writeFileSync(
        scheduledMessagesFilePath,
        JSON.stringify(scheduledMessagesData, null, 2)
      );
      
      resolve({
        success: true,
        deletedCount
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Get unsent scheduled messages for a user
function getUnsentScheduledMessages(userId) {
  return new Promise((resolve, reject) => {
    try {
      const scheduledMessagesData = readScheduledMessages();
      const messages = scheduledMessagesData.scheduledMessages.filter(
        m => m.user_id === userId && m.status === 'SCHEDULED'
      );
      
      // Sort by scheduled time (oldest first)
      messages.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
      
      resolve(messages);
    } catch (err) {
      reject(err);
    }
  });
}

// Cancel scheduled message
function cancelScheduledMessage(messageId) {
  return new Promise((resolve, reject) => {
    try {
      const scheduledMessagesData = readScheduledMessages();
      
      // Find message by ID
      const messageIndex = scheduledMessagesData.scheduledMessages.findIndex(m => m.id === messageId);
      
      if (messageIndex === -1) {
        reject(new Error('Message not found'));
        return;
      }
      
      // Check if message can be canceled
      const message = scheduledMessagesData.scheduledMessages[messageIndex];
      if (['SENT', 'DELIVERED', 'READ'].includes(message.status)) {
        reject(new Error('Cannot cancel a message that has already been sent'));
        return;
      }
      
      // Create status history if it doesn't exist
      if (!message.status_history) {
        message.status_history = [];
      }
      
      // Add current status to history
      message.status_history.push({
        status: message.status,
        timestamp: message.updated_at
      });
      
      // Update message status to CANCELED
      message.status = 'CANCELED';
      message.updated_at = new Date().toISOString();
      
      // Write updated data
      fs.writeFileSync(
        scheduledMessagesFilePath,
        JSON.stringify(scheduledMessagesData, null, 2)
      );
      
      resolve({
        success: true,
        message
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Get all scheduled messages (for statistics)
function getAllScheduledMessages() {
  return new Promise((resolve, reject) => {
    try {
      const scheduledMessagesData = readScheduledMessages();
      resolve(scheduledMessagesData.scheduledMessages);
    } catch (err) {
      reject(err);
    }
  });
}

// Check if a message can be sent right now based on working hours and interval
function canSendMessageNow(userId, settings, lastSentMessageTime = null) {
  return new Promise(async (resolve) => {
    try {
      const now = new Date();
      
      // 1. Check working hours
      const [startHours, startMinutes] = settings.startHour.split(':').map(Number);
      const [endHours, endMinutes] = settings.endHour.split(':').map(Number);
      
      const startTime = new Date(now);
      startTime.setHours(startHours, startMinutes, 0, 0);
      
      const endTime = new Date(now);
      endTime.setHours(endHours, endMinutes, 0, 0);
      
      // If end time is earlier than start time, it spans over midnight
      if (endTime < startTime) {
        if (now < startTime) {
          endTime.setDate(endTime.getDate() - 1); // End time was yesterday
        } else {
          startTime.setDate(startTime.getDate() - 1); // Start time was yesterday
        }
      }
      
      // Check if current time is within working hours
      const isWithinWorkingHours = now >= startTime && now <= endTime;
      
      if (!isWithinWorkingHours) {
        console.log(`Outside working hours (${now.toLocaleTimeString()} not between ${settings.startHour}-${settings.endHour})`);
        return resolve({
          canSend: false,
          reason: 'outside_working_hours',
          nextTime: startTime > now ? startTime : new Date(startTime.setDate(startTime.getDate() + 1))
        });
      }
      
      // 2. Check if there's enough time left in working hours
      const timeUntilEndOfDay = endTime.getTime() - now.getTime();
      if (timeUntilEndOfDay < 60000) { // Less than a minute left
        console.log(`Less than a minute left in working hours`);
        return resolve({
          canSend: false, 
          reason: 'working_hours_ending_soon',
          nextTime: new Date(startTime.setDate(startTime.getDate() + 1))
        });
      }
      
      // 3. Check interval since last message
      if (lastSentMessageTime) {
        const timeSinceLastMessage = now.getTime() - lastSentMessageTime.getTime();
        const minInterval = settings.interval * 1000; // Convert to milliseconds
        
        if (timeSinceLastMessage < minInterval) {
          const waitTime = minInterval - timeSinceLastMessage;
          const nextSendTime = new Date(now.getTime() + waitTime);
          
          console.log(`Need to wait ${Math.round(waitTime / 1000)} more seconds before sending the next message`);
          
          return resolve({
            canSend: false,
            reason: 'interval_not_elapsed',
            nextTime: nextSendTime,
            waitSeconds: Math.round(waitTime / 1000)
          });
        }
      }
      
      // All checks passed, message can be sent
      resolve({ canSend: true });
    } catch (error) {
      console.error('Error checking if message can be sent:', error);
      resolve({ canSend: false, reason: 'error', error });
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

function readSales() {
  try {
    const data = fs.readFileSync(salesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading sales file:', err);
    return { sales: [], nextId: 1, lastFetchTime: null };
  }
}

function writeSales(data) {
  fs.writeFileSync(salesFilePath, JSON.stringify(data, null, 2));
}

function readSalesSettings() {
  try {
    const data = fs.readFileSync(salesSettingsFilePath, 'utf8');
    const settings = JSON.parse(data);
    
    // Ensure delay units are set even if they are missing in the file
    if (!settings.firstMessageDelayUnit) {
      settings.firstMessageDelayUnit = 'hours';
    }
    if (!settings.secondMessageDelayUnit) {
      settings.secondMessageDelayUnit = 'days';
    }
    
    return settings;
  } catch (err) {
    console.error('Error reading sales settings file:', err);
    return {
      autoSchedulerEnabled: false,
      firstMessageDelay: 2,
      firstMessageDelayUnit: 'hours',
      secondMessageDelay: 180,
      secondMessageDelayUnit: 'days',
      firstMessageTemplate: "Hello {{name}}, thank you for your purchase of {{amount}}. We appreciate your business!",
      secondMessageTemplate: "Hello {{name}}, it's been a while since your purchase. How are you enjoying our product? We'd love to hear your feedback!"
    };
  }
}

function writeSalesSettings(data) {
  fs.writeFileSync(salesSettingsFilePath, JSON.stringify(data, null, 2));
}

function readSalesScheduledMessages() {
  try {
    const data = fs.readFileSync(salesScheduledMessagesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading sales scheduled messages file:', err);
    return { scheduledMessages: [], nextId: 1 };
  }
}

function writeSalesScheduledMessages(data) {
  fs.writeFileSync(salesScheduledMessagesFilePath, JSON.stringify(data, null, 2));
}

// Get sales with pagination and filtering
function getSales(page = 1, limit = 100, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const salesData = readSales();
      let filteredSales = [...salesData.sales];
      
      // Apply town filter
      if (filters.town && filters.town !== 'all') {
        filteredSales = filteredSales.filter(sale => 
          sale.businessEntity.town.toLowerCase() === filters.town.toLowerCase()
        );
      }
      
      // Apply date range filter
      if (filters.startDate && filters.endDate) {
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Include the end date fully
        
        filteredSales = filteredSales.filter(sale => {
          const saleDate = new Date(sale.documentDate);
          return saleDate >= startDate && saleDate <= endDate;
        });
      }
      
      // Apply global search filter
      if (filters.search && filters.search.trim() !== '') {
        const searchTerm = filters.search.toLowerCase().trim();
        filteredSales = filteredSales.filter(sale => {
          // Search in multiple fields
          return (
            (sale.documentNumber && sale.documentNumber.toLowerCase().includes(searchTerm)) ||
            (sale.businessEntity.name && sale.businessEntity.name.toLowerCase().includes(searchTerm)) ||
            (sale.businessEntity.town && sale.businessEntity.town.toLowerCase().includes(searchTerm)) ||
            (sale.businessEntity.phone && sale.businessEntity.phone.includes(searchTerm)) ||
            (sale.documentLevel.code && sale.documentLevel.code.toLowerCase().includes(searchTerm))
          );
        });
      }
      
      // Sort primarily by document date, newest first (to ensure today's sales are at the top)
      filteredSales.sort((a, b) => {
        // First compare document dates
        const docDateA = new Date(a.documentDate);
        const docDateB = new Date(b.documentDate);
        
        // If document dates are different, sort by them (newest first)
        if (docDateA.toDateString() !== docDateB.toDateString()) {
          return docDateB - docDateA;
        }
        
        // If document dates are the same, use fetchDate as secondary sort (newest first)
        return new Date(b.fetchDate) - new Date(a.fetchDate);
      });
      
      // Apply pagination
      const totalSales = filteredSales.length;
      const totalPages = Math.ceil(totalSales / limit);
      const offset = (page - 1) * limit;
      const paginatedSales = filteredSales.slice(offset, offset + limit);
      
      resolve({
        sales: paginatedSales,
        pagination: {
          page,
          limit,
          totalSales,
          totalPages
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Save new sales
function saveSales(salesList) {
  return new Promise((resolve, reject) => {
    try {
      const salesData = readSales();
      const newSales = [];
      const currentTime = new Date().toISOString();
      
      // Process each sale
      for (const sale of salesList) {
        // Check if sale with this ID already exists
        const existingSale = salesData.sales.find(s => s.id === sale.id);
        
        if (!existingSale) {
          // Add fetch date to track when we fetched it
          const newSale = {
            ...sale,
            fetchDate: currentTime
          };
          
          salesData.sales.push(newSale);
          newSales.push(newSale);
        }
      }
      
      // Update last fetch time
      salesData.lastFetchTime = currentTime;
      
      // Save to database
      writeSales(salesData);
      
      resolve({
        newSalesCount: newSales.length,
        newSales,
        lastFetchTime: currentTime
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Update a sale
function updateSale(saleId, saleData) {
  return new Promise((resolve, reject) => {
    try {
      const salesData = readSales();
      
      // Find sale by ID
      const saleIndex = salesData.sales.findIndex(s => s.id === saleId);
      
      if (saleIndex === -1) {
        reject(new Error('Sale not found'));
        return;
      }
      
      // Update sale
      salesData.sales[saleIndex] = {
        ...salesData.sales[saleIndex],
        ...saleData,
        // Keep original ID and fetch date
        id: salesData.sales[saleIndex].id,
        fetchDate: salesData.sales[saleIndex].fetchDate
      };
      
      // Save to database
      writeSales(salesData);
      
      resolve({
        success: true,
        sale: salesData.sales[saleIndex]
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Delete sales
function deleteSales(saleIds) {
  return new Promise((resolve, reject) => {
    try {
      const salesData = readSales();
      
      // Filter out the sales to delete
      salesData.sales = salesData.sales.filter(sale => !saleIds.includes(sale.id));
      
      // Save to database
      writeSales(salesData);
      
      resolve({
        success: true,
        deletedCount: saleIds.length
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Get last fetch time
function getLastFetchTime() {
  return new Promise((resolve) => {
    try {
      const salesData = readSales();
      resolve({
        lastFetchTime: salesData.lastFetchTime
      });
    } catch (err) {
      console.error('Error getting last fetch time:', err);
      resolve({
        lastFetchTime: null
      });
    }
  });
}

// Get all towns from sales data
function getSalesTowns() {
  return new Promise((resolve) => {
    try {
      const salesData = readSales();
      const towns = [...new Set(salesData.sales.map(sale => 
        sale.businessEntity.town.toLowerCase()))]
        .map(town => town.charAt(0).toUpperCase() + town.slice(1));
      
      resolve({
        towns
      });
    } catch (err) {
      console.error('Error getting sales towns:', err);
      resolve({
        towns: []
      });
    }
  });
}

// Get sales settings
function getSalesSettings() {
  return new Promise((resolve) => {
    try {
      const settings = readSalesSettings();
      // Ensure delay units are always included
      if (!settings.firstMessageDelayUnit) {
        settings.firstMessageDelayUnit = 'hours';
      }
      if (!settings.secondMessageDelayUnit) {
        settings.secondMessageDelayUnit = 'days';
      }
      resolve(settings);
    } catch (error) {
      console.error('Error getting sales settings:', error);
      resolve({
        autoSchedulerEnabled: false,
        firstMessageDelay: 2,
        firstMessageDelayUnit: 'hours',
        secondMessageDelay: 180,
        secondMessageDelayUnit: 'days',
        firstMessageTemplate: "Hello {{name}}, thank you for your purchase of {{amount}}. We appreciate your business!",
        secondMessageTemplate: "Hello {{name}}, it's been a while since your purchase. How are you enjoying our product? We'd love to hear your feedback!"
      });
    }
  });
}

// Update sales settings
function updateSalesSettings(settings) {
  return new Promise((resolve, reject) => {
    try {
      writeSalesSettings(settings);
      resolve({ success: true });
    } catch (error) {
      console.error('Error updating sales settings:', error);
      reject(error);
    }
  });
}

// Schedule sales messages
function scheduleSalesMessages(saleId, userId) {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if autoscheduler is enabled
      const settings = readSalesSettings();
      
      const salesData = readSales();
      const sale = salesData.sales.find(s => s.id === saleId);
      
      if (!sale) {
        reject(new Error('Sale not found'));
        return;
      }
      
      // Only schedule if the sale is from today
      const saleDate = new Date(sale.documentDate);
      const today = new Date();
      const isSaleFromToday = 
        saleDate.getDate() === today.getDate() &&
        saleDate.getMonth() === today.getMonth() &&
        saleDate.getFullYear() === today.getFullYear();
      
      // Add metadata for tracking
      sale.messageScheduled = settings.autoSchedulerEnabled && isSaleFromToday;
      sale.schedulingSkipped = !settings.autoSchedulerEnabled || !isSaleFromToday;
      sale.schedulingReason = !settings.autoSchedulerEnabled 
        ? 'AutoScheduler Disabled' 
        : (!isSaleFromToday ? 'Sale Not From Today' : 'Scheduled');
      
      // Save updated sale
      writeSales(salesData);
      
      // If autoscheduler is disabled or sale is not from today, don't schedule messages
      if (!settings.autoSchedulerEnabled || !isSaleFromToday) {
        resolve({
          scheduled: false,
          reason: sale.schedulingReason
        });
        return;
      }
      
      // Calculate scheduled times based on the delay unit
      const now = new Date();
      let firstMessageTime = new Date();
      
      // Apply the appropriate time calculation based on the delay unit from settings
      if (settings.firstMessageDelayUnit === 'seconds') {
        firstMessageTime.setSeconds(firstMessageTime.getSeconds() + settings.firstMessageDelay);
        console.log(`Scheduling first message for sale ${saleId} at ${firstMessageTime.toLocaleString()}, which is ${settings.firstMessageDelay} seconds from now`);
      } else if (settings.firstMessageDelayUnit === 'minutes') {
        firstMessageTime.setMinutes(firstMessageTime.getMinutes() + settings.firstMessageDelay);
        console.log(`Scheduling first message for sale ${saleId} at ${firstMessageTime.toLocaleString()}, which is ${settings.firstMessageDelay} minutes from now`);
      } else if (settings.firstMessageDelayUnit === 'hours') {
        firstMessageTime.setHours(firstMessageTime.getHours() + settings.firstMessageDelay);
        console.log(`Scheduling first message for sale ${saleId} at ${firstMessageTime.toLocaleString()}, which is ${settings.firstMessageDelay} hours from now`);
      } else if (settings.firstMessageDelayUnit === 'days') {
        firstMessageTime.setDate(firstMessageTime.getDate() + settings.firstMessageDelay);
        console.log(`Scheduling first message for sale ${saleId} at ${firstMessageTime.toLocaleString()}, which is ${settings.firstMessageDelay} days from now`);
      } else {
        // Default to 10 seconds if no valid unit is specified
        firstMessageTime.setSeconds(firstMessageTime.getSeconds() + 10);
        console.log(`Scheduling first message for sale ${saleId} at ${firstMessageTime.toLocaleString()}, which is 10 seconds from now (default)`);
      }
      
      // Get name and amount from sale
      const customerName = sale.businessEntity.name || 'Customer';
      const documentNumber = sale.documentNumber || '';
      
      // Replace variables in templates
      const firstMessageContent = settings.firstMessageTemplate
        .replace(/{{name}}/g, customerName)
        .replace(/{{amount}}/g, documentNumber);
      
      const secondMessageContent = settings.secondMessageTemplate
        .replace(/{{name}}/g, customerName)
        .replace(/{{amount}}/g, documentNumber);
      
      // Create message records
      const messagesData = readSalesScheduledMessages();
      
      // First message
      const firstMessage = {
        id: messagesData.nextId++,
        saleId,
        userId,
        messageNumber: 1,
        status: 'SCHEDULED',
        phoneNumber: sale.businessEntity.phone,
        customerName,
        messageContent: firstMessageContent,
        scheduledTime: firstMessageTime.toISOString(),
        sentTime: null,
        deliveredTime: null,
        readTime: null,
        failedTime: null,
        canceledTime: null,
        whatsappMessageId: null,
        dependentMessageId: null,
        scheduledDate: firstMessageTime.toDateString()
      };
      
      messagesData.scheduledMessages.push(firstMessage);
      
      // Second message (will be scheduled after first message is sent)
      const secondMessage = {
        id: messagesData.nextId++,
        saleId,
        userId,
        messageNumber: 2,
        status: 'PENDING_FIRST_MESSAGE',
        phoneNumber: sale.businessEntity.phone,
        customerName,
        messageContent: secondMessageContent,
        scheduledTime: null, // Will be set when first message is sent
        sentTime: null,
        deliveredTime: null,
        readTime: null,
        failedTime: null,
        canceledTime: null,
        whatsappMessageId: null,
        dependentMessageId: firstMessage.id, // Depends on first message
        scheduledDate: null // Will be set when first message is sent
      };
      
      messagesData.scheduledMessages.push(secondMessage);
      
      // Save messages
      writeSalesScheduledMessages(messagesData);
      
      resolve({
        scheduled: true,
        firstMessage,
        secondMessage
      });
    } catch (error) {
      console.error('Error scheduling sales messages:', error);
      reject(error);
    }
  });
}

// Get sales scheduled messages
function getSalesScheduledMessages(page = 1, limit = 20, filters = {}, options = {}) {
  return new Promise((resolve) => {
    try {
      const messagesData = readSalesScheduledMessages();
      let filteredMessages = [...messagesData.scheduledMessages];
      
      // Apply status filter
      if (filters.status && filters.status !== 'ALL') {
        filteredMessages = filteredMessages.filter(message => message.status === filters.status);
      }
      
      // Apply message number filter
      if (filters.messageNumber) {
        filteredMessages = filteredMessages.filter(message => message.messageNumber === parseInt(filters.messageNumber));
      }
      
      // Apply date range filter
      if (filters.startDate && filters.endDate) {
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Include the end date fully
        
        filteredMessages = filteredMessages.filter(message => {
          const scheduledDate = message.scheduledTime ? new Date(message.scheduledTime) : null;
          if (!scheduledDate) return false;
          return scheduledDate >= startDate && scheduledDate <= endDate;
        });
      }
      
      // Default sorting options
      const orderBy = options.orderBy || 'scheduledTime';
      const orderDirection = options.orderDirection || 'desc';
      const groupRelatedMessages = options.groupRelatedMessages || false;
      
      // First sort by the requested field
      filteredMessages.sort((a, b) => {
        // Handle missing values
        if (!a[orderBy]) return 1;
        if (!b[orderBy]) return -1;
        
        // For date fields, convert to Date objects
        if (orderBy.includes('Time')) {
          const dateA = new Date(a[orderBy]);
          const dateB = new Date(b[orderBy]);
          return orderDirection === 'desc' ? dateB - dateA : dateA - dateB;
        }
        
        // For string or numeric fields
        if (orderDirection === 'desc') {
          return a[orderBy] > b[orderBy] ? -1 : 1;
        } else {
          return a[orderBy] > b[orderBy] ? 1 : -1;
        }
      });
      
      // Always group related messages (msg1 and msg2 from same sale)
      // regardless of if groupRelatedMessages is true - this is critical for proper ordering
      {
        // Build a map of message pairs by saleId
        const messagePairsBySaleId = new Map();
        
        // First pass: group messages by saleId
        filteredMessages.forEach(message => {
          if (!messagePairsBySaleId.has(message.saleId)) {
            messagePairsBySaleId.set(message.saleId, { msg1: null, msg2: null });
          }
          
          const pair = messagePairsBySaleId.get(message.saleId);
          if (message.messageNumber === 1) {
            pair.msg1 = message;
          } else if (message.messageNumber === 2) {
            pair.msg2 = message;
          }
        });
        
        // Now find the most recent scheduled time for each sale
        // This will be used for sorting the pairs
        const sortValues = new Map();
        
        messagePairsBySaleId.forEach((pair, saleId) => {
          // Find the best timestamp to sort by
          let sortTimestamp = new Date(0);
          
          // First priority: Msg1 scheduledTime if exists
          if (pair.msg1 && pair.msg1.scheduledTime) {
            sortTimestamp = new Date(pair.msg1.scheduledTime);
          }
          
          sortValues.set(saleId, sortTimestamp);
        });
        
        // Sort the sales by their most recent message timestamp (newest first)
        const sortedSaleIds = Array.from(messagePairsBySaleId.keys()).sort((saleIdA, saleIdB) => {
          const timeA = sortValues.get(saleIdA);
          const timeB = sortValues.get(saleIdB);
          return timeB - timeA; // Newest first
        });
        
        // Create the final array with pairs in the correct order
        const result = [];
        
        sortedSaleIds.forEach(saleId => {
          const pair = messagePairsBySaleId.get(saleId);
          
          // Add msg2 first if exists
          if (pair.msg2) {
            result.push(pair.msg2);
          }
          
          // Then add msg1 after its msg2
          if (pair.msg1) {
            result.push(pair.msg1);
          }
        });
        
        filteredMessages = result;
      }
      
      // Apply pagination
      const totalMessages = filteredMessages.length;
      const totalPages = Math.ceil(totalMessages / limit);
      const offset = (page - 1) * limit;
      const paginatedMessages = filteredMessages.slice(offset, offset + limit);
      
      resolve({
        messages: paginatedMessages,
        pagination: {
          page,
          limit,
          totalMessages,
          totalPages
        }
      });
    } catch (error) {
      console.error('Error getting sales scheduled messages:', error);
      resolve({
        messages: [],
        pagination: {
          page,
          limit,
          totalMessages: 0,
          totalPages: 0
        }
      });
    }
  });
}

// Update sales message status
function updateSalesMessageStatus(messageId, status, whatsappMessageId = null) {
  return new Promise((resolve, reject) => {
    try {
      const messagesData = readSalesScheduledMessages();
      const messageIndex = messagesData.scheduledMessages.findIndex(message => message.id === messageId);
      
      if (messageIndex === -1) {
        reject(new Error('Message not found'));
        return;
      }
      
      const message = messagesData.scheduledMessages[messageIndex];
      const now = new Date();
      const nowIso = now.toISOString();
      
      // Update status and respective time
      message.status = status;
      
      if (status === 'SENDING') {
        message.sendingTime = nowIso;
      } else if (status === 'SENT') {
        message.sentTime = nowIso;
        
        // If this is a first message being sent, schedule the second message
        if (message.messageNumber === 1) {
          // Find the dependent second message
          const secondMessageIndex = messagesData.scheduledMessages.findIndex(m => 
            m.dependentMessageId === message.id && m.messageNumber === 2);
          
          if (secondMessageIndex !== -1) {
            const secondMessage = messagesData.scheduledMessages[secondMessageIndex];
            const settings = readSalesSettings();
            
            // Calculate scheduled time for second message based on FIRST MESSAGE SENT TIME
            // This ensures the timing is relative to when Msg1 was actually sent, not when Msg2 is being scheduled
            const secondMessageTime = new Date(message.sentTime);
            
            if (settings.secondMessageDelayUnit === 'seconds') {
              secondMessageTime.setSeconds(secondMessageTime.getSeconds() + settings.secondMessageDelay);
              console.log(`Scheduling second message for ${secondMessage.customerName} at ${secondMessageTime.toLocaleString()}, which is ${settings.secondMessageDelay} seconds after first message sent at ${new Date(message.sentTime).toLocaleString()}`);
            } else if (settings.secondMessageDelayUnit === 'minutes') {
              secondMessageTime.setMinutes(secondMessageTime.getMinutes() + settings.secondMessageDelay);
              console.log(`Scheduling second message for ${secondMessage.customerName} at ${secondMessageTime.toLocaleString()}, which is ${settings.secondMessageDelay} minutes after first message sent at ${new Date(message.sentTime).toLocaleString()}`);
            } else if (settings.secondMessageDelayUnit === 'hours') {
              secondMessageTime.setHours(secondMessageTime.getHours() + settings.secondMessageDelay);
              console.log(`Scheduling second message for ${secondMessage.customerName} at ${secondMessageTime.toLocaleString()}, which is ${settings.secondMessageDelay} hours after first message sent at ${new Date(message.sentTime).toLocaleString()}`);
            } else if (settings.secondMessageDelayUnit === 'days') {
              secondMessageTime.setDate(secondMessageTime.getDate() + settings.secondMessageDelay);
              console.log(`Scheduling second message for ${secondMessage.customerName} at ${secondMessageTime.toLocaleString()}, which is ${settings.secondMessageDelay} days after first message sent at ${new Date(message.sentTime).toLocaleString()}`);
            } else {
              // Default to 20 seconds if no valid unit is specified
              secondMessageTime.setSeconds(secondMessageTime.getSeconds() + 20);
              console.log(`Scheduling second message for ${secondMessage.customerName} at ${secondMessageTime.toLocaleString()}, which is 20 seconds after first message sent at ${new Date(message.sentTime).toLocaleString()} (default)`);
            }
            
            // Update second message
            secondMessage.status = 'SCHEDULED';
            secondMessage.scheduledTime = secondMessageTime.toISOString();
            secondMessage.scheduledDate = secondMessageTime.toDateString();
            
            messagesData.scheduledMessages[secondMessageIndex] = secondMessage;
          }
        }
      } else if (status === 'DELIVERED') {
        message.deliveredTime = nowIso;
      } else if (status === 'READ') {
        message.readTime = nowIso;
      } else if (status === 'FAILED') {
        message.failedTime = nowIso;
        
        // If first message fails, cancel the second message
        if (message.messageNumber === 1) {
          const secondMessageIndex = messagesData.scheduledMessages.findIndex(m => 
            m.dependentMessageId === message.id && m.messageNumber === 2);
          
          if (secondMessageIndex !== -1) {
            messagesData.scheduledMessages[secondMessageIndex].status = 'CANCELED';
            messagesData.scheduledMessages[secondMessageIndex].canceledTime = nowIso;
            messagesData.scheduledMessages[secondMessageIndex].cancelReason = 'First message failed';
          }
        }
      } else if (status === 'CANCELED') {
        message.canceledTime = nowIso;
        
        // If first message is canceled, cancel the second message
        if (message.messageNumber === 1) {
          const secondMessageIndex = messagesData.scheduledMessages.findIndex(m => 
            m.dependentMessageId === message.id && m.messageNumber === 2);
          
          if (secondMessageIndex !== -1) {
            messagesData.scheduledMessages[secondMessageIndex].status = 'CANCELED';
            messagesData.scheduledMessages[secondMessageIndex].canceledTime = nowIso;
            messagesData.scheduledMessages[secondMessageIndex].cancelReason = 'First message was canceled';
          }
        }
      }
      
      // Update WhatsApp message ID if provided
      if (whatsappMessageId) {
        message.whatsappMessageId = whatsappMessageId;
      }
      
      // Save updated message
      messagesData.scheduledMessages[messageIndex] = message;
      writeSalesScheduledMessages(messagesData);
      
      resolve({
        success: true,
        message
      });
    } catch (error) {
      console.error('Error updating sales message status:', error);
      reject(error);
    }
  });
}

// Cancel sales scheduled message
function cancelSalesScheduledMessage(messageId) {
  return updateSalesMessageStatus(messageId, 'CANCELED');
}

// Delete sales scheduled messages
function deleteSalesScheduledMessages(messageIds) {
  return new Promise((resolve, reject) => {
    try {
      const messagesData = readSalesScheduledMessages();
      
      // Filter out the messages to delete
      messagesData.scheduledMessages = messagesData.scheduledMessages.filter(message => 
        !messageIds.includes(message.id));
      
      // Save updated messages
      writeSalesScheduledMessages(messagesData);
      
      resolve({
        success: true,
        deletedCount: messageIds.length
      });
    } catch (error) {
      console.error('Error deleting sales scheduled messages:', error);
      reject(error);
    }
  });
}

// Get due sales messages
function getDueSalesMessages(userId) {
  return new Promise((resolve) => {
    try {
      // Always read the latest data
      const messagesData = readSalesScheduledMessages();
      const now = new Date();
      const settings = readSalesSettings();
      
      // First, check for messages that are too old to be sent (expired)
      const outdatedMessages = messagesData.scheduledMessages.filter(message => {
        // Only consider SCHEDULED or PENDING_FIRST_MESSAGE messages
        if (message.status !== 'SCHEDULED' && message.status !== 'PENDING_FIRST_MESSAGE') {
          return false;
        }
        
        // Get scheduled time (if exists)
        if (!message.scheduledTime) {
          return false; // Skip messages without scheduled time
        }
        
        const scheduledTime = new Date(message.scheduledTime);
        
        // Reasonable buffer - 60 seconds (more precise than the previous 1-hour window)
        const bufferMs = 60 * 1000; 
        
        // Check if the message is past due (current time > scheduled time + buffer)
        const isPastDue = now.getTime() > (scheduledTime.getTime() + bufferMs);
        
        // For Msg1: if past due, mark it as expired
        if (message.messageNumber === 1 && isPastDue) {
          console.log(`Message ${message.id} (Msg1) is expired: scheduled for ${scheduledTime.toLocaleString()} but current time is ${now.toLocaleString()}`);
          return true;
        }
        
        // For Msg2: if past due, mark it as expired
        if (message.messageNumber === 2 && isPastDue) {
          console.log(`Message ${message.id} (Msg2) is expired: scheduled for ${scheduledTime.toLocaleString()} but current time is ${now.toLocaleString()}`);
          return true;
        }
        
        return false;
      });
      
      // Cancel all outdated messages
      if (outdatedMessages.length > 0) {
        console.log(`Canceling ${outdatedMessages.length} outdated messages for user ${userId}`);
        
        // Cancel all outdated messages
        for (const outdatedMessage of outdatedMessages) {
          outdatedMessage.status = 'CANCELED';
          outdatedMessage.canceledTime = now.toISOString();
          outdatedMessage.cancelReason = 'Message is too old to be delivered';
          
          // If this is a first message, cancel the second message too
          if (outdatedMessage.messageNumber === 1) {
            const secondMessageIndex = messagesData.scheduledMessages.findIndex(m => 
              m.dependentMessageId === outdatedMessage.id && m.messageNumber === 2);
            
            if (secondMessageIndex !== -1) {
              messagesData.scheduledMessages[secondMessageIndex].status = 'CANCELED';
              messagesData.scheduledMessages[secondMessageIndex].canceledTime = now.toISOString();
              messagesData.scheduledMessages[secondMessageIndex].cancelReason = 'First message was too old to be delivered';
            }
          }
        }
        
        // Save changes
        writeSalesScheduledMessages(messagesData);
      }
      
      // Now find messages that are scheduled and due RIGHT NOW (respecting exact time)
      const dueMessages = messagesData.scheduledMessages.filter(message => {
        // Only consider SCHEDULED messages
        if (message.status !== 'SCHEDULED') {
          return false;
        }
        
        if (!message.scheduledTime) {
          return false;
        }
        
        // Get scheduled time
        const scheduledTime = new Date(message.scheduledTime);
        
        // Check if the current time is EXACTLY equal to or slightly past the scheduled time
        // We want to be very precise about when we send the message
        const diffInSeconds = (now - scheduledTime) / 1000;
        
        // Check if we're exactly at the scheduled time (within millisecond precision)
        // This ensures Msg1 waits the EXACT amount of time set in settings
        const diffInMs = now.getTime() - scheduledTime.getTime();
        return diffInMs >= 0 && diffInMs < 100; // Only allow 100ms precision for exact timing
      });
      
      // Save any status changes made
      writeSalesScheduledMessages(messagesData);
      
      // Log detailed info about due messages
      if (dueMessages.length > 0) {
        console.log(`Found ${dueMessages.length} due messages for user ${userId}:`);
        dueMessages.forEach(msg => {
          const scheduledTime = new Date(msg.scheduledTime);
          const timeDiff = (now - scheduledTime) / 1000; // in seconds
          console.log(`Message ID: ${msg.id}, Type: ${msg.messageNumber}, Scheduled: ${scheduledTime.toLocaleString()}, Due for: ${timeDiff.toFixed(1)}s`);
        });
      }
      
      resolve(dueMessages);
    } catch (error) {
      console.error('Error getting due sales messages:', error);
      resolve([]);
    }
  });
}

// Get sales message statistics
function getSalesMessageStatistics(startDate, endDate) {
  return new Promise((resolve) => {
    try {
      const messagesData = readSalesScheduledMessages();
      const salesData = readSales();
      
      // Filter messages by date range if provided
      let filteredMessages = messagesData.scheduledMessages;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the end date fully
        
        filteredMessages = filteredMessages.filter(message => {
          const createdAt = message.scheduledTime ? new Date(message.scheduledTime) : null;
          if (!createdAt) return false;
          return createdAt >= start && createdAt <= end;
        });
      }
      
      // Count messages by status
      const statusCounts = {
        SCHEDULED: 0,
        SCHEDULED_FUTURE: 0,
        PENDING_FIRST_MESSAGE: 0,
        SENDING: 0,
        SENT: 0,
        DELIVERED: 0,
        READ: 0,
        FAILED: 0,
        CANCELED: 0
      };
      
      filteredMessages.forEach(message => {
        if (statusCounts.hasOwnProperty(message.status)) {
          statusCounts[message.status]++;
        }
      });
      
      // Count messages by message number
      const messageNumberCounts = {
        1: 0,
        2: 0
      };
      
      filteredMessages.forEach(message => {
        if (messageNumberCounts.hasOwnProperty(message.messageNumber)) {
          messageNumberCounts[message.messageNumber]++;
        }
      });
      
      // Count skipped schedules
      const skippedCount = salesData.sales.filter(sale => sale.schedulingSkipped).length;
      
      // Group messages by day for daily statistics
      const dailyStats = {};
      filteredMessages.forEach(message => {
        if (!message.scheduledTime) return;
        
        const day = new Date(message.scheduledTime).toISOString().split('T')[0];
        
        if (!dailyStats[day]) {
          dailyStats[day] = {
            SCHEDULED: 0,
            SCHEDULED_FUTURE: 0,
            PENDING_FIRST_MESSAGE: 0,
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
      
      resolve({
        totalMessages: filteredMessages.length,
        statusCounts,
        messageNumberCounts,
        skippedCount,
        dailyStats
      });
    } catch (error) {
      console.error('Error getting sales message statistics:', error);
      resolve({
        totalMessages: 0,
        statusCounts: {},
        messageNumberCounts: {},
        skippedCount: 0,
        dailyStats: {}
      });
    }
  });
}

// Get all user IDs
function getAllUserIds() {
  return new Promise((resolve) => {
    try {
      const usersData = readUsers();
      const userIds = usersData.users.map(user => user.id);
      resolve(userIds);
    } catch (error) {
      console.error('Error getting all user IDs:', error);
      resolve([1]); // Default to user ID 1 if there's an error
    }
  });
}

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
  deleteScheduledMessages,
  getUnsentScheduledMessages,
  cancelScheduledMessage,
  getAllScheduledMessages,
  canSendMessageNow,
  getSales,
  saveSales,
  updateSale,
  deleteSales,
  getLastFetchTime,
  getSalesTowns,
  getSalesSettings,
  updateSalesSettings,
  scheduleSalesMessages,
  getSalesScheduledMessages,
  updateSalesMessageStatus,
  cancelSalesScheduledMessage,
  deleteSalesScheduledMessages,
  getDueSalesMessages,
  getSalesMessageStatistics,
  getAllUserIds
}; 