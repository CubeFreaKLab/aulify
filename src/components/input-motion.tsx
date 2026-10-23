'use client';

import { useEffect } from 'react';
import '@/styles/input-motion.css';

/** Decorative text mirror; native controls keep editing, selection and form semantics. */
export function InputMotion() {
  useEffect(() => {
    let layer: HTMLDivElement | null = null;
    let active: HTMLInputElement | HTMLTextAreaElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      clearTimeout(timer);
      active?.classList.remove('piano-input-active');
      active = null;
      layer?.remove();
      layer = null;
    };
    const input = (event: Event) => {
      clear();
      const field = event.target;
      const change = event as InputEvent;
      if (
        !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) ||
        field.closest('.auth-input-shell') ||
        change.inputType !== 'insertText' ||
        change.isComposing ||
        !change.data ||
        [...change.data].length !== 1 ||
        matchMedia('(prefers-reduced-motion: reduce)').matches ||
        (field instanceof HTMLInputElement &&
          !['text', 'email', 'url', 'tel', 'search', 'password', 'number'].includes(field.type)) ||
        field.value.length > 10000
      )
        return;
      // Visible password toggles still must not copy secrets into a decorative DOM node.
      const secret =
        field.type === 'password' || /password/i.test(`${field.name} ${field.autocomplete}`);
      if (secret && field.type !== 'password') return;
      const value = secret ? '•'.repeat(field.value.length) : field.value;
      const end = field.selectionStart ?? value.length;
      if (!end || (field.selectionEnd !== null && field.selectionEnd !== end)) return;
      const rect = field.getBoundingClientRect();
      const style = getComputedStyle(field);
      layer = document.createElement('div');
      layer.className = 'piano-input-layer';
      layer.setAttribute('aria-hidden', 'true');
      Object.assign(layer.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        color: style.color,
        font: style.font,
        letterSpacing: style.letterSpacing,
        textAlign: style.textAlign,
        direction: style.direction,
        borderWidth: style.borderWidth,
        padding: style.padding,
        borderRadius: style.borderRadius,
      });
      const text = document.createElement('div');
      text.style.whiteSpace = field instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
      text.style.overflowWrap = 'break-word';
      text.style.transform = `translate(${-field.scrollLeft}px, ${-field.scrollTop}px)`;
      text.append(document.createTextNode(value.slice(0, end - change.data.length)));
      const letter = document.createElement('span');
      letter.className = 'piano-input-letter';
      letter.textContent = value.slice(end - change.data.length, end);
      text.append(letter, document.createTextNode(value.slice(end)));
      layer.append(text);
      document.body.append(layer);
      active = field;
      field.style.setProperty(
        '--piano-caret',
        style.caretColor === 'auto' ? style.color : style.caretColor,
      );
      field.classList.add('piano-input-active');
      timer = setTimeout(clear, 180);
    };
    const selection = () => {
      if (
        active &&
        (active.selectionStart !== active.selectionEnd || document.activeElement !== active)
      )
        clear();
    };
    document.addEventListener('input', input, true);
    document.addEventListener('pointerdown', clear, true);
    document.addEventListener('compositionstart', clear, true);
    document.addEventListener('selectionchange', selection);
    document.addEventListener('focusout', clear, true);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);
    return () => {
      clear();
      document.removeEventListener('input', input, true);
      document.removeEventListener('pointerdown', clear, true);
      document.removeEventListener('compositionstart', clear, true);
      document.removeEventListener('selectionchange', selection);
      document.removeEventListener('focusout', clear, true);
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
    };
  }, []);
  return null;
}
