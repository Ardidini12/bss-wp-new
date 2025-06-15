const { app, BrowserWindow, ipcMain, nativeTheme, Menu, Tray } = require('electron');
const path = require('node:path');
const fs = require('fs');
const { initApi, setupSalesAPI } = require('./backend/api');
const { getAppTheme, setAppTheme } = require('./backend/store');
const { 
  initWhatsAppHandlers, 
  initWhatsAppForExistingSessions,
  startMessageScheduler,
  findExistingSessionUserIds
} = require('./backend/whatsappService');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Global references
global.mainWindow = null;
let tray = null;

// Find the logo file
const findLogoPath = () => {
  // Try different possible locations - only use PNG format
  const possiblePaths = [
    path.join(__dirname, 'assets', 'Logo-BSS.png'),
    path.join(app.getAppPath(), 'src', 'assets', 'Logo-BSS.png'),
    path.join(process.cwd(), 'src', 'assets', 'Logo-BSS.png')
  ];
  
  for (const logoPath of possiblePaths) {
    if (fs.existsSync(logoPath)) {
      console.log('Using logo from:', logoPath);
      return logoPath;
    }
  }
  
  console.error('Logo file not found in any of the expected locations');
  return null;
};

const logoPath = findLogoPath();

// Create dist directory if it doesn't exist
const ensureDistDirectory = () => {
  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Copy CSS file to dist directory if it doesn't exist
  const srcCssPath = path.join(__dirname, 'index.css');
  const distCssPath = path.join(distDir, 'index.css');
  
  if (fs.existsSync(srcCssPath) && !fs.existsSync(distCssPath)) {
    try {
      fs.copyFileSync(srcCssPath, distCssPath);
      console.log('Copied CSS to:', distCssPath);
    } catch (error) {
      console.error('Error copying CSS:', error);
    }
  }
};

const createWindow = () => {
  // Create the browser window.
  global.mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      additionalArguments: [
        `--js-flags=--max-old-space-size=4096`,
        `--disable-web-security`
      ]
    },
    icon: logoPath,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    show: false
  });

  // Disable CSP completely
  global.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [],
        'Content-Security-Policy-Report-Only': []
      }
    });
  });

  // Load the index.html of the app
  global.mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Apply theme from settings
  const theme = getAppTheme();
  if (theme === 'dark') {
    nativeTheme.themeSource = 'dark';
  } else if (theme === 'light') {
    nativeTheme.themeSource = 'light';
  } else {
    nativeTheme.themeSource = 'system';
  }

  // Open the DevTools in development
  if (process.env.NODE_ENV === 'development') {
    global.mainWindow.webContents.openDevTools();
  }
  
  // Add keyboard shortcut to open DevTools (Ctrl+Shift+I or F12)
  global.mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || 
        (input.key === 'I' && input.control && input.shift)) {
      global.mainWindow.webContents.openDevTools();
    }
  });
  
  // Show the window once it's ready
  global.mainWindow.once('ready-to-show', () => {
    global.mainWindow.show();
    global.mainWindow.focus();
    
    // Initialize WhatsApp for all users with existing sessions immediately
    initWhatsAppForExistingSessions();
  });
  
  // Handle window close event - hide instead of close
  global.mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      global.mainWindow.hide();
      return false;
    }
  });
};

// Create tray icon
const createTray = () => {
  // Only create tray if we have a logo
  if (!logoPath) {
    console.error('Cannot create tray without logo');
    return;
  }

  try {
    tray = new Tray(logoPath);
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Open BSS App', 
        click: () => {
          if (global.mainWindow === null) {
            createWindow();
          } else {
            global.mainWindow.show();
          }
        } 
      },
      { type: 'separator' },
      { 
        label: 'Quit', 
        click: () => {
          app.isQuitting = true;
          app.quit();
        } 
      }
    ]);
    
    tray.setToolTip('BSS Desktop App');
    tray.setContextMenu(contextMenu);
    
    // Double-click to show the app
    tray.on('double-click', () => {
      if (global.mainWindow === null) {
        createWindow();
      } else {
        global.mainWindow.show();
      }
    });
  } catch (error) {
    console.error('Error creating tray:', error);
  }
};

// Start message schedulers for all existing sessions
const startAllMessageSchedulers = () => {
  try {
    const userIds = findExistingSessionUserIds();
    console.log(`Starting message schedulers for ${userIds.length} users`);
    
    for (const userId of userIds) {
      startMessageScheduler(userId).catch(err => {
        console.error(`Error starting message scheduler for user ${userId}:`, err);
      });
    }
  } catch (err) {
    console.error('Error starting message schedulers:', err);
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  ensureDistDirectory();
  createWindow();
  createTray();
  
  // Setup API handlers
  initApi(ipcMain);
  
  // Setup WhatsApp handlers
  initWhatsAppHandlers(ipcMain);
  
  // Setup Sales API
  setupSalesAPI(ipcMain);
  
  // Start message schedulers
  startAllMessageSchedulers();
  
  // Handle theme changes
  ipcMain.handle('set-theme', (event, theme) => {
    nativeTheme.themeSource = theme;
    setAppTheme(theme);
    return { success: true, theme };
  });
  
  // Window control handlers
  ipcMain.handle('minimize-app', () => {
    if (global.mainWindow) {
      global.mainWindow.minimize();
      return { success: true };
    }
    return { success: false, error: 'Window not available' };
  });
  
  ipcMain.handle('maximize-app', () => {
    if (global.mainWindow) {
      if (global.mainWindow.isMaximized()) {
        global.mainWindow.unmaximize();
      } else {
        global.mainWindow.maximize();
      }
      return { success: true, maximized: global.mainWindow.isMaximized() };
    }
    return { success: false, error: 'Window not available' };
  });
  
  ipcMain.handle('close-app', () => {
    if (global.mainWindow) {
      global.mainWindow.hide();
      return { success: true };
    }
    return { success: false, error: 'Window not available' };
  });
  
  // Get app version
  ipcMain.handle('get-app-version', () => {
    return { success: true, version: app.getVersion() };
  });

  // File system access handlers
  ipcMain.handle('open-file-dialog', async (event, options) => {
    try {
      if (!global.mainWindow) {
        return { success: false, error: 'Main window not available' };
      }
      
      const { dialog } = require('electron');
      
      // Set default options if not provided
      const dialogOptions = {
        title: options.title || 'Select File',
        properties: options.properties || ['openFile'],
        filters: options.filters || [
          { name: 'All Files', extensions: ['*'] }
        ]
      };
      
      const result = await dialog.showOpenDialog(global.mainWindow, dialogOptions);
      
      return {
        success: !result.canceled,
        filePaths: result.filePaths,
        canceled: result.canceled
      };
    } catch (error) {
      console.error('Error showing file dialog:', error);
      return { success: false, error: error.message };
    }
  });

  // Debug IPC calls
  ipcMain.on('debug-log', (event, data) => {
    console.log('DEBUG:', data);
  });
  
  // Debug handler to log all IPC calls
  const originalHandle = ipcMain.handle;
  ipcMain.handle = function(channel, listener) {
    return originalHandle.call(ipcMain, channel, (event, ...args) => {
      console.log(`IPC call to ${channel} with args:`, JSON.stringify(args));
      return listener(event, ...args);
    });
  };

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Modify window-all-closed to keep app running in background
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    // On macOS, keep the app running even with all windows closed
    // This is standard macOS behavior
  } else {
    // On Windows and Linux, the app will continue running with the tray icon
    // Do not quit the app when all windows are closed
  }
});

// Set proper quit behavior when the app is about to quit
app.on('before-quit', () => {
  app.isQuitting = true;
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
