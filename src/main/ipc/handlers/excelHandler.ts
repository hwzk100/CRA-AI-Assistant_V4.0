/**
 * CRA AI Assistant - Excel IPC Handlers
 */

import { ipcMain, dialog } from 'electron';
import { getExcelGenerator } from '../../services/ExcelService/ExcelGenerator';
import type { ExcelExportOptions, ExcelExportResult } from '@shared/types';

/**
 * Register Excel handlers
 */
export function registerExcelHandlers(): void {
  // Export tracker to Excel
  ipcMain.handle('excel:exportTracker', async (event, data: any, options: ExcelExportOptions = {}): Promise<ExcelExportResult> => {
    try {
      // If no output path specified, show save dialog
      let outputPath = options.outputPath;
      if (!outputPath) {
        const result = await dialog.showSaveDialog({
          title: '保存 Excel 追踪表',
          defaultPath: options.fileName || `临床试验追踪表_${new Date().toISOString().slice(0, 10)}.xlsx`,
          filters: [
            { name: 'Excel 文件', extensions: ['xlsx'] },
            { name: '所有文件', extensions: ['*'] },
          ],
        });

        if (result.canceled || !result.filePath) {
          return {
            success: false,
            error: '用户取消保存',
          };
        }

        outputPath = result.filePath;
      }

      // Generate Excel file
      const generator = getExcelGenerator();
      const result = await generator.generate(data, { ...options, outputPath });

      // Reset generator for next use
      generator.reset();

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Excel 导出失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  });
}
