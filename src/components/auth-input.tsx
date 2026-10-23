'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  trailing?: ReactNode;
};

/** Native input remains the form control; the brief visual echo never stores a password. */
export function AuthInput({ label, hint, error, trailing, id, onChange, ...props }: Props) {
  const [echo, setEcho] = useState<{ text: string; tick: number; scroll: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef(0);
  const clearEcho = () => {
    if (timer.current) clearTimeout(timer.current);
    setEcho(null);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="auth-field">
      <div className={`auth-input-shell${trailing ? ' has-trailing' : ''}`}>
        <input
          {...props}
          id={id}
          placeholder=" "
          data-echo={!!echo}
          aria-invalid={!!error}
          aria-describedby={
            [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') ||
            undefined
          }
          onChange={(event) => {
            onChange?.(event);
            clearEcho();
            const input = event.currentTarget;
            const native = event.nativeEvent as InputEvent;
            if (
              native.inputType !== 'insertText' ||
              native.isComposing ||
              !native.data ||
              [...native.data].length !== 1 ||
              window.matchMedia('(prefers-reduced-motion: reduce)').matches
            )
              return;
            if (input.selectionEnd !== null && input.selectionEnd !== input.value.length) return;
            // For passwords only bullets are copied to the decorative layer, even while visible.
            if (props.name === 'password' && props.type !== 'password') return;
            setEcho({
              text: props.type === 'password' ? '•'.repeat(input.value.length) : input.value,
              tick: ++tick.current,
              scroll: input.scrollLeft,
            });
            timer.current = setTimeout(() => setEcho(null), 180);
          }}
          onPointerDown={clearEcho}
          onBlur={clearEcho}
          onSelect={(event) => {
            if (event.currentTarget.selectionStart !== event.currentTarget.selectionEnd)
              clearEcho();
          }}
          onKeyDown={(event) => {
            if (
              ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Backspace', 'Delete'].includes(
                event.key,
              ) ||
              event.ctrlKey ||
              event.metaKey
            )
              clearEcho();
          }}
        />
        <label htmlFor={id} className="auth-floating-label">
          {[...label].map((letter, index) => (
            <span key={index} style={{ '--letter': index } as CSSProperties}>
              {letter === ' ' ? '\u00a0' : letter}
            </span>
          ))}
        </label>
        {echo && (
          <span className="auth-input-echo" aria-hidden="true">
            <span style={{ transform: `translateX(-${echo.scroll}px)` }}>
              {[...echo.text].map((letter, index, letters) => (
                <span
                  key={index === letters.length - 1 ? `new-${echo.tick}` : index}
                  className={index === letters.length - 1 ? 'auth-letter-enter' : undefined}
                >
                  {letter === ' ' ? '\u00a0' : letter}
                </span>
              ))}
            </span>
          </span>
        )}
        {trailing}
      </div>
      {hint && (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
