import { app, safeStorage, dialog, BrowserWindow, ipcMain } from 'electron';

const result = safeStorage.encryptString('test');
console.log('encryptString result:', JSON.stringify(result));
console.log('encryptString typeof:', typeof result);

const path = app.getPath('userData');
console.log('getPath result:', JSON.stringify(path));
