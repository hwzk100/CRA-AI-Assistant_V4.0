/**
 * CRA AI Assistant - Eligibility Matrix Component
 * Displays eligibility analysis results in a matrix format
 * with files as columns and criteria as rows
 */

import React from 'react';
import type { InclusionCriteria, ExclusionCriteria, FileInfo } from '@shared/types';

interface EligibilityMatrixProps {
  criteria: InclusionCriteria[] | ExclusionCriteria[];
  subjectFiles: FileInfo[];
  isInclusion: boolean;
}

/**
 * Get eligibility badge component
 */
const getEligibilityBadge = (eligible: boolean, isInclusion: boolean): React.ReactNode => {
  if (isInclusion) {
    // For inclusion criteria: eligible = true is good (green)
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
        eligible
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700'
      }`}>
        {eligible ? '✓ 符合' : '✗ 不符合'}
      </span>
    );
  } else {
    // For exclusion criteria: eligible = true means should be excluded (red)
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
        eligible
          ? 'bg-red-100 text-red-700'
          : 'bg-green-100 text-green-700'
      }`}>
        {eligible ? '✗ 应排除' : '✓ 不排除'}
      </span>
    );
  }
};

/**
 * Check if any file results exist
 */
const hasFileResults = (
  criteria: InclusionCriteria[] | ExclusionCriteria[]
): boolean => {
  return criteria.some(c => c.fileResults && c.fileResults.length > 0);
};

export const EligibilityMatrix: React.FC<EligibilityMatrixProps> = ({
  criteria,
  subjectFiles,
  isInclusion
}) => {
  const completedFiles = subjectFiles.filter(f => f.status === 'completed');

  // Show message if no completed files
  if (completedFiles.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">请先上传受试者资料并等待处理完成</p>
        </div>
      </div>
    );
  }

  // Show message if no criteria
  if (criteria.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <p className="text-sm">暂无标准</p>
      </div>
    );
  }

  // Show message if no file results yet
  if (!hasFileResults(criteria)) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">点击"分析受试者资格"按钮开始分析</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
              标准描述
            </th>
            {completedFiles.map((file) => (
              <th
                key={file.id}
                className="px-4 py-3 text-center text-sm font-medium text-gray-700 border-l border-gray-200 min-w-[150px] max-w-[200px]"
              >
                <div className="truncate" title={file.name}>{file.name}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, index) => (
            <tr
              key={c.id}
              className={`hover:bg-gray-50 ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
              }`}
            >
              <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200 sticky left-0 bg-white z-10">
                <div className="font-medium">{c.description}</div>
              </td>
              {completedFiles.map((file) => {
                const fileResult = c.fileResults?.find((r) => r.fileId === file.id);
                return (
                  <td
                    key={file.id}
                    className="px-4 py-3 text-center border-b border-l border-gray-200"
                  >
                    {fileResult ? (
                      <div className="space-y-1">
                        <div className="flex justify-center">
                          {getEligibilityBadge(fileResult.eligible, isInclusion)}
                        </div>
                        {fileResult.reason && (
                          <p
                            className="text-xs text-gray-500 truncate"
                            title={fileResult.reason}
                          >
                            {fileResult.reason}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">未分析</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EligibilityMatrix;
