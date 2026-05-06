export interface OcrSuccessResponse {
  success: true;
  text: string;
  lineCount: number;
  elapsedMs: number;
  detections: Array<{
    text: string;
    confidence: number;
  }>;
}

export interface OcrErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
}

export type OcrResponse = OcrSuccessResponse | OcrErrorResponse;

const OCR_ENDPOINT = '/api/ocr/recognize';

export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_IMAGES_PER_MESSAGE = 5;
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/jpg,image/png,image/webp';

const ACCEPTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export async function recognizeImage(file: File): Promise<OcrSuccessResponse> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(OCR_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  let data: OcrResponse;
  try {
    data = await response.json();
  } catch {
    throw new Error(`OCR service error (HTTP ${response.status})`);
  }

  if (!response.ok || !data.success) {
    const errorData = data as OcrErrorResponse;
    throw new Error(errorData.error || `OCR failed (HTTP ${response.status})`);
  }

  return data;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function isAcceptedImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_MIME_TYPES.has(file.type);
}

export function validateImageFile(file: File): string | null {
  if (!isAcceptedImageFile(file)) {
    return 'invalid_type';
  }

  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return 'too_large';
  }

  return null;
}
