// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import {contextBridge, ipcRenderer} from 'electron';

const electronHandler = {
  ipcRenderer: {
    send: ipcRenderer.send,
    on: ipcRenderer.on,
    once: ipcRenderer.once,
    invoke: ipcRenderer.invoke,
    removeListener: ipcRenderer.removeListener,
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
