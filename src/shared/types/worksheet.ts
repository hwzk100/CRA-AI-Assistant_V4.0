/**
 * CRA AI Assistant - Worksheet Type Definitions
 * Extended types for worksheet-specific functionality
 */

import type {
  InclusionCriteria,
  ExclusionCriteria,
  VisitSchedule,
  MedicationRecord,
  WorksheetType,
} from './core';

// ============================================================================
// Subject Visit Data
// ============================================================================

export interface SubjectVisitData {
  id: string;
  subjectId: string;
  subjectNumber: string;
  screeningNumber?: string;
  randomizationNumber?: string;
  visits: SubjectVisitItemData[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SubjectVisitItemData {
  id: string;
  visitType: string;
  visitDay?: string;
  plannedDate?: Date;
  actualDate?: Date;
  status: VisitStatus;
  completionPercentage?: number;
  notes?: string;
  items?: VisitItemDetail[];
}

export type VisitStatus = 'planned' | 'scheduled' | 'completed' | 'missed' | 'cancelled' | 'pending';

export interface VisitItemDetail {
  id: string;
  name: string;
  category: string;
  required: boolean;
  completed: boolean;
  value?: string | number | boolean;
  unit?: string;
  notes?: string;
}

// ============================================================================
// Worksheet Row Type (for editable tables)
// ============================================================================

export type WorksheetRow =
  | InclusionCriteriaRow
  | ExclusionCriteriaRow
  | VisitScheduleRow
  | SubjectVisitRow
  | MedicationRow;

export interface InclusionCriteriaRow {
  id: string;
  category: string;
  description: string;
}

export interface ExclusionCriteriaRow {
  id: string;
  category: string;
  description: string;
}

export interface VisitScheduleRow {
  id: string;
  visitType: string;
  visitDay: string;
  visitWindow: string;
  description: string;
  items: string; // JSON stringified array
}

export interface SubjectVisitRow {
  id: string;
  subjectId: string;
  visitType: string;
  plannedDate: string;
  actualDate?: string;
  status: string;
  notes?: string;
}

export interface MedicationRow {
  id: string;
  subjectId: string;
  visitType: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}

// ============================================================================
// Excel Export Types
// ============================================================================

export interface ExcelExportOptions {
  outputPath?: string;
  fileName?: string;
  author?: string;
  title?: string;
  subject?: string;
  keywords?: string;
  category?: string;
  comments?: string;
  includeEmptySheets?: boolean;
  freezeHeaderRow?: boolean;
  autoFilter?: boolean;
}

export interface ExcelExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  bytesWritten?: number;
  sheetCount?: number;
}

export interface ExcelSheetConfig {
  name: string;
  title?: string;
  description?: string;
  columns: ExcelColumn[];
  data: unknown[];
}

export interface ExcelColumn {
  key: string;
  header: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  format?: string;
  enumValues?: Record<string, string>;
  required?: boolean;
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
  row?: number;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code?: string;
  row?: number;
}

// ============================================================================
// Edit State (for tracking edits in worksheets)
// ============================================================================

export interface EditState<T> {
  original: T;
  current: T;
  isDirty: boolean;
  hasErrors: boolean;
  errors: Record<string, string>;
}

export type EditableField<T> = {
  [K in keyof T]?: T[K] | EditValue<T[K]>;
};

export type EditValue<T> = T extends string
  ? string
  : T extends number
  ? number | string
  : T extends Date
  ? Date | string
  : T extends boolean
  ? boolean | string
  : T;

// ============================================================================
// Worksheet Metadata
// ============================================================================

export interface WorksheetMetadata {
  type: WorksheetType;
  title: string;
  description: string;
  icon: string;
  rowCount: number;
  lastModified: Date;
  isEmpty: boolean;
}

export const WORKSHEET_METADATA: Record<WorksheetType, WorksheetMetadata> = {
  inclusionCriteria: {
    type: 'inclusionCriteria',
    title: '入选标准',
    description: '研究方案的入选标准列表',
    icon: '✓',
    rowCount: 0,
    lastModified: new Date(),
    isEmpty: true,
  },
  exclusionCriteria: {
    type: 'exclusionCriteria',
    title: '排除标准',
    description: '研究方案的排除标准列表',
    icon: '✗',
    rowCount: 0,
    lastModified: new Date(),
    isEmpty: true,
  },
  visitSchedule: {
    type: 'visitSchedule',
    title: '访视计划',
    description: '临床试验访视时间表和检查项目',
    icon: '📅',
    rowCount: 0,
    lastModified: new Date(),
    isEmpty: true,
  },
  subjectVisits: {
    type: 'subjectVisits',
    title: '受试者访视',
    description: '受试者访视记录追踪',
    icon: '👤',
    rowCount: 0,
    lastModified: new Date(),
    isEmpty: true,
  },
  medications: {
    type: 'medications',
    title: '用药记录',
    description: '受试者用药记录管理',
    icon: '💊',
    rowCount: 0,
    lastModified: new Date(),
    isEmpty: true,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for new items
 */
export const generateId = (prefix: string = ''): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
};

/**
 * Deep clone an item for editing
 */
export const cloneItem = <T>(item: T): T => {
  return JSON.parse(JSON.stringify(item));
};

/**
 * Create an empty edit state
 */
export const createEditState = <T>(original: T): EditState<T> => {
  return {
    original,
    current: cloneItem(original),
    isDirty: false,
    hasErrors: false,
    errors: {},
  };
};

/**
 * Check if two values are equal
 */
export const isEqual = <T>(a: T, b: T): boolean => {
  return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Convert a date to ISO string
 */
export const dateToISOString = (date: Date | undefined | null): string | undefined => {
  if (!date) return undefined;
  try {
    return date.toISOString();
  } catch {
    return undefined;
  }
};

/**
 * Parse an ISO string to Date
 */
export const isoStringToDate = (isoString: string | undefined | null): Date | undefined => {
  if (!isoString) return undefined;
  try {
    const date = new Date(isoString);
    return isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
};

/**
 * Format a date for display
 */
export const formatDate = (date: Date | string | undefined | null, format: 'short' | 'long' = 'short'): string => {
  if (!date) return '-';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';

    const locale = 'zh-CN';
    if (format === 'short') {
      return d.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
    } else {
      return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    }
  } catch {
    return '-';
  }
};

/**
 * Get status display text
 */
export const getVisitStatusText = (status: VisitStatus): string => {
  const statusMap: Record<VisitStatus, string> = {
    planned: '计划中',
    scheduled: '已安排',
    completed: '已完成',
    missed: '缺失',
    cancelled: '已取消',
    pending: '待定',
  };
  return statusMap[status] || status;
};

/**
 * Get status color class
 */
export const getVisitStatusColor = (status: VisitStatus): string => {
  const colorMap: Record<VisitStatus, string> = {
    planned: 'bg-blue-100 text-blue-800',
    scheduled: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    missed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    pending: 'bg-purple-100 text-purple-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
};
