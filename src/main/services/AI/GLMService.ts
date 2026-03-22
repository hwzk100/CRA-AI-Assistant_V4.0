/**
 * CRA AI Assistant - GLM-4 AI Service
 * Handles communication with Zhipu AI GLM-4 API
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import type {
  IAIService,
  AIServiceConfig,
  GLMRequestPayload,
  GLMResponse,
  GLMErrorResponse,
  ExtractCriteriaResult,
  ExtractVisitScheduleResult,
  ExtractSubjectDataResult,
  ExtractSubjectVisitDatesResult,
  ExtractSubjectVisitItemsResult,
  ImageExtractionResult,
} from './types';
import { Result, ok, err } from '@shared/types/core';
import { ErrorCode, createAppError } from '@shared/types/core';
import { PromptEngine } from './PromptEngine';

export class GLMService implements IAIService {
  private client: AxiosInstance;
  private config: AIServiceConfig;

  constructor(config: Partial<AIServiceConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || '',
      apiEndpoint: config.apiEndpoint || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      modelName: config.modelName || 'glm-4',
      timeout: config.timeout || 120000,
      maxRetries: config.maxRetries || 3,
    };

    this.client = axios.create({
      baseURL: this.config.apiEndpoint,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Update API configuration
   */
  updateConfig(config: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Make API call with retry logic
   * @param messages - Messages to send to the API
   * @param retries - Number of retry attempts
   * @param modelOverride - Optional model name override (e.g., 'glm-4.6v-flash' for image processing)
   */
  private async callAPI(messages: unknown[], retries = this.config.maxRetries, modelOverride?: string): Promise<Result<string>> {
    for (let i = 0; i < retries; i++) {
      try {
        const actualModel = modelOverride || this.config.modelName;
        console.log('[GLMService] callAPI - Using model:', actualModel, '(override:', modelOverride, ', default:', this.config.modelName, ')');

        const payload: GLMRequestPayload = {
          model: actualModel,
          messages: messages as any,
          temperature: 0.1,  // Lower temperature for more deterministic JSON output
          top_p: 0.7,
          max_tokens: 4096,  // Ensure enough tokens for complete response
        };

        console.log('[GLMService] Payload model:', payload.model);
        // Debug: Log message structure (not full content to avoid cluttering logs)
        console.log('[GLMService] Messages structure:', JSON.stringify(messages, (key, value) => {
          if (key === 'content' && Array.isArray(value)) {
            return '[Array with ' + value.length + ' items: ' + value.map((v: any) => {
              if (v.type === 'image_url') {
                return '{type: image_url, url: length=' + v.image_url?.url?.length + '}';
              }
              return '{type: ' + v.type + ', text=' + (v.text?.length || 0) + ' chars}';
            }).join(', ') + ']';
          }
          if (typeof value === 'string' && value.length > 100) {
            return '[String: ' + value.length + ' chars]';
          }
          return value;
        }, 2));

        const response = await this.client.post<GLMResponse>('', payload, {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        });

        const content = response.data.choices[0]?.message?.content;
        if (!content) {
          return err(createAppError(ErrorCode.AI_INVALID_RESPONSE, 'AI 返回空响应'));
        }

        return ok(content);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const errorData = error.response?.data as GLMErrorResponse;
          if (errorData?.error) {
            // Provide helpful error messages for common error codes
            let errorMessage = errorData.error.message;
            if (errorData.error.code === '1210') {
              errorMessage = `API 调用参数有误 (错误代码: 1210)。这可能是因为：\n1. API Key 没有视觉模型的访问权限\n2. 图片格式或大小不符合要求\n3. 请求参数格式不正确\n\n提示：GLM-4.6V-Flash 是智谱 AI 的免费视觉模型，应该可以直接使用。\n请访问 https://open.bigmodel.cn/ 查看您的 API Key 权限和支持的模型列表。`;
            }
            return err(createAppError(
              ErrorCode.AI_API_ERROR,
              errorMessage,
              errorData
            ));
          }

          // Network errors - retry
          if (i < retries - 1) {
            await this.delay(1000 * (i + 1)); // Exponential backoff
            continue;
          }

          return err(createAppError(
            ErrorCode.NETWORK_ERROR,
            `网络错误: ${error.message}`
          ));
        }

        return err(createAppError(
          ErrorCode.UNKNOWN_ERROR,
          `未知错误: ${error instanceof Error ? error.message : 'Unknown error'}`
        ));
      }
    }

    return err(createAppError(ErrorCode.AI_TIMEOUT, '请求超时，已达到最大重试次数'));
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test API connection
   */
  async testConnection(apiKey: string): Promise<Result<{ success: boolean; model?: string }>> {
    try {
      const messages = PromptEngine.generateTestPrompt();
      const result = await this.callAPI(messages);

      if (!result.success) {
        return result;
      }

      return ok({
        success: true,
        model: this.config.modelName,
      });
    } catch (error) {
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `连接测试失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Extract inclusion and exclusion criteria
   */
  async extractCriteria(fileId: string, pdfContent: string): Promise<Result<ExtractCriteriaResult>> {
    try {
      const truncatedContent = PromptEngine.truncateContent(pdfContent);
      const messages = PromptEngine.generateCriteriaPrompt(truncatedContent);
      const result = await this.callAPI(messages);

      if (!result.success) {
        return result;
      }

      const parseResult = PromptEngine.parseJSONResponse<ExtractCriteriaResult>(result.data);
      if (!parseResult.success) {
        return parseResult;
      }

      return ok(parseResult.data);
    } catch (error) {
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `提取标准失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Extract visit schedule
   */
  async extractVisitSchedule(fileId: string, pdfContent: string): Promise<Result<ExtractVisitScheduleResult>> {
    try {
      const truncatedContent = PromptEngine.truncateContent(pdfContent);
      const messages = PromptEngine.generateVisitSchedulePrompt(truncatedContent);
      const result = await this.callAPI(messages);

      if (!result.success) {
        return result;
      }

      const parseResult = PromptEngine.parseJSONResponse<ExtractVisitScheduleResult>(result.data);
      if (!parseResult.success) {
        return parseResult;
      }

      return ok(parseResult.data);
    } catch (error) {
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `提取访视计划失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Recognize medications
   */
  async recognizeMedications(fileId: string, content: string): Promise<Result<Array<{
    medicationName: string;
    dosage: string;
    frequency: string;
    route: string;
  }>>> {
    try {
      const truncatedContent = PromptEngine.truncateContent(content);
      const messages = PromptEngine.generateMedicationPrompt(truncatedContent);
      const result = await this.callAPI(messages);

      if (!result.success) {
        return result;
      }

      const parseResult = PromptEngine.parseJSONResponse<{ medications: Array<{
        medicationName: string;
        dosage: string;
        frequency: string;
        route: string;
      }> }>(result.data);

      if (!parseResult.success) {
        return parseResult;
      }

      return ok(parseResult.data.medications || []);
    } catch (error) {
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `识别用药记录失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Extract subject number
   */
  async extractSubjectNumber(fileId: string, content: string): Promise<Result<ExtractSubjectDataResult>> {
    try {
      console.log('[GLMService] Input content length:', content.length);
      console.log('[GLMService] Input content preview:', content.substring(0, 1000));
      const truncatedContent = PromptEngine.truncateContent(content, 4000);
      console.log('[GLMService] Truncated content length:', truncatedContent.length);
      console.log('[GLMService] Truncated content preview:', truncatedContent.substring(0, 1000));
      const messages = PromptEngine.generateSubjectDataPrompt(truncatedContent);
      console.log('[GLMService] System message:', messages[0].content.substring(0, 500));
      console.log('[GLMService] User message length:', messages[1].content.length);
      console.log('[GLMService] User message preview:', messages[1].content.substring(0, 500));

      // Write debug file
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const debugDir = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.claude', 'debug');
        await fs.mkdir(debugDir, { recursive: true });
        const promptContent = `=== SYSTEM PROMPT ===\n${messages[0].content}\n\n=== USER PROMPT ===\n${messages[1].content}`;
        await fs.writeFile(
          path.join(debugDir, 'ai-prompt-debug.txt'),
          promptContent
        );
        console.log('[GLMService] Debug prompt file written to:', path.join(debugDir, 'ai-prompt-debug.txt'));
        console.log('[GLMService] User message content length:', messages[1].content.length);
        console.log('[GLMService] User message actual content:', messages[1].content.substring(0, 2000));
      } catch (e) {
        console.error('[GLMService] Failed to write debug file:', e);
      }

      const result = await this.callAPI(messages);

      if (!result.success) {
        console.error('[GLMService] API call failed:', result.error);
        return result;
      }

      console.log('[GLMService] AI raw response:', result.data);
      const parseResult = PromptEngine.parseJSONResponse<ExtractSubjectDataResult>(result.data);
      if (!parseResult.success) {
        console.error('[GLMService] JSON parse failed:', parseResult.error);
        return parseResult;
      }

      console.log('[GLMService] Parsed subject data:', parseResult.data);
      return ok(parseResult.data);
    } catch (error) {
      console.error('[GLMService] Exception:', error);
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `提取受试者编号失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Extract subject visit dates
   */
  async extractSubjectVisitDates(fileId: string, content: string): Promise<Result<ExtractSubjectVisitDatesResult>> {
    try {
      const truncatedContent = PromptEngine.truncateContent(content);
      const messages = PromptEngine.generateVisitDatesPrompt(truncatedContent);
      const result = await this.callAPI(messages);

      if (!result.success) {
        return result;
      }

      const parseResult = PromptEngine.parseJSONResponse<ExtractSubjectVisitDatesResult>(result.data);
      if (!parseResult.success) {
        return parseResult;
      }

      return ok(parseResult.data);
    } catch (error) {
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `提取访视日期失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Extract subject visit items
   */
  async extractSubjectVisitItems(
    fileId: string,
    content: string,
    visitType: string
  ): Promise<Result<ExtractSubjectVisitItemsResult>> {
    try {
      const truncatedContent = PromptEngine.truncateContent(content, 4000);
      const messages = PromptEngine.generateVisitItemsPrompt(truncatedContent, visitType);
      const result = await this.callAPI(messages);

      if (!result.success) {
        return result;
      }

      const parseResult = PromptEngine.parseJSONResponse<ExtractSubjectVisitItemsResult>(result.data);
      if (!parseResult.success) {
        return parseResult;
      }

      return ok(parseResult.data);
    } catch (error) {
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `提取访视项目失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Extract data from image (OCR)
   * Note: This requires GLM-4V model which supports images
   * @deprecated Use extractSubjectDataFromImage or analyzeEligibilityFromImage for direct analysis
   */
  async extractFromImage(imagePath: string, userPrompt: string): Promise<Result<ImageExtractionResult>> {
    try {
      // Read and convert image to base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text',
              text: PromptEngine['IMAGE_SYSTEM_PROMPT'],
            },
            {
              type: 'image_url',
              image_url: {
                // 根据智谱 AI 官方 SDK，base64 图片需要 data URI 前缀
                url: `data:image/png;base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ];

      // 使用免费视觉模型 GLM-4.6V-Flash
      const result = await this.callAPI(messages, this.config.maxRetries, 'glm-4.6v-flash');

      if (!result.success) {
        return result;
      }

      const parseResult = PromptEngine.parseJSONResponse<ImageExtractionResult>(result.data);
      if (!parseResult.success) {
        // If JSON parsing fails, return as plain text
        return ok({
          text: result.data,
        });
      }

      return ok(parseResult.data);
    } catch (error) {
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `图片识别失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Extract subject data directly from image (no OCR step)
   * This method sends the image directly to VLM for analysis
   */
  async extractSubjectDataFromImage(
    imagePath: string
  ): Promise<Result<ExtractSubjectDataResult>> {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // 根据智谱 AI 官方 SDK，content 数组顺序：先 text，后 image_url
      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text',
              text: PromptEngine['SUBJECT_DATA_FROM_IMAGE_PROMPT'],
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ];

      // 使用免费视觉模型 GLM-4.6V-Flash
      const result = await this.callAPI(messages, this.config.maxRetries, 'glm-4.6v-flash');
      if (!result.success) {
        return result;
      }

      const parseResult = PromptEngine.parseJSONResponse<ExtractSubjectDataResult>(result.data);
      return parseResult;
    } catch (error) {
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `从图片提取受试者数据失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Analyze eligibility directly from image (no OCR step)
   * This method sends the image directly to VLM for eligibility analysis
   */
  async analyzeEligibilityFromImage(
    imagePath: string,
    inclusionCriteria: any[],
    exclusionCriteria: any[]
  ): Promise<Result<{
    inclusion: Array<{ id: string; eligible: boolean; reason: string }>;
    exclusion: Array<{ id: string; eligible: boolean; reason: string }>;
  }>> {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Debug: Log image info
      console.log('[GLMService] Image file:', imagePath);
      console.log('[GLMService] Image size:', imageBuffer.length, 'bytes (', (imageBuffer.length / 1024 / 1024).toFixed(2), 'MB)');
      console.log('[GLMService] Base64 length:', base64Image.length, 'characters');

      const prompt = PromptEngine.generateEligibilityFromImagePrompt(
        inclusionCriteria,
        exclusionCriteria
      );

      // Debug: Log the prompt being sent
      console.log('[GLMService] System prompt length:', prompt.system.length);
      console.log('[GLMService] User prompt length:', prompt.user.length);
      console.log('[GLMService] System prompt preview:', prompt.system.substring(0, 500));
      console.log('[GLMService] User prompt:', prompt.user);

      // 根据智谱 AI 官方 SDK，content 数组顺序：先 text，后 image_url
      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text',
              text: `${prompt.system}\n\n${prompt.user}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ];

      // 使用免费视觉模型 GLM-4.6V-Flash
      const result = await this.callAPI(messages, this.config.maxRetries, 'glm-4.6v-flash');
      if (!result.success) {
        return result;
      }

      console.log('[GLMService] AI raw response for eligibility:', result.data);

      const parseResult = PromptEngine.parseJSONResponse<any>(result.data);

      if (!parseResult.success) {
        console.error('[GLMService] Failed to parse eligibility response. Raw response:', result.data);
        // Return error with raw response for debugging
        return err(createAppError(
          ErrorCode.AI_PARSE_ERROR,
          `无法解析资格分析结果。AI返回：\n${result.data.substring(0, 500)}${result.data.length > 500 ? '...' : ''}`,
          parseResult.error
        ));
      }

      console.log('[GLMService] Parsed eligibility result:', JSON.stringify(parseResult.data, null, 2));

      // Handle both Chinese and English field names
      const data = parseResult.data;
      const inclusion = data.inclusion || data.入选标准;
      const exclusion = data.exclusion || data.排除标准;

      // Debug: Log the structure of the first item to understand the format
      if (inclusion && inclusion.length > 0) {
        console.log('[GLMService] First inclusion item type:', typeof inclusion[0]);
        console.log('[GLMService] First inclusion item:', inclusion[0]);
      }

      // Validate the parsed data structure
      if (!inclusion || !Array.isArray(inclusion)) {
        console.error('[GLMService] Invalid parsed data - missing or invalid inclusion array');
        return err(createAppError(
          ErrorCode.AI_PARSE_ERROR,
          '解析后的数据缺少 inclusion/入选标准 字段或格式不正确'
        ));
      }

      if (!exclusion || !Array.isArray(exclusion)) {
        console.error('[GLMService] Invalid parsed data - missing or invalid exclusion array');
        return err(createAppError(
          ErrorCode.AI_PARSE_ERROR,
          '解析后的数据缺少 exclusion/排除标准 字段或格式不正确'
        ));
      }

      // Normalize to English field names
      const normalizedData = {
        inclusion,
        exclusion
      };

      return ok(normalizedData);
    } catch (error) {
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `从图片分析资格失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Analyze subject eligibility against criteria
   */
  async analyzeEligibility(
    subjectData: string,
    inclusionCriteria: any[],
    exclusionCriteria: any[]
  ): Promise<Result<{
    inclusion: Array<{ id: string; eligible: boolean; reason: string }>;
    exclusion: Array<{ id: string; eligible: boolean; reason: string }>;
  }>> {
    try {
      const truncatedData = PromptEngine.truncateContent(subjectData, 6000);
      const messages = PromptEngine.generateEligibilityPrompt(truncatedData, inclusionCriteria, exclusionCriteria);
      const result = await this.callAPI(messages);

      if (!result.success) {
        return result;
      }

      console.log('[GLMService] AI raw response for eligibility:', result.data);

      const parseResult = PromptEngine.parseJSONResponse<{
        inclusion: Array<{ id: string; eligible: boolean; reason: string }>;
        exclusion: Array<{ id: string; eligible: boolean; reason: string }>;
      }>(result.data);

      if (!parseResult.success) {
        console.error('[GLMService] Failed to parse eligibility response. Raw response:', result.data);
        // Return error with raw response for debugging
        return err(createAppError(
          ErrorCode.AI_PARSE_ERROR,
          `无法解析资格分析结果。AI返回：\n${result.data.substring(0, 500)}${result.data.length > 500 ? '...' : ''}`,
          parseResult.error
        ));
      }

      console.log('[GLMService] Parsed eligibility result:', JSON.stringify(parseResult.data, null, 2));

      // Handle both Chinese and English field names
      const data = parseResult.data;
      const inclusion = data.inclusion || data.入选标准;
      const exclusion = data.exclusion || data.排除标准;

      // Validate the parsed data structure
      if (!inclusion || !Array.isArray(inclusion)) {
        console.error('[GLMService] Invalid parsed data - missing or invalid inclusion array');
        return err(createAppError(
          ErrorCode.AI_PARSE_ERROR,
          '解析后的数据缺少 inclusion/入选标准 字段或格式不正确'
        ));
      }

      if (!exclusion || !Array.isArray(exclusion)) {
        console.error('[GLMService] Invalid parsed data - missing or invalid exclusion array');
        return err(createAppError(
          ErrorCode.AI_PARSE_ERROR,
          '解析后的数据缺少 exclusion/排除标准 字段或格式不正确'
        ));
      }

      // Normalize to English field names
      const normalizedData = {
        inclusion,
        exclusion
      };

      return ok(normalizedData);
    } catch (error) {
      return err(createAppError(
        ErrorCode.AI_API_ERROR,
        `分析受试者资格失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }
}

// Singleton instance
let glmServiceInstance: GLMService | null = null;

export const getGLMService = (config?: Partial<AIServiceConfig>): GLMService => {
  if (!glmServiceInstance) {
    glmServiceInstance = new GLMService(config);
  } else if (config) {
    glmServiceInstance.updateConfig(config);
  }
  return glmServiceInstance;
};
