/**
 * pdf-parse type definitions
 */

declare module 'pdf-parse' {
  interface PDFParseData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  interface PDFParseOptions {
    // Optional configuration options
  }

  function pdfParse(
    buffer: Buffer,
    options?: PDFParseOptions
  ): Promise<PDFParseData>;

  export = pdfParse;
}
