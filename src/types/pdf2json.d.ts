declare module 'pdf2json' {
  interface PDFData {
    Pages: Array<{
      Texts: Array<{
        R: Array<{
          T: string;
        }>;
      }>;
    }>;
  }

  class PDFParser {
    constructor();
    on(event: 'pdfParser_dataError', callback: (error: any) => void): void;
    on(event: 'pdfParser_dataReady', callback: (data: PDFData) => void): void;
    loadPDF(path: string): void;
  }

  export default PDFParser;
}