const { app, BrowserWindow, ipcMain, nativeTheme, Menu, Tray } = require('electron');
const path = require('node:path');
const fs = require('fs');
const { initApi } = require('./backend/api');
const { getAppTheme, setAppTheme } = require('./backend/store');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Global references
let mainWindow = null;
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

// Copy logo to webpack output directory
const copyLogoToOutput = () => {
  if (!logoPath) return;
  
  const outputDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, path.basename(logoPath));
  if (!fs.existsSync(outputPath)) {
    try {
      fs.copyFileSync(logoPath, outputPath);
      console.log('Copied logo to:', outputPath);
    } catch (error) {
      console.error('Error copying logo:', error);
    }
  }
};

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: logoPath,
    frame: false, // Frameless window for custom titlebar
    transparent: false,
    backgroundColor: '#ffffff',
    show: false // Don't show until ready-to-show
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

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
    mainWindow.webContents.openDevTools();
  }
  
  // Show the window once it's ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  
  // Handle window close event - hide instead of close
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
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
          if (mainWindow === null) {
            createWindow();
          } else {
            mainWindow.show();
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
      if (mainWindow === null) {
        createWindow();
      } else {
        mainWindow.show();
      }
    });
  } catch (error) {
    console.error('Error creating tray:', error);
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Initialize the backend API
  initApi();
  
  // Copy logo file for use in webpack output
  copyLogoToOutput();

  // Handle theme changes
  ipcMain.handle('set-theme', (event, theme) => {
    nativeTheme.themeSource = theme;
    setAppTheme(theme);
    return { success: true, theme };
  });
  
  // Window control handlers
  ipcMain.handle('minimize-app', () => {
    if (mainWindow) {
      mainWindow.minimize();
      return { success: true };
    }
    return { success: false, error: 'Window not available' };
  });
  
  ipcMain.handle('maximize-app', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return { success: true, maximized: mainWindow.isMaximized() };
    }
    return { success: false, error: 'Window not available' };
  });
  
  ipcMain.handle('close-app', () => {
    if (mainWindow) {
      mainWindow.hide();
      return { success: true };
    }
    return { success: false, error: 'Window not available' };
  });
  
  // Get app version
  ipcMain.handle('get-app-version', () => {
    return { success: true, version: app.getVersion() };
  });

  createWindow();
  createTray();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
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
