import { describe, expect, it } from 'vitest';
import { resourceVideoSource } from '../../src/lib/resource-video';

describe('orígenes del video de clase', () => {
  it('solo transforma direcciones conocidas de YouTube y descarta sus parámetros extra', () => {
    for (const url of [
      'https://youtu.be/M7lc1UVf-VE?t=20',
      'https://www.youtube.com/watch?v=M7lc1UVf-VE&autoplay=1',
      'https://youtube.com/shorts/M7lc1UVf-VE',
    ])
      expect(resourceVideoSource(url)?.src).toBe(
        'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?playsinline=1',
      );
    expect(resourceVideoSource('https://youtube.com.example.org/watch?v=M7lc1UVf-VE')?.player).toBe(
      'link',
    );
    expect(resourceVideoSource('https://youtube.com/watch?v=incorrecto')?.player).toBe('link');
    expect(resourceVideoSource('https://youtube.com:444/watch?v=M7lc1UVf-VE')?.player).toBe('link');
  });
  it('conserva video directo y enlaces externos; rechaza esquemas inseguros y credenciales', () => {
    expect(resourceVideoSource('https://example.org/clase.mp4?download=1')?.player).toBe('file');
    expect(resourceVideoSource('https://example.org/leccion')?.player).toBe('link');
    for (const url of [
      'http://example.org/a.mp4',
      'javascript:alert(1)',
      'data:text/html,video',
      'https://user:password@example.org/a.mp4',
      'no es una dirección',
    ])
      expect(resourceVideoSource(url)).toBeNull();
  });
});
