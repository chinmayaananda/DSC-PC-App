/**
 * Preload Script — Secure Context Bridge
 * Exposes a safe, limited API to the renderer process.
 * No raw Node.js APIs are exposed.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // File dialogs
  openFile: (options) => ipcRenderer.invoke('open-file-dialog', options || {}),
  saveFile: (options) => ipcRenderer.invoke('save-file-dialog', options || {}),
  openImage: () => ipcRenderer.invoke('open-image-dialog'),

  // Persistent settings store
  getStore: (key) => ipcRenderer.invoke('get-store', key),
  setStore: (key, value) => ipcRenderer.invoke('set-store', key, value),

  // Theme
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),

  // Backend URL
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),

  // Convenience: call backend API
  callBackend: async (endpoint, method = 'GET', body = null) => {
    const baseUrl = await ipcRenderer.invoke('get-backend-url');
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${endpoint}`, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },
});
