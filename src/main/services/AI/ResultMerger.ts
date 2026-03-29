/**
 * CRA AI Assistant - Result Merger Service
 * Merges results from multiple batch processing rounds
 */

/**
 * Calculate string similarity using Levenshtein distance
 */
function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }

  const distance = costs[longer.length];
  return (longer.length - distance) / longer.length;
}

/**
 * Normalize criterion to consistent object format
 * AI may return strings or {category, description} objects
 */
function normalizeCriterion(item: any): { category: string; description: string } {
  if (typeof item === 'string') {
    return { category: '未分类', description: item };
  }
  return {
    category: item.category || '未分类',
    description: item.description || String(item),
  };
}

export class ResultMerger {
  /**
   * Merge criteria (inclusion or exclusion) from multiple batches
   * Deduplicates by description similarity (threshold 0.9), keeps more complete version
   */
  static mergeCriteria<T extends { category?: string; description: string }>(
    batches: T[][],
    similarityThreshold: number = 0.9
  ): T[] {
    const merged: T[] = [];

    for (const batch of batches) {
      for (const criterion of batch) {
        // Check if this criterion already exists (by similarity)
        const existingIndex = merged.findIndex(
          (existing) => stringSimilarity(existing.description, criterion.description) >= similarityThreshold
        );

        if (existingIndex === -1) {
          // New criterion, add it
          merged.push(criterion);
        } else {
          // Similar criterion exists — keep the more complete version
          const existing = merged[existingIndex];
          if (criterion.description.length > existing.description.length) {
            merged[existingIndex] = criterion;
          }
        }
      }
    }

    return merged;
  }

  /**
   * Merge visit schedules from multiple batches
   * Deduplicates by visitType, merges items arrays for same visitType
   */
  static mergeVisitSchedules<T extends { visitType: string; items?: any[]; [key: string]: any }>(
    batches: T[][]
  ): T[] {
    const merged: T[] = [];

    for (const batch of batches) {
      for (const visit of batch) {
        const existingIndex = merged.findIndex(
          (existing) => existing.visitType === visit.visitType
        );

        if (existingIndex === -1) {
          merged.push({ ...visit });
        } else {
          // Merge items arrays
          const existing = merged[existingIndex];
          const existingItems = existing.items || [];
          const newItems = visit.items || [];

          // Add new items that don't already exist by name
          for (const item of newItems) {
            const itemName = item.name?.toLowerCase();
            if (!existingItems.some((ei: any) => ei.name?.toLowerCase() === itemName)) {
              existingItems.push(item);
            }
          }

          merged[existingIndex] = {
            ...existing,
            ...visit,
            items: existingItems,
          };
        }
      }
    }

    return merged;
  }

  /**
   * Merge extract criteria results (containing both inclusionCriteria and exclusionCriteria)
   * Accepts any criteria shape (string[] or {category, description}[])
   */
  static mergeExtractCriteriaResults(
    batches: Array<{
      inclusionCriteria?: any[];
      exclusionCriteria?: any[];
    }>
  ): {
    inclusionCriteria: any[];
    exclusionCriteria: any[];
  } {
    const inclusionBatches = batches
      .map((b) => (b.inclusionCriteria || []).map(normalizeCriterion))
      .filter((b) => b.length > 0);
    const exclusionBatches = batches
      .map((b) => (b.exclusionCriteria || []).map(normalizeCriterion))
      .filter((b) => b.length > 0);

    return {
      inclusionCriteria: ResultMerger.mergeCriteria(inclusionBatches),
      exclusionCriteria: ResultMerger.mergeCriteria(exclusionBatches),
    };
  }

  /**
   * Merge visit schedule results
   */
  static mergeVisitScheduleResults(
    batches: Array<{
      visits?: Array<{
        visitType: string;
        visitDay?: string;
        visitWindow?: string;
        description?: string;
        items?: any[];
      }>;
    }>
  ): {
    visits: Array<{
      visitType: string;
      visitDay?: string;
      visitWindow?: string;
      description?: string;
      items?: any[];
    }>;
  } {
    const visitBatches = batches
      .map((b) => b.visits || [])
      .filter((b) => b.length > 0);

    return {
      visits: ResultMerger.mergeVisitSchedules(visitBatches),
    };
  }

  /**
   * Merge subject data from multiple batches
   * Non-null fields from later batches override earlier ones, arrays are deduplicated and merged
   */
  static mergeSubjectData<T extends Record<string, any>>(
    batches: T[]
  ): T {
    if (batches.length === 0) {
      return {} as T;
    }

    const merged: Record<string, any> = {};

    for (const batch of batches) {
      for (const [key, value] of Object.entries(batch)) {
        if (value === null || value === undefined) {
          continue;
        }

        if (Array.isArray(value)) {
          // Merge arrays by deduplication
          const existingArray: any[] = merged[key] || [];
          const mergedArray = [...existingArray];

          for (const item of value) {
            const itemKey = typeof item === 'object' && item !== null
              ? JSON.stringify(item)
              : String(item);

            if (!mergedArray.some((existing) => {
              const existingKey = typeof existing === 'object' && existing !== null
                ? JSON.stringify(existing)
                : String(existing);
              return existingKey === itemKey;
            })) {
              mergedArray.push(item);
            }
          }

          merged[key] = mergedArray;
        } else if (typeof value === 'object') {
          // For objects, later non-null values override
          merged[key] = { ...(merged[key] || {}), ...value };
        } else {
          // For primitives, later non-null values override
          merged[key] = value;
        }
      }
    }

    return merged as T;
  }

  /**
   * Merge eligibility analysis results from multiple batches
   * If all batches agree → take that result
   * If batches disagree → mark as "needs manual review"
   */
  static mergeEligibilityResults(
    batches: Array<{
      inclusion: Array<{ id: string; eligible: boolean; reason: string }>;
      exclusion: Array<{ id: string; eligible: boolean; reason: string }>;
    }>
  ): {
    inclusion: Array<{ id: string; eligible: boolean | null; reason: string }>;
    exclusion: Array<{ id: string; eligible: boolean | null; reason: string }>;
  } {
    const mergeItems = (
      itemsBatches: Array<Array<{ id: string; eligible: boolean; reason: string }>>
    ): Array<{ id: string; eligible: boolean | null; reason: string }> => {
      // Group by ID
      const byId = new Map<string, Array<{ eligible: boolean; reason: string }>>();

      for (const batch of itemsBatches) {
        for (const item of batch) {
          if (!byId.has(item.id)) {
            byId.set(item.id, []);
          }
          byId.get(item.id)!.push({ eligible: item.eligible, reason: item.reason });
        }
      }

      const result: Array<{ id: string; eligible: boolean | null; reason: string }> = [];

      for (const [id, entries] of byId) {
        if (entries.length === 0) continue;

        // Check if all entries agree
        const allEligible = entries.every((e) => e.eligible === true);
        const allIneligible = entries.every((e) => e.eligible === false);

        if (allEligible || allIneligible) {
          // Consensus: use the most common reason (first one from latest batch)
          result.push({
            id,
            eligible: allEligible,
            reason: entries[entries.length - 1].reason,
          });
        } else {
          // Disagreement: mark for manual review
          const trueCount = entries.filter((e) => e.eligible).length;
          const falseCount = entries.filter((e) => !e.eligible).length;
          // Use majority vote but indicate uncertainty
          const majorityEligible = trueCount > falseCount;
          result.push({
            id,
            eligible: majorityEligible,
            reason: `[多数${majorityEligible ? '符合' : '不符合'} (${trueCount}/${entries.length} 批次), 需人工审核] ${entries[entries.length - 1].reason}`,
          });
        }
      }

      return result;
    };

    const inclusionBatches = batches.map((b) => b.inclusion || []);
    const exclusionBatches = batches.map((b) => b.exclusion || []);

    return {
      inclusion: mergeItems(inclusionBatches),
      exclusion: mergeItems(exclusionBatches),
    };
  }
}
