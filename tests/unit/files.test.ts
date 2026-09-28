import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { validateFileBytes, validateFileMetadata } from '../../src/lib/file-validation';

describe('archivos privados del aula', () => {
  it('rechaza rutas manipuladas, ejecutables renombrados y tamaños fuera del límite', async () => {
    expect(() => validateFileMetadata('../trabajo.pdf', 20, 'submission')).toThrow();
    expect(() => validateFileMetadata('trabajo.pdf', 10 * 1024 * 1024 + 1, 'submission')).toThrow();
    expect(() => validateFileMetadata('imagen.png', 5 * 1024 * 1024 + 1, 'resource')).toThrow();
    expect(() => validateFileMetadata('trabajo.docx', 100, 'resource')).toThrow();
    await expect(validateFileBytes('trabajo.pdf', strToU8('MZ ejecutable de prueba'))).rejects.toThrow();
  });
  it('rechaza macros y expansión desproporcionada de DOCX antes de extraer documentos', async () => {
    const types = strToU8('<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" /></Types>');
    const macro = zipSync({ '[Content_Types].xml': types, 'word/document.xml': strToU8('<w:document/>'), 'word/vbaProject.bin': new Uint8Array([1]) });
    await expect(validateFileBytes('trabajo.docx', macro)).rejects.toThrow(/macros/);
    const expanded = zipSync({ '[Content_Types].xml': new Uint8Array(300_000), 'word/document.xml': strToU8('<w:document/>') });
    await expect(validateFileBytes('trabajo.docx', expanded)).rejects.toThrow(/estructura/);
  });
  it('acepta la firma real de PDF y detecta una imagen con extensión engañosa', async () => {
    const bytes = strToU8('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    await expect(validateFileBytes('trabajo.pdf', bytes)).resolves.toBe('application/pdf');
    await expect(validateFileBytes('trabajo.png', bytes)).rejects.toThrow(/extensión/);
  });
});
