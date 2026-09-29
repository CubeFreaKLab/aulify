export type VideoSource = {
  href: string;
  host: string;
  player: 'youtube' | 'file' | 'link';
  src?: string;
};

/** Only known video forms become players; other HTTPS addresses remain ordinary links. */
export function resourceVideoSource(value: string): VideoSource | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const source: VideoSource = { href: url.href, host: url.hostname, player: 'link' };
    const youtubeHosts = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'www.youtube-nocookie.com',
    ];
    let id: string | null = null;
    if (!url.port && url.hostname === 'youtu.be') id = url.pathname.slice(1);
    else if (!url.port && youtubeHosts.includes(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else id = url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})\/?$/)?.[1] || null;
    }
    if (id && /^[\w-]{11}$/.test(id))
      return {
        ...source,
        player: 'youtube',
        src: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1`,
      };
    if (/\.(mp4|webm|ogg)$/i.test(url.pathname))
      return { ...source, player: 'file', src: url.href };
    return source;
  } catch {
    return null;
  }
}
