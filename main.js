const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, 'icon.png'),
    frame: true,
    backgroundColor: '#ffffff'
  });

  mainWindow.loadFile('index.html');

  // حذف منوی پیش‌فرض برای ظاهر تمیزتر (اختیاری)
  // mainWindow.setMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers برای ارتباط با فایل سیستم

// ذخیره فایل
ipcMain.handle('save-file', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'ذخیره نتایج آنالیز',
    defaultPath: 'grain-analysis-result.txt',
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, data.content);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// باز کردن فایل
ipcMain.handle('open-file', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'باز کردن فایل نتایج',
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Text Files', extensions: ['txt', 'csv'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      return { success: true, content, path: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// ذخیره تصویر
ipcMain.handle('save-image', async (event, imageData) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'ذخیره تصویر آنالیز',
    defaultPath: 'grain-analysis.png',
    filters: [
      { name: 'PNG Images', extensions: ['png'] },
      { name: 'JPEG Images', extensions: ['jpg', 'jpeg'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    try {
      const base64Data = imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
      fs.writeFileSync(result.filePath, base64Data, 'base64');
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// ذخیره PDF (ساده)
ipcMain.handle('save-pdf', async (event, htmlContent) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'ذخیره گزارش PDF',
    defaultPath: 'grain-analysis-report.pdf',
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    try {
      // در نسخه ساده، محتوا را به عنوان HTML ذخیره می‌کنیم
      // برای PDF واقعی نیاز به کتابخانه‌ای مانند pdfkit است
      fs.writeFileSync(result.filePath.replace('.pdf', '.html'), htmlContent);
      return { 
        success: true, 
        path: result.filePath.replace('.pdf', '.html'),
        message: 'گزارش به صورت HTML ذخیره شد. می‌توانید آن را در مرورگر باز کرده و به PDF تبدیل کنید.'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// دریافت اطلاعات برنامه
ipcMain.handle('get-app-info', () => {
  return {
    name: 'Grain Size Analyzer',
    version: '2.0.0',
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node
  };
});

// بستن برنامه
ipcMain.handle('close-app', () => {
  app.quit();
});

// کمینه کردن پنجره
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

// بیشینه/عادی کردن پنجره
ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});
