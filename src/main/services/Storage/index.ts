/**
 * CRA AI Assistant - Storage Service Interface
 */

import type { FileInfo, StorageZone, Result } from '@shared/types';

export interface IStorageService {
  /**
   * Initialize the storage service
   */
  initialize(): Promise<void>;

  /**
   * Store a file in the specified zone
   */
  storeFile(zone: StorageZone, file: FileInfo): Promise<Result<void>>;

  /**
   * Retrieve a file by ID from the specified zone
   */
  getFile(zone: StorageZone, fileId: string): Promise<Result<FileInfo>>;

  /**
   * Get all files in the specified zone
   */
  getAllFiles(zone: StorageZone): Promise<Result<FileInfo[]>>;

  /**
   * Delete a file from the specified zone
   */
  deleteFile(zone: StorageZone, fileId: string): Promise<Result<void>>;

  /**
   * Update file metadata
   */
  updateFile(zone: StorageZone, fileId: string, updates: Partial<FileInfo>): Promise<Result<void>>;

  /**
   * Clear all files in a zone
   */
  clearZone(zone: StorageZone): Promise<Result<void>>;

  /**
   * Clean up resources
   */
  dispose(): Promise<void>;
}
