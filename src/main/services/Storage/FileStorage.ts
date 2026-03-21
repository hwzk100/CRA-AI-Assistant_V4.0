/**
 * CRA AI Assistant - File Storage Service Implementation
 * Simple in-memory storage with optional file persistence
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import type { FileInfo, Result } from '@shared/types';
import { StorageZone } from '@shared/types';
import type { IStorageService } from './index';
import { ok, err } from '@shared/types/core';
import { ErrorCode, createAppError } from '@shared/types/core';
import { STORAGE_DIR_NAME, PROTOCOL_DIR_NAME, SUBJECT_DIR_NAME } from '@shared/constants';

export class FileStorageService implements IStorageService {
  private protocolFiles: Map<string, FileInfo> = new Map();
  private subjectFiles: Map<string, FileInfo> = new Map();
  private baseStoragePath: string;
  private isInitialized: boolean = false;

  constructor(basePath?: string) {
    this.baseStoragePath = basePath || '';
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.baseStoragePath) {
      try {
        // Create storage directories
        const protocolDir = path.join(this.baseStoragePath, STORAGE_DIR_NAME, PROTOCOL_DIR_NAME);
        const subjectDir = path.join(this.baseStoragePath, STORAGE_DIR_NAME, SUBJECT_DIR_NAME);

        await fs.mkdir(protocolDir, { recursive: true });
        await fs.mkdir(subjectDir, { recursive: true });
      } catch (error) {
        console.error('Failed to initialize storage directories:', error);
      }
    }

    this.isInitialized = true;
  }

  async storeFile(zone: StorageZone, file: FileInfo): Promise<Result<void>> {
    const storage = zone === StorageZone.PROTOCOL ? this.protocolFiles : this.subjectFiles;

    if (storage.has(file.id)) {
      return err(createAppError(ErrorCode.FILE_ALREADY_EXISTS, 'File already exists'));
    }

    storage.set(file.id, { ...file });
    return ok(undefined);
  }

  async getFile(zone: StorageZone, fileId: string): Promise<Result<FileInfo>> {
    const storage = zone === StorageZone.PROTOCOL ? this.protocolFiles : this.subjectFiles;
    const file = storage.get(fileId);

    if (!file) {
      return err(createAppError(ErrorCode.FILE_NOT_FOUND, 'File not found'));
    }

    return ok({ ...file });
  }

  async getAllFiles(zone: StorageZone): Promise<Result<FileInfo[]>> {
    const storage = zone === StorageZone.PROTOCOL ? this.protocolFiles : this.subjectFiles;
    return ok(Array.from(storage.values()).map(f => ({ ...f })));
  }

  async deleteFile(zone: StorageZone, fileId: string): Promise<Result<void>> {
    const storage = zone === StorageZone.PROTOCOL ? this.protocolFiles : this.subjectFiles;

    if (!storage.has(fileId)) {
      return err(createAppError(ErrorCode.FILE_NOT_FOUND, 'File not found'));
    }

    storage.delete(fileId);
    return ok(undefined);
  }

  async updateFile(zone: StorageZone, fileId: string, updates: Partial<FileInfo>): Promise<Result<void>> {
    const storage = zone === StorageZone.PROTOCOL ? this.protocolFiles : this.subjectFiles;
    const file = storage.get(fileId);

    if (!file) {
      return err(createAppError(ErrorCode.FILE_NOT_FOUND, 'File not found'));
    }

    storage.set(fileId, { ...file, ...updates });
    return ok(undefined);
  }

  async clearZone(zone: StorageZone): Promise<Result<void>> {
    const storage = zone === StorageZone.PROTOCOL ? this.protocolFiles : this.subjectFiles;
    storage.clear();
    return ok(undefined);
  }

  async dispose(): Promise<void> {
    this.protocolFiles.clear();
    this.subjectFiles.clear();
    this.isInitialized = false;
  }

  /**
   * Get storage path for a zone
   */
  getZonePath(zone: StorageZone): string {
    const dirName = zone === StorageZone.PROTOCOL ? PROTOCOL_DIR_NAME : SUBJECT_DIR_NAME;
    return path.join(this.baseStoragePath, STORAGE_DIR_NAME, dirName);
  }

  /**
   * Check if storage is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get file count for a zone
   */
  getZoneCount(zone: StorageZone): number {
    const storage = zone === StorageZone.PROTOCOL ? this.protocolFiles : this.subjectFiles;
    return storage.size;
  }
}
