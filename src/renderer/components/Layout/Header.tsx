/**
 * CRA AI Assistant - Header Component
 */

import React from 'react';
import { useSettings, useIsProcessing } from '../../hooks/useStore';
import { PROCESSING_STAGE_MESSAGES } from '@shared/constants';

export const Header: React.FC = () => {
  const settings = useSettings();
  const isProcessing = useIsProcessing();

  return (
    <header className="h-14 bg-primary-600 text-white flex items-center justify-between px-4 shadow-md">
      {/* Left Section - Logo and Title */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
          <span className="text-primary-600 font-bold text-lg">C</span>
        </div>
        <h1 className="text-xl font-semibold">CRA AI Assistant</h1>
      </div>

      {/* Center Section - Processing Status */}
      {isProcessing && (
        <div className="flex items-center space-x-2 bg-primary-700 px-4 py-1.5 rounded-full">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">处理中...</span>
        </div>
      )}

      {/* Right Section - Actions */}
      <div className="flex items-center space-x-2">
        {settings.apiKey ? (
          <div className="flex items-center space-x-1.5 bg-primary-700 px-3 py-1.5 rounded-md">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-xs font-medium">API 已连接</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 bg-red-500 px-3 py-1.5 rounded-md">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="text-xs font-medium">API 未配置</span>
          </div>
        )}
      </div>
    </header>
  );
};
