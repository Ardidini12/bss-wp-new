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
  verifyToken
}; 