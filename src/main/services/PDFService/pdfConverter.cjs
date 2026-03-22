/**
 * CRA AI Assistant - Standalone PDF to Image Converter
 * CommonJS version for better Electron compatibility
 * Uses pdf-img-convert which doesn't require canvas
 */

const fs = require('fs/promises');
const path = require('path');
const os = require('os');

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

    // Import pdf-img-convert dynamically
    let pdfToImg;
    try {
      // Use dynamic import for ES module
      const module = await import('pdf-img-convert');
      pdfToImg = module.default || module;
    } catch (e) {
      console.error('[PDF Converter] pdf-img-convert module not available:', e);
      return {
        success: false,
        error: 'PDF 转换需要 pdf-img-convert 模块，请运行: npm install pdf-img-convert'
      };
    }

    // Read PDF file
    const pdfBuffer = await fs.readFile(filePath);

    // Convert PDF to images (returns array of buffers)
    const outputImages = await pdfToImg(pdfBuffer, {
      width: 2000,
      height: 2000,
    });

    // Limit to maxPages
    const pagesToSave = outputImages.slice(0, maxPages);

    for (let i = 0; i < pagesToSave.length; i++) {
      // Save to temp file
      const outputPath = path.join(
        TEMP_DIR,
        `${path.basename(filePath, '.pdf')}_page_${i + 1}.png`
      );

      await fs.writeFile(outputPath, pagesToSave[i]);
      imagePaths.push(outputPath);

      console.log(`[PDF Converter] Converted page ${i + 1} to ${outputPath}`);
    }

    console.log(`[PDF Converter] Total pages converted: ${pagesToSave.length}`);

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
