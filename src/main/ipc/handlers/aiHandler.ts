/**
 * CRA AI Assistant - AI IPC Handlers
 */

import { ipcMain } from 'electron';
import { getGLMService } from '../../services/AI/GLMService';
import type { Result } from '@shared/types';
import { ErrorCode, createAppError } from '@shared/types/core';
import * as fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import { getCurrentSettings } from './settingsHandler';
import { pdfToPng } from 'pdf-to-img';

// Cache for settings (will be populated when needed)
let cachedSettings: { apiKey: string; modelName: string } | null = null;

async function getSettings(): Promise<{ apiKey: string; modelName: string }> {
  if (!cachedSettings) {
    // Use the exported getCurrentSettings function
    const settings = getCurrentSettings();
    cachedSettings = {
      apiKey: settings.apiKey,
      modelName: settings.modelName,
    };
  }
  return cachedSettings || { apiKey: '', modelName: 'glm-4' };
}

// PDF content cache to avoid re-reading files
const pdfContentCache = new Map<string, string>();

/**
 * Convert PDF pages to images and extract text using AI
 */
async function readScannedPDF(filePath: string, settings: { apiKey: string; modelName: string }): Promise<string> {
  console.log('[AI Handler] PDF appears to be scanned, converting to images...');
  try {
    const service = getGLMService({ apiKey: settings.apiKey, modelName: 'glm-4v' }); // Use vision model
    const pdfConvert = await pdfToPng(filePath, { scale: 2.0 });
    const allText: string[] = [];

    let pageCount = 0;
    for await (const page of pdfConvert) {
      pageCount++;
      console.log(`[AI Handler] Processing page ${pageCount}...`);

      // Save page to temp file
      const tempDir = require('os').tmpdir();
      const tempImagePath = require('path').join(tempDir, `pdf_page_${pageCount}.png`);
      await fs.writeFile(tempImagePath, page.content);

      // Extract text from image using AI
      const result = await service.extractFromImage(tempImagePath, '请提取图片中的所有文字内容，特别是受试者的信息（年龄、性别、身高、体重等）');
      if (result.success && result.data.text) {
        allText.push(result.data.text);
        console.log(`[AI Handler] Extracted ${result.data.text.length} chars from page ${pageCount}`);
      }

      // Clean up temp file
      try {
        await fs.unlink(tempImagePath);
      } catch (e) {
        // Ignore cleanup errors
      }

      // Only process first 3 pages to save time
      if (pageCount >= 3) {
        console.log('[AI Handler] Processed first 3 pages, stopping');
        break;
      }
    }

    const combinedText = allText.join('\n\n');
    console.log(`[AI Handler] Total extracted text length: ${combinedText.length}`);
    return combinedText;
  } catch (error) {
    console.error('[AI Handler] Failed to process scanned PDF:', error);
    throw new Error(`Failed to process scanned PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Read PDF content
 */
async function readPDFContent(filePath: string, settings?: { apiKey: string; modelName: string }): Promise<string> {
  // Check cache first
  if (pdfContentCache.has(filePath)) {
    return pdfContentCache.get(filePath)!;
  }

  try {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    const content = data.text;

    // Check if PDF has meaningful text content (less than 50 chars means likely scanned)
    const meaningfulTextLength = content.replace(/\s+/g, '').length;
    console.log(`[AI Handler] PDF text length (without spaces): ${meaningfulTextLength}`);

    if (meaningfulTextLength < 50) {
      console.log('[AI Handler] PDF appears to be scanned (low text content)');
      if (settings) {
        const scannedText = await readScannedPDF(filePath, settings);
        pdfContentCache.set(filePath, scannedText);
        return scannedText;
      }
    }

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
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.apiKey });
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
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.apiKey });
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
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.apiKey });
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
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.apiKey });
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
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.apiKey });
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
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.apiKey });
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
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      const service = getGLMService({ apiKey: settings.apiKey });
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

  // Process protocol file - extract both criteria and visit schedule
  ipcMain.handle('ai:processProtocolFile', async (event, fileId: string, filePath: string): Promise<Result<any>> => {
    try {
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      // Read PDF content
      const pdfContent = await readPDFContent(filePath, { apiKey: settings.apiKey, modelName: settings.modelName });

      // Get AI service
      const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });

      // Extract criteria and visit schedule in parallel
      const [criteriaResult, scheduleResult] = await Promise.all([
        service.extractCriteria(fileId, pdfContent),
        service.extractVisitSchedule(fileId, pdfContent),
      ]);

      if (!criteriaResult.success) {
        return criteriaResult;
      }

      if (!scheduleResult.success) {
        return scheduleResult;
      }

      return {
        success: true,
        data: {
          criteria: criteriaResult.data,
          schedule: scheduleResult.data,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `处理方案文件失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });

  // Process subject file - extract subject data
  ipcMain.handle('ai:processSubjectFile', async (event, fileId: string, filePath: string): Promise<Result<any>> => {
    try {
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      // Read file content (PDF or image)
      let content: string;
      if (filePath.toLowerCase().endsWith('.pdf')) {
        console.log('[AI Handler] Reading PDF from path:', filePath);
        content = await readPDFContent(filePath, { apiKey: settings.apiKey, modelName: settings.modelName });
        console.log('[AI Handler] PDF content length:', content.length);
        console.log('[AI Handler] PDF content preview (first 1000 chars):', content.substring(0, 1000));
        console.log('[AI Handler] PDF actual content:', content.substring(0, 3000));
        // Write to debug file
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const debugDir = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.claude', 'debug');
          await fs.mkdir(debugDir, { recursive: true });
          await fs.writeFile(path.join(debugDir, 'pdf-content-debug.txt'), content);
          console.log('[AI Handler] Debug file written to:', path.join(debugDir, 'pdf-content-debug.txt'));
        } catch (e) {
          console.error('[AI Handler] Failed to write debug file:', e);
        }
      } else {
        // For images, use AI to extract text first
        const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });
        const imageResult = await service.extractFromImage(filePath, '请提取图片中的所有文字内容');
        if (!imageResult.success) {
          return imageResult;
        }
        content = imageResult.data.text || '';
      }

      // Get AI service
      const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });

      // Extract subject data
      console.log('[AI Handler] Extracting subject data from content length:', content.length);
      console.log('[AI Handler] First 500 chars of content:', content.substring(0, 500));
      const subjectResult = await service.extractSubjectNumber(fileId, content);
      console.log('[AI Handler] Subject result:', subjectResult);
      if (!subjectResult.success) {
        return subjectResult;
      }

      // Extract visit dates
      const visitDatesResult = await service.extractSubjectVisitDates(fileId, content);
      if (!visitDatesResult.success) {
        return visitDatesResult;
      }

      // Extract medications
      const medicationsResult = await service.recognizeMedications(fileId, content);

      return {
        success: true,
        data: {
          subject: subjectResult.data,
          visitDates: visitDatesResult.data,
          medications: medicationsResult.success ? medicationsResult.data : [],
          subjectData: content, // 保留原始数据用于后续分析
        },
      };
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `处理受试者文件失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });

  // Analyze subject eligibility against criteria
  ipcMain.handle('ai:analyzeEligibility', async (event, subjectFilePath: string, inclusionCriteria: any[], exclusionCriteria: any[]): Promise<Result<any>> => {
    try {
      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      // Read subject file content
      let subjectData: string;
      if (subjectFilePath.toLowerCase().endsWith('.pdf')) {
        subjectData = await readPDFContent(subjectFilePath);
      } else {
        // For images, use AI to extract text first
        const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });
        const imageResult = await service.extractFromImage(subjectFilePath, '请提取图片中的所有文字内容');
        if (!imageResult.success) {
          return imageResult;
        }
        subjectData = imageResult.data.text || '';
      }

      const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });
      return await service.analyzeEligibility(subjectData, inclusionCriteria, exclusionCriteria);
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `分析受试者资格失败: ${error instanceof Error ? error.message : 'Unknown error'}`
        ),
      };
    }
  });
}
