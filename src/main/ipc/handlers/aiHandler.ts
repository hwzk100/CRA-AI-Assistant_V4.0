/**
 * CRA AI Assistant - AI IPC Handlers
 */

import { ipcMain } from 'electron';
import { getGLMService } from '../../services/AI/GLMService';
import type { Result } from '@shared/types';
import { ErrorCode, createAppError, ok } from '@shared/types/core';
import { getCurrentSettings } from './settingsHandler';

// Lazy load PDFProcessor to avoid pdfjs-dist loading during startup
let pdfProcessorPromise: Promise<any> | null = null;

async function getPDFProcessor() {
  if (!pdfProcessorPromise) {
    pdfProcessorPromise = import('../../services/PDFService/PDFProcessor').then(m => m.getPDFProcessor());
  }
  return pdfProcessorPromise;
}

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
const pdfContentCache = new Map<string, PDFContentResult>();

/**
 * PDF Content Result
 */
interface PDFContentResult {
  type: 'text' | 'scanned';
  content: string;
  imagePaths?: string[];
}

/**
 * Read PDF content (handles both text and scanned PDFs)
 */
async function readPDFContent(filePath: string): Promise<PDFContentResult> {
  // Check cache first
  if (pdfContentCache.has(filePath)) {
    return pdfContentCache.get(filePath)!;
  }

  const pdfProcessor = await getPDFProcessor();
  const result = await pdfProcessor.extractContent(filePath);

  if (!result.success) {
    throw new Error(result.error?.message || 'PDF processing failed');
  }

  // Cache the result
  pdfContentCache.set(filePath, result.data);
  return result.data;
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

  // Test GLM-4.6V-Flash model connection (free vision model for image processing)
  ipcMain.handle('ai:testGLM4V', async (event, apiKey: string): Promise<Result<{ success: boolean; model?: string }>> => {
    try {
      const service = getGLMService({ apiKey });

      // Create a simple test with text message (GLM-4.6V-Flash supports both text and images)
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '你好，请回复"连接成功"，确认 GLM-4.6V-Flash 免费视觉模型正常工作。'
            }
          ]
        }
      ];

      const result = await service['callAPI'](messages, 1, 'glm-4.6v-flash');

      if (!result.success) {
        return {
          success: false,
          error: {
            code: result.error.code,
            message: `GLM-4.6V-Flash 免费视觉模型测试失败: ${result.error.message}\n\nGLM-4.6V-Flash 是智谱 AI 的免费视觉模型，应该可以直接使用。\n\n访问 https://open.bigmodel.cn/ 查看您的账户支持的模型列表。`,
            details: result.error.details
          }
        };
      }

      return ok({
        success: true,
        model: 'glm-4.6v-flash'
      });
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AI_API_ERROR',
          message: `GLM-4.6V-Flash 模型测试异常: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error
        }
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

      // Read PDF content (now handles both text and scanned)
      const pdfResult = await readPDFContent(filePath);

      let combinedText = '';

      if (pdfResult.type === 'text') {
        // Use extracted text directly
        combinedText = pdfResult.content;
      } else {
        // Scanned PDF - extract text from images using GLM-4V
        console.log('[AI Handler] Processing scanned PDF with GLM-4V...');

        const service = getGLMService({
          apiKey: settings.apiKey,
          modelName: 'glm-4.6v-flash' // Use free vision model
        });

        const textParts: string[] = [];

        for (const imagePath of (pdfResult.imagePaths || [])) {
          console.log(`[AI Handler] Extracting text from ${imagePath}...`);

          const result = await service.extractFromImage(
            imagePath,
            '请提取图片中的所有文字内容，包括标题、正文、表格等所有可见文字。'
          );

          if (result.success && result.data.text) {
            textParts.push(result.data.text);
            console.log(`[AI Handler] Extracted ${result.data.text.length} chars from page`);
          }
        }

        combinedText = textParts.join('\n\n');

        // Cleanup temporary images
        console.log('[AI Handler] Cleaning up temporary images...');
        const pdfProcessor = await getPDFProcessor();
        await pdfProcessor.cleanupImages(pdfResult.imagePaths || []);

        // Clear cache after cleanup to prevent stale file references
        clearPDFContentCache(filePath);
      }

      // Validate we got some content
      if (combinedText.trim().length < 50) {
        return {
          success: false,
          error: createAppError(
            ErrorCode.AI_INVALID_RESPONSE,
            '无法从 PDF 中提取足够的文字内容。请确认文件格式正确。'
          ),
        };
      }

      // Get AI service
      const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });

      // Extract criteria and visit schedule in parallel
      const [criteriaResult, scheduleResult] = await Promise.all([
        service.extractCriteria(fileId, combinedText),
        service.extractVisitSchedule(fileId, combinedText),
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
      let imagePaths: string[] | undefined;

      if (filePath.toLowerCase().endsWith('.pdf')) {
        console.log('[AI Handler] Reading PDF from path:', filePath);
        const pdfResult = await readPDFContent(filePath);
        console.log('[AI Handler] PDF type:', pdfResult.type);

        if (pdfResult.type === 'text') {
          content = pdfResult.content;
        } else {
          // Scanned PDF - analyze directly with GLM-4V (no OCR step)
          console.log('[AI Handler] Processing scanned PDF with direct VLM analysis...');

          const service = getGLMService({
            apiKey: settings.apiKey,
            modelName: 'glm-4v' // Use vision model
          });

          // Use the first page for direct analysis
          const firstPageImage = pdfResult.imagePaths?.[0];
          if (!firstPageImage) {
            await (await getPDFProcessor()).cleanupImages(pdfResult.imagePaths || []);
            return {
              success: false,
              error: createAppError(ErrorCode.AI_INVALID_RESPONSE, '无法获取PDF页面图片'),
            };
          }

          console.log(`[AI Handler] Analyzing first page directly: ${firstPageImage}`);

          // Direct analysis from image (no OCR step)
          const subjectResult = await service.extractSubjectDataFromImage(firstPageImage);
          if (!subjectResult.success) {
            await (await getPDFProcessor()).cleanupImages(pdfResult.imagePaths || []);
            return subjectResult;
          }

          console.log('[AI Handler] Subject data extracted from image:', subjectResult.data);

          // Cleanup temporary images
          console.log('[AI Handler] Cleaning up temporary images...');
          await (await getPDFProcessor()).cleanupImages(pdfResult.imagePaths || []);

          // Clear cache after cleanup to prevent stale file references
          clearPDFContentCache(filePath);

          // Return direct analysis result
          return {
            success: true,
            data: {
              subject: subjectResult.data,
              demographics: subjectResult.data,
              visitDates: { visits: [] }, // Empty for scanned PDF - requires separate analysis
              medications: [], // Empty for scanned PDF - requires separate analysis
            },
          };
        }

        console.log('[AI Handler] Content length:', content.length);
        console.log('[AI Handler] Content preview (first 500 chars):', content.substring(0, 500));
      } else {
        // For images, use AI to extract text first
        const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });
        const imageResult = await service.extractFromImage(filePath, '请提取图片中的所有文字内容');
        if (!imageResult.success) {
          return imageResult;
        }
        content = imageResult.data.text || '';
      }

      // Validate we got some content
      if (content.trim().length < 10) {
        return {
          success: false,
          error: createAppError(
            ErrorCode.AI_INVALID_RESPONSE,
            '无法从文件中提取足够的文字内容。请确认文件格式正确。'
          ),
        };
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
          demographics: subjectResult.data, // Add demographics data
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
  ipcMain.handle('ai:analyzeEligibility', async (event, subjectFilePaths: string[], inclusionCriteria: any[], exclusionCriteria: any[]): Promise<Result<any>> => {
    try {
      console.log('[AI Handler] analyzeEligibility called with:', {
        subjectFilePaths: subjectFilePaths?.length || 0,
        inclusionCriteria: inclusionCriteria?.length || 0,
        exclusionCriteria: exclusionCriteria?.length || 0
      });

      // Validate file paths
      if (!subjectFilePaths || !Array.isArray(subjectFilePaths) || subjectFilePaths.length === 0) {
        return {
          success: false,
          error: createAppError(ErrorCode.INVALID_PARAMS, '受试者文件路径不能为空'),
        };
      }

      const settings = await getSettings();
      if (!settings.apiKey) {
        return {
          success: false,
          error: createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'),
        };
      }

      // Validate criteria arrays
      if (!inclusionCriteria || !Array.isArray(inclusionCriteria)) {
        return {
          success: false,
          error: createAppError(ErrorCode.AI_INVALID_RESPONSE, '入选标准数据无效'),
        };
      }

      if (!exclusionCriteria || !Array.isArray(exclusionCriteria)) {
        return {
          success: false,
          error: createAppError(ErrorCode.AI_INVALID_RESPONSE, '排除标准数据无效'),
        };
      }

      // Log original criteria IDs for debugging
      console.log('[AI Handler] Original inclusion criteria IDs:', inclusionCriteria.map(c => c.id));
      console.log('[AI Handler] Original exclusion criteria IDs:', exclusionCriteria.map(c => c.id));

      // Create ID maps for inclusion and exclusion criteria
      const createIdMap = (criteria: any[]) => {
        const idMap = new Map<string, any>();
        criteria.forEach((c, i) => {
          const actualId = c.id;
          // Map actual ID to the criterion object
          idMap.set(actualId, c);
          // Map index (1-based) to actual ID
          idMap.set(String(i + 1), c);
          // Map various bracket formats to actual ID
          idMap.set(`[ID: ${actualId}]`, c);
          idMap.set(`[id: ${actualId}]`, c);
          idMap.set(`[${actualId}]`, c);
        });
        return idMap;
      };

      const inclusionIdMap = createIdMap(inclusionCriteria);
      const exclusionIdMap = createIdMap(exclusionCriteria);

      /**
       * Find criteria by description similarity
       * Uses Levenshtein distance to calculate string similarity
       */
      const findCriteriaByDescription = (
        aiResponse: string,
        criteriaArray: any[]
      ): { criteria: any; similarity: number } | null => {
        // 简单的字符串相似度计算（基于编辑距离）
        const calculateSimilarity = (str1: string, str2: string): number => {
          const longer = str1.length > str2.length ? str1 : str2;
          const shorter = str1.length > str2.length ? str2 : str1;

          if (longer.length === 0) return 1.0;

          const editDistance = (s1: string, s2: string): number => {
            s1 = s1.toLowerCase();
            s2 = s2.toLowerCase();
            const costs: number[] = [];
            for (let i = 0; i <= s1.length; i++) {
              let lastValue = i;
              for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                  costs[j] = j;
                } else if (j > 0) {
                  let newValue = costs[j - 1];
                  if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                  }
                  costs[j - 1] = lastValue;
                  lastValue = newValue;
                }
              }
              if (i > 0) costs[s2.length] = lastValue;
            }
            return costs[s2.length];
          };

          const distance = editDistance(longer, shorter);
          return (longer.length - distance) / longer.length;
        };

        let bestMatch: { criteria: any; similarity: number } | null = null;

        for (const criteria of criteriaArray) {
          // 尝试在 AI 响应中查找描述的匹配
          const similarity = calculateSimilarity(aiResponse, criteria.description);

          if (similarity > 0.85 && (!bestMatch || similarity > bestMatch.similarity)) {
            bestMatch = { criteria, similarity };
          }
        }

        return bestMatch;
      };

      // Normalize AI returned IDs to match frontend IDs
      const normalizeId = (
        aiId: string,
        idMap: Map<string, any>,
        criteriaArray?: any[]
      ): string => {
        console.log(`[AI Handler] normalizeId called with: ${aiId}`);
        console.log(`[AI Handler] idMap keys:`, Array.from(idMap.keys()));

        // Layer 1: Direct ID match
        if (idMap.has(aiId)) {
          console.log(`[AI Handler] Direct match found for: ${aiId}`);
          return idMap.get(aiId)!.id;
        }

        // Try to clean up the ID (remove brackets, prefixes, etc.)
        const cleanId = aiId
          .replace(/\[ID:\s*/i, '')
          .replace(/\[id:\s*/i, '')
          .replace(/\[/g, '')
          .replace(/\]/g, '')
          .trim();
        console.log(`[AI Handler] Cleaned ID: ${cleanId}`);

        if (idMap.has(cleanId)) {
          console.log(`[AI Handler] Cleaned ID match found for: ${cleanId}`);
          return idMap.get(cleanId)!.id;
        }

        // Layer 2: Numeric index match (for AI responses like "1", "2", "3", etc.)
        if (criteriaArray && criteriaArray.length > 0) {
          const numericIndex = parseInt(aiId);
          if (!isNaN(numericIndex) && numericIndex > 0 && numericIndex <= criteriaArray.length) {
            const matchedCriteria = criteriaArray[numericIndex - 1];
            console.log(`[AI Handler] Numeric index match: ${aiId} -> ${matchedCriteria.id}`);
            return matchedCriteria.id;
          }
        }

        // Layer 3: Description similarity match (as fallback)
        if (criteriaArray && criteriaArray.length > 0) {
          const bestMatch = findCriteriaByDescription(aiId, criteriaArray);
          if (bestMatch && bestMatch.similarity > 0.85) {
            console.log(`[AI Handler] Description match: ${aiId} -> ${bestMatch.criteria.id} (similarity: ${bestMatch.similarity.toFixed(3)})`);
            return bestMatch.criteria.id;
          }
        }

        console.warn(`[AI Handler] Could not normalize ID: ${aiId} -> cleaned: ${cleanId}`);
        return aiId; // Return original if no match found
      };

      // Process all files
      const results = [];
      const path = require('path');

      console.log(`[AI Handler] ========== Starting multi-file eligibility analysis ==========`);
      console.log(`[AI Handler] Total files to process: ${subjectFilePaths.length}`);
      subjectFilePaths.forEach((fp, i) => {
        console.log(`[AI Handler] File ${i + 1}: ${path.basename(fp)}`);
      });
      console.log(`[AI Handler] Inclusion criteria: ${inclusionCriteria.length}, Exclusion criteria: ${exclusionCriteria.length}`);

      for (let i = 0; i < subjectFilePaths.length; i++) {
        const filePath = subjectFilePaths[i];
        const fileName = path.basename(filePath);

        console.log(`[AI Handler] Processing file ${i + 1}/${subjectFilePaths.length}:`, fileName);

        try {
          // Read subject file content
          let isScannedPDF = false;
          let imagePaths: string[] | undefined;
          let subjectData: string;

          if (filePath.toLowerCase().endsWith('.pdf')) {
            const pdfResult = await readPDFContent(filePath);

            if (pdfResult.type === 'text') {
              subjectData = pdfResult.content;
            } else {
              // Scanned PDF - will use direct VLM analysis
              isScannedPDF = true;
              imagePaths = pdfResult.imagePaths;
            }
          } else {
            // For direct image files, use direct VLM analysis
            isScannedPDF = true;
            imagePaths = [filePath];
          }

          const service = getGLMService({ apiKey: settings.apiKey, modelName: isScannedPDF ? 'glm-4.6v-flash' : settings.modelName });

          let result;

          if (isScannedPDF && imagePaths && imagePaths.length > 0) {
            // Direct analysis from image (no OCR step)
            console.log('[AI Handler] Analyzing eligibility from image directly...');
            const firstPageImage = imagePaths[0];

            try {
              result = await service.analyzeEligibilityFromImage(
                firstPageImage,
                inclusionCriteria,
                exclusionCriteria
              );
              console.log('[AI Handler] Analysis result received:', result.success ? 'SUCCESS' : 'FAILED');
              if (!result.success) {
                console.log('[AI Handler] Analysis error:', result.error);
              }
            } catch (apiError) {
              console.error('[AI Handler] API call threw exception:', apiError);
              result = {
                success: false,
                error: createAppError(
                  ErrorCode.AI_API_ERROR,
                  `API调用异常: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`
                )
              };
            }

            // Cleanup if it was a converted PDF
            if (filePath.toLowerCase().endsWith('.pdf')) {
              await (await getPDFProcessor()).cleanupImages(imagePaths);
              // Clear cache after cleanup to prevent stale file references
              clearPDFContentCache(filePath);
            }
          } else {
            // Text-based analysis
            result = await service.analyzeEligibility(subjectData, inclusionCriteria, exclusionCriteria);
          }

          if (!result.success) {
            console.error(`[AI Handler] Failed to analyze file:`, fileName, 'Error:', result.error);
            // Continue processing other files
            results.push({
              filePath,
              fileName,
              error: result.error?.message || '分析失败'
            });
            continue;
          }

          console.log(`[AI Handler] File ${fileName} analysis successful, processing results...`);

          // Normalize IDs in the result
          if (result.data) {
            if (result.data.inclusion && Array.isArray(result.data.inclusion)) {
              result.data.inclusion = result.data.inclusion.map((item: any) => ({
                ...item,
                id: normalizeId(item.id, inclusionIdMap, inclusionCriteria)
              }));
            }

            if (result.data.exclusion && Array.isArray(result.data.exclusion)) {
              result.data.exclusion = result.data.exclusion.map((item: any) => ({
                ...item,
                id: normalizeId(item.id, exclusionIdMap, exclusionCriteria)
              }));
            }
          }

          results.push({
            filePath,
            fileName,
            inclusion: result.data?.inclusion || [],
            exclusion: result.data?.exclusion || []
          });

        } catch (error) {
          console.error(`[AI Handler] Error processing file ${fileName}:`, error);
          // Continue processing other files
          results.push({
            filePath,
            fileName,
            error: error instanceof Error ? error.message : '未知错误'
          });
        }
      }

      console.log(`[AI Handler] All files processed. Total results: ${results.length}, Successful: ${results.filter(r => !r.error).length}, Failed: ${results.filter(r => r.error).length}`);

      // Log summary of results
      results.forEach((r, i) => {
        if (r.error) {
          console.error(`[AI Handler] Result ${i + 1}: ${r.fileName} - FAILED: ${r.error}`);
        } else {
          console.log(`[AI Handler] Result ${i + 1}: ${r.fileName} - SUCCESS (${r.inclusion?.length || 0} inclusion, ${r.exclusion?.length || 0} exclusion)`);
        }
      });

      return ok({ results });

    } catch (error) {
      console.error('[AI Handler] Fatal error in analyzeEligibility:', error);
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
