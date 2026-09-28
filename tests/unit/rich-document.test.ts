import { describe, expect, it } from 'vitest';
import { blankIds, duplicateTree, semanticBlocks, textOf } from '../../src/lib/rich-document';

describe('documento enriquecido del recurso', () => {
  it('conserva texto anidado, casillas y tablas en la representación de búsqueda', () => {
    const document = [
      {
        id: 'parent',
        type: 'toggleListItem',
        content: [{ type: 'text', text: 'Observación' }],
        children: [
          {
            id: 'child',
            type: 'checkListItem',
            props: { checked: true },
            content: [{ text: 'Medir la luz' }],
          },
        ],
      },
      {
        id: 'table',
        type: 'table',
        content: {
          rows: [
            { cells: [[{ text: 'Factor' }], [{ text: 'Efecto' }]] },
            { cells: [[{ text: 'Luz' }], [{ text: 'Crecimiento' }]] },
          ],
        },
      },
      { id: 'quiz', type: 'quiz', props: { label: 'Actividad interactiva' } },
    ];
    const blocks = semanticBlocks(document);
    expect(blocks.map((b) => b.id)).toEqual(['parent', 'child', 'table']);
    expect(blocks[1]).toMatchObject({ type: 'list', items: ['☑ Medir la luz'] });
    expect(blocks[2]).toMatchObject({ type: 'text', text: 'Factor | Efecto\nLuz | Crecimiento' });
    expect(textOf([{ type: 'link', content: [{ text: 'Referencia' }] }])).toBe('Referencia');
  });
  it('extrae el identificador de archivo y no inventa descripción de imagen', () => {
    const id = crypto.randomUUID();
    expect(
      semanticBlocks([
        {
          type: 'image',
          props: { url: `/api/files/${id}`, alt: 'Hoja con nervaduras', caption: 'Observación' },
        },
      ])[0],
    ).toMatchObject({ fileId: id, alt: 'Hoja con nervaduras', caption: 'Observación' });
    expect(semanticBlocks([{ type: 'image', props: { url: '' } }])[0]).toMatchObject({
      type: 'image',
      alt: '',
      url: '',
    });
  });
  it('duplicar renueva cada ID de bloque sin mutar la fuente', () => {
    const source = {
      id: 'parent',
      type: 'toggleListItem',
      children: [{ id: 'child', type: 'paragraph', content: [{ text: 'Detalle' }] }],
    };
    const copy = duplicateTree(source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.children[0].id).not.toBe(source.children[0].id);
    expect(copy.children[0].content).toEqual(source.children[0].content);
    expect(source.children[0].id).toBe('child');
  });
  it('detecta espacios distintos y rechaza nombres ambiguos con espacios', () => {
    expect(blankIds('La {planta} usa {luz}; otra {planta}.')).toEqual(['planta', 'luz']);
    expect(blankIds('Texto {nombre con espacios} sin marcador válido.')).toEqual([]);
  });
});
