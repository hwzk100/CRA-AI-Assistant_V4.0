/**
 * CRA AI Assistant - Prompt Engine
 * Manages all AI prompt templates for GLM-4
 */

import type { GLMMessage } from './types';

export class PromptEngine {
  // ============================================================================
  // System Prompts
  // ============================================================================

  private static readonly BASE_SYSTEM_PROMPT = `你是一位专业的临床试验研究助理(CRA)，负责从临床试验方案和受试者文档中提取和整理数据。
你的输出必须是严格的JSON格式，不要包含任何额外的文字说明。
所有日期格式必须使用 ISO 8601 格式 (YYYY-MM-DD)。`;

  private static readonly CRITERIA_SYSTEM_PROMPT = `${PromptEngine.BASE_SYSTEM_PROMPT}

你需要从临床试验方案中提取入选标准和排除标准。

输出格式：
{
  "inclusionCriteria": [
    {
      "category": "分类",
      "description": "标准描述"
    }
  ],
  "exclusionCriteria": [
    {
      "category": "分类",
      "description": "标准描述"
    }
  ]
}`;

  private static readonly VISIT_SCHEDULE_SYSTEM_PROMPT = `${PromptEngine.BASE_SYSTEM_PROMPT}

你需要从临床试验方案中提取访视计划。

输出格式：
{
  "visits": [
    {
      "visitType": "访视名称",
      "visitDay": "第X天/第X周",
      "visitWindow": "时间窗口",
      "description": "描述",
      "items": [
        {
          "name": "项目名称",
          "category": "分类",
          "required": true/false
        }
      ]
    }
  ]
}`;

  private static readonly SUBJECT_DATA_SYSTEM_PROMPT = `${PromptEngine.BASE_SYSTEM_PROMPT}

你需要从受试者文档中提取受试者编号信息。

输出格式：
{
  "subjectNumber": "受试者编号",
  "screeningNumber": "筛选号",
  "randomizationNumber": "随机号"
}`;

  private static readonly VISIT_DATES_SYSTEM_PROMPT = `${PromptEngine.BASE_SYSTEM_PROMPT}

你需要从受试者文档中提取访视日期信息。

输出格式：
{
  "visits": [
    {
      "visitType": "访视名称",
      "date": "YYYY-MM-DD"
    }
  ]
}`;

  private static readonly VISIT_ITEMS_SYSTEM_PROMPT = `${PromptEngine.BASE_SYSTEM_PROMPT}

你需要从受试者文档中提取特定访视的检查项目数据。

输出格式：
{
  "items": [
    {
      "name": "项目名称",
      "value": "值",
      "unit": "单位",
      "completed": true/false
    }
  ]
}`;

  private static readonly MEDICATION_SYSTEM_PROMPT = `${PromptEngine.BASE_SYSTEM_PROMPT}

你需要从文档中识别用药记录。

输出格式：
{
  "medications": [
    {
      "medicationName": "药品名称",
      "dosage": "剂量",
      "frequency": "频率",
      "route": "给药途径"
    }
  ]
}`;

  private static readonly IMAGE_SYSTEM_PROMPT = `你是一个专业的临床试验数据提取助手。
你需要从图片中识别并提取相关的临床试验数据。
请提供详细的文字描述和结构化的数据。

输出格式：
{
  "text": "图片中的文字内容",
  "data": {
    // 根据具体内容提取的结构化数据
  }
}`;

  // ============================================================================
  // Prompt Generation Methods
  // ============================================================================

  /**
   * Generate prompt for extracting inclusion/exclusion criteria
   */
  static generateCriteriaPrompt(documentContent: string): GLMMessage[] {
    return [
      {
        role: 'system',
        content: this.CRITERIA_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `请从以下临床试验方案中提取入选标准和排除标准：\n\n${documentContent}`,
      },
    ];
  }

  /**
   * Generate prompt for extracting visit schedule
   */
  static generateVisitSchedulePrompt(documentContent: string): GLMMessage[] {
    return [
      {
        role: 'system',
        content: this.VISIT_SCHEDULE_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `请从以下临床试验方案中提取访视计划：\n\n${documentContent}`,
      },
    ];
  }

  /**
   * Generate prompt for extracting subject data
   */
  static generateSubjectDataPrompt(documentContent: string): GLMMessage[] {
    return [
      {
        role: 'system',
        content: this.SUBJECT_DATA_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `请从以下文档中提取受试者编号信息：\n\n${documentContent}`,
      },
    ];
  }

  /**
   * Generate prompt for extracting visit dates
   */
  static generateVisitDatesPrompt(documentContent: string): GLMMessage[] {
    return [
      {
        role: 'system',
        content: this.VISIT_DATES_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `请从以下文档中提取访视日期信息：\n\n${documentContent}`,
      },
    ];
  }

  /**
   * Generate prompt for extracting visit items
   */
  static generateVisitItemsPrompt(documentContent: string, visitType: string): GLMMessage[] {
    return [
      {
        role: 'system',
        content: this.VISIT_ITEMS_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `请从以下文档中提取${visitType}的检查项目数据：\n\n${documentContent}`,
      },
    ];
  }

  /**
   * Generate prompt for recognizing medications
   */
  static generateMedicationPrompt(documentContent: string): GLMMessage[] {
    return [
      {
        role: 'system',
        content: this.MEDICATION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `请从以下文档中识别用药记录：\n\n${documentContent}`,
      },
    ];
  }

  /**
   * Generate prompt for image extraction
   */
  static generateImagePrompt(userPrompt: string): GLMMessage[] {
    return [
      {
        role: 'system',
        content: this.IMAGE_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];
  }

  /**
   * Generate test connection prompt
   */
  static generateTestPrompt(): GLMMessage[] {
    return [
      {
        role: 'system',
        content: '你是一个友好的助手。',
      },
      {
        role: 'user',
        content: '请回复"连接成功"，确认API正常工作。',
      },
    ];
  }

  // ============================================================================
  // Content Processing
  // ============================================================================

  /**
   * Truncate content to fit within token limits
   */
  static truncateContent(content: string, maxTokens: number = 8000): string {
    // Rough estimation: 1 token ≈ 2 characters for Chinese
    const maxChars = maxTokens * 2;
    if (content.length <= maxChars) {
      return content;
    }

    // Truncate and add indicator
    return content.substring(0, maxChars - 50) + '\n\n[内容过长，已截断...]';
  }

  /**
   * Clean and parse JSON response
   */
  static parseJSONResponse<T>(response: string): Result<T> {
    try {
      // Try direct parse first
      return { success: true, data: JSON.parse(response) };
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return { success: true, data: JSON.parse(jsonMatch[1]) };
        } catch {
          // Fall through to error
        }
      }

      // Try to find JSON object in response
      const objectMatch = response.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return { success: true, data: JSON.parse(objectMatch[0]) };
        } catch {
          // Fall through to error
        }
      }

      return {
        success: false,
        error: {
          code: 'AI_PARSE_ERROR' as const,
          message: '无法解析 AI 返回的 JSON 数据',
          details: response,
        },
      };
    }
  }
}
