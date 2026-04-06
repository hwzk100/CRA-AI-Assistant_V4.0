/**
 * CRA AI Assistant - AI IPC Handlers
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getGLMService } from '../../services/AI/GLMService';
import { BatchProcessor } from '../../services/AI/BatchProcessor';
import { ResultMerger } from '../../services/AI/ResultMerger';
import type { Result } from '@shared/types';
import { ErrorCode, createAppError, ok, err } from '@shared/types/core';
import { getCurrentSettings } from './settingsHandler';
import { PDF_CONFIG } from '@shared/constants/app';

// Lazy load PDFProcessor to avoid pdfjs-dist loading during startup
let pdfProcessorPromise: Promise<any> | null = null;

async function getPDFProcessor() {
  if (!pdfProcessorPromise) {
    pdfProcessorPromise = import('../../services/PDFService/PDFProcessor').then(m => m.getPDFProcessor());
  }
  return pdfProcessorPromise;
}

// Settings are read fresh each time to avoid stale cache issues
function getSettings(): { apiKey: string; modelName: string } {
  const settings = getCurrentSettings();
  return {
    apiKey: settings.apiKey,
    modelName: settings.modelName,
  };
}

// PDF content cache with TTL to prevent stale references and unbounded growth
const PDF_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const pdfContentCache = new Map<string, { result: PDFContentResult; timestamp: number }>();

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
  // Check cache first, with TTL validation
  const cached = pdfContentCache.get(filePath);
  if (cached) {
    if (Date.now() - cached.timestamp > PDF_CACHE_TTL) {
      // Expired entry - stale imagePaths may have been cleaned up
      pdfContentCache.delete(filePath);
    } else {
      return cached.result;
    }
  }

  const pdfProcessor = await getPDFProcessor();
  const result = await pdfProcessor.extractContent(filePath);

  if (!result.success) {
    throw new Error(result.error?.message || 'PDF processing failed');
  }

  // Cache the result with timestamp
  pdfContentCache.set(filePath, { result: result.data, timestamp: Date.now() });
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
 * Send progress event to renderer
 */
function sendProgress(event: IpcMainInvokeEvent, current: number, total: number, stage: string): void {
  try {
    event.sender.send('ai:progress', { current, total, stage });
  } catch (e) {
    // Ignore errors if window is already closed
  }
}

/**
 * Validate API key availability, * @returns Settings with valid apiKey or error Result
 */
function requireApiKey(): Result<{ apiKey: string; modelName: string }> {
  const settings = getCurrentSettings();
  if (!settings.apiKey) {
    return err(createAppError(ErrorCode.API_KEY_MISSING, '请先配置 API Key'));
  }
  return ok({ apiKey: settings.apiKey, modelName: settings.modelName });
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

      const result = await service.rawCall(messages, 1, 'glm-4.6v-flash');

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
        error: createAppError(
          ErrorCode.AI_API_ERROR,
          `GLM-4.6V-Flash 模型测试异常: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error
        )
      };
    }
  });

  // Extract criteria from PDF
  ipcMain.handle('ai:extractCriteria', async (event, fileId: string, pdfContent: string): Promise<Result<any>> => {
    const keyResult = requireApiKey();
    if (!keyResult.success) return keyResult;
    try {
      const service = getGLMService({ apiKey: keyResult.data.apiKey });
      return await service.extractCriteria(fileId, pdfContent);
    } catch (error) {
      return err(createAppError(ErrorCode.AI_API_ERROR, `提取标准失败: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });

  // Recognize medications
  ipcMain.handle('ai:recognizeMedications', async (event, fileId: string, content: string): Promise<Result<any>> => {
    const keyResult = requireApiKey();
    if (!keyResult.success) return keyResult;
    try {
      const service = getGLMService({ apiKey: keyResult.data.apiKey });
      return await service.recognizeMedications(fileId, content);
    } catch (error) {
      return err(createAppError(ErrorCode.AI_API_ERROR, `识别用药记录失败: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });

  // Extract subject number
  ipcMain.handle('ai:extractSubjectNumber', async (event, fileId: string, content: string): Promise<Result<any>> => {
    const keyResult = requireApiKey();
    if (!keyResult.success) return keyResult;
    try {
      const service = getGLMService({ apiKey: keyResult.data.apiKey });
      return await service.extractSubjectNumber(fileId, content);
    } catch (error) {
      return err(createAppError(ErrorCode.AI_API_ERROR, `提取受试者编号失败: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });

  // Extract subject visit dates
  ipcMain.handle('ai:extractSubjectVisitDates', async (event, fileId: string, content: string): Promise<Result<any>> => {
    const keyResult = requireApiKey();
    if (!keyResult.success) return keyResult;
    try {
      const service = getGLMService({ apiKey: keyResult.data.apiKey });
      return await service.extractSubjectVisitDates(fileId, content);
    } catch (error) {
      return err(createAppError(ErrorCode.AI_API_ERROR, `提取访视日期失败: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });

  // Extract subject visit items
  ipcMain.handle('ai:extractSubjectVisitItems', async (event, fileId: string, content: string, visitType: string): Promise<Result<any>> => {
    const keyResult = requireApiKey();
    if (!keyResult.success) return keyResult;
    try {
      const service = getGLMService({ apiKey: keyResult.data.apiKey });
      return await service.extractSubjectVisitItems(fileId, content, visitType);
    } catch (error) {
      return err(createAppError(ErrorCode.AI_API_ERROR, `提取访视项目失败: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });

  // Extract from image
  ipcMain.handle('ai:extractFromImage', async (event, imagePath: string, prompt: string): Promise<Result<any>> => {
    const keyResult = requireApiKey();
    if (!keyResult.success) return keyResult;
    try {
      const service = getGLMService({ apiKey: keyResult.data.apiKey });
      return await service.extractFromImage(imagePath, prompt);
    } catch (error) {
      return err(createAppError(ErrorCode.AI_API_ERROR, `图片识别失败: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });

  // Process protocol file - extract both criteria and visit schedule
  ipcMain.handle('ai:processProtocolFile', async (event, fileId: string, filePath: string): Promise<Result<any>> => {
    const keyResult = requireApiKey();
    if (!keyResult.success) return keyResult;
    const settings = keyResult.data;
    try {

    // Read PDF content (now handles both text and scanned)
      const pdfResult = await readPDFContent(filePath);

      let combinedText = '';

      if (pdfResult.type === 'text') {
        // Use extracted text directly
        combinedText = pdfResult.content;

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

        // Check if we need batch processing for text PDFs
        if (BatchProcessor.shouldBatch(combinedText)) {
          console.log(`[AI Handler] Large text PDF (${combinedText.length} chars), using batch processing`);
          sendProgress(event, 0, 2, '正在分批提取标准...');

          // Batch extract criteria
          const criteriaBatches = await BatchProcessor.processTextInBatches(
            combinedText,
            async (chunk, batchIdx, totalBatches) => {
              sendProgress(event, batchIdx + 1, totalBatches * 2, `正在提取标准 (批次 ${batchIdx + 1}/${totalBatches})`);
              const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });
              const result = await service.extractCriteria(fileId, chunk);
              return result.success ? result.data : { inclusionCriteria: [], exclusionCriteria: [] };
            }
          );

          sendProgress(event, 1, 2, '正在分批提取访视计划...');

          // Batch extract visit schedule
          const scheduleBatches = await BatchProcessor.processTextInBatches(
            combinedText,
            async (chunk, batchIdx, totalBatches) => {
              sendProgress(event, totalBatches + batchIdx + 1, totalBatches * 2, `正在提取访视计划 (批次 ${batchIdx + 1}/${totalBatches})`);
              const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });
              const result = await service.extractVisitSchedule(fileId, chunk);
              return result.success ? result.data : { visits: [] };
            }
          );

          // Merge results
          const mergedCriteria = ResultMerger.mergeExtractCriteriaResults(criteriaBatches);
          const mergedSchedule = ResultMerger.mergeVisitScheduleResults(scheduleBatches);

          sendProgress(event, 2, 2, '处理完成');

          return {
            success: true,
            data: {
              criteria: mergedCriteria,
              schedule: mergedSchedule,
            },
          };
        }

        // Small text PDF - single call (original behavior)
        const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });

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
      } else {
        // Scanned PDF
        const pdfProcessor = await getPDFProcessor();
        const totalPages = await pdfProcessor.getPDFPageCount(filePath);

        if (BatchProcessor.shouldBatchScanned(totalPages)) {
          console.log(`[AI Handler] Large scanned PDF (${totalPages} pages), using batch processing`);

          // Use free vision model for OCR
          const visionService = getGLMService({
            apiKey: settings.apiKey,
            modelName: 'glm-4.6v-flash'
          });

          // Batch process: convert to images → OCR each batch → collect text
          sendProgress(event, 0, 1, '正在分批转换扫描PDF...');
          const textBatches = await BatchProcessor.processScannedInBatches(
            filePath,
            pdfProcessor,
            async (imagePaths, batchIdx, totalBatches) => {
              sendProgress(event, batchIdx + 1, totalBatches, `正在OCR识别 (批次 ${batchIdx + 1}/${totalBatches})`);
              const textParts: string[] = [];
              for (const imagePath of imagePaths) {
                const result = await visionService.extractFromImage(
                  imagePath,
                  '请提取图片中的所有文字内容，包括标题、正文、表格等所有可见文字。'
                );
                if (result.success && result.data.text) {
                  textParts.push(result.data.text);
                }
              }
              return textParts.join('\n\n');
            },
            (progress) => {
              sendProgress(event, progress.current, progress.total, progress.stage);
            }
          );

          combinedText = textBatches.filter(t => t.length > 0).join('\n\n');

          // Clear cache after all batches
          clearPDFContentCache(filePath);

          if (combinedText.trim().length < 50) {
            return {
              success: false,
              error: createAppError(
                ErrorCode.AI_INVALID_RESPONSE,
                '无法从 PDF 中提取足够的文字内容。请确认文件格式正确。'
              ),
            };
          }

          // Now batch-extract from the combined OCR text
          sendProgress(event, 0, 2, '正在分批提取标准...');

          const criteriaBatches = await BatchProcessor.processTextInBatches(
            combinedText,
            async (chunk, batchIdx, totalBatches) => {
              const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });
              const result = await service.extractCriteria(fileId, chunk);
              return result.success ? result.data : { inclusionCriteria: [], exclusionCriteria: [] };
            }
          );

          const scheduleBatches = await BatchProcessor.processTextInBatches(
            combinedText,
            async (chunk, batchIdx, totalBatches) => {
              const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });
              const result = await service.extractVisitSchedule(fileId, chunk);
              return result.success ? result.data : { visits: [] };
            }
          );

          const mergedCriteria = ResultMerger.mergeExtractCriteriaResults(criteriaBatches);
          const mergedSchedule = ResultMerger.mergeVisitScheduleResults(scheduleBatches);

          sendProgress(event, 2, 2, '处理完成');

          return {
            success: true,
            data: {
              criteria: mergedCriteria,
              schedule: mergedSchedule,
            },
          };
        }

        // Small scanned PDF (≤10 pages) — original behavior
        const visionService = getGLMService({
          apiKey: settings.apiKey,
          modelName: 'glm-4.6v-flash'
        });

        const textParts: string[] = [];
        for (const imagePath of (pdfResult.imagePaths || [])) {
          const result = await visionService.extractFromImage(
            imagePath,
            '请提取图片中的所有文字内容，包括标题、正文、表格等所有可见文字。'
          );
          if (result.success && result.data.text) {
            textParts.push(result.data.text);
          }
        }

        combinedText = textParts.join('\n\n');

        await pdfProcessor.cleanupImages(pdfResult.imagePaths || []);
        clearPDFContentCache(filePath);

        if (combinedText.trim().length < 50) {
          return {
            success: false,
            error: createAppError(
              ErrorCode.AI_INVALID_RESPONSE,
              '无法从 PDF 中提取足够的文字内容。请确认文件格式正确。'
            ),
          };
        }

        const service = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });

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
      }
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
    const keyResult = requireApiKey();
    if (!keyResult.success) return keyResult;
    const settings = keyResult.data;
    try {
      // Read file content (PDF or image)
      let content: string;
      let imagePaths: string[] | undefined;

      if (filePath.toLowerCase().endsWith('.pdf')) {
        const pdfResult = await readPDFContent(filePath);

        if (pdfResult.type === 'text') {
          content = pdfResult.content;
        } else {
          // Scanned PDF - analyze directly with GLM-4V (no OCR step)
          const pdfProcessor = await getPDFProcessor();
          const totalPages = await pdfProcessor.getPDFPageCount(filePath);

          if (BatchProcessor.shouldBatchScanned(totalPages)) {
            // Large scanned PDF: process all pages in batches
            console.log(`[AI Handler] Large scanned subject PDF (${totalPages} pages), using batch processing`);
            sendProgress(event, 0, 1, '正在分批处理扫描PDF...');

            const visionService = getGLMService({
              apiKey: settings.apiKey,
              modelName: 'glm-4.6v-flash'
            });

            // Process all pages: collect subject data from each batch
            const subjectDataBatches = await BatchProcessor.processScannedInBatches(
              filePath,
              pdfProcessor,
              async (batchImagePaths, batchIdx, totalBatches) => {
                sendProgress(event, batchIdx + 1, totalBatches, `正在分析受试者数据 (批次 ${batchIdx + 1}/${totalBatches})`);

                // Extract subject data from each image in this batch
                const batchSubjects: any[] = [];
                for (const imagePath of batchImagePaths) {
                  try {
                    const result = await visionService.extractSubjectDataFromImage(imagePath);
                    if (result.success) {
                      batchSubjects.push(result.data);
                    }
                  } catch (e) {
                    console.error('[AI Handler] Failed to extract from page:', e);
                  }
                }
                return batchSubjects;
              },
              (progress) => {
                sendProgress(event, progress.current, progress.total, progress.stage);
              }
            );

            // Merge subject data from all batches
            const allSubjects = subjectDataBatches.flat();
            const mergedSubject = allSubjects.length > 0
              ? ResultMerger.mergeSubjectData(allSubjects)
              : {};

            // Also extract medications and visit dates from all pages
            const medicationService = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });
            let mergedMedications: any[] = [];
            let mergedVisits: any[] = [];

            // For medication/visit extraction, we need OCR text from all pages
            // Re-process first batch to get OCR text
            const visionService2 = getGLMService({
              apiKey: settings.apiKey,
              modelName: 'glm-4.6v-flash'
            });

            const textBatches = await BatchProcessor.processScannedInBatches(
              filePath,
              pdfProcessor,
              async (batchImagePaths) => {
                const textParts: string[] = [];
                for (const imagePath of batchImagePaths) {
                  try {
                    const result = await visionService2.extractFromImage(
                      imagePath,
                      '请提取图片中的所有文字内容，包括标题、正文、表格等所有可见文字。'
                    );
                    if (result.success && result.data.text) {
                      textParts.push(result.data.text);
                    }
                  } catch (e) {
                    console.error('[AI Handler] OCR failed for page:', e);
                  }
                }
                return textParts.join('\n\n');
              }
            );

            const fullText = textBatches.filter(t => t.length > 0).join('\n\n');

            if (fullText.length > 10) {
              // Extract medications from full text
              const medResult = await medicationService.recognizeMedications(fileId, fullText);
              if (medResult.success) {
                mergedMedications = medResult.data;
              }

              // Extract visit dates from full text
              const visitResult = await medicationService.extractSubjectVisitDates(fileId, fullText);
              if (visitResult.success && visitResult.data) {
                mergedVisits = visitResult.data.visits || [];
              }
            }

            clearPDFContentCache(filePath);

            sendProgress(event, 1, 1, '处理完成');

            return {
              success: true,
              data: {
                subject: mergedSubject,
                demographics: mergedSubject,
                visitDates: { visits: mergedVisits },
                medications: mergedMedications,
              },
            };
          }

          // Small scanned PDF (≤10 pages) — use ALL pages, extract both subject data and OCR text
          const visionService = getGLMService({
            apiKey: settings.apiKey,
            modelName: 'glm-4.6v-flash'
          });

          const allSubjectData: any[] = [];
          const allImagePaths = pdfResult.imagePaths || [];
          const textParts: string[] = [];

          // Extract subject data AND OCR text from ALL pages in a single pass
          for (const imagePath of allImagePaths) {
            try {
              const subjectResult = await visionService.extractSubjectDataFromImage(imagePath);
              if (subjectResult.success) {
                allSubjectData.push(subjectResult.data);
              }
            } catch (e) {
              console.error('[AI Handler] Failed to extract subject data from page:', e);
            }

            try {
              const ocrResult = await visionService.extractFromImage(
                imagePath,
                '请提取图片中的所有文字内容，包括标题、正文、表格等所有可见文字。'
              );
              if (ocrResult.success && ocrResult.data.text) {
                textParts.push(ocrResult.data.text);
              }
            } catch (e) {
              console.error('[AI Handler] OCR failed for page:', e);
            }
          }

          // Merge data from all pages
          const mergedSubject = allSubjectData.length > 0
            ? ResultMerger.mergeSubjectData(allSubjectData)
            : {};

          // Cleanup temporary images (single cleanup, no re-conversion needed)
          await pdfProcessor.cleanupImages(allImagePaths);
          clearPDFContentCache(filePath);

          // Extract visit dates and medications from OCR text
          let visitDates: any = { visits: [] };
          let medications: any[] = [];

          const fullText = textParts.join('\n\n');
          if (fullText.length > 10) {
            const textService = getGLMService({ apiKey: settings.apiKey, modelName: settings.modelName });

            const visitResult = await textService.extractSubjectVisitDates(fileId, fullText);
            if (visitResult.success) {
              visitDates = visitResult.data;
            }

            const medResult = await textService.recognizeMedications(fileId, fullText);
            if (medResult.success) {
              medications = medResult.data;
            }
          }

          // Return analysis result
          return {
            success: true,
            data: {
              subject: mergedSubject,
              demographics: mergedSubject,
              visitDates,
              medications,
            },
          };
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
      const subjectResult = await service.extractSubjectNumber(fileId, content);
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
    // Validate file paths
    if (!subjectFilePaths || !Array.isArray(subjectFilePaths) || subjectFilePaths.length === 0) {
      return err(createAppError(ErrorCode.VALIDATION_ERROR, '受试者文件路径不能为空'));
    }

    const keyResult = requireApiKey();
    if (!keyResult.success) return keyResult;
    const settings = keyResult.data;

    try {
      // Validate criteria arrays
      if (!inclusionCriteria || !Array.isArray(inclusionCriteria)) {
        return err(createAppError(ErrorCode.AI_INVALID_RESPONSE, '入选标准数据无效'));
      }

      if (!exclusionCriteria || !Array.isArray(exclusionCriteria)) {
        return err(createAppError(ErrorCode.AI_INVALID_RESPONSE, '排除标准数据无效'));
      }

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
        // Layer 1: Direct ID match
        if (idMap.has(aiId)) {
          return idMap.get(aiId)!.id;
        }

        // Try to clean up the ID (remove brackets, prefixes, etc.)
        const cleanId = aiId
          .replace(/\[ID:\s*/i, '')
          .replace(/\[id:\s*/i, '')
          .replace(/\[/g, '')
          .replace(/\]/g, '')
          .trim();

        if (idMap.has(cleanId)) {
          return idMap.get(cleanId)!.id;
        }

        // Layer 2: Numeric index match (for AI responses like "1", "2", "3", etc.)
        if (criteriaArray && criteriaArray.length > 0) {
          const numericIndex = parseInt(aiId);
          if (!isNaN(numericIndex) && numericIndex > 0 && numericIndex <= criteriaArray.length) {
            const matchedCriteria = criteriaArray[numericIndex - 1];
            return matchedCriteria.id;
          }
        }

        // Layer 3: Description similarity match (as fallback)
        if (criteriaArray && criteriaArray.length > 0) {
          const bestMatch = findCriteriaByDescription(aiId, criteriaArray);
          if (bestMatch && bestMatch.similarity > 0.85) {
            return bestMatch.criteria.id;
          }
        }

        console.warn(`[AI Handler] Could not normalize ID: ${aiId} -> cleaned: ${cleanId}`);
        return aiId; // Return original if no match found
      };

      // Process all files
      const results = [];
      const path = await import('path');

      for (let i = 0; i < subjectFilePaths.length; i++) {
        const filePath = subjectFilePaths[i];
        const fileName = path.basename(filePath);

        try {
          // Read subject file content
          let isScannedPDF = false;
          let imagePaths: string[] | undefined;
          let subjectData = ''; // Initialize to prevent "used before assignment" error

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
            // Analyze ALL pages for eligibility
            try {
              // Process each page individually and merge results
              const eligibilityBatches: Array<{
                inclusion: Array<{ id: string; eligible: boolean; reason: string }>;
                exclusion: Array<{ id: string; eligible: boolean; reason: string }>;
              }> = [];

              for (let pageIdx = 0; pageIdx < imagePaths.length; pageIdx++) {
                const pageImage = imagePaths[pageIdx];
                try {
                  const pageResult = await service.analyzeEligibilityFromImage(
                    pageImage,
                    inclusionCriteria,
                    exclusionCriteria
                  );
                  if (pageResult.success && pageResult.data) {
                    eligibilityBatches.push(pageResult.data);
                  }
                } catch (pageError) {
                  console.error(`[AI Handler] Failed to analyze page ${pageIdx + 1}:`, pageError);
                }
              }

              if (eligibilityBatches.length === 0) {
                result = {
                  success: false,
                  error: createAppError(ErrorCode.AI_API_ERROR, '所有页面的分析均失败')
                };
              } else if (eligibilityBatches.length === 1) {
                // Single page result, no need to merge
                result = { success: true, data: eligibilityBatches[0] };
              } else {
                // Merge results from multiple pages
                const merged = ResultMerger.mergeEligibilityResults(eligibilityBatches);
                result = { success: true, data: merged };
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

      // Log errors from failed results
      results.forEach((r) => {
        if (r.error) {
          console.error(`[AI Handler] Failed result: ${r.fileName} - ${r.error}`);
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
