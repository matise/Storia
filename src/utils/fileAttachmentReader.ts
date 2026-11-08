import { CoWriterAttachment } from '../types/storia';
import { extractTextFromDocxArrayBuffer } from '../services/agent/podcastTranscriptParser';

export async function processUploadedFiles(
  fileList: FileList | File[] | null
): Promise<CoWriterAttachment[]> {
  if (!fileList || fileList.length === 0) return [];
  const attachments: CoWriterAttachment[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isDocx =
      file.name.toLowerCase().endsWith('.docx') ||
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (isImage || isPdf) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
      attachments.push({
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mimeType: file.type || (isImage ? 'image/png' : 'application/pdf'),
        sizeBytes: file.size,
        dataUrl,
        isImage,
      });
    } else if (isDocx) {
      const buffer = await new Promise<ArrayBuffer>((resolve) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(
            reader.result instanceof ArrayBuffer
              ? reader.result
              : new ArrayBuffer(0)
          );
        reader.onerror = () => resolve(new ArrayBuffer(0));
        reader.readAsArrayBuffer(file);
      });
      const textContent = await extractTextFromDocxArrayBuffer(buffer);
      attachments.push({
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mimeType:
          file.type ||
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: file.size,
        textContent,
        isImage: false,
      });
    } else {
      const textContent = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => resolve('');
        reader.readAsText(file);
      });
      attachments.push({
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mimeType: file.type || 'text/plain',
        sizeBytes: file.size,
        textContent,
        isImage: false,
      });
    }
  }

  return attachments;
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

