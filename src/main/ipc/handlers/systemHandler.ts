/**
 * CRA AI Assistant - System IPC Handlers
 */

import { ipcMain, shell, app } from 'electron';
import type { Result } from '@shared/types';
import { ok, err } from '@shared/types/core';
import { ErrorCode, createAppError } from '@shared/types/core';
import { APP_VERSION } from '@shared/constants';

/**
 * Register system handlers
 */
export function registerSystemHandlers(): void {
  // Get app version
  ipcMain.handle('system:getVersion', async (): Promise<Result<{ version: string; electronVersion: string }>> => {
    try {
      return ok({
        version: APP_VERSION,
        electronVersion: process.versions.electron,
      });
    } catch (error) {
      return err(createAppError(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to get version: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });

  // Open external URL
  ipcMain.handle('system:openExternal', async (event, url: string): Promise<Result<void>> => {
    try {
      await shell.openExternal(url);
      return ok(undefined);
    } catch (error) {
      return err(createAppError(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to open URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });

  // Get app path
  ipcMain.handle('system:getAppPath', async (event, name: 'home' | 'appData' | 'userData' | 'temp' | 'downloads'): Promise<Result<string>> => {
    try {
      const appPath = app.getPath(name);
      return ok(appPath);
    } catch (error) {
      return err(createAppError(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to get app path: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });
}
