/** Copia local de bytes de Storage; no sustituye un respaldo de PostgreSQL y Auth. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const base = path.resolve('.local-private/backups');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const projectRef = 'bnqyyumfmyexsqszglab';
const bucket = 'aulify-files';
const maxBytes = 256 * 1024 * 1024;
const maxObjects = 5000;
const inside = (value) => {
  const resolved = path.resolve(value);
  assert.ok(
    resolved.startsWith(base + path.sep),
    'La ruta debe quedar dentro del respaldo privado',
  );
  return resolved;
};

async function verify(directory) {
  const folder = inside(directory);
  const manifest = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
  assert.equal(manifest.projectRef, projectRef);
  assert.equal(manifest.bucket, bucket);
  assert.equal(manifest.complete, true);
  let bytes = 0;
  for (const object of manifest.objects) {
    assert.match(object.localName, /^[a-f0-9]{64}\.bin$/);
    const content = await fs.readFile(path.join(folder, 'objects', object.localName));
    assert.equal(content.length, object.size);
    assert.equal(sha(content), object.sha256);
    bytes += content.length;
  }
  assert.equal(bytes, manifest.totalBytes);
  return {
    objects: manifest.objects.length,
    totalBytes: bytes,
    verifiedAt: new Date().toISOString(),
  };
}

const operation = process.argv[2];
if (operation === '--verify') {
  console.log(JSON.stringify(await verify(process.argv[3])));
} else if (operation === '--create') {
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, `https://${projectRef}.supabase.co`);
  assert.ok(process.env.SUPABASE_SECRET_KEY, 'Falta la variable privada de servidor');
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const folder = inside(path.join(base, `storage-${Date.now()}-${randomUUID()}`));
  await fs.mkdir(path.join(folder, 'objects'), { recursive: true });
  const manifest = {
    projectRef,
    bucket,
    startedAt: new Date().toISOString(),
    complete: false,
    objects: [],
    totalBytes: 0,
  };
  const folders = [''];
  const discovered = [];
  for (let index = 0; index < folders.length; index++) {
    assert.ok(folders.length <= maxObjects, 'Demasiadas carpetas');
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.storage.from(bucket).list(folders[index], {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`No se pudo listar Storage: ${error.statusCode ?? 'ERROR'}`);
      for (const entry of data) {
        const objectPath = [folders[index], entry.name].filter(Boolean).join('/');
        if (!entry.id) folders.push(objectPath);
        else
          discovered.push({
            path: objectPath,
            id: entry.id,
            metadata: entry.metadata,
            updatedAt: entry.updated_at,
          });
      }
      assert.ok(discovered.length <= maxObjects, 'Demasiados objetos');
      if (data.length < 100) break;
    }
  }
  assert.ok(
    discovered.reduce((sum, object) => sum + Number(object.metadata?.size ?? 0), 0) <= maxBytes,
    'El respaldo excede el presupuesto de 256 MiB',
  );
  for (const object of discovered) {
    const { data, error } = await client.storage
      .from(bucket)
      .download(object.path, { cacheNonce: randomUUID() });
    if (error)
      throw new Error(`Objeto no disponible durante la copia: ${error.statusCode ?? 'ERROR'}`);
    const bytes = Buffer.from(await data.arrayBuffer());
    assert.ok(manifest.totalBytes + bytes.length <= maxBytes, 'El respaldo excede el presupuesto');
    const localName = sha(object.path) + '.bin';
    await fs.writeFile(path.join(folder, 'objects', localName), bytes, { flag: 'wx' });
    manifest.objects.push({ ...object, localName, size: bytes.length, sha256: sha(bytes) });
    manifest.totalBytes += bytes.length;
  }
  manifest.complete = true;
  manifest.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const verification = await verify(folder);
  const summary = {
    status: 'passed',
    projectRef,
    bucket,
    ...verification,
    manifestSha256: sha(await fs.readFile(path.join(folder, 'manifest.json'))),
    limitations: [
      'Copia de archivos con verificación local de bytes; no restaura PostgreSQL ni cuentas de Auth.',
      'No es una instantánea transaccional conjunta con la base de datos. Debe coordinarse con una pausa de escrituras para una recuperación completa.',
    ],
  };
  await fs.writeFile(
    'docs/verificacion/respaldo-storage.json',
    JSON.stringify(summary, null, 2) + '\n',
  );
  await fs.writeFile(
    '.local-private/latest-storage-backup.json',
    JSON.stringify({ folder, ...summary }, null, 2),
  );
  console.log(JSON.stringify({ status: summary.status, ...verification }));
} else {
  throw new Error('Usar --create o --verify RUTA_PRIVADA');
}
