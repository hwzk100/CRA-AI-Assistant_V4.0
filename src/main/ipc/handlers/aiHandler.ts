/**
 * CRA AI Assistant - AI IPC Handlers
 */

import { ipcMain } from 'electron';
import { getGLMService } from '../../services/AI/GLMService';
import type { Result } from '@shared/types';
import { ErrorCode, createAppError } from '@shared/types/core';
import * as fs from 'fs/promises';
import pdfParse from 'pdf-parse';

// PDF content cache to avoid re-reading files
const pdfContentCache = new Map<string, string>();

/**
 * Read PDF content
 */
async function readPDFContent(filePath: string): Promise<string> {
  // Check cache first
  if (pdfContentCache.has(filePath)) {
    return pdfContentCache.get(filePath)!;
  }

  try {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    const content = data.text;

    // Cache the content
    pdfContentCache.set(filePath, content);

    return content;
  } catch (error) {
    throw new Error(`Failed to read PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clear PDF content cache
 */
function clearPDFContentCache(filePath?: string): void {
  if (filePath) {
    pdfContentCache.delete(filePath);
  } else {
    pdfContentCache.clear();
  }
}

/**
 * Register AI handlers
 */
export function registerAIHandlers(): void {
  // Test AI connection
  ipcMain.handle('ai:testConnection', async (event, apiKey: string): Promise<Result<{ success: boolean; model?: string }>> => {
    try {
      const service = getGLMService({ apiKey });
      return await service.testConnection(apiKey);
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `连接测试失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });

  // Extract criteria from PDF
  ipcMain.handle('ai:extractCriteria', async (event, fileId: string, pdfContent: string): Promise<Result<any>> => {
    try {
      const settings = await ipcMain.invoke('settings:get') as any;
      if (!settings.success || !settings.data.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.data.apiKey });
      return await service.extractCriteria(fileId, pdfContent);
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `提取标准失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });

  // Extract visit schedule from PDF
  ipcMain.handle('ai:extractVisitSchedule', async (event, fileId: string, pdfContent: string): Promise<Result<any>> => {
    try {
      const settings = await ipcMain.invoke('settings:get') as any;
      if (!settings.success || !settings.data.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.data.apiKey });
      return await service.extractVisitSchedule(fileId, pdfContent);
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `提取访视计划失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });

  // Recognize medications
  ipcMain.handle('ai:recognizeMedications', async (event, fileId: string, content: string): Promise<Result<any>> => {
    try {
      const settings = await ipcMain.invoke('settings:get') as any;
      if (!settings.success || !settings.data.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.data.apiKey });
      return await service.recognizeMedications(fileId, content);
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `识别用药记录失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });

  // Extract subject number
  ipcMain.handle('ai:extractSubjectNumber', async (event, fileId: string, content: string): Promise<Result<any>> => {
    try {
      const settings = await ipcMain.invoke('settings:get') as any;
      if (!settings.success || !settings.data.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.data.apiKey });
      return await service.extractSubjectNumber(fileId, content);
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `提取受试者编号失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });

  // Extract subject visit dates
  ipcMain.handle('ai:extractSubjectVisitDates', async (event, fileId: string, content: string): Promise<Result<any>> => {
    try {
      const settings = await ipcMain.invoke('settings:get') as any;
      if (!settings.success || !settings.data.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.data.apiKey });
      return await service.extractSubjectVisitDates(fileId, content);
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `提取访视日期失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });

  // Extract subject visit items
  ipcMain.handle('ai:extractSubjectVisitItems', async (event, fileId: string, content: string, visitType: string): Promise<Result<any>> => {
    try {
      const settings = await ipcMain.invoke('settings:get') as any;
      if (!settings.success || !settings.data.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.data.apiKey });
      return await service.extractSubjectVisitItems(fileId, content, visitType);
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `提取访视项目失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });

  // Extract from image
  ipcMain.handle('ai:extractFromImage', async (event, imagePath: string, prompt: string): Promise<Result<any>> => {
    try {
      const settings = await ipcMain.invoke('settings:get') as any;
      if (!settings.success || !settings.data.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.data.apiKey });
      return await service.extractFromImage(imagePath, prompt);
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `图片识别失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });
}
