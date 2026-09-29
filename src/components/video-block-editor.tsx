'use client';
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { resourceVideoSource } from '@/lib/resource-video';
import { ResourceVideo } from './resource-video';

export function VideoBlockEditor({
  url,
  caption,
  onChange,
}: {
  url: string;
  caption: string;
  onChange: (props: { url?: string; caption?: string }) => void;
}) {
  const [editing, setEditing] = useState(!url);
  const [error, setError] = useState('');
  return (
    <div className="video-block-editor" contentEditable={false}>
      {editing ? (
        <div className="editor-video">
          <label>
            Enlace al video (HTTPS)
            <input
              type="url"
              value={url}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label>
            Título del video
            <input
              value={caption}
              onChange={(e) => onChange({ caption: e.target.value })}
              placeholder="¿Qué aprenderá tu clase con este video?"
            />
          </label>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button secondary small"
            type="button"
            onClick={() => {
              if (!resourceVideoSource(url) || !caption.trim()) {
                setError('Añade un título y un enlace HTTPS válido.');
                return;
              }
              setError('');
              setEditing(false);
            }}
          >
            Mostrar video
          </button>
        </div>
      ) : (
        <>
          <ResourceVideo url={url} title={caption} />
          <button type="button" className="button ghost small" onClick={() => setEditing(true)}>
            <Pencil size={14} aria-hidden="true" /> Editar video
          </button>
        </>
      )}
    </div>
  );
}
