/**
 * CRA AI Assistant - Root Component
 */

import React from 'react';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { FileZone } from './components/FileUpload/FileZone';
import { useActiveWorksheet, WORKSHEET_CONFIG } from './components/WorkSheet/TabBar';
import { StorageZone, FileType } from '@shared/types';

// Placeholder components for worksheets
const WorksheetPlaceholder: React.FC<{ type: string }> = ({ type }) => {
  const config = WORKSHEET_CONFIG[type as keyof typeof WORKSHEET_CONFIG];

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">{config?.icon || '📋'}</div>
        <h2 className="text-2xl font-bold text-gray-700 mb-2">
          {config?.title || type}
        </h2>
        <p className="text-gray-500 mb-6">{config?.description || '工作表'}</p>
        <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
          <span className="text-sm">此工作表功能开发中</span>
        </div>
      </div>
    </div>
  );
};

function App(): React.ReactElement {
  const activeWorksheet = useActiveWorksheet();

  return (
    <div className="h-screen w-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <Header />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Content Area */}
        <main className="flex-1 flex overflow-hidden">
          {/* Left Panel - File Upload */}
          <div className="w-80 p-4 overflow-y-auto border-r border-gray-200">
            <div className="space-y-4">
              {/* Protocol Files */}
              <div className="h-64">
                <FileZone
                  zone={StorageZone.PROTOCOL}
                  title="方案文件"
                  description="上传 PDF 或图片格式的临床试验方案"
                  icon="📋"
                  acceptedTypes={[FileType.PDF, FileType.IMAGE]}
                />
              </div>

              {/* Subject Files */}
              <div className="flex-1">
                <FileZone
                  zone={StorageZone.SUBJECT}
                  title="受试者文件"
                  description="上传受试者相关文档"
                  icon="👤"
                  acceptedTypes={[FileType.PDF, FileType.IMAGE]}
                />
              </div>
            </div>
          </div>

          {/* Right Panel - Worksheet Content */}
          <div className="flex-1 flex flex-col bg-white">
            <WorksheetPlaceholder type={activeWorksheet} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
