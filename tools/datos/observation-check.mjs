import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const results = [];
try {
  // Agregar un lock en cada iteración permite detectar reuso del primer conjunto.
  const queries = {
    functionScan: `with recursive s(n,c) as (select 0,0::bigint union all select p.n+1,o.c from s p cross join lateral(select pg_advisory_lock(p.n::bigint) v) l cross join lateral(select count(*) c from pg_locks where locktype='advisory' and l.v::text is not null) o where p.n<5) select c from s where n>0`,
    projectSet: `with recursive s(n,c) as (select 0,0::bigint union all select p.n+1,o.c from s p cross join lateral(select pg_advisory_lock(p.n::bigint) v) l cross join lateral(select count(*) c from (select to_jsonb(pg_lock_status()) j where l.v::text is not null) k where j->>'locktype'='advisory') o where p.n<5) select c from s where n>0`,
  };
  for (const [name, query] of Object.entries(queries)) {
    await db.query('select pg_advisory_unlock_all()');
    const counts = (await db.query(query)).rows.map(r => Number(r.c));
    assert.deepEqual(counts, name === 'functionScan' ? [1, 1, 1, 1, 1] : [1, 2, 3, 4, 5]);
    results.push({ name, counts, pass: true });
  }
  await db.exec('create schema app; create table app.activity_sync_versions(activity_id uuid, teacher_revision bigint)');
  const sql = (await fs.readFile('tools/datos/observe-counter-waits-v2.sql', 'utf8')).replace('previous.n<160', 'previous.n<5').replace("'requested_samples',160", "'requested_samples',5");
  const start = performance.now(), diagnostic = (await db.query(sql)).rows[0].diagnostic;
  assert.equal(diagnostic.observer_version, 2);
  assert.equal(diagnostic.actual_samples, 5);
  assert.ok(performance.now() - start >= 500);
  assert.ok(!JSON.stringify(diagnostic).match(/"(pid|query|usename|client_addr)"\s*:/));
  for (let i = 1; i < diagnostic.samples.length; i++) assert.ok(Date.parse(diagnostic.samples[i].at) - Date.parse(diagnostic.samples[i - 1].at) >= 95);
  results.push({ name: 'Consulta completa v2: cinco muestras, separación y salida agregada', pass: true });
  const report = { measuredAt: new Date().toISOString(), environment: 'PGlite aislado; advisory locks ficticios en una sola sesión; sin tráfico remoto.', results };
  await fs.writeFile('docs/verificacion/datos-observador-aislado.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await db.close();
}
