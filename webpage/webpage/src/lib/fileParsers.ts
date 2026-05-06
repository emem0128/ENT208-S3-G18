const MAX_MODEL_TEXT_LENGTH = 18000;
let pdfWorkerConfigured = false;

export interface ParsedLegalFile {
  fileName: string;
  fileTypeLabel: string;
  originalLength: number;
  truncatedLength: number;
  text: string;
}

function ensurePdfWorker(globalWorkerOptions: { workerSrc: string }) {
  if (pdfWorkerConfigured) {
    return;
  }

  globalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.6.205/pdf.worker.min.mjs';
  pdfWorkerConfigured = true;
}

function normalizeText(text: string) {
  return text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function truncateTextForModel(text: string) {
  if (text.length <= MAX_MODEL_TEXT_LENGTH) {
    return text;
  }

  const headLength = 7000;
  const middleLength = 4000;
  const tailLength = 7000;
  const middleStart = Math.max(0, Math.floor(text.length / 2) - Math.floor(middleLength / 2));

  return [
    text.slice(0, headLength),
    '\n\n[以下内容因篇幅过长已省略部分中段文本]\n\n',
    text.slice(middleStart, middleStart + middleLength),
    '\n\n[以下内容因篇幅过长已省略部分内容，以下为结尾重点文本]\n\n',
    text.slice(-tailLength),
  ].join('');
}

async function parsePdf(arrayBuffer: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  ensurePdfWorker(pdfjs.GlobalWorkerOptions);

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();

    if (pageText) {
      pageTexts.push(pageText);
    }
  }

  return pageTexts.join('\n\n');
}

async function parseDocx(arrayBuffer: ArrayBuffer) {
  const { default: mammoth } = await import('mammoth/mammoth.browser');
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function getFileExtension(file: File) {
  const parts = file.name.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

export async function parseLegalFile(file: File): Promise<ParsedLegalFile> {
  const extension = getFileExtension(file);
  const arrayBuffer = await file.arrayBuffer();

  let rawText = '';
  let fileTypeLabel = '';

  if (extension === 'pdf' || file.type === 'application/pdf') {
    fileTypeLabel = 'PDF';
    rawText = await parsePdf(arrayBuffer);
  } else if (
    extension === 'docx' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    fileTypeLabel = 'Word DOCX';
    rawText = await parseDocx(arrayBuffer);
  } else if (extension === 'doc' || file.type === 'application/msword') {
    throw new Error('暂不支持旧版 .doc 文件，请先转换为 .docx 或 PDF 后再上传。');
  } else {
    throw new Error('仅支持 PDF 或 DOCX 合同文件。');
  }

  const normalizedText = normalizeText(rawText);

  if (!normalizedText) {
    throw new Error('未能从文件中读取到正文内容，请确认文件不是扫描件、空白文件或受保护文档。');
  }

  const truncatedText = truncateTextForModel(normalizedText);

  return {
    fileName: file.name,
    fileTypeLabel,
    originalLength: normalizedText.length,
    truncatedLength: truncatedText.length,
    text: truncatedText,
  };
}
