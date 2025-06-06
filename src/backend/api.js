const { ipcMain } = require('electron');
const { 
  registerUser, 
  loginUser, 
  getUserSettings, 
  updateUserSettings,
  verifyToken
} = require('./db');

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
}

module.exports = { initApi }; 