/**
 * CRA AI Assistant - Root Component
 */

import React from 'react';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { FileZone } from './components/FileUpload/FileZone';
import { useActiveWorksheet } from './hooks/useStore';
import { StorageZone, FileType } from '@shared/types';
import { InclusionCriteriaWorksheet } from './components/WorkSheet/InclusionCriteriaWorksheet';
import { ExclusionCriteriaWorksheet } from './components/WorkSheet/ExclusionCriteriaWorksheet';
import { VisitScheduleWorksheet } from './components/WorkSheet/VisitScheduleWorksheet';
import { SubjectVisitsWorksheet } from './components/WorkSheet/SubjectVisitsWorksheet';
import { MedicationsWorksheet } from './components/WorkSheet/MedicationsWorksheet';

function App(): React.ReactElement {
  const activeWorksheet = useActiveWorksheet();

  const renderWorksheet = () => {
    switch (activeWorksheet) {
      case 'inclusionCriteria':
        return <InclusionCriteriaWorksheet />;
      case 'exclusionCriteria':
        return <ExclusionCriteriaWorksheet />;
      case 'visitSchedule':
        return <VisitScheduleWorksheet />;
      case 'subjectVisits':
        return <SubjectVisitsWorksheet />;
      case 'medications':
        return <MedicationsWorksheet />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-lg">未知的工作表类型</p>
            </div>
          </div>
        );
    }
  };

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
          <div className="w-80 p-4 border-r border-gray-200 flex flex-col overflow-hidden">
            {/* Protocol Files */}
            <div className="flex-shrink-0 h-48">
              <FileZone
                zone={StorageZone.PROTOCOL}
                title="方案文件"
                description="上传 PDF 或图片格式的临床试验方案"
                icon="📋"
                acceptedTypes={[FileType.PDF, FileType.IMAGE]}
              />
            </div>

            {/* Subject Files */}
            <div className="flex-1 mt-4 min-h-0">
              <FileZone
                zone={StorageZone.SUBJECT}
                title="受试者文件"
                description="上传受试者相关文档"
                icon="👤"
                acceptedTypes={[FileType.PDF, FileType.IMAGE]}
              />
            </div>
          </div>

          {/* Right Panel - Worksheet Content */}
          <div className="flex-1 flex flex-col bg-white">
            {renderWorksheet()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
