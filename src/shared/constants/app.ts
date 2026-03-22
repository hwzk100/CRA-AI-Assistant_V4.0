/**
 * CRA AI Assistant - Application Constants
 */

import type { WorksheetType, FileFilter } from '../types';
export type { WorksheetType } from '../types/core';
export { DEFAULT_SETTINGS } from '../types/core';

// ============================================================================
// Application Info
// ============================================================================

export const APP_NAME = 'CRA AI Assistant';
export const APP_VERSION = '4.0.3';
export const APP_DESCRIPTION = 'Clinical Research Assistant powered by GLM-4 AI';
export const APP_AUTHOR = 'CRA AI Team';

// ============================================================================
// File Constraints
// ============================================================================

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.webp'];
export const MAX_FILES_PER_ZONE = 100;

// ============================================================================
// File Filters for Dialogs
// ============================================================================

export const FILE_FILTERS: Record<string, FileFilter[]> = {
  all: [
    { name: 'All Supported Files', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'bmp', 'webp'] },
    { name: 'All Files', extensions: ['*'] },
  ],
  pdf: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  image: [
    { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'webp'] },
  ],
  excel: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
};

// ============================================================================
// Worksheet Configuration
// ============================================================================

export const WORKSHEET_CONFIG: Record<
  WorksheetType,
  { title: string; description: string; icon: string; color: string }
> = {
  inclusionCriteria: {
    title: '入选标准',
    description: '研究方案的入选标准列表',
    icon: '✓',
    color: 'green',
  },
  exclusionCriteria: {
    title: '排除标准',
    description: '研究方案的排除标准列表',
    icon: '✗',
    color: 'red',
  },
  visitSchedule: {
    title: '访视计划',
    description: '临床试验访视时间表和检查项目',
    icon: '📅',
    color: 'blue',
  },
  subjectVisits: {
    title: '受试者访视',
    description: '受试者访视记录追踪',
    icon: '👤',
    color: 'purple',
  },
  medications: {
    title: '用药记录',
    description: '受试者用药记录管理',
    icon: '💊',
    color: 'orange',
  },
  subjectDemographics: {
    title: '受试者信息',
    description: '受试者人口统计学信息',
    icon: '👥',
    color: 'teal',
  },
};

// ============================================================================
// Storage Paths
// ============================================================================

export const STORAGE_DIR_NAME = 'cra-ai-assistant';
export const PROTOCOL_DIR_NAME = 'protocol';
export const SUBJECT_DIR_NAME = 'subject';
export const EXPORT_DIR_NAME = 'exports';

// ============================================================================
// AI Configuration
// ============================================================================

export const AI_DEFAULT_MODEL = 'glm-4';
export const AI_DEFAULT_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
export const AI_DEFAULT_TIMEOUT = 120000; // 2 minutes
export const AI_MAX_RETRIES = 3;
export const AI_RETRY_DELAY = 1000; // 1 second

// ============================================================================
// Processing Stages
// ============================================================================

export const PROCESSING_STAGES = {
  idle: 'idle',
  uploading: 'uploading',
  parsing: 'parsing',
  analyzing: 'analyzing',
  extracting: 'extracting',
  validating: 'validating',
  completing: 'completing',
  error: 'error',
} as const;

export const PROCESSING_STAGE_MESSAGES: Record<keyof typeof PROCESSING_STAGES, string> = {
  idle: '准备就绪',
  uploading: '正在上传文件...',
  parsing: '正在解析文件内容...',
  analyzing: 'AI 正在分析...',
  extracting: '正在提取数据...',
  validating: '正在验证数据...',
  completing: '处理完成',
  error: '处理出错',
};

// ============================================================================
// Excel Export Configuration
// ============================================================================

export const EXCEL_DEFAULT_AUTHOR = APP_NAME;
export const EXCEL_DEFAULT_TITLE = '临床试验追踪表';
export const EXCEL_DEFAULT_SUBJECT = 'Clinical Trial Tracker';
export const EXCEL_SHEET_NAMES = {
  inclusionCriteria: '入选标准',
  exclusionCriteria: '排除标准',
  visitSchedule: '访视计划',
  subjectVisits: '受试者访视',
  medications: '用药记录',
  subjectDemographics: '受试者信息',
} as const;

// ============================================================================
// UI Constants
// ============================================================================

export const UI_SIDEBAR_WIDTH = 240;
export const UI_HEADER_HEIGHT = 56;
export const UI_FOOTER_HEIGHT = 32;
export const UI_MIN_WIDTH = 1000;
export const UI_MIN_HEIGHT = 700;
export const UI_DEFAULT_WIDTH = 1400;
export const UI_DEFAULT_HEIGHT = 900;

// ============================================================================
// Validation Messages
// ============================================================================

export const VALIDATION_MESSAGES = {
  REQUIRED: '此字段为必填项',
  INVALID_EMAIL: '请输入有效的邮箱地址',
  INVALID_DATE: '请输入有效的日期',
  INVALID_NUMBER: '请输入有效的数字',
  MIN_LENGTH: (min: number) => `至少需要 ${min} 个字符`,
  MAX_LENGTH: (max: number) => `最多允许 ${max} 个字符`,
  INVALID_FILE_TYPE: '不支持的文件类型',
  FILE_TOO_LARGE: (max: number) => `文件大小不能超过 ${max}MB`,
} as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  FILE_NOT_FOUND: '文件不存在',
  FILE_READ_ERROR: '读取文件失败',
  FILE_INVALID_TYPE: '无效的文件类型',
  FILE_ALREADY_EXISTS: '文件已存在',
  AI_API_ERROR: 'AI 服务调用失败',
  AI_PARSE_ERROR: 'AI 响应解析失败',
  AI_TIMEOUT: 'AI 请求超时',
  AI_INVALID_RESPONSE: 'AI 返回无效响应',
  STORAGE_ERROR: '存储错误',
  STORAGE_QUOTA_EXCEEDED: '存储空间不足',
  EXCEL_GENERATION_ERROR: 'Excel 生成失败',
  VALIDATION_ERROR: '数据验证失败',
  INVALID_DATA_FORMAT: '无效的数据格式',
  UNKNOWN_ERROR: '未知错误',
  NETWORK_ERROR: '网络连接失败',
  API_KEY_MISSING: '请先配置 API Key',
  API_KEY_INVALID: 'API Key 无效',
} as const;

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  FILE_UPLOADED: '文件上传成功',
  FILE_DELETED: '文件删除成功',
  DATA_SAVED: '数据保存成功',
  EXCEL_EXPORTED: 'Excel 导出成功',
  SETTINGS_SAVED: '设置保存成功',
  CONNECTION_TESTED: '连接测试成功',
  DATA_IMPORTED: '数据导入成功',
} as const;

// ============================================================================
// Key Binding Constants (for future use)
// ============================================================================

export const KEY_BINDINGS = {
  SAVE: 'Ctrl+S',
  OPEN: 'Ctrl+O',
  EXPORT: 'Ctrl+E',
  NEW: 'Ctrl+N',
  DELETE: 'Delete',
  EDIT: 'Enter',
  CANCEL: 'Escape',
} as const;

// ============================================================================
// Date Format Constants
// ============================================================================

export const DATE_FORMATS = {
  DISPLAY: 'YYYY-MM-DD',
  DISPLAY_LONG: 'YYYY年MM月DD日',
  ISO: 'YYYY-MM-DDTHH:mm:ss.sssZ',
  EXCEL: 'YYYY-MM-DD',
} as const;

// ============================================================================
// Regular Expression Patterns
// ============================================================================

export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^1[3-9]\d{9}$/,
  SUBJECT_ID: /^[A-Z]{2}\d{4}$/,
  DATE: /^\d{4}-\d{2}-\d{2}$/,
  TIME: /^\d{2}:\d{2}$/,
} as const;

// ============================================================================
// PDF Processing Configuration
// ============================================================================

export const PDF_CONFIG = {
  MAX_PAGES_FOR_CONVERSION: 10,      // Limit pages to process
  SCANNED_TEXT_THRESHOLD: 100,       // Min chars to consider text-based
  MEANINGFUL_CHAR_RATIO: 0.3,        // Min ratio of meaningful chars
  TEMP_DIR: 'cra-ai-pdf-cache',      // Temp directory for images
  IMAGE_SCALE: 2.0,                   // Scale factor for PDF to image conversion
} as const;
