/**
 * CRA AI Assistant - Dialog IPC Handlers
 * Handles file open/save dialogs
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';

/**
 * Register dialog handlers
 */
export function registerDialogHandlers(): void {
  // Open file dialog
  ipcMain.handle('dialog:openFile', async (event, filters: Electron.FileFilter[]) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, filePaths: [] };
    }

    return { canceled: false, filePaths: result.filePaths };
  });

  // Save file dialog
  ipcMain.handle('dialog:saveFile', async (event, defaultPath: string, filters: Electron.FileFilter[]) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: defaultPath || '',
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true, filePath: '' };
    }

    return { canceled: false, filePath: result.filePath };
  });
}
