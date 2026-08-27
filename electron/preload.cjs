const { contextBridge, ipcRenderer } = require('electron')

// Expose a reliable file-based store to the renderer process
contextBridge.exposeInMainWorld('cotiStore', {
  load: () => ipcRenderer.sendSync('store:load'),
  save: (data) => ipcRenderer.sendSync('store:save', data),
})
