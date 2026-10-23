'use client';
import { isValidElement, useState } from 'react';
import {
  ComponentsContext,
  BlockNoteViewRaw,
  useBlockNoteEditor,
  type ComponentProps,
} from '@blocknote/react';
import { components } from '@blocknote/ariakit';
import { Popover, useMenuContext } from '@ariakit/react';
import { mapTableCell } from '@blocknote/core';
import { TableHandlesExtension } from '@blocknote/core/extensions';
import {
  ColorArea,
  ColorThumb,
  ColorSlider,
  SliderTrack,
  parseColor,
  I18nProvider,
} from 'react-aria-components';
import { PaintBucket, Type, RotateCcw } from 'lucide-react';
import '@/styles/editor-color-picker.css';

type ColorChoice = { color: string; setColor: (color: string) => void };
type PaletteProps = {
  text?: ColorChoice;
  background?: ColorChoice;
  iconSize?: number;
  onClick?: () => void;
};
const swatches = [
  '#202020',
  '#ffffff',
  '#e6e6e3',
  '#d4e5c8',
  '#c7dced',
  '#e3d4eb',
  '#f0d5d0',
  '#f4e6b9',
];
const named: Record<string, string> = {
  gray: '#777777',
  brown: '#91674e',
  red: '#ba4a40',
  orange: '#d68236',
  yellow: '#d0b43e',
  green: '#527545',
  blue: '#426d99',
  purple: '#865fa5',
  pink: '#b65e88',
};

function ColorPanel(props: PaletteProps) {
  const editor = useBlockNoteEditor();
  const [target, setTarget] = useState<'text' | 'background'>(props.text ? 'text' : 'background');
  const initial = props[target]?.color ?? 'default';
  const readColor = (raw: string) => {
    try {
      return parseColor(named[raw] ?? raw).toFormat('hsb');
    } catch {
      return parseColor('#202020').toFormat('hsb');
    }
  };
  const [color, setColor] = useState(() => readColor(initial));
  const [hex, setHex] = useState(() => color.toString('hex'));
  // Keep the cell range while the picker takes keyboard focus.
  const [tableTarget] = useState(() => {
    const block = editor.getTextCursorPosition().block;
    const range = editor.getExtension(TableHandlesExtension)?.getCellSelection();
    return !props.iconSize && block.type === 'table' && range
      ? { id: block.id, cells: range.cells }
      : null;
  });
  const tableBlock = tableTarget ? editor.getBlock(tableTarget.id) : null;
  const firstCell = tableTarget?.cells[0];
  const backgroundValue =
    tableBlock?.type === 'table' && firstCell
      ? mapTableCell(tableBlock.content.rows[firstCell.row].cells[firstCell.col]).props
          .backgroundColor
      : props.background?.color;
  const choose = (raw: string) => {
    const next = readColor(raw);
    setColor(next);
    setHex(next.toString('hex'));
  };
  const apply = (value: string) => {
    props.onClick?.();
    if (tableTarget && target === 'background') {
      const block = editor.getBlock(tableTarget.id);
      if (block?.type !== 'table') return;
      const content = structuredClone(block.content);
      const rows = content.rows.map((row) => ({
        ...row,
        cells: row.cells.map((cell) => mapTableCell(cell)),
      }));
      for (const { row, col } of tableTarget.cells)
        rows[row].cells[col].props.backgroundColor = value;
      editor.updateBlock(block, { type: 'table', content: { ...content, rows } });
      editor.setTextCursorPosition(block);
      editor.focus();
    } else props[target]?.setColor(value);
  };
  const valid = /^#[\da-f]{6}$/i.test(hex);
  return (
    <I18nProvider locale="es-BO">
      <div
        className="editor-color-panel"
        role="group"
        aria-label="Selector de color"
        onKeyDown={(event) => {
          if (event.key !== 'Escape') event.stopPropagation();
        }}
      >
        <div className="editor-color-tabs" role="group" aria-label="Aplicar color a">
          {props.text && (
            <button
              type="button"
              aria-pressed={target === 'text'}
              onClick={() => {
                setTarget('text');
                choose(props.text!.color);
              }}
            >
              <Type size={16} /> Texto
            </button>
          )}
          {props.background && (
            <button
              type="button"
              aria-pressed={target === 'background'}
              onClick={() => {
                setTarget('background');
                choose(
                  !backgroundValue || backgroundValue === 'default' ? '#e6e6e3' : backgroundValue,
                );
              }}
            >
              <PaintBucket size={16} /> {tableTarget ? 'Fondo de celda' : 'Fondo'}
            </button>
          )}
        </div>
        <ColorArea
          className="editor-color-area"
          aria-label="Saturación y brillo"
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
          value={color}
          onChange={(next) => {
            setColor(next);
            setHex(next.toString('hex'));
          }}
        >
          <ColorThumb className="editor-color-thumb" />
        </ColorArea>
        <ColorSlider
          className="editor-color-slider"
          aria-label="Tono"
          colorSpace="hsb"
          channel="hue"
          value={color}
          onChange={(next) => {
            setColor(next);
            setHex(next.toString('hex'));
          }}
        >
          <SliderTrack className="editor-color-track">
            <ColorThumb className="editor-color-thumb" />
          </SliderTrack>
        </ColorSlider>
        <div className="editor-color-swatches" aria-label="Colores rápidos">
          {swatches.map((value) => (
            <button
              type="button"
              key={value}
              style={{ background: value }}
              aria-label={`Elegir ${value}`}
              onClick={() => choose(value)}
            />
          ))}
        </div>
        <label className="editor-color-hex">
          HEX{' '}
          <input
            aria-label="Color hexadecimal"
            value={hex}
            maxLength={7}
            spellCheck={false}
            aria-invalid={!valid}
            onChange={(event) => {
              const value = event.target.value;
              setHex(value);
              if (/^#[\da-f]{6}$/i.test(value)) setColor(readColor(value));
            }}
          />
        </label>
        <div className="editor-color-actions">
          <button type="button" className="button ghost small" onClick={() => apply('default')}>
            <RotateCcw size={14} /> Automático
          </button>
          <button
            type="button"
            className="button small"
            disabled={!valid}
            onClick={() => apply(hex)}
          >
            Aplicar
          </button>
        </div>
      </div>
    </I18nProvider>
  );
}

function BrandColorDropdown(props: ComponentProps['Generic']['Menu']['Dropdown']) {
  const store = useMenuContext();
  const child = props.children;
  const palette =
    props.className?.includes('bn-color-picker-dropdown') &&
    isValidElement<PaletteProps>(child) &&
    (child.props.text || child.props.background);
  if (palette && isValidElement<PaletteProps>(child))
    return (
      <Popover
        store={store ?? undefined}
        role="dialog"
        aria-label="Selector de color"
        unmountOnHide
        className={`bn-ak-menu ${props.className ?? ''}`}
      >
        <ColorPanel {...child.props} />
      </Popover>
    );
  return <components.Generic.Menu.Dropdown {...props} />;
}
const brandComponents = {
  ...components,
  Generic: {
    ...components.Generic,
    Menu: { ...components.Generic.Menu, Dropdown: BrandColorDropdown },
  },
};

export function EditorColorProvider({ children }: { children: React.ReactNode }) {
  return (
    <ComponentsContext.Provider value={brandComponents}>{children}</ComponentsContext.Provider>
  );
}

// Preserve the installed Ariakit controls while replacing its palette in every color menu.
export { BlockNoteViewRaw };
