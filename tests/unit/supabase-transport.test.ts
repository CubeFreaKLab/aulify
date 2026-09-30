import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { createBoundedTransport } from '../../src/lib/supabase/transport';

describe('transporte acotado al servicio de datos', () => {
  it('reutiliza conexiones y conserva los cuerpos y credenciales de cada solicitud', async () => {
    let active = 0,
      peak = 0,
      connections = 0;
    const seen: string[] = [];
    const server = createServer(async (request, response) => {
      active++;
      peak = Math.max(peak, active);
      let body = '';
      for await (const chunk of request) body += chunk;
      seen.push(body);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ body, token: request.headers.authorization }));
    });
    server.on('connection', () => connections++);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const transport = createBoundedTransport(origin, 4);
    try {
      const values = await Promise.all(
        Array.from({ length: 20 }, async (_, index) => {
          const response = await transport.fetch(`${origin}/rpc`, {
            method: 'POST',
            headers: { Authorization: `Bearer fixture-${index}` },
            body: `request-${index}`,
          });
          return response.json();
        }),
      );
      expect(peak).toBeLessThanOrEqual(4);
      expect(connections).toBeLessThanOrEqual(4);
      expect(new Set(seen).size).toBe(20);
      expect(values).toEqual(
        Array.from({ length: 20 }, (_, index) => ({
          body: `request-${index}`,
          token: `Bearer fixture-${index}`,
        })),
      );
      await expect(transport.fetch('http://unexpected.example/')).rejects.toThrow('Origen');
      expect(seen).toHaveLength(20);
    } finally {
      await transport.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('no reenvía un POST cuando se pierde la conexión después de recibirlo', async () => {
    let requests = 0;
    const server = createServer((request) => {
      requests++;
      request.socket.destroy();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const transport = createBoundedTransport(origin, 2);
    try {
      await expect(
        transport.fetch(origin, { method: 'POST', body: 'fixture-command' }),
      ).rejects.toThrow();
      expect(requests).toBe(1);
    } finally {
      await transport.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('retira un comando cancelado de la cola sin enviarlo después', async () => {
    const received: string[] = [];
    let started!: () => void;
    let release!: () => void;
    const firstStarted = new Promise<void>((resolve) => (started = resolve));
    const hold = new Promise<void>((resolve) => (release = resolve));
    const server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      received.push(body);
      if (body === 'first') {
        started();
        await hold;
      }
      response.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const transport = createBoundedTransport(origin, 1);
    try {
      const first = transport.fetch(origin, { method: 'POST', body: 'first' });
      await firstStarted;
      const controller = new AbortController();
      const cancelled = transport.fetch(origin, {
        method: 'POST',
        body: 'cancelled',
        signal: controller.signal,
      });
      const rejection = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
      controller.abort();
      await rejection;
      release();
      await (await first).text();
      await (await transport.fetch(origin, { method: 'POST', body: 'after' })).text();
      expect(received).toEqual(['first', 'after']);
    } finally {
      release();
      await transport.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('limita la espera de un POST lento sin reenviarlo', async () => {
    let received = 0;
    const server = createServer(() => {
      received++;
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const transport = createBoundedTransport(origin, 1, 200);
    try {
      await expect(transport.fetch(origin, { method: 'POST', body: 'slow' })).rejects.toMatchObject(
        { name: 'TimeoutError' },
      );
      expect(received).toBe(1);
    } finally {
      await transport.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
