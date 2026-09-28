import { fileTypeFromBuffer } from 'file-type';
import { unzipSync, strFromU8 } from 'fflate';

export const FILE_MIMES: Record<string, string> = {
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};
export function validateFileMetadata(name: string, size: number, purpose: string) {
  const extension = name.split('.').at(-1)?.toLowerCase() || '';
  if (!name || name.length > 180 || /[/\\\u0000-\u001f]/.test(name) || !FILE_MIMES[extension]) throw new Error('Usa archivos PDF, DOCX, JPG, PNG o WebP con un nombre válido.');
  if (!['resource', 'submission'].includes(purpose)) throw new Error('El destino del archivo no es válido.');
  if (!Number.isSafeInteger(size) || size <= 0 || size > (purpose === 'resource' ? 5 : 10) * 1024 * 1024) throw new Error(purpose === 'resource' ? 'La imagen debe pesar como máximo 5 MiB.' : 'Cada archivo debe pesar como máximo 10 MiB.');
  if (purpose === 'resource' && !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) throw new Error('El recurso admite imágenes JPG, PNG o WebP.');
  return { extension, mime: FILE_MIMES[extension] };
}
export async function validateFileBytes(name: string, bytes: Uint8Array) {
  const metadata = validateFileMetadata(name, bytes.byteLength, 'submission');
  if (metadata.extension === 'docx') {
    let total = 0;
    let entries = 0;
    let documentFound = false;
    const selected = unzipSync(bytes, { filter(file) {
      total += file.originalSize;
      entries++;
      if (total > 50 * 1024 * 1024 || entries > 2500 || /(^|\/)\.\.(\/|$)|^\/|\\|vba|activex|\.exe$|\.js$|embeddings\//i.test(file.name)) throw new Error('El documento contiene macros, objetos activos o una estructura no permitida.');
      if (file.name === 'word/document.xml') documentFound = true;
      if (file.name === '[Content_Types].xml') {
        if (file.originalSize > 256 * 1024) throw new Error('La estructura del documento es demasiado grande.');
        return true;
      }
      return false;
    } });
    const types = selected['[Content_Types].xml'];
    if (!documentFound || !types || !strFromU8(types).includes('wordprocessingml.document.main+xml') || /macroEnabled|vbaProject|activeX/i.test(strFromU8(types))) throw new Error('Adjunta un documento DOCX válido y sin macros.');
  }
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || detected.mime !== metadata.mime) throw new Error('El contenido del archivo no coincide con su extensión.');
  return metadata.mime;
}
