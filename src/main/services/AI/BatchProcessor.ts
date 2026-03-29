/**
 * CRA AI Assistant - Batch Processor Service
 * Handles batch processing of large documents by splitting into manageable chunks
 */

import { PromptEngine } from './PromptEngine';
import { PDF_CONFIG } from '@shared/constants/app';

export interface BatchProgress {
  current: number;
  total: number;
  stage: string;
}

type ProgressCallback = (progress: BatchProgress) => void;

export class BatchProcessor {
  /**
   * Process text content in batches
   * Splits content into chunks, processes each chunk sequentially, returns all results
   */
  static async processTextInBatches<T>(
    content: string,
    processFn: (chunk: string, batchIndex: number, totalBatches: number) => Promise<T>,
    onProgress?: ProgressCallback
  ): Promise<T[]> {
    const chunks = PromptEngine.splitContent(
      content,
      PDF_CONFIG.BATCH_TEXT_CHUNK_TOKENS,
      PDF_CONFIG.BATCH_TEXT_OVERLAP_TOKENS
    );

    console.log(`[BatchProcessor] Text split into ${chunks.length} chunks`);

    const results: T[] = [];

    for (let i = 0; i < chunks.length; i++) {
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: chunks.length,
          stage: `正在处理文本批次 ${i + 1}/${chunks.length}`,
        });
      }

      console.log(`[BatchProcessor] Processing text chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
      const result = await processFn(chunks[i], i, chunks.length);
      results.push(result);
    }

    return results;
  }

  /**
   * Process scanned PDF in batches
   * Converts pages to images in batches, processes each batch, cleans up after each
   */
  static async processScannedInBatches<T>(
    filePath: string,
    pdfProcessor: any,
    processFn: (imagePaths: string[], batchIndex: number, totalBatches: number) => Promise<T>,
    onProgress?: ProgressCallback
  ): Promise<T[]> {
    const totalPages = await pdfProcessor.getPDFPageCount(filePath);
    const imagesPerBatch = PDF_CONFIG.BATCH_IMAGES_PER_BATCH;
    const totalBatches = Math.ceil(totalPages / imagesPerBatch);

    console.log(`[BatchProcessor] Scanned PDF: ${totalPages} pages, ${totalBatches} batches`);

    const results: T[] = [];
    let currentPage = 1;
    let batchIndex = 0;

    while (currentPage <= totalPages) {
      const pagesInBatch = Math.min(imagesPerBatch, totalPages - currentPage + 1);

      if (onProgress) {
        onProgress({
          current: batchIndex + 1,
          total: totalBatches,
          stage: `正在处理图片批次 ${batchIndex + 1}/${totalBatches} (页 ${currentPage}-${currentPage + pagesInBatch - 1})`,
        });
      }

      console.log(`[BatchProcessor] Converting pages ${currentPage}-${currentPage + pagesInBatch - 1}`);

      // Convert batch of pages to images
      const conversionResult = await pdfProcessor.convertPDFToImages(
        filePath,
        pagesInBatch,
        currentPage
      );

      if (!conversionResult.success) {
        console.error(`[BatchProcessor] Failed to convert pages ${currentPage}-${currentPage + pagesInBatch - 1}:`, conversionResult.error);
        // Skip this batch and continue
        currentPage += pagesInBatch;
        batchIndex++;
        continue;
      }

      // Process the batch
      try {
        const result = await processFn(conversionResult.data, batchIndex, totalBatches);
        results.push(result);
      } catch (error) {
        console.error(`[BatchProcessor] Error processing batch ${batchIndex + 1}:`, error);
      } finally {
        // Clean up temporary images after each batch
        await pdfProcessor.cleanupImages(conversionResult.data);
      }

      currentPage += pagesInBatch;
      batchIndex++;
    }

    return results;
  }

  /**
   * Check if content is large enough to require batching
   */
  static shouldBatch(content: string): boolean {
    return content.length > PDF_CONFIG.BATCH_LARGE_FILE_THRESHOLD;
  }

  /**
   * Check if scanned PDF has enough pages to require batching
   */
  static shouldBatchScanned(totalPages: number): boolean {
    return totalPages > PDF_CONFIG.MAX_PAGES_FOR_CONVERSION;
  }
}
