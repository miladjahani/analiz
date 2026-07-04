const { contextBridge, ipcRenderer } = require('electron');

// ایجاد پل امن بین renderer و main process
contextBridge.exposeInMainWorld('electronAPI', {
  // ذخیره فایل
  saveFile: (content) => ipcRenderer.invoke('save-file', { content }),
  
  // باز کردن فایل
  openFile: () => ipcRenderer.invoke('open-file'),
  
  // ذخیره تصویر
  saveImage: (imageData) => ipcRenderer.invoke('save-image', imageData),
  
  // ذخیره PDF
  savePDF: (htmlContent) => ipcRenderer.invoke('save-pdf', htmlContent),
  
  // اطلاعات برنامه
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // کنترل پنجره
  closeApp: () => ipcRenderer.invoke('close-app'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  
  // تشخیص اینکه در محیط دسکتاپ هستیم
  isDesktop: true,
  platform: process.platform
});
