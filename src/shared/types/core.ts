/**
 * CRA AI Assistant - Core Type Definitions
 */

// ============================================================================
// Result Type - Functional Error Handling
// ============================================================================

export type Result<T, E extends AppError = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export const ok = <T>(data: T): Result<T> => ({ success: true, data });
export const err = <E extends AppError>(error: E): Result<never, E> => ({ success: false, error });

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorCode {
  // File errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_INVALID_TYPE = 'FILE_INVALID_TYPE',
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',

  // AI errors
  AI_API_ERROR = 'AI_API_ERROR',
  AI_PARSE_ERROR = 'AI_PARSE_ERROR',
  AI_TIMEOUT = 'AI_TIMEOUT',
  AI_INVALID_RESPONSE = 'AI_INVALID_RESPONSE',

  // Storage errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',

  // Excel errors
  EXCEL_GENERATION_ERROR = 'EXCEL_GENERATION_ERROR',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_DATA_FORMAT = 'INVALID_DATA_FORMAT',

  // System errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export class AppException extends Error implements AppError {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppException';
  }
}

// ============================================================================
// Storage Zone
// ============================================================================

export enum StorageZone {
  PROTOCOL = 'protocol',
  SUBJECT = 'subject',
}

// ============================================================================
// File Status
// ============================================================================

export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// ============================================================================
// File Type
// ============================================================================

export enum FileType {
  PDF = 'pdf',
  IMAGE = 'image',
  WORD = 'word',
  EXCEL = 'excel',
  UNKNOWN = 'unknown',
}

// ============================================================================
// File Info Interface
// ============================================================================

export interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  type: FileType;
  status: FileStatus;
  uploadedAt: Date;
  processedAt?: Date;
  errorMessage?: string;
  metadata?: FileMetadata;
}

export interface FileMetadata {
  pageCount?: number;
  author?: string;
  creationDate?: Date;
  modificationDate?: Date;
  [key: string]: unknown;
}

// ============================================================================
// IPC Channel Types
// ============================================================================

export type IPCChannel =
  // File operations
  | 'file:upload'
  | 'file:delete'
  | 'file:getAll'
  | 'file:getById'
  // AI operations
  | 'ai:testConnection'
  | 'ai:extractCriteria'
  | 'ai:extractVisitSchedule'
  | 'ai:recognizeMedications'
  | 'ai:extractSubjectNumber'
  | 'ai:extractSubjectVisitDates'
  | 'ai:extractSubjectVisitItems'
  | 'ai:extractFromImage'
  // Excel operations
  | 'excel:exportTracker'
  // Settings operations
  | 'settings:get'
  | 'settings:set'
  | 'settings:reset'
  // System operations
  | 'system:getVersion'
  | 'system:openExternal'
  // Dialog operations
  | 'dialog:openFile'
  | 'dialog:saveFile';

// ============================================================================
// IPC Request/Response Types
// ============================================================================

export type IPCRequestPayload = {
  'file:upload': { zone: StorageZone; filePath: string };
  'file:delete': { zone: StorageZone; fileId: string };
  'file:getAll': { zone: StorageZone };
  'file:getById': { zone: StorageZone; fileId: string };
  'ai:testConnection': { apiKey: string };
  'ai:extractCriteria': { fileId: string; pdfContent: string };
  'ai:extractVisitSchedule': { fileId: string; pdfContent: string };
  'ai:recognizeMedications': { fileId: string; content: string };
  'ai:extractSubjectNumber': { fileId: string; content: string };
  'ai:extractSubjectVisitDates': { fileId: string; content: string };
  'ai:extractSubjectVisitItems': { fileId: string; content: string; visitType: string };
  'ai:extractFromImage': { imagePath: string; prompt: string };
  'excel:exportTracker': { data: ExcelExportData; options: ExcelExportOptions };
  'settings:get': undefined;
  'settings:set': { settings: Partial<AppSettings> };
  'settings:reset': undefined;
  'system:getVersion': undefined;
  'system:openExternal': { url: string };
  'dialog:openFile': { filters: FileFilter[] };
  'dialog:saveFile': { defaultPath: string; filters: FileFilter[] };
};

export type IPCResponsePayload<T extends IPCChannel> = Result<any, AppError>;

// ============================================================================
// Settings Types
// ============================================================================

export interface AppSettings {
  // API Configuration
  apiKey: string;
  apiEndpoint: string;
  modelName: string;

  // Storage Configuration
  storagePath: string;
  maxFileSize: number;

  // Processing Configuration
  processingTimeout: number;
  retryAttempts: number;

  // UI Preferences
  theme: 'light' | 'dark' | 'system';
  language: 'zh' | 'en';
  autoSave: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '', // User needs to provide their own API key
  apiEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  modelName: 'glm-4',
  storagePath: '',
  maxFileSize: 50 * 1024 * 1024, // 50MB
  processingTimeout: 120000, // 2 minutes
  retryAttempts: 3,
  theme: 'system',
  language: 'zh',
  autoSave: true,
};

// ============================================================================
// File Filter Type
// ============================================================================

export interface FileFilter {
  name: string;
  extensions: string[];
}

// ============================================================================
// Worksheet Base Types
// ============================================================================

export interface InclusionCriteria {
  id: string;
  category: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExclusionCriteria {
  id: string;
  category: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VisitSchedule {
  id: string;
  visitType: string;
  visitDay: string;
  visitWindow: string;
  description: string;
  items: VisitItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VisitItem {
  id: string;
  name: string;
  category: string;
  required: boolean;
  description?: string;
}

export interface MedicationRecord {
  id: string;
  subjectId: string;
  visitType: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type WorksheetType =
  | 'inclusionCriteria'
  | 'exclusionCriteria'
  | 'visitSchedule'
  | 'subjectVisits'
  | 'medications';

// ============================================================================
// Excel Export Types (forward reference from worksheet.ts)
// ============================================================================

export interface ExcelExportData {
  inclusionCriteria: InclusionCriteria[];
  exclusionCriteria: ExclusionCriteria[];
  visitSchedule: VisitSchedule[];
  subjectVisits: SubjectVisitData[];
  medications: MedicationRecord[];
}

export interface ExcelExportOptions {
  outputPath?: string;
  fileName?: string;
  author?: string;
  title?: string;
  subject?: string;
}

export interface ExcelExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

// ============================================================================
// Subject Visit Data (from worksheet.ts)
// ============================================================================

export interface SubjectVisitData {
  subjectId: string;
  visits: SubjectVisitItemData[];
}

export interface SubjectVisitItemData {
  visitType: string;
  plannedDate?: Date;
  actualDate?: Date;
  status: 'planned' | 'completed' | 'missed' | 'cancelled';
  notes?: string;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code?: string;
}

// ============================================================================
// Edit State (for tracking edits)
// ============================================================================

export interface EditState<T> {
  original: T;
  current: T;
  isDirty: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

export const createAppError = (code: ErrorCode, message: string, details?: unknown): AppError => ({
  code,
  message,
  details,
});

export const isFileOfType = (file: FileInfo, type: FileType): boolean => {
  return file.type === type;
};

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export const getFileTypeFromExtension = (extension: string): FileType => {
  const ext = extension.toLowerCase();
  switch (ext) {
    case 'pdf':
      return FileType.PDF;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'webp':
      return FileType.IMAGE;
    case 'doc':
    case 'docx':
      return FileType.WORD;
    case 'xls':
    case 'xlsx':
      return FileType.EXCEL;
    default:
      return FileType.UNKNOWN;
  }
};
