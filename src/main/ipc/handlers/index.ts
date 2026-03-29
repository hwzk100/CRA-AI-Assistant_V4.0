/**
 * CRA AI Assistant - IPC Handlers Registration
 * Central registration point for all IPC handlers
 */

import { ipcMain } from 'electron';
import { registerFileHandlers } from './fileHandler';
import { registerSettingsHandlers } from './settingsHandler';
import { registerSystemHandlers } from './systemHandler';
import { registerAIHandlers } from './aiHandler';
import { registerExcelHandlers } from './excelHandler';
import { registerDialogHandlers } from './dialogHandler';

export function registerIPCHandlers(): void {
  registerFileHandlers();
  registerSettingsHandlers();
  registerSystemHandlers();
  registerAIHandlers();
  registerExcelHandlers();
  registerDialogHandlers();
}
