'use client';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Play, Video } from 'lucide-react';
import { resourceVideoSource } from '@/lib/resource-video';
import '@/styles/resource-video.css';

export function ResourceVideo({ url, title }: { url: string; title: string }) {
  const [loadedUrl, setLoadedUrl] = useState('');
  const [failedUrl, setFailedUrl] = useState('');
  const player = useRef<HTMLIFrameElement | HTMLVideoElement | null>(null);
  useEffect(() => {
    if (loadedUrl) player.current?.focus({ preventScroll: true });
  }, [loadedUrl]);
  const source = resourceVideoSource(url);
  const label = title.trim() || 'Video de la clase';
  if (!source) return <p className="notice">Añade un enlace HTTPS válido al video.</p>;
  const loaded = loadedUrl === source.href;
  const failed = failedUrl === source.href;
  return (
    <figure className="resource-video">
      {loaded && source.player === 'youtube' ? (
        <iframe
          ref={(element) => {
            player.current = element;
          }}
          src={source.src}
          title={label}
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : loaded && source.player === 'file' && !failed ? (
        <video
          ref={(element) => {
            player.current = element;
          }}
          tabIndex={0}
          aria-label={label}
          src={source.src}
          controls
          playsInline
          preload="none"
          onError={() => setFailedUrl(source.href)}
        />
      ) : source.player !== 'link' && !failed ? (
        <button
          type="button"
          className="resource-video-load"
          onClick={() => setLoadedUrl(source.href)}
        >
          <Play size={24} aria-hidden="true" />
          <strong>{label}</strong>
          <span>Cargar video de {source.host}</span>
        </button>
      ) : (
        <div className="resource-video-link">
          <Video size={24} aria-hidden="true" />
          <div>
            <strong>{label}</strong>
            <p>
              {failed
                ? 'No se pudo reproducir aquí. Puedes abrir el enlace original.'
                : source.host}
            </p>
          </div>
        </div>
      )}
      <figcaption>
        <a href={source.href} target="_blank" rel="noopener noreferrer">
          Abrir {label} en otra pestaña <ExternalLink size={14} aria-hidden="true" />
        </a>
      </figcaption>
    </figure>
  );
}
