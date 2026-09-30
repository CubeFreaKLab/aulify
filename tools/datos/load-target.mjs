import fs from 'node:fs/promises';

const localOrigin = 'http://127.0.0.1:3001';
const previewHost = /^aulify-[a-z0-9]+-jdanielchfhd-9543s-projects\.vercel\.app$/;

export function createLoadTarget({ base, expectedBuild, manifest, secret, fetchImpl = fetch }) {
  if (!expectedBuild || !/^[\w-]+$/.test(expectedBuild))
    throw new Error('Falta identificar el compilado.');
  const url = new URL(base);
  const local = base === localOrigin;
  if (url.origin !== base)
    throw new Error('El destino debe ser un origen sin ruta ni credenciales.');
  if (
    !local &&
    (url.protocol !== 'https:' ||
      !previewHost.test(url.hostname) ||
      url.port ||
      manifest?.baseUrl !== base ||
      manifest?.buildId !== expectedBuild ||
      manifest?.projectId !== 'prj_ZQGfPAaJLkLOa5nPa1GoPVF7ACzb' ||
      manifest?.environment !== 'preview' ||
      manifest?.ready !== true ||
      !/^[a-f0-9]{40}$/.test(manifest?.sourceCommit || '') ||
      !/^[A-Za-z0-9_-]{16,256}$/.test(secret || ''))
  )
    throw new Error('Vista previa no identificada o sin acceso autorizado de automatización.');
  if (local && secret) throw new Error('No enviar el secreto de Vercel al servidor local.');
  const request = (path, init = {}) => {
    const target = new URL(path, base);
    if (!path.startsWith('/') || target.origin !== base || target.username || target.password) {
      throw new Error('Solicitud fuera del destino de carga autorizado.');
    }
    const headers = new Headers(init.headers);
    headers.delete('x-vercel-protection-bypass');
    if (!local) headers.set('x-vercel-protection-bypass', secret);
    // Ninguna redirección recibe cookies ni el acceso temporal de automatización.
    return fetchImpl(target.href, { ...init, headers, redirect: 'manual' });
  };
  return {
    local,
    metadata: {
      base,
      expectedBuild,
      environment: local ? 'local-production-build' : 'vercel-preview',
      sourceCommit: local ? undefined : manifest.sourceCommit,
    },
    request,
    async verifyBuild() {
      if (local && (await fs.readFile('.next/BUILD_ID', 'utf8')).trim() !== expectedBuild) {
        throw new Error('Compilado local diferente del esperado.');
      }
      const response = await request('/', { signal: AbortSignal.timeout(15_000) });
      if (!response.ok || !(await response.text()).includes(expectedBuild)) {
        throw new Error('El alojamiento no entrega el compilado esperado o rechaza el acceso.');
      }
      return {
        ...this.metadata,
        verifiedAt: new Date().toISOString(),
        diskMatches: local ? true : null,
        servedHtmlMatches: true,
      };
    },
  };
}

export async function loadTargetFromEnvironment(base, env = process.env) {
  const local = base === localOrigin;
  const manifestPath = env.AULIFY_LOAD_PREVIEW_MANIFEST;
  const secretPath = env.AULIFY_LOAD_PREVIEW_SECRET_FILE;
  if (!local && (!manifestPath || !secretPath))
    throw new Error('Faltan manifiesto y acceso privado de la vista previa.');
  return createLoadTarget({
    base,
    expectedBuild: env.AULIFY_EXPECTED_BUILD_ID,
    manifest: local ? undefined : JSON.parse(await fs.readFile(manifestPath, 'utf8')),
    secret: local ? undefined : (await fs.readFile(secretPath, 'utf8')).trim(),
  });
}
