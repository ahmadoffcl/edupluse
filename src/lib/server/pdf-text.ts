import "server-only";

type PdfTextOptions = {
  cellSeparator?: string;
  pageJoiner?: string;
  first?: number;
  last?: number;
};

export type PdfTextResult = {
  text: string;
  total: number;
  pages: Array<{
    text: string;
    num: number;
  }>;
};

type PdfParseInstance = {
  getText(options?: PdfTextOptions): Promise<PdfTextResult>;
  destroy(): Promise<void> | void;
};

type PdfParseConstructor = new (params: {
  data: Uint8Array | Buffer;
}) => PdfParseInstance;

async function installPdfRuntimePolyfills() {
  const runtime = globalThis as Record<string, unknown>;
  if (runtime.DOMMatrix && runtime.ImageData && runtime.Path2D) return;

  const canvas = await import("@napi-rs/canvas").catch(() => null);
  if (!canvas) return;

  runtime.DOMMatrix ??= canvas.DOMMatrix;
  runtime.ImageData ??= canvas.ImageData;
  runtime.Path2D ??= canvas.Path2D;
}

export async function createPdfParser(data: Uint8Array | Buffer) {
  await installPdfRuntimePolyfills();
  const { PDFParse } = await import("pdf-parse");
  return new (PDFParse as PdfParseConstructor)({ data });
}

export async function extractPdfText(
  data: Uint8Array | Buffer,
  options?: PdfTextOptions,
) {
  const parser = await createPdfParser(data);
  try {
    return await parser.getText(options);
  } finally {
    await parser.destroy();
  }
}
