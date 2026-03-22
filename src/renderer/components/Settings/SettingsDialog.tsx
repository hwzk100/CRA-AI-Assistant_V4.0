/**
 * CRA AI Assistant - Settings Dialog Component
 */

import React, { useState, useEffect } from 'react';
import { useSettings, useStore } from '../../hooks/useStore';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const settings = useSettings();
  const updateSettings = useStore((state) => state.updateSettings);
  const resetSettings = useStore((state) => state.resetSettings);

  const [localSettings, setLocalSettings] = useState(settings);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const handleReset = () => {
    resetSettings();
    setLocalSettings(useStore.getState().settings);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await window.electronAPI.testConnection(localSettings.apiKey);
      setTestResult({
        success: result.success,
        message: result.success ? '连接成功！API Key 有效' : result.error?.message || '连接失败',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '连接测试失败',
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* API Configuration */}
          <section>
            <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🔑</span>
              API 配置
            </h3>

            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={localSettings.apiKey}
                  onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                  placeholder="已预置默认 API Key，可修改为自定义 Key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  默认已内置智谱 AI API Key，也可使用自己的 API Key:{' '}
                  <a
                    href="https://open.bigmodel.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    https://open.bigmodel.cn/
                  </a>
                </p>
              </div>

              {/* Test Connection Button */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleTestConnection}
                  disabled={!localSettings.apiKey || isTesting}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </button>

                {testResult && (
                  <div className={`flex items-center space-x-1 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    <span>{testResult.success ? '✓' : '✗'}</span>
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* API Endpoint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API 端点
                </label>
                <input
                  type="text"
                  value={localSettings.apiEndpoint}
                  onChange={(e) => setLocalSettings({ ...localSettings, apiEndpoint: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Model Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模型名称
                </label>
                <select
                  value={localSettings.modelName}
                  onChange={(e) => setLocalSettings({ ...localSettings, modelName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="glm-4">GLM-4 (文本处理)</option>
                  <option value="glm-4.6v-flash">GLM-4.6V-Flash (免费视觉模型)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Processing Configuration */}
          <section>
            <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <span className="mr-2">⚙️</span>
              处理配置
            </h3>

            <div className="space-y-4">
              {/* Processing Timeout */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  处理超时时间（秒）
                </label>
                <input
                  type="number"
                  value={localSettings.processingTimeout / 1000}
                  onChange={(e) => setLocalSettings({ ...localSettings, processingTimeout: parseInt(e.target.value) * 1000 })}
                  min="30"
                  max="300"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Retry Attempts */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  重试次数
                </label>
                <input
                  type="number"
                  value={localSettings.retryAttempts}
                  onChange={(e) => setLocalSettings({ ...localSettings, retryAttempts: parseInt(e.target.value) })}
                  min="1"
                  max="5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* Storage Configuration */}
          <section>
            <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <span className="mr-2">💾</span>
              存储配置
            </h3>

            <div className="space-y-4">
              {/* Max File Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最大文件大小（MB）
                </label>
                <input
                  type="number"
                  value={localSettings.maxFileSize / 1024 / 1024}
                  onChange={(e) => setLocalSettings({ ...localSettings, maxFileSize: parseInt(e.target.value) * 1024 * 1024 })}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* UI Preferences */}
          <section>
            <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🎨</span>
              界面偏好
            </h3>

            <div className="space-y-4">
              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  主题
                </label>
                <select
                  value={localSettings.theme}
                  onChange={(e) => setLocalSettings({ ...localSettings, theme: e.target.value as 'light' | 'dark' | 'system' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="system">跟随系统</option>
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  语言
                </label>
                <select
                  value={localSettings.language}
                  onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value as 'zh' | 'en' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="zh">简体中文</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* Auto Save */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    自动保存
                  </label>
                  <p className="text-xs text-gray-500">自动保存工作表数据</p>
                </div>
                <button
                  onClick={() => setLocalSettings({ ...localSettings, autoSave: !localSettings.autoSave })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    localSettings.autoSave ? 'bg-primary-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      localSettings.autoSave ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            重置默认
          </button>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
