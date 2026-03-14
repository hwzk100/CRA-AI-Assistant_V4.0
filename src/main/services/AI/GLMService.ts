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
   */
  private async callAPI(messages: unknown[], retries = this.config.maxRetries): Promise<Result<string>> {
    for (let i = 0; i < retries; i++) {
      try {
        const payload: GLMRequestPayload = {
          model: this.config.modelName,
          messages: messages as any,
          temperature: 0.3,
          top_p: 0.7,
        };

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
            return err(createAppError(
              ErrorCode.AI_API_ERROR,
              errorData.error.message,
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
      const truncatedContent = PromptEngine.truncateContent(content, 4000);
      const messages = PromptEngine.generateSubjectDataPrompt(truncatedContent);
      const result = await this.callAPI(messages);

      if (!result.success) {
        return result;
      }

      const parseResult = PromptEngine.parseJSONResponse<ExtractSubjectDataResult>(result.data);
      if (!parseResult.success) {
        return parseResult;
      }

      return ok(parseResult.data);
    } catch (error) {
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
   * Extract data from image
   * Note: This requires GLM-4V model which supports images
   */
  async extractFromImage(imagePath: string, userPrompt: string): Promise<Result<ImageExtractionResult>> {
    try {
      // Read and convert image to base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const messages = [
        {
          role: 'system' as const,
          content: PromptEngine['IMAGE_SYSTEM_PROMPT'],
        },
        {
          role: 'user' as const,
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ];

      const result = await this.callAPI(messages);

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
