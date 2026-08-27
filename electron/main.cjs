const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs   = require('fs')

// Validación nativa e inequívoca de entorno de producción para Electron
const isProd   = app.isPackaged
const dataFile = () => path.join(app.getPath('userData'), 'cotiplus-data.json')

// ── IPC: file-based persistent storage ────────────────────────────────────
ipcMain.on('store:load', (event) => {
  try {
    const file = dataFile()
    if (fs.existsSync(file)) {
      event.returnValue = JSON.parse(fs.readFileSync(file, 'utf8'))
    } else {
      event.returnValue = {}
    }
  } catch {
    event.returnValue = {}
  }
})

ipcMain.on('store:save', (event, data) => {
  try {
    fs.writeFileSync(dataFile(), JSON.stringify(data), 'utf8')
    event.returnValue = true
  } catch (e) {
    console.error('store:save error', e)
    event.returnValue = false
  }
})

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'COTIPLUS — Sistema de Cotizaciones',
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, 'icons/icon.ico'), // <── AGREGA ESTA LÍNEA EXACTAMENTE AQUÍ
    show: false,
    webPreferences: {
      // Al estar en la carpeta 'electron', busca preload.js en su mismo directorio
      preload: path.join(__dirname, 'preload.js'), 
      nodeIntegration: false,
      contextIsolation: true,
    },
  })


  // Carga condicional infalible basada en el estado del empaquetado
  if (!isProd) {
    win.loadURL('http://localhost:5173')
  } else {
    // Sube un nivel ('..') para salir de 'electron' y entrar a 'dist' de forma correcta
    const indexProduccion = path.resolve(__dirname, '..', 'dist', 'index.html')
    win.loadFile(indexProduccion)
  }

  win.once('ready-to-show', () => win.show())
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

