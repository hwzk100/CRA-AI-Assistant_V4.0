/**
 * CRA AI Assistant - Settings IPC Handlers
 */

import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { AppSettings, Result } from '@shared/types';
import { ok, err } from '@shared/types/core';
import { DEFAULT_SETTINGS, ErrorCode, createAppError } from '@shared/types/core';

const SETTINGS_FILE = 'settings.json';

let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };

/**
 * Load settings from disk
 */
async function loadSettings(): Promise<void> {
  try {
    const settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE);
    const data = await fs.readFile(settingsPath, 'utf-8');
    const loaded = JSON.parse(data);
    currentSettings = { ...DEFAULT_SETTINGS, ...loaded };
  } catch {
    // If file doesn't exist or is invalid, use defaults
    currentSettings = { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save settings to disk
 */
async function saveSettings(): Promise<void> {
  try {
    const userDataPath = app.getPath('userData');
    await fs.mkdir(userDataPath, { recursive: true });
    const settingsPath = path.join(userDataPath, SETTINGS_FILE);
    await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2), 'utf-8');
  } catch (error) {
    throw error;
  }
}

/**
 * Get current settings (synchronous, for internal use)
 */
export function getCurrentSettings(): AppSettings {
  return { ...currentSettings };
}

/**
 * Register settings handlers
 */
export function registerSettingsHandlers(): void {
  // Get current settings
  ipcMain.handle('settings:get', async (): Promise<Result<AppSettings>> => {
    try {
      await loadSettings();
      return ok({ ...currentSettings });
    } catch (error) {
      return err(createAppError(
        ErrorCode.STORAGE_ERROR,
        `Failed to get settings: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });

  // Set settings
  ipcMain.handle('settings:set', async (event, settings: Partial<AppSettings>): Promise<Result<AppSettings>> => {
    try {
      currentSettings = { ...currentSettings, ...settings };
      await saveSettings();
      return ok({ ...currentSettings });
    } catch (error) {
      return err(createAppError(
        ErrorCode.STORAGE_ERROR,
        `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });

  // Reset settings to defaults
  ipcMain.handle('settings:reset', async (): Promise<Result<AppSettings>> => {
    try {
      currentSettings = { ...DEFAULT_SETTINGS };
      await saveSettings();
      return ok({ ...currentSettings });
    } catch (error) {
      return err(createAppError(
        ErrorCode.STORAGE_ERROR,
        `Failed to reset settings: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });

  // Initialize settings on app start
  loadSettings().catch(console.error);
}
