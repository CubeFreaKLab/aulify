import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoadTarget } from './load-target.mjs';

const base = 'https://aulify-fixture-jdanielchfhd-9543s-projects.vercel.app';
const secret = 'fixture-secret-not-a-credential';
const manifest = {
  baseUrl: base,
  buildId: 'build-fixture',
  projectId: 'prj_ZQGfPAaJLkLOa5nPa1GoPVF7ACzb',
  sourceCommit: '1'.repeat(40),
  environment: 'preview',
  ready: true,
};
const config = { base, expectedBuild: manifest.buildId, manifest, secret };

test('limita credenciales al origen autorizado y no sigue redirecciones', async () => {
  const calls = [];
  const target = createLoadTarget({
    ...config,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(null, { status: 302, headers: { Location: 'https://foreign.example' } });
    },
  });
  const response = await target.request('/api/commands', {
    method: 'POST',
    headers: { Cookie: 'fixture=session', Origin: base },
    body: '{}',
    redirect: 'follow',
  });
  assert.equal(response.status, 302);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[0].options.headers.get('x-vercel-protection-bypass'), secret);
  assert.equal(calls[0].options.headers.get('Cookie'), 'fixture=session');
  assert.equal(calls[0].options.body, '{}');
  for (const path of [
    '//foreign.example/api/commands',
    'https://foreign.example/',
    '/\\foreign.example/',
  ])
    assert.throws(() => target.request(path));
  assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(target).includes(secret), false);
});

test('rechaza producción, otro proyecto, metadatos incompletos y falta de autorización', () => {
  const cases = [
    { base: 'https://aulify-cubefreaklab.vercel.app' },
    { base: 'https://other-fixture-jdanielchfhd-9543s-projects.vercel.app' },
    { manifest: { ...manifest, environment: 'production' } },
    { manifest: { ...manifest, ready: false } },
    { manifest: { ...manifest, buildId: 'other-build' } },
    { manifest: { ...manifest, sourceCommit: 'unknown' } },
    { manifest: { ...manifest, projectId: 'another-project' } },
    { secret: '' },
    { base: base + '/' },
  ];
  for (const override of cases) assert.throws(() => createLoadTarget({ ...config, ...override }));
});

test('el servidor local no recibe credenciales del alojamiento', async () => {
  let headers;
  const target = createLoadTarget({
    base: 'http://127.0.0.1:3001',
    expectedBuild: 'fixture',
    fetchImpl: async (_url, init) => {
      headers = init.headers;
      return new Response('ok');
    },
  });
  await target.request('/', { headers: { 'x-vercel-protection-bypass': secret } });
  assert.equal(headers.has('x-vercel-protection-bypass'), false);
  assert.throws(() => createLoadTarget({ ...config, base: 'http://127.0.0.1:3001' }));
});

test('el manifiesto remoto exige verificar el compilado realmente servido', async () => {
  const target = createLoadTarget({
    ...config,
    fetchImpl: async () => new Response('<html>build-fixture</html>'),
  });
  const evidence = await target.verifyBuild();
  assert.equal(evidence.diskMatches, null);
  assert.equal(evidence.servedHtmlMatches, true);
  assert.equal(evidence.sourceCommit, manifest.sourceCommit);
  for (const response of [new Response('other-build'), new Response('', { status: 401 })]) {
    const invalid = createLoadTarget({ ...config, fetchImpl: async () => response });
    await assert.rejects(invalid.verifyBuild());
  }
});
