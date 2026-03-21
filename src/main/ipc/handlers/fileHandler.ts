/**
 * CRA AI Assistant - File Operation IPC Handlers
 */

import { ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { FileInfo, FileStatus, FileType, Result } from '@shared/types';
import { StorageZone } from '@shared/types';
import { ok, err } from '@shared/types/core';
import { ErrorCode, createAppError } from '@shared/types/core';
import { getFileExtension, getFileTypeFromExtension } from '@shared/types/core';

// In-memory storage for files (will be replaced with FileStorage service)
const protocolFiles: Map<string, FileInfo> = new Map();
const subjectFiles: Map<string, FileInfo> = new Map();

let fileIdCounter = 1;

/**
 * Generate a unique file ID
 */
const generateFileId = (): string => {
  return `file_${Date.now()}_${fileIdCounter++}`;
};

/**
 * Get file info from path
 */
const getFileInfo = async (filePath: string): Promise<Partial<FileInfo>> => {
  const stats = await fs.stat(filePath);
  const name = path.basename(filePath);
  const extension = getFileExtension(name);
  const type = getFileTypeFromExtension(extension);

  return {
    name,
    path: filePath,
    size: stats.size,
    type,
  };
};

/**
 * Register file operation handlers
 */
export function registerFileHandlers(): void {
  // Upload file
  ipcMain.handle('file:upload', async (event, zone: StorageZone, filePath: string): Promise<Result<FileInfo>> => {
    try {
      // Validate file exists
      try {
        await fs.access(filePath);
      } catch {
        return err(createAppError(ErrorCode.FILE_NOT_FOUND, 'File not found'));
      }

      // Get file info
      const info = await getFileInfo(filePath);

      // Create file record
      const file: FileInfo = {
        id: generateFileId(),
        name: info.name!,
        path: info.path!,
        size: info.size!,
        type: info.type!,
        status: 'pending' as FileStatus,
        uploadedAt: new Date(),
        metadata: {},
      };

      // Store in appropriate zone
      const storage = zone === StorageZone.PROTOCOL ? protocolFiles : subjectFiles;
      storage.set(file.id, file);

      return ok(file);
    } catch (error) {
      return err(createAppError(
        ErrorCode.FILE_READ_ERROR,
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });

  // Delete file
  ipcMain.handle('file:delete', async (event, zone: StorageZone, fileId: string): Promise<Result<void>> => {
    try {
      const storage = zone === StorageZone.PROTOCOL ? protocolFiles : subjectFiles;

      if (!storage.has(fileId)) {
        return err(createAppError(ErrorCode.FILE_NOT_FOUND, 'File not found'));
      }

      storage.delete(fileId);
      return ok(undefined);
    } catch (error) {
      return err(createAppError(
        ErrorCode.STORAGE_ERROR,
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });

  // Get all files in a zone
  ipcMain.handle('file:getAll', async (event, zone: StorageZone): Promise<Result<FileInfo[]>> => {
    try {
      const storage = zone === StorageZone.PROTOCOL ? protocolFiles : subjectFiles;
      return ok(Array.from(storage.values()));
    } catch (error) {
      return err(createAppError(
        ErrorCode.STORAGE_ERROR,
        `Failed to get files: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });

  // Get file by ID
  ipcMain.handle('file:getById', async (event, zone: StorageZone, fileId: string): Promise<Result<FileInfo>> => {
    try {
      const storage = zone === StorageZone.PROTOCOL ? protocolFiles : subjectFiles;
      const file = storage.get(fileId);

      if (!file) {
        return err(createAppError(ErrorCode.FILE_NOT_FOUND, 'File not found'));
      }

      return ok(file);
    } catch (error) {
      return err(createAppError(
        ErrorCode.STORAGE_ERROR,
        `Failed to get file: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });

  // Update file status
  ipcMain.handle('file:updateStatus', async (event, zone: StorageZone, fileId: string, status: FileStatus, errorMessage?: string): Promise<Result<void>> => {
    try {
      const storage = zone === StorageZone.PROTOCOL ? protocolFiles : subjectFiles;
      const file = storage.get(fileId);

      if (!file) {
        return err(createAppError(ErrorCode.FILE_NOT_FOUND, 'File not found'));
      }

      file.status = status;
      if (status === 'completed') {
        file.processedAt = new Date();
      }
      if (errorMessage) {
        file.errorMessage = errorMessage;
      }

      return ok(undefined);
    } catch (error) {
      return err(createAppError(
        ErrorCode.STORAGE_ERROR,
        `Failed to update file status: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  });
}
