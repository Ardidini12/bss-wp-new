const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const os = require('os');

// Find the desktop path for any PC
const desktopPath = path.join(os.homedir(), 'Desktop');
const dbFolderPath = path.join(desktopPath, 'bss-wp-db');
const dbFilePath = path.join(dbFolderPath, 'bss-wp.db');

// Create database folder if it doesn't exist
if (!fs.existsSync(dbFolderPath)) {
  fs.mkdirSync(dbFolderPath, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(dbFilePath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    createTables();
  }
});

// Create necessary tables
function createTables() {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('Users table created or already exists.');
    }
  });

  // User settings table
  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    theme TEXT DEFAULT 'system',
    remember_me BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )`, (err) => {
    if (err) {
      console.error('Error creating user_settings table:', err.message);
    } else {
      console.log('User settings table created or already exists.');
    }
  });
}

// User registration
function registerUser(username, password) {
  return new Promise((resolve, reject) => {
    // Hash the password
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        reject(err);
        return;
      }

      // Insert user into database
      db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, 
        [username, hash], 
        function(err) {
          if (err) {
            reject(err);
            return;
          }

          // Create default settings for the user
          db.run(`INSERT INTO user_settings (user_id, theme, remember_me) VALUES (?, ?, ?)`,
            [this.lastID, 'system', 0],
            (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve({ id: this.lastID, username });
            }
          );
        }
      );
    });
  });
}

// User login
function loginUser(username, password) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
      if (err) {
        reject(err);
        return;
      }

      if (!user) {
        reject(new Error('User not found'));
        return;
      }

      // Compare password
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          reject(err);
          return;
        }

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
      });
    });
  });
}

// Get user settings
function getUserSettings(userId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM user_settings WHERE user_id = ?`, [userId], (err, settings) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(settings || { theme: 'system', remember_me: 0 });
    });
  });
}

// Update user settings
function updateUserSettings(userId, settings) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE user_settings SET theme = ?, remember_me = ? WHERE user_id = ?`,
      [settings.theme, settings.remember_me ? 1 : 0, userId],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ changes: this.changes });
      }
    );
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

module.exports = {
  db,
  registerUser,
  loginUser,
  getUserSettings,
  updateUserSettings,
  verifyToken
}; 