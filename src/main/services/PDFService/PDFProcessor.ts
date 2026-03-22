/**
 * CRA AI Assistant - PDF Processor Service
 * Handles both text-based and scanned (image-based) PDFs
 * Uses node-poppler for PDF to image conversion
 */

import * as fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import * as path from 'path';
import * as os from 'os';
import { Poppler } from 'node-poppler';
import type { Result } from '@shared/types';
import { ok, err, createAppError, ErrorCode } from '@shared/types';
import { app } from 'electron';

/**
 * PDF Content Result
 */
export interface PDFContentResult {
  type: 'text' | 'scanned';
  content: string;
  imagePaths?: string[];
}

export class PDFProcessor {
  private tempDir: string;
  private poppler: Poppler | null = null;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'cra-ai-pdf-cache');
    this.initPoppler();
  }

  /**
   * Initialize Poppler instance
   */
  private initPoppler(): void {
    try {
      const isDev = !app.isPackaged;
      let popplerPath: string;

      if (isDev) {
        // Development: use local resources directory
        popplerPath = path.join(process.cwd(), 'resources', 'poppler', 'Library', 'bin');
        console.log(`[PDFProcessor] Dev mode, poppler path: ${popplerPath}`);
      } else {
        // Production: use packaged resources
        popplerPath = path.join(process.resourcesPath, 'poppler', 'Library', 'bin');
        console.log(`[PDFProcessor] Production mode, poppler path: ${popplerPath}`);
      }

      // Create Poppler instance with custom path
      this.poppler = new Poppler(popplerPath);
      console.log(`[PDFProcessor] Poppler initialized successfully`);
    } catch (error) {
      console.error('[PDFProcessor] Failed to initialize poppler:', error);
    }
  }

  /**
   * Detect if PDF is scanned (image-based)
   */
  async isScannedPDF(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);

      const textLength = data.text.trim().length;
      const meaningfulChars = data.text.replace(/[\s\n\r\t]/g, '').length;

      // PDF is considered scanned if text is too short
      const threshold = 100;
      const isScanned = textLength < threshold || meaningfulChars < textLength * 0.3;

      console.log(`[PDFProcessor] PDF text length: ${textLength}, meaningful chars: ${meaningfulChars}, isScanned: ${isScanned}`);

      return isScanned;
    } catch (error) {
      console.error('[PDFProcessor] Failed to detect PDF type:', error);
      return false; // Assume text-based on error
    }
  }

  /**
   * Extract text content from PDF (for text-based PDFs)
   */
  async extractTextContent(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  /**
   * Convert scanned PDF pages to images using node-poppler
   */
  async convertPDFToImages(
    filePath: string,
    maxPages: number = 10
  ): Promise<Result<string[]>> {
    try {
      console.log(`[PDFProcessor] Starting PDF conversion with node-poppler, max pages: ${maxPages}`);

      if (!this.poppler) {
        return err(createAppError(
          ErrorCode.PDF_CONVERSION_ERROR,
          'Poppler 未初始化。请确保应用正确安装。'
        ));
      }

      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });

      // Get PDF filename for naming output images
      const pdfName = path.basename(filePath, path.extname(filePath));
      const outputPathPrefix = path.join(this.tempDir, `${pdfName}_page`);

      console.log(`[PDFProcessor] Converting PDF: ${filePath}`);
      console.log(`[PDFProcessor] Output prefix: ${outputPathPrefix}`);

      // Convert PDF to images using poppler pdfToPpm
      // Options for pdftoppm command
      const options = {
        pngFile: true, // Use PNG format instead of PPM
        resolutionXYAxis: 150, // 150 DPI to reduce image size and avoid API limits
        firstPageToConvert: 1,
        lastPageToConvert: maxPages,
      };

      // pdfToPpm uses the output prefix (will append -1.png, -2.png, etc.)
      await this.poppler.pdfToPpm(filePath, outputPathPrefix, options);
      console.log(`[PDFProcessor] Conversion completed`);

      // Get list of generated files
      const imagePaths: string[] = [];
      let page = 1;

      while (page <= maxPages) {
        const imagePath = `${outputPathPrefix}-${page}.png`;
        try {
          await fs.access(imagePath);
          imagePaths.push(imagePath);
          console.log(`[PDFProcessor] Found page ${page}: ${imagePath}`);
          page++;
        } catch {
          // File doesn't exist, no more pages
          break;
        }
      }

      console.log(`[PDFProcessor] Total pages converted: ${imagePaths.length}`);

      if (imagePaths.length === 0) {
        return err(createAppError(
          ErrorCode.PDF_CONVERSION_ERROR,
          'PDF 转换失败，未能生成任何图片'
        ));
      }

      return ok(imagePaths);
    } catch (error) {
      console.error('[PDFProcessor] PDF conversion failed:', error);

      // Provide helpful error messages
      let errorMessage = 'PDF 转换失败';
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        if (errorStr.includes('poppler') || errorStr.includes('pdftoppm')) {
          errorMessage = '找不到 poppler 组件。请确保应用正确安装。';
        } else if (errorStr.includes('permission') || errorStr.includes('access')) {
          errorMessage = '没有权限访问文件或目录。';
        } else {
          errorMessage = `PDF 转换失败: ${error.message}`;
        }
      }

      return err(createAppError(
        ErrorCode.PDF_CONVERSION_ERROR,
        errorMessage
      ));
    }
  }

  /**
   * Extract content from PDF (auto-detect type)
   */
  async extractContent(filePath: string): Promise<Result<PDFContentResult>> {
    try {
      // First, check if PDF is scanned
      const isScanned = await this.isScannedPDF(filePath);

      if (!isScanned) {
        // Text-based PDF - extract text directly
        const content = await this.extractTextContent(filePath);
        console.log(`[PDFProcessor] Extracted ${content.length} chars from text PDF`);
        return ok({
          type: 'text',
          content,
        });
      }

      // Scanned PDF - convert to images first
      console.log('[PDFProcessor] Detected scanned PDF, converting to images...');
      const conversionResult = await this.convertPDFToImages(filePath);

      if (!conversionResult.success) {
        return conversionResult;
      }

      return ok({
        type: 'scanned',
        content: '', // Will be populated by AI extraction
        imagePaths: conversionResult.data,
      });
    } catch (error) {
      console.error('[PDFProcessor] Content extraction failed:', error);
      return err(createAppError(
        ErrorCode.FILE_READ_ERROR,
        `PDF 内容提取失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      ));
    }
  }

  /**
   * Cleanup temporary image files
   * Silently ignores errors if files don't exist (already cleaned up)
   */
  async cleanupImages(imagePaths: string[]): Promise<void> {
    for (const imagePath of imagePaths) {
      try {
        await fs.unlink(imagePath);
        console.log(`[PDFProcessor] Cleaned up temp image: ${imagePath}`);
      } catch (e: any) {
        // Silently ignore ENOENT errors (file already cleaned up)
        if (e?.code !== 'ENOENT') {
          console.error(`[PDFProcessor] Failed to cleanup ${imagePath}:`, e);
        }
      }
    }

    // Try to remove temp directory if empty
    try {
      const files = await fs.readdir(this.tempDir);
      if (files.length === 0) {
        await fs.rmdir(this.tempDir);
        console.log(`[PDFProcessor] Removed temp directory: ${this.tempDir}`);
      }
    } catch (e: any) {
      // Silently ignore ENOENT errors (directory already removed)
      if (e?.code !== 'ENOENT') {
        console.error(`[PDFProcessor] Failed to remove temp directory:`, e);
      }
    }
  }
}

// Singleton instance
let pdfProcessorInstance: PDFProcessor | null = null;

export const getPDFProcessor = (): PDFProcessor => {
  if (!pdfProcessorInstance) {
    pdfProcessorInstance = new PDFProcessor();
  }
  return pdfProcessorInstance;
};
