/**
 * CRA AI Assistant - File Upload Zone Component
 */

import React, { useCallback, useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { StorageZone, FileType, FileStatus } from '@shared/types';

interface FileZoneProps {
  zone: StorageZone;
  title: string;
  description: string;
  icon: string;
  acceptedTypes: FileType[];
}

export const FileZone: React.FC<FileZoneProps> = ({
  zone,
  title,
  description,
  icon,
  acceptedTypes,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { addFile, updateFileStatus, setProtocolFiles, setSubjectFiles, removeFile } = useStore();

  const files = zone === StorageZone.PROTOCOL
    ? useStore((state) => state.protocolFiles)
    : useStore((state) => state.subjectFiles);

  // Clear all files handler
  const handleClearAll = () => {
    if (files.length === 0) return;

    const zoneName = zone === StorageZone.PROTOCOL ? '方案' : '受试者';
    if (confirm(`确定要清空所有${zoneName}文件吗？`)) {
      if (zone === StorageZone.PROTOCOL) {
        setProtocolFiles([]);
      } else {
        setSubjectFiles([]);
      }
    }
  };

  // 处理单个文件上传（只添加到列表，不处理）
  const handleFileUpload = async (file: File) => {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('handleFileUpload started for:', file.name, 'zone:', zone);

    try {
      // Create file info object
      const fileInfo = {
        id: fileId,
        name: file.name,
        path: (file as any).path || file.name,
        size: file.size,
        type: file.type.includes('pdf') ? FileType.PDF : FileType.IMAGE,
        status: FileStatus.PENDING,
        uploadedAt: new Date(),
      };
      console.log('File info created:', fileInfo);

      // Add to store
      addFile(zone, fileInfo);
      console.log('File added to store:', fileId);
    } catch (error) {
      console.error('Failed to add file:', error);
    } finally {
      // Reset file input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 处理单个文件的 AI 分析
  const processSingleFile = async (fileInfo: any): Promise<boolean> => {
    const { id: fileId, path: filePath } = fileInfo;

    try {
      // Update status to processing
      updateFileStatus(zone, fileId, FileStatus.PROCESSING);

      // Check API key
      const settingsResult = await window.electronAPI.getSettings();
      if (!settingsResult.success || !settingsResult.data.apiKey) {
        updateFileStatus(zone, fileId, FileStatus.FAILED, '请先在设置中配置 API Key');
        return false;
      }

      // Process file based on zone
      let processResult;
      if (zone === StorageZone.PROTOCOL) {
        processResult = await window.electronAPI.processProtocolFile(fileId, filePath);

        if (processResult.success) {
          const { criteria, schedule } = processResult.data;

          // Clear existing data for protocol files (only keep the latest)
          const { setInclusionCriteria, setExclusionCriteria, setVisitSchedule } = useStore.getState();

          // Store inclusion criteria
          if (criteria.inclusionCriteria && Array.isArray(criteria.inclusionCriteria)) {
            const inclusionData = criteria.inclusionCriteria.map((c: any) => ({
              id: `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              category: c.category || '未分类',
              description: c.description,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));
            setInclusionCriteria(inclusionData);
          }

          // Store exclusion criteria
          if (criteria.exclusionCriteria && Array.isArray(criteria.exclusionCriteria)) {
            const exclusionData = criteria.exclusionCriteria.map((c: any) => ({
              id: `exc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              category: c.category || '未分类',
              description: c.description,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));
            setExclusionCriteria(exclusionData);
          }

          // Store visit schedule
          if (schedule.visits && Array.isArray(schedule.visits)) {
            const visitData = schedule.visits.map((v: any) => ({
              id: `visit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              visitType: v.visitType,
              visitDay: v.visitDay,
              visitWindow: v.visitWindow,
              description: v.description,
              items: v.items || [],
              createdAt: new Date(),
              updatedAt: new Date(),
            }));
            setVisitSchedule(visitData);
          }
        }
      } else {
        // SUBJECT zone
        processResult = await window.electronAPI.processSubjectFile(fileId, filePath);

        if (processResult.success) {
          const { subject, visitDates, medications } = processResult.data;

          // Store subject demographics
          if (subject) {
            const { addSubjectDemographics } = useStore.getState();
            console.log('Storing subject demographics:', subject);
            addSubjectDemographics(subject);
          }

          // Store medications
          if (medications && Array.isArray(medications)) {
            const { addMedication } = useStore.getState();
            medications.forEach((m: any) => {
              addMedication({
                id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                subjectId: subject?.subjectNumber || '未知',
                visitType: '访视',
                medicationName: m.medicationName,
                dosage: m.dosage,
                frequency: m.frequency,
                route: m.route,
                startDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            });
          }
        }
      }

      if (processResult.success) {
        updateFileStatus(zone, fileId, FileStatus.COMPLETED);
        return true;
      } else {
        updateFileStatus(zone, fileId, FileStatus.FAILED, processResult.error?.message || '处理失败');
        return false;
      }
    } catch (error) {
      console.error('Failed to process file:', error);
      updateFileStatus(zone, fileId, FileStatus.FAILED, error instanceof Error ? error.message : '处理失败');
      return false;
    }
  };

  // 开始分析所有待处理的文件
  const handleStartAnalysis = async () => {
    const pendingFiles = files.filter(f => f.status === FileStatus.PENDING);
    if (pendingFiles.length === 0) {
      return;
    }

    setIsAnalyzing(true);

    // 顺序处理文件
    for (const file of pendingFiles) {
      await processSingleFile(file);
    }

    setIsAnalyzing(false);
  };

  const getFileIcon = (type: FileType): string => {
    switch (type) {
      case FileType.PDF:
        return '📄';
      case FileType.IMAGE:
        return '🖼️';
      default:
        return '📁';
    }
  };

  const getStatusColor = (status: FileStatus): string => {
    switch (status) {
      case FileStatus.PENDING:
        return 'bg-gray-100 text-gray-600';
      case FileStatus.PROCESSING:
        return 'bg-blue-100 text-blue-600';
      case FileStatus.COMPLETED:
        return 'bg-green-100 text-green-600';
      case FileStatus.FAILED:
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusText = (status: FileStatus): string => {
    switch (status) {
      case FileStatus.PENDING:
        return '等待中';
      case FileStatus.PROCESSING:
        return '处理中';
      case FileStatus.COMPLETED:
        return '已完成';
      case FileStatus.FAILED:
        return '失败';
      default:
        return '未知';
    }
  };

  // 支持多文件拖放
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    for (const file of droppedFiles) {
      await handleFileUpload(file);
    }
  }, [zone]);

  // 支持多文件选择
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    for (const file of selectedFiles) {
      await handleFileUpload(file);
    }
    // Reset input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [zone]);

  const pendingCount = files.filter(f => f.status === FileStatus.PENDING).length;
  const hasPendingFiles = pendingCount > 0;
  const isProcessing = files.some(f => f.status === FileStatus.PROCESSING);

  return (
    <div className="flex flex-col h-full">
      {/* Upload Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-3 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          id={`file-input-${zone}`}
          className="hidden"
          onChange={handleFileSelect}
          multiple
          accept={acceptedTypes.map(t => t === FileType.PDF ? '.pdf' : '.jpg,.jpeg,.png,.bmp,.webp').join(',')}
        />
        <label htmlFor={`file-input-${zone}`} className="cursor-pointer">
          <div className="text-2xl mb-1">{icon}</div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
          <p className="text-xs text-gray-500 mb-2">{description}</p>
          <div className="inline-flex items-center px-3 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
            <span className="text-xs font-medium">选择文件</span>
          </div>
        </label>
      </div>

      {/* Start Analysis Button */}
      {hasPendingFiles && (
        <button
          onClick={handleStartAnalysis}
          disabled={isAnalyzing || isProcessing}
          className={`
            mt-4 w-full py-3 px-4 rounded-lg font-medium transition-all
            ${isAnalyzing || isProcessing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg'
            }
          `}
        >
          {isAnalyzing || isProcessing ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              分析中... ({pendingCount} 个文件)
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              开始分析 ({pendingCount} 个待处理文件)
            </span>
          )}
        </button>
      )}

      {/* File List */}
      <div className="flex-1 mt-4 overflow-y-auto">
        {/* File List Header */}
        {files.length > 0 && (
          <div className="flex items-center justify-between px-2 py-2 mb-2 bg-gray-50 rounded-lg">
            <span className="text-xs text-gray-600">
              已上传 {files.length} 个文件
            </span>
            <button
              onClick={handleClearAll}
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center space-x-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>清空全部</span>
            </button>
          </div>
        )}
        {files.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <span className="text-sm">暂无文件</span>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="text-xl flex-shrink-0">{getFileIcon(file.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(file.status)}`}>
                    {getStatusText(file.status)}
                  </span>
                  {file.status === FileStatus.PENDING && (
                    <button
                      onClick={() => {
                        removeFile(zone, file.id);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="删除文件"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
