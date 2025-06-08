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
function getContacts(page = 1, limit = 100, search = "") {
  return new Promise((resolve, reject) => {
    try {
      const contactsData = readContacts();
      let filteredContacts = contactsData.contacts;
      
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
  canSendMessageNow
}; 