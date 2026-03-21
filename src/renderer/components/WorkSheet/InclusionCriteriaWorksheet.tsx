/**
 * CRA AI Assistant - Inclusion Criteria Worksheet Component
 */

import React, { useState } from 'react';
import { useInclusionCriteria, useStore, useSubjectFiles } from '../../hooks/useStore';
import type { InclusionCriteria } from '@shared/types';
import { generateId } from '@shared/types/worksheet';

export const InclusionCriteriaWorksheet: React.FC = () => {
  const inclusionCriteria = useInclusionCriteria();
  const subjectFiles = useSubjectFiles();
  const { addInclusionCriteria, updateInclusionCriteria, removeInclusionCriteria, setInclusionCriteria, updateInclusionEligibility } = useStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ category: string; description: string }>({
    category: '',
    description: '',
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 分析受试者资格
  const handleAnalyzeEligibility = async () => {
    if (subjectFiles.length === 0) {
      alert('请先上传受试者资料');
      return;
    }

    if (inclusionCriteria.length === 0) {
      alert('请先上传方案文档以提取入选标准');
      return;
    }

    setIsAnalyzing(true);

    try {
      // 获取受试者数据（从第一个已完成的受试者文件）
      const completedSubjectFile = subjectFiles.find(f => f.status === 'completed');
      if (!completedSubjectFile) {
        alert('请先等待受试者文件处理完成');
        setIsAnalyzing(false);
        return;
      }

      // 调用 AI 分析资格
      const result = await window.electronAPI.analyzeEligibility(
        completedSubjectFile.path, // 传递文件路径而不是空字符串
        inclusionCriteria.map(c => ({ id: c.id, description: c.description })),
        [] // 排除标准留空，因为这是入选标准工作表
      );

      if (result.success && result.data) {
        // 更新入选标准的符合状态
        result.data.inclusion.forEach((item: any) => {
          updateInclusionEligibility(item.id, item.eligible, item.reason);
        });
        alert('资格分析完成！');
      } else {
        alert('分析失败：' + (result.error?.message || '未知错误'));
      }
    } catch (error) {
      console.error('分析失败:', error);
      alert('分析失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEdit = (criteria: InclusionCriteria) => {
    setEditingId(criteria.id);
    setEditForm({
      category: criteria.category,
      description: criteria.description,
    });
  };

  const handleSave = () => {
    if (editingId) {
      updateInclusionCriteria(editingId, {
        ...editForm,
        updatedAt: new Date(),
      });
    }
    setEditingId(null);
    setEditForm({ category: '', description: '' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({ category: '', description: '' });
    setIsAdding(false);
  };

  const handleAdd = () => {
    const newCriteria: InclusionCriteria = {
      id: generateId(),
      category: editForm.category || '未分类',
      description: editForm.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    addInclusionCriteria(newCriteria);
    setEditForm({ category: '', description: '' });
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条入选标准吗？')) {
      removeInclusionCriteria(id);
    }
  };

  const getEligibilityBadge = (eligible?: boolean) => {
    if (eligible === undefined) {
      return null;
    }
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
        eligible
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700'
      }`}>
        {eligible ? '✓ 符合' : '✗ 不符合'}
      </span>
    );
  };

  const groupedCriteria = inclusionCriteria.reduce((acc, criteria) => {
    const category = criteria.category || '未分类';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(criteria);
    return acc;
  }, {} as Record<string, InclusionCriteria[]>);

  const hasAnalyzedData = inclusionCriteria.some(c => c.eligible !== undefined);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">入选标准</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {inclusionCriteria.length} 条标准，{Object.keys(groupedCriteria).length} 个分类
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {subjectFiles.length > 0 && (
            <button
              onClick={handleAnalyzeEligibility}
              disabled={isAnalyzing || inclusionCriteria.length === 0}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                isAnalyzing || inclusionCriteria.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>分析中...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>分析受试者资格</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>添加标准</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {inclusionCriteria.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">暂无入选标准</p>
            <p className="text-sm mt-2">上传方案文档后，AI将自动提取入选标准</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedCriteria).map(([category, criteria]) => (
              <div key={category} className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-700 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  {category}
                  <span className="text-sm text-gray-400 font-normal ml-2">({criteria.length})</span>
                </h3>
                <div className="space-y-2">
                  {criteria.map((c) => (
                    <div
                      key={c.id}
                      className={`bg-white border rounded-lg p-3 hover:border-gray-300 transition-colors ${
                        c.eligible === true
                          ? 'border-green-300 bg-green-50'
                          : c.eligible === false
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200'
                      }`}
                    >
                      {editingId === c.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            placeholder="分类"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                          />
                          <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            placeholder="标准描述"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm resize-none"
                          />
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={handleSave}
                              className="px-3 py-1 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors text-sm"
                            >
                              保存
                            </button>
                            <button
                              onClick={handleCancel}
                              className="px-3 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-sm"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-gray-700">{c.description}</p>
                            {c.reason && (
                              <p className="text-sm text-gray-500 mt-2 italic">
                                原因：{c.reason}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            {getEligibilityBadge(c.eligible)}
                            <button
                              onClick={() => handleEdit(c)}
                              className="p-1 text-gray-400 hover:text-primary-500 transition-colors"
                              title="编辑"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              title="删除"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Form */}
        {isAdding && (
          <div className="fixed bottom-0 right-0 w-96 bg-white border-t border-gray-200 shadow-lg p-4">
            <h4 className="text-lg font-medium text-gray-800 mb-3">添加入选标准</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                placeholder="分类"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="标准描述"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleAdd}
                  disabled={!editForm.description}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  添加
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
