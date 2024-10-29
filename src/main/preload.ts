// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer } from 'electron';

const electronHandler = {
  ipcRenderer: {
    send: ipcRenderer.send.bind(ipcRenderer) as typeof ipcRenderer.send,
    sendSync: ipcRenderer.sendSync.bind(ipcRenderer) as typeof ipcRenderer.sendSync,
    on: ipcRenderer.on.bind(ipcRenderer) as typeof ipcRenderer.on,
    once: ipcRenderer.once.bind(ipcRenderer) as typeof ipcRenderer.once,
    invoke: ipcRenderer.invoke.bind(ipcRenderer) as typeof ipcRenderer.invoke,
    removeListener: ipcRenderer.removeListener.bind(
      ipcRenderer
    ) as typeof ipcRenderer.removeListener,
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
