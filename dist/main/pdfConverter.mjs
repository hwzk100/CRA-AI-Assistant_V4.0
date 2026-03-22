/**
 * CRA AI Assistant - Standalone PDF to Image Converter
 * This script runs outside of webpack to avoid bundling issues
 * Uses pdfjs-dist directly with canvas for Node.js compatibility
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createCanvas } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

// Set up worker
const pdfWorkerPath = path.join(
  path.dirname(pdfjsLib.getVersion()),
  '../build/pdf.worker.cjs'
);

const TEMP_DIR = path.join(os.tmpdir(), 'cra-ai-pdf-cache');

/**
 * Convert PDF pages to images
 */
async function convertPDFToImages(filePath, maxPages = 10) {
  try {
    // Ensure temp directory exists
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const imagePaths = [];

    console.log(`[PDF Converter] Converting PDF to images, max pages: ${maxPages}`);

    // Read PDF file
    const data = new Uint8Array(await fs.readFile(filePath));

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data,
      standardFontDataUrl: path.join(path.dirname(pdfjsLib.getVersion()), '../standard_fonts/'),
      cMapUrl: path.join(path.dirname(pdfjsLib.getVersion()), '../cmaps/'),
      cMapPacked: true,
    });

    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;

    console.log(`[PDF Converter] PDF has ${totalPages} pages`);

    const pagesToConvert = Math.min(totalPages, maxPages);

    for (let i = 1; i <= pagesToConvert; i++) {
      const page = await pdfDocument.getPage(i);

      // Calculate scale (2.0 = 200% zoom for better quality)
      const viewport = page.getViewport({ scale: 2.0 });

      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Convert to buffer
      const imageBuffer = canvas.toBuffer('image/png');

      // Save to temp file
      const outputPath = path.join(
        TEMP_DIR,
        `${path.basename(filePath, '.pdf')}_page_${i}.png`
      );

      await fs.writeFile(outputPath, imageBuffer);
      imagePaths.push(outputPath);

      console.log(`[PDF Converter] Converted page ${i} to ${outputPath}`);
    }

    console.log(`[PDF Converter] Total pages converted: ${pagesToConvert}`);

    if (imagePaths.length === 0) {
      return {
        success: false,
        error: 'PDF 转换失败，未能生成任何图片'
      };
    }

    return {
      success: true,
      data: imagePaths
    };
  } catch (error) {
    console.error('[PDF Converter] PDF conversion failed:', error);
    return {
      success: false,
      error: `PDF 转换失败: ${error.message}`
    };
  }
}

/**
 * Cleanup temporary image files
 */
async function cleanupImages(imagePaths) {
  for (const imagePath of imagePaths) {
    try {
      await fs.unlink(imagePath);
      console.log(`[PDF Converter] Cleaned up temp image: ${imagePath}`);
    } catch (e) {
      console.error(`[PDF Converter] Failed to cleanup ${imagePath}:`, e);
    }
  }

  // Try to remove temp directory if empty
  try {
    const files = await fs.readdir(TEMP_DIR);
    if (files.length === 0) {
      await fs.rmdir(TEMP_DIR);
      console.log(`[PDF Converter] Removed temp directory: ${TEMP_DIR}`);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

// IPC handler for messages from parent process
process.on('message', async (msg) => {
  if (msg.type === 'convert') {
    const result = await convertPDFToImages(msg.filePath, msg.maxPages);
    process.send(result);
  } else if (msg.type === 'cleanup') {
    await cleanupImages(msg.imagePaths);
    process.send({ success: true });
  } else {
    process.send({
      success: false,
      error: `Unknown message type: ${msg.type}`
    });
  }
});

// Keep the process alive
console.log('[PDF Converter] Worker process ready');
