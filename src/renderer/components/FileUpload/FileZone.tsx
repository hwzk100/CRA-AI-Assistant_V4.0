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
  const { addFile, updateFileStatus } = useStore();

  const files = zone === StorageZone.PROTOCOL
    ? useStore((state) => state.protocolFiles)
    : useStore((state) => state.subjectFiles);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileUpload(file);
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      // Create file info object
      const fileInfo = {
        id: `file_${Date.now()}`,
        name: file.name,
        path: file.path || file.name,
        size: file.size,
        type: file.type.includes('pdf') ? FileType.PDF : FileType.IMAGE,
        status: FileStatus.PENDING,
        uploadedAt: new Date(),
      };

      // Add to store
      addFile(zone, fileInfo);

      // TODO: Process file with AI
      updateFileStatus(zone, fileInfo.id, FileStatus.PROCESSING);
    } catch (error) {
      console.error('Failed to upload file:', error);
      updateFileStatus(zone, `file_${Date.now()}`, FileStatus.FAILED, error instanceof Error ? error.message : 'Upload failed');
    }
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
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }
        `}
      >
        <input
          type="file"
          id={`file-input-${zone}`}
          className="hidden"
          onChange={handleFileSelect}
          accept={acceptedTypes.map(t => t === FileType.PDF ? '.pdf' : '.jpg,.jpeg,.png,.bmp,.webp').join(',')}
        />
        <label htmlFor={`file-input-${zone}`} className="cursor-pointer">
          <div className="text-4xl mb-2">{icon}</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 mb-3">{description}</p>
          <div className="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
            <span className="text-sm font-medium">选择文件</span>
          </div>
        </label>
      </div>

      {/* File List */}
      <div className="flex-1 mt-4 overflow-y-auto">
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
                  <button
                    onClick={() => useStore((state) => state.removeFile(zone, file.id))}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
