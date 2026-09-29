import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';

// Sin --run solo comprueba la preparación local; no inicia sesión ni realiza solicitudes.
const run = process.argv.includes('--run');
const scriptPath = 'tools/datos/editor-links-remote.mjs';
const migrationPath = 'supabase/migrations/20260929231531_aulify_editor_link_validation.sql';
const migrationHash = 'c414dacd0c2d27335aefb9a3a981ac805f48997a3acb9e0fd5a390f876255132';
const reportPath = 'docs/verificacion/enlaces-editor-remoto.json';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const literal = '<script>Ejemplo educativo inerte</script>\n<a href="javascript:void(0)">Texto</a>';
const documentWithHref = (href) => [
  {
    type: 'toggleListItem',
    content: [{ type: 'text', text: 'Ejemplo ficticio AP-33', styles: {} }],
    children: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'link',
            href,
            content: [{ type: 'text', text: 'Referencia educativa', styles: {} }],
          },
        ],
      },
      {
        type: 'codeBlock',
        props: { language: 'html' },
        content: [{ type: 'text', text: literal, styles: {} }],
      },
    ],
  },
];

async function preflight() {
  // Mismas guardas de proyecto y carga local que game-privacy-remote.mjs; una sola cuenta.
  const accounts = JSON.parse(
    await fs.readFile('.local-private/remote-test-accounts.json', 'utf8'),
  );
  const env = Object.fromEntries(
    (await fs.readFile('.env.local', 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, '')];
      }),
  );
  const teacher = accounts.users?.teacher;
  if (
    accounts.projectRef !== 'bnqyyumfmyexsqszglab' ||
    env.NEXT_PUBLIC_SUPABASE_URL !== `https://${accounts.projectRef}.supabase.co` ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_') ||
    !teacher?.id ||
    !teacher.email ||
    !teacher.password ||
    hash(await fs.readFile(migrationPath)) !== migrationHash
  )
    throw new Error('Preparación local no válida.');
  return { teacher, env };
}

async function execute({ teacher, env }) {
  const report = {
    startedAt: new Date().toISOString(),
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    environment: 'Supabase remoto, JWT de una docente ficticia existente y clave publicable',
    script: { path: scriptPath, sha256: hash(await fs.readFile(scriptPath)) },
    expectedMigration: { path: migrationPath, sha256: migrationHash },
    fixture: 'AP-33: un recurso nuevo con enlace HTTPS anidado y código literal educativo.',
    checks: [],
    rpcCalls: 0,
    limits: { maxRpcCalls: 15, accountsCreated: 0, resourcesCreatedAtMost: 1 },
    limitations: [
      'No aplica migraciones ni consulta su historial remoto; requiere verificar su aplicación antes del ensayo.',
      'No mide capacidad, concurrencia, interfaz, accesibilidad ni ejecución de enlaces.',
      'Compara el borrador completo, incluida su revisión, y las versiones propias del recurso; state.revision cambia con la hora de lectura y no se usa como revisión persistida.',
      'No publica credenciales, JWT, direcciones de cuentas, identificadores ni documentos ajenos.',
    ],
  };
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  let authenticated = false;
  const equal = (actual, expected, detail) => {
    if (!isDeepStrictEqual(actual, expected)) throw new Error(`ASSERT: ${detail}`);
    report.checks.push({ detail, result: 'passed' });
    console.log(`PASS ${detail}`);
  };
  const rpc = async (name, args) => {
    if (report.rpcCalls >= report.limits.maxRpcCalls)
      throw new Error('ASSERT: Se alcanzó el límite de RPC del ensayo.');
    report.rpcCalls += 1;
    const { data, error } = await client.rpc(name, args);
    if (error || data?.error) {
      const failure = error ?? data.error;
      const marker = String(failure.message ?? '').match(/^[A-Z][A-Z_0-9]+(?=:|$)/)?.[0];
      const code = /^[A-Z0-9]+$/.test(String(failure.code)) ? failure.code : 'UNKNOWN';
      const sanitized = new Error(`RPC ${name}: ${marker ?? code}`);
      sanitized.domainCode = marker;
      throw sanitized;
    }
    return data;
  };
  const command = (action, ...args) =>
    rpc('aulify_command', { p_action: action, p_payload: { args } });
  const snapshot = () => rpc('aulify_snapshot');

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: teacher.email,
      password: teacher.password,
    });
    if (error) throw new Error('AUTH: No se pudo iniciar la sesión ficticia.');
    authenticated = true;
    equal(data.user?.id, teacher.id, 'JWT corresponde a la cuenta ficticia preparada');
    const initial = await snapshot();
    equal(
      initial.state.users.find((user) => user.id === initial.userId)?.role,
      'teacher',
      'El perfil persistido tiene función docente',
    );
    const resource = {
      id: randomUUID(),
      ownerId: teacher.id,
      title: 'AP-33 · Enlaces y código literal · ensayo remoto',
      kind: 'resource',
      revision: 1,
      updatedAt: new Date().toISOString(),
      blocks: [{ id: randomUUID(), type: 'text', text: 'Contenido educativo ficticio.' }],
      editorDocument: documentWithHref('HTTPS://example.test/leccion#resumen'),
    };
    await command('saveDraft', resource, 0);
    report.cleanup = 'Un recurso ficticio conservado en la biblioteca de la cuenta de prueba.';
    const baseline = await snapshot();
    const stored = baseline.state.resources.find((item) => item.id === resource.id);
    equal(
      stored?.editorDocument,
      resource.editorDocument,
      'HTTPS y código literal se guardan intactos',
    );
    equal(stored?.revision, 1, 'El borrador válido comienza en revisión 1');
    const versions = (state) => state.versions.filter((item) => item.resourceId === resource.id);
    equal(versions(baseline.state).length, 0, 'El recurso todavía no tiene versiones publicadas');
    for (const [label, href] of [
      ['JavaScript', 'javascript:void(0)'],
      ['tipo nulo', null],
      ['control interno', 'https://example.test/\tmarcador'],
    ]) {
      let failure;
      try {
        await command('saveDraft', { ...resource, editorDocument: documentWithHref(href) }, 1);
      } catch (error) {
        failure = error;
      }
      equal(
        failure?.domainCode,
        'INVALID_EDITOR_LINK',
        `${label}: se rechaza con error orientable`,
      );
      const after = await snapshot();
      equal(
        after.state.resources.find((item) => item.id === resource.id),
        stored,
        `${label}: no cambia contenido, revisión ni fecha del borrador`,
      );
      equal(versions(after.state), [], `${label}: no crea una versión`);
    }
    const published = await command('publishResource', resource.id);
    equal(
      published.editorDocument,
      resource.editorDocument,
      'La publicación conserva HTTPS y código literal',
    );
    const final = await snapshot();
    equal(
      versions(final.state).length,
      1,
      'Se persiste exactamente una versión del recurso ficticio',
    );
    equal(
      versions(final.state)[0]?.editorDocument,
      resource.editorDocument,
      'La lectura posterior conserva el documento publicado completo',
    );
    equal(
      final.state.resources.find((item) => item.id === resource.id)?.revision,
      1,
      'La publicación mantiene la revisión 1 del borrador',
    );
    report.observation = { rejectedVariants: 3, draftRevision: 1, publishedVersions: 1 };
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.failure =
      error instanceof Error && /^(ASSERT:|AUTH:|RPC )/.test(error.message)
        ? error.message.slice(0, 240)
        : 'Fallo de transporte o respuesta no reconocida; no se publica contenido sensible.';
    console.error(report.failure);
    process.exitCode = 1;
  } finally {
    if (authenticated) {
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw new Error('Signout');
      } catch {
        report.sessionCleanupWarning = 'No se confirmó el cierre de la sesión local del ensayo.';
      }
    }
    report.completedAt = new Date().toISOString();
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(
      JSON.stringify({
        status: report.status,
        checks: report.checks.length,
        rpcCalls: report.rpcCalls,
        report: reportPath,
      }),
    );
  }
}

try {
  const prepared = await preflight();
  if (run) await execute(prepared);
  else
    console.log(
      JSON.stringify({ status: 'prepared-only', accounts: 1, remoteRequests: 0, maxRpcCalls: 15 }),
    );
} catch {
  console.error(
    'No se completó la preparación: revisa la cuenta ficticia, el entorno y la migración esperada.',
  );
  process.exitCode = 1;
}
