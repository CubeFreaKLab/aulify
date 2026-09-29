export const editorLinkError =
  'Hay un enlace no permitido en el recurso. Edita o elimina su destino: usa una dirección HTTPS completa de hasta 8192 caracteres, sin espacios ni caracteres de control. El texto y los ejemplos de código pueden conservarse.';

export function isAllowedEditorHref(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // Match the SQL validator, including whitespace browsers can trim or normalize.
  let length = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (
      ++length > 8192 ||
      code <= 32 ||
      code === 127 ||
      (code >= 8192 && code <= 8202) ||
      [133, 160, 5760, 8232, 8233, 8239, 8287, 12288, 65279].includes(code)
    )
      return false;
  }
  return /^https:\/\/[^/?#]+(?:[/?#].*)?$/i.test(value);
}
