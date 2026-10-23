'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { QrCode, Copy, ExternalLink } from 'lucide-react';
import { Button, DialogPanel, Field } from './ui';
import type { Activity } from '@/domain/types';
import type { GuestLink } from '@/lib/guest-types';
import '@/styles/guest-practice.css';

function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function GuestShare({ activity, live }: { activity: Activity; live: boolean }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [link, setLink] = useState<GuestLink | null>(null),
    [qr, setQr] = useState('');
  const [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [starts, setStarts] = useState(() => localDate(activity.settings.opensAt));
  const [ends, setEnds] = useState(() => localDate(activity.settings.closesAt));
  const [minutes, setMinutes] = useState(activity.settings.timeLimitMinutes || 10);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!link) return;
    let active = true;
    const href = new URL(`/jugar/${link.token}`, window.location.origin).href;
    void import('qrcode')
      .then((module) =>
        module.toDataURL(href, {
          width: 280,
          margin: 3,
          errorCorrectionLevel: 'M',
          color: { dark: '#191919', light: '#ffffff' },
        }),
      )
      .then((data) => {
        if (active) {
          setQr(data);
          setUrl(href);
        }
      })
      .catch(() => {
        if (active) {
          setError('No pudimos generar el QR. Puedes copiar el enlace.');
          setUrl(href);
        }
      });
    return () => {
      active = false;
    };
  }, [link]);
  async function action(kind: 'read' | 'create' | 'revoke') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!live) {
        setLink({
          token: 'ecosistema-demo',
          title: 'Reto del ecosistema',
          opensAt: '2020-01-01',
          closesAt: '2099-12-31',
          durationSeconds: 240,
          count: 6,
        });
        return;
      }
      const response = await fetch('/api/guest-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: kind,
          activityId: activity.id,
          ...(kind === 'create'
            ? {
                opensAt: new Date(starts).toISOString(),
                closesAt: new Date(ends).toISOString(),
                durationSeconds: minutes * 60,
              }
            : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLink(data.link);
      if (kind === 'revoke') {
        setQr('');
        setUrl('');
        setMessage('Enlace desactivado. Ya no admite partidas.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar el enlace.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="secondary"
        onPress={() => {
          setOpen(true);
          void action('read');
        }}
      >
        <QrCode size={19} /> Invitar por QR
      </Button>
      <DialogPanel
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Jugar sin cuenta"
      >
        <p>
          Comparte una práctica individual. Cada invitado escribe su nombre y recibe un avatar. Sus
          puntos no se registran como notas.
        </p>
        {error && (
          <p className="notice warning" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {link ? (
          <div className="guest-share-result">
            {!live && (
              <p className="notice">
                Este QR abre el ejemplo «Reto del ecosistema». En tu cuenta puedes compartir tus
                propios quizzes y programar sus fechas.
              </p>
            )}
            <strong>{link.title}</strong>
            {qr && (
              <img src={qr} alt="Código QR para abrir esta práctica" width={240} height={240} />
            )}
            <input
              aria-label="Enlace para invitados"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className="row wrap">
              <Button
                variant="secondary"
                onPress={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setMessage('Enlace copiado.');
                  } catch {
                    setError('Selecciona el enlace y cópialo con Ctrl + C.');
                  }
                }}
              >
                <Copy size={17} /> Copiar enlace
              </Button>
              <a className="button" href={url} target="_blank" rel="noopener noreferrer">
                Probar como invitado <ExternalLink size={17} />
              </a>
            </div>
            {live && (
              <>
                <small>
                  Disponible del {new Date(link.opensAt).toLocaleString('es-BO')} al{' '}
                  {new Date(link.closesAt).toLocaleString('es-BO')}. {link.durationSeconds / 60}{' '}
                  minutos por partida.
                </small>
                <Button variant="ghost" isDisabled={busy} onPress={() => void action('revoke')}>
                  Desactivar enlace
                </Button>
              </>
            )}
          </div>
        ) : (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) void action('create');
            }}
          >
            <Field label="Disponible desde" id="guest-start">
              <input
                required
                id="guest-start"
                type="datetime-local"
                value={starts}
                onChange={(e) => setStarts(e.target.value)}
              />
            </Field>
            <Field label="Disponible hasta" id="guest-end">
              <input
                required
                id="guest-end"
                type="datetime-local"
                value={ends}
                onChange={(e) => setEnds(e.target.value)}
              />
            </Field>
            <Field label="Minutos por partida" id="guest-minutes">
              <input
                required
                id="guest-minutes"
                type="number"
                min={1}
                max={120}
                value={minutes}
                onChange={(e) => setMinutes(e.target.valueAsNumber)}
              />
            </Field>
            <small>
              Fechas en la zona horaria de este dispositivo. Usa preguntas de corrección automática;
              el enlace conserva esta versión del quiz.
            </small>
            <Button type="submit" isDisabled={busy}>
              {busy ? 'Preparando…' : 'Crear enlace y QR'}
            </Button>
          </form>
        )}
      </DialogPanel>
    </>
  );
}
