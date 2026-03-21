/**
 * CRA AI Assistant - Preload Script
 * Exposes safe APIs to the renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';

// TODO: Define proper types for the electronAPI
const electronAPI = {
  // File operations
  uploadFile: (zone: string, filePath: string) => ipcRenderer.invoke('file:upload', zone, filePath),
  deleteFile: (zone: string, fileId: string) => ipcRenderer.invoke('file:delete', zone, fileId),
  getAllFiles: (zone: string) => ipcRenderer.invoke('file:getAll', zone),

  // AI operations
  testConnection: (apiKey: string) => ipcRenderer.invoke('ai:testConnection', apiKey),
  extractCriteria: (fileId: string, pdfContent: string) => ipcRenderer.invoke('ai:extractCriteria', fileId, pdfContent),
  extractVisitSchedule: (fileId: string, pdfContent: string) => ipcRenderer.invoke('ai:extractVisitSchedule', fileId, pdfContent),
  extractFromImage: (imagePath: string, prompt: string) => ipcRenderer.invoke('ai:extractFromImage', imagePath, prompt),
  processProtocolFile: (fileId: string, filePath: string) => ipcRenderer.invoke('ai:processProtocolFile', fileId, filePath),
  processSubjectFile: (fileId: string, filePath: string) => ipcRenderer.invoke('ai:processSubjectFile', fileId, filePath),
  analyzeEligibility: (subjectData: string, inclusionCriteria: any[], exclusionCriteria: any[]) => ipcRenderer.invoke('ai:analyzeEligibility', subjectData, inclusionCriteria, exclusionCriteria),

  // Excel operations
  exportTracker: (data: any, options: any) => ipcRenderer.invoke('excel:exportTracker', data, options),

  // Settings operations
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: any) => ipcRenderer.invoke('settings:set', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),

  // System operations
  getVersion: () => ipcRenderer.invoke('system:getVersion'),
  openExternal: (url: string) => ipcRenderer.invoke('system:openExternal', url),

  // Dialog operations
  openFile: (filters: any[]) => ipcRenderer.invoke('dialog:openFile', filters),
  saveFile: (defaultPath: string, filters: any[]) => ipcRenderer.invoke('dialog:saveFile', defaultPath, filters),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
