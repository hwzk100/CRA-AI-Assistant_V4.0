/**
 * CRA AI Assistant - Prompt Engine
 * Manages all AI prompt templates for GLM-4
 */

import type { GLMMessage } from './types';
import type { Result } from '@shared/types';
import { ErrorCode } from '@shared/types/core';

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

你需要从受试者文档中提取受试者的基本信息和编号信息。

请仔细查找并提取以下信息：
- 受试者编号/筛选号/随机号
- 年龄（查找"年龄"、"岁"等关键词）
- 性别（男/女）
- 身高（cm）
- 体重（kg）
- 民族
- 出生日期

如果某些信息在文档中不存在，请使用 null 值。

输出格式：
{
  "subjectNumber": "受试者编号",
  "screeningNumber": "筛选号",
  "randomizationNumber": "随机号",
  "age": 年龄数字或null,
  "gender": "男"/"女"/null,
  "height": 身高数字或null,
  "weight": 体重数字或null,
  "ethnicity": "民族"或null,
  "birthDate": "YYYY-MM-DD"或null
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

  private static readonly SUBJECT_DATA_FROM_IMAGE_PROMPT = `你是一位专业的临床试验研究助理(CRA)，负责从医疗文档图片中直接提取受试者数据。

请仔细观察图片，提取以下信息：
- 受试者编号/筛选号/随机号
- 年龄（查找"年龄"、"岁"等关键词）
- 性别（男/女）
- 身高（cm）
- 体重（kg）
- 民族
- 出生日期

如果某些信息在文档中不存在，请使用 null 值。

输出格式（必须是纯JSON）：
{
  "subjectNumber": "受试者编号",
  "screeningNumber": "筛选号",
  "randomizationNumber": "随机号",
  "age": 年龄数字或null,
  "gender": "男"/"女"/null,
  "height": 身高数字或null,
  "weight": 体重数字或null,
  "ethnicity": "民族"或null,
  "birthDate": "YYYY-MM-DD"或null
}`;

  private static readonly ELIGIBILITY_FROM_IMAGE_PROMPT = `你是临床试验数据分析师。分析图片中的医疗文档，判断受试者是否符合每一条标准。

返回JSON格式：{"inclusion": [{"id": "标准ID", "eligible": true, "reason": "原因"}], "exclusion": []}

要求：
- id使用提供的完整ID
- eligible是布尔值true/false
- 使用英文字段名inclusion和exclusion`;

  private static readonly ELIGIBILITY_SYSTEM_PROMPT = `${PromptEngine.BASE_SYSTEM_PROMPT}

你需要根据受试者数据，逐一分析受试者是否符合每一条入选标准和排除标准。

对于入选标准：
- eligible: true 表示符合该标准
- eligible: false 表示不符合该标准

对于排除标准：
- eligible: true 表示符合该标准（即应被排除）
- eligible: false 表示不符合该标准（即不被排除）

输出格式要求（必须严格遵循）：
- 必须使用英文字段名：inclusion 和 exclusion（不要使用中文）
- 每条标准必须是一个对象，包含 id、eligible、reason 三个字段

正确的JSON格式：
{
  "inclusion": [
    {
      "id": "标准ID",
      "eligible": true/false,
      "reason": "符合或不符合的详细原因"
    }
  ],
  "exclusion": [
    {
      "id": "标准ID",
      "eligible": true/false,
      "reason": "符合或不符合的详细原因"
    }
  ]
}

【重要】
1. 只输出纯JSON，不要使用markdown代码块
2. 必须使用英文字段名 inclusion 和 exclusion
3. 布尔值使用 true/false，不要用字符串`;

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
        content: `请从以下文档中提取受试者的基本信息和编号信息（包括年龄、性别、身高、体重、民族、出生日期等）：\n\n${documentContent}`,
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

  /**
   * Generate prompt for eligibility analysis
   */
  static generateEligibilityPrompt(
    subjectData: string,
    inclusionCriteria: any[],
    exclusionCriteria: any[]
  ): GLMMessage[] {
    // Ensure arrays are valid
    const inclusionList = Array.isArray(inclusionCriteria) ? inclusionCriteria : [];
    const exclusionList = Array.isArray(exclusionCriteria) ? exclusionCriteria : [];

    const criteriaText = `
入选标准：
${inclusionList.map((c, i) => `${i + 1}. [ID: ${c.id}] ${c.description}`).join('\n')}

排除标准：
${exclusionList.map((c, i) => `${i + 1}. [ID: ${c.id}] ${c.description}`).join('\n')}
`;

    return [
      {
        role: 'system',
        content: this.ELIGIBILITY_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `请根据以下受试者数据，分析其是否符合上述标准：\n\n受试者数据：\n${subjectData}\n\n${criteriaText}`,
      },
    ];
  }

  /**
   * Generate prompt for eligibility analysis from image (direct VLM analysis, no OCR)
   */
  static generateEligibilityFromImagePrompt(
    inclusionCriteria: any[],
    exclusionCriteria: any[]
  ): { system: string; user: string } {
    // Ensure arrays are valid
    const inclusionList = Array.isArray(inclusionCriteria) ? inclusionCriteria : [];
    const exclusionList = Array.isArray(exclusionCriteria) ? exclusionCriteria : [];

    const criteriaText = inclusionList.map((c) => `${c.id}: ${c.description}`).join('\n');

    return {
      system: this.ELIGIBILITY_FROM_IMAGE_PROMPT,
      user: `分析受试者是否符合以下${inclusionList.length}条入选标准：\n\n${criteriaText}\n\n返回JSON格式结果。`,
    };
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
   * Split content into chunks for batch processing
   * @param content - Full text content to split
   * @param chunkTokens - Target chunk size in tokens
   * @param overlapTokens - Overlap between chunks in tokens
   * @returns Array of content chunks with batch indicators
   */
  static splitContent(content: string, chunkTokens: number, overlapTokens: number): string[] {
    const chunkChars = chunkTokens * 2; // 1 token ≈ 2 chars for Chinese
    const overlapChars = overlapTokens * 2;

    if (content.length <= chunkChars) {
      return [content];
    }

    const chunks: string[] = [];
    let startPos = 0;

    while (startPos < content.length) {
      let endPos = Math.min(startPos + chunkChars, content.length);

      // If this is not the last chunk, try to find a good split point
      if (endPos < content.length) {
        const searchRange = content.substring(startPos, endPos);
        const splitPriority: Array<{ separator: string; name: string }> = [
          { separator: '\n\n', name: 'paragraph' },
          { separator: '\n', name: 'line' },
          { separator: '。', name: 'sentence' },
        ];

        let bestSplitPos = -1;
        for (const { separator } of splitPriority) {
          const lastIdx = searchRange.lastIndexOf(separator);
          if (lastIdx > chunkChars * 0.5) {
            // Only split at positions in the latter half to avoid tiny chunks
            bestSplitPos = startPos + lastIdx + separator.length;
            break;
          }
        }

        if (bestSplitPos > 0) {
          endPos = bestSplitPos;
        }
      }

      const chunk = content.substring(startPos, endPos).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Move start position back by overlap amount for context continuity
      startPos = endPos - overlapChars;
      if (startPos >= content.length) break;
      // Ensure progress: if overlap would cause us to stay in same spot, advance
      if (startPos <= (chunks.length > 1 ? endPos - chunkChars + overlapChars : 0)) {
        startPos = endPos;
      }
    }

    // Add batch indicators to each chunk
    const totalChunks = chunks.length;
    return chunks.map((chunk, index) => {
      if (totalChunks <= 1) return chunk;
      return `[这是长文档的第${index + 1}/${totalChunks}段，请仅提取本批次中的信息]\n\n${chunk}`;
    });
  }

  /**
   * Clean and parse JSON response
   */
  static parseJSONResponse<T>(response: string): Result<T> {
    console.log('[PromptEngine] Attempting to parse AI response, length:', response.length);
    console.log('[PromptEngine] Response preview:', response.substring(0, 300));

    try {
      // Try direct parse first
      return { success: true, data: JSON.parse(response) };
    } catch (directError) {
      console.log('[PromptEngine] Direct parse failed, trying to extract JSON from markdown...');

      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          console.log('[PromptEngine] Found JSON in markdown code block');
          return { success: true, data: JSON.parse(jsonMatch[1]) };
        } catch (markdownError) {
          console.log('[PromptEngine] Markdown JSON parse failed:', markdownError);
          // Fall through to next attempt
        }
      }

      // Try to find JSON object in response (look for { ... })
      const objectMatch = response.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          console.log('[PromptEngine] Found JSON object in response');
          return { success: true, data: JSON.parse(objectMatch[0]) };
        } catch (objectError) {
          console.log('[PromptEngine] JSON object parse failed:', objectError);
          // Fall through to error
        }
      }

      // All attempts failed - return detailed error
      console.error('[PromptEngine] All JSON parse attempts failed. Full response:', response);
      return {
        success: false,
        error: {
          code: ErrorCode.AI_PARSE_ERROR,
          message: `无法解析 AI 返回的 JSON 数据。原始响应：\n${response.substring(0, 1000)}${response.length > 1000 ? '\n... (响应已截断)' : ''}`,
          details: response,
        },
      };
    }
  }
}
