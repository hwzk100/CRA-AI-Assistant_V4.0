/**
 * CRA AI Assistant - Worksheet Tab Bar Component
 */

import React from 'react';
import { useActiveWorksheet, useStore } from '../../hooks/useStore';
import { WORKSHEET_CONFIG, type WorksheetType } from '@shared/constants';

export const TabBar: React.FC = () => {
  const activeWorksheet = useActiveWorksheet();
  const setActiveWorksheet = useStore((state) => state.setActiveWorksheet);

  const worksheets: { type: WorksheetType }[] = [
    { type: 'inclusionCriteria' },
    { type: 'exclusionCriteria' },
    { type: 'visitSchedule' },
    { type: 'subjectVisits' },
    { type: 'medications' },
  ];

  return (
    <div className="flex items-center space-x-1 bg-white border-b border-gray-200 px-4">
      {worksheets.map(({ type }) => {
        const config = WORKSHEET_CONFIG[type];
        const isActive = activeWorksheet === type;

        return (
          <button
            key={type}
            onClick={() => setActiveWorksheet(type)}
            className={`
              flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors duration-150
              ${isActive
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }
            `}
          >
            <span>{config.icon}</span>
            <span className="text-sm font-medium">{config.title}</span>
          </button>
        );
      })}
    </div>
  );
};
