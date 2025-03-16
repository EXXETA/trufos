import './logging/logger';

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { EnvironmentService } from 'main/environment/service/environment-service';
import 'main/event/main-event-service';
import path from 'node:path';
import quit from 'electron-squirrel-startup';
import { SettingsService } from './persistence/service/settings-service';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (quit) {
  app.quit();
}

const createWindow = async () => {
  // initialize services in correct order
  await SettingsService.instance.init();
  await EnvironmentService.instance.init();

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 728,
    minWidth: 1024,
    minHeight: 728,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Open links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window close event
  let isClosing = false;
  mainWindow.on('close', async (event) => {
    if (!isClosing) {
      isClosing = true;
      event.preventDefault();
      mainWindow?.webContents.send('before-close');

      // Wait for the renderer to respond or timeout
      try {
        await new Promise<void>((resolve, reject) => {
          ipcMain.once('ready-to-close', () => resolve());
          setTimeout(() => reject(new Error('Timeout')), 30000);
        });
      } catch (error) {
        console.error('Could not handle close event in renderer:', error);
      }

      // Close app
      mainWindow.close();
      app.quit();
    }
  });

  // Load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
