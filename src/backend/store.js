const { app } = require('electron');
const Store = require('electron-store').default;

// User data store (for remember me functionality)
const userStore = new Store({
  name: 'user-credentials',
  encryptionKey: 'bss-app-encryption-key' // For basic security
});

// User session store (for active sessions)
const sessionStore = new Store({
  name: 'user-session',
  encryptionKey: 'bss-app-session-key'
});

// App settings store
const settingsStore = new Store({
  name: 'app-settings',
  defaults: {
    theme: 'system', // Default theme
    animations: {
      enabled: true,
      speed: 'normal'
    }
  }
});

// Store user credentials for "remember me" feature
function saveUserCredentials(username, password) {
  userStore.set('credentials', { username, password });
}

// Clear saved credentials
function clearUserCredentials() {
  userStore.delete('credentials');
}

// Get saved credentials
function getSavedCredentials() {
  return userStore.get('credentials');
}

// Store active session
function saveSession(token, user) {
  sessionStore.set('session', { token, user });
}

// Clear active session
function clearSession() {
  sessionStore.delete('session');
}

// Get active session
function getActiveSession() {
  return sessionStore.get('session');
}

// Save app theme
function setAppTheme(theme) {
  settingsStore.set('theme', theme);
}

// Get app theme
function getAppTheme() {
  return settingsStore.get('theme');
}

// Set animation preferences
function setAnimationPrefs(prefs) {
  settingsStore.set('animations', prefs);
}

// Get animation preferences
function getAnimationPrefs() {
  return settingsStore.get('animations');
}

module.exports = {
  saveUserCredentials,
  clearUserCredentials,
  getSavedCredentials,
  saveSession,
  clearSession,
  getActiveSession,
  setAppTheme,
  getAppTheme,
  setAnimationPrefs,
  getAnimationPrefs
}; 