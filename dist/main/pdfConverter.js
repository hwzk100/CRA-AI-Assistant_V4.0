/**
 * CRA AI Assistant - Standalone PDF to Image Converter
 * This script runs outside of webpack to avoid bundling issues
 * It runs as a child process and receives messages via IPC
 */

const PDF2Img = require('pdf-to-img');
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
    const converter = new PDF2Img(filePath, {
      scale: 2.0,
    });

    console.log(`[PDF Converter] Converting PDF to images, max pages: ${maxPages}`);

    let pageCount = 0;
    for await (const image of converter.convert()) {
      if (pageCount >= maxPages) {
        console.log(`[PDF Converter] Reached max pages (${maxPages}), stopping conversion`);
        break;
      }

      pageCount++;

      // Save image to temp file
      const outputPath = path.join(
        TEMP_DIR,
        `${path.basename(filePath, '.pdf')}_page_${pageCount}.png`
      );

      await fs.writeFile(outputPath, image);
      imagePaths.push(outputPath);

      console.log(`[PDF Converter] Converted page ${pageCount} to ${outputPath}`);
    }

    console.log(`[PDF Converter] Total pages converted: ${pageCount}`);

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
