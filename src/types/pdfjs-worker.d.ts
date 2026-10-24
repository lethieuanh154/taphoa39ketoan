// pdfjs-dist không kèm khai báo kiểu cho file worker — chỉ cần WorkerMessageHandler (utils/tpbank-pdf.util.ts, 24/10/2026)
declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}
