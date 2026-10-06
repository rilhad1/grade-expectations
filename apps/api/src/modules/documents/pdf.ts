import { unprocessable } from '../../errors.js';

/** DOCX → PDF через Gotenberg (LibreOffice). Без GOTENBERG_URL PDF недоступний. */
export async function convertToPdf(
  gotenbergUrl: string | undefined,
  docx: Buffer,
  fileName: string,
): Promise<Buffer> {
  if (gotenbergUrl === undefined)
    throw unprocessable('PDF_NOT_CONFIGURED', 'PDF недоступний: не налаштовано Gotenberg');
  const form = new FormData();
  form.append('files', new Blob([new Uint8Array(docx)]), fileName);
  const response = await fetch(`${gotenbergUrl.replace(/\/$/, '')}/forms/libreoffice/convert`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Gotenberg відповів ${String(response.status)}`);
  return Buffer.from(await response.arrayBuffer());
}
