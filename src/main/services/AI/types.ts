/**
 * CRA AI Assistant - AI Service Types
 */

import type { Result } from '@shared/types';

// ============================================================================
// GLM API Types
// ============================================================================

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GLMRequestPayload {
  model: string;
  messages: GLMMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface GLMResponseChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

export interface GLMResponseUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface GLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GLMResponseChoice[];
  usage: GLMResponseUsage;
}

export interface GLMErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

// ============================================================================
// AI Service Types
// ============================================================================

export interface ExtractCriteriaResult {
  inclusionCriteria: string[];
  exclusionCriteria: string[];
}

export interface ExtractVisitScheduleResult {
  visits: Array<{
    visitType: string;
    visitDay: string;
    visitWindow: string;
    description: string;
    items: Array<{
      name: string;
      category: string;
      required: boolean;
    }>;
  }>;
}

export interface ExtractSubjectDataResult {
  subjectNumber?: string;
  screeningNumber?: string;
  randomizationNumber?: string;
  age?: number | null;
  gender?: string | null;
  height?: number | null;
  weight?: number | null;
  ethnicity?: string | null;
  birthDate?: string | null;
}

export interface ExtractSubjectVisitDatesResult {
  visits: Array<{
    visitType: string;
    date: Date;
  }>;
}

export interface ExtractSubjectVisitItemsResult {
  items: Array<{
    name: string;
    value: string;
    unit?: string;
    completed: boolean;
  }>;
}

export interface ImageExtractionResult {
  text: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// AI Service Interface
// ============================================================================

export interface IAIService {
  /**
   * Test API connection
   */
  testConnection(apiKey: string): Promise<Result<{ success: boolean; model?: string }>>;

  /**
   * Extract inclusion and exclusion criteria from protocol PDF
   */
  extractCriteria(fileId: string, pdfContent: string): Promise<Result<ExtractCriteriaResult>>;

  /**
   * Extract visit schedule from protocol PDF
   */
  extractVisitSchedule(fileId: string, pdfContent: string): Promise<Result<ExtractVisitScheduleResult>>;

  /**
   * Recognize medications from document
   */
  recognizeMedications(fileId: string, content: string): Promise<Result<Array<{
    medicationName: string;
    dosage: string;
    frequency: string;
    route: string;
  }>>>;

  /**
   * Extract subject number from document
   */
  extractSubjectNumber(fileId: string, content: string): Promise<Result<ExtractSubjectDataResult>>;

  /**
   * Extract subject visit dates
   */
  extractSubjectVisitDates(fileId: string, content: string): Promise<Result<ExtractSubjectVisitDatesResult>>;

  /**
   * Extract subject visit item data
   */
  extractSubjectVisitItems(
    fileId: string,
    content: string,
    visitType: string
  ): Promise<Result<ExtractSubjectVisitItemsResult>>;

  /**
   * Extract data from image using vision model
   */
  extractFromImage(imagePath: string, prompt: string): Promise<Result<ImageExtractionResult>>;
}

// ============================================================================
// Service Configuration
// ============================================================================

export interface AIServiceConfig {
  apiKey: string;
  apiEndpoint: string;
  modelName: string;
  timeout: number;
  maxRetries: number;
}
