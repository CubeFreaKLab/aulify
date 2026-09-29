import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import {
  createDemoState,
  DEMO_IDS,
  saveDraft,
  validateEditorDocument,
  type DemoState,
} from '../../src/domain';
import { editorLinkError } from '../../src/domain/editor-links';
import { commandError } from '../../src/lib/command-errors';
import {
  allowedHrefs,
  documentWithHref,
  maximumHref,
  rejectedHrefs,
} from '../fixtures/editor-link-cases';

describe('AP-33: destinos de enlaces estructurales', () => {
  it('acepta 8192 caracteres de enlace y rechaza 8193 sin limitar el texto literal', () => {
    expect(() => validateEditorDocument(documentWithHref(maximumHref))).not.toThrow();
    expect(() => validateEditorDocument(documentWithHref(maximumHref + 'a'))).toThrow(
      editorLinkError,
    );
    expect(() =>
      validateEditorDocument([
        { type: 'codeBlock', content: [{ type: 'text', text: 'javascript:'.repeat(1000) }] },
      ]),
    ).not.toThrow();
  });
  it.each(allowedHrefs)('conserva el enlace permitido %s y el código literal', (href) => {
    const document = documentWithHref(href);
    const original = structuredClone(document);
    expect(() => validateEditorDocument(document)).not.toThrow();
    expect(document).toEqual(original);
  });

  it.each(rejectedHrefs.map((href, index) => ({ href, index })))(
    'rechaza href anidado no permitido, variante $index',
    ({ href }) => {
      expect(() => validateEditorDocument(documentWithHref(href))).toThrow(editorLinkError);
    },
  );

  it('conserva el borrador anterior y orienta el error local y del contrato', () => {
    const state = createDemoState();
    const original = structuredClone(state.resources[0]);
    const changed = { ...original, editorDocument: documentWithHref(rejectedHrefs[0]) };
    expect(() =>
      saveDraft(state, changed, original.revision, {
        actorId: DEMO_IDS.teacher,
        id: randomUUID(),
        now: new Date().toISOString(),
      }),
    ).toThrow(editorLinkError);
    expect(state.resources[0]).toEqual(original);
    expect(commandError('INVALID_EDITOR_LINK')).toBe(editorLinkError);
  });
});

it('AP-33: conserva rechazo SQL de javascript y cierra controles/tipos de href sin modificar versiones existentes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
      alter table storage.objects enable row level security;
      grant all on storage.objects to authenticated; grant usage on schema storage to authenticated;
    `);
    const migrations = (await readdir('supabase/migrations'))
      .filter((file) => file.endsWith('.sql'))
      .sort();
    const migration = migrations.find((file) =>
      file.endsWith('_aulify_editor_link_validation.sql'),
    )!;
    expect(migration).toBeTruthy();
    for (const file of migrations.filter((file) => file < migration))
      await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    const teacher = randomUUID();
    await db.query('insert into auth.users values($1,$2,now(),$3)', [
      teacher,
      'teacher@example.test',
      { name: 'Docente ficticio', role: 'teacher' },
    ]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [teacher]);
    const command = async <T>(action: string, ...args: unknown[]): Promise<T> =>
      (
        await db.query<{ result: T }>('select public.aulify_command($1,$2) result', [
          action,
          { args },
        ])
      ).rows[0].result;
    const snapshot = async () =>
      (await db.query<{ result: { state: DemoState } }>('select public.aulify_snapshot() result'))
        .rows[0].result.state;
    const resource = (href: unknown) => ({
      id: randomUUID(),
      ownerId: teacher,
      title: 'AP-33 · Enlaces y código literal',
      kind: 'resource',
      revision: 1,
      updatedAt: new Date().toISOString(),
      blocks: [{ id: randomUUID(), type: 'text', text: 'Contenido educativo de prueba.' }],
      editorDocument: documentWithHref(href),
    });
    await expect(command('saveDraft', resource(rejectedHrefs[0]), 0)).rejects.toThrow(
      'INVALID_EDITOR_URL',
    );
    const legacy = resource('https://example.test/\tmarcador');
    await command('saveDraft', legacy, 0);
    const legacyVersion = await command<{ id: string; editorDocument: unknown[] }>(
      'publishResource',
      legacy.id,
    );
    expect(legacyVersion.editorDocument).toEqual(legacy.editorDocument);
    const malformed = resource(null);
    await command('saveDraft', malformed, 0);

    await db.exec('reset role');
    await db.exec(await readFile(`supabase/migrations/${migration}`, 'utf8'));
    await db.exec('set role authenticated');
    await expect(command('publishResource', legacy.id)).rejects.toThrow('INVALID_EDITOR_LINK');
    await expect(command('publishResource', malformed.id)).rejects.toThrow('INVALID_EDITOR_LINK');
    const afterMigration = await snapshot();
    expect(
      afterMigration.versions.find(({ id }) => id === legacyVersion.id)?.editorDocument,
    ).toEqual(legacy.editorDocument);
    expect(afterMigration.resources.find(({ id }) => id === legacy.id)?.editorDocument).toEqual(
      legacy.editorDocument,
    );
    expect(afterMigration.versions).toHaveLength(1);
    for (const href of rejectedHrefs)
      await expect(command('saveDraft', resource(href), 0)).rejects.toThrow('INVALID_EDITOR_LINK');
    expect((await snapshot()).resources).toHaveLength(2);
    await expect(command('saveDraft', resource(maximumHref + 'a'), 0)).rejects.toThrow(
      'INVALID_EDITOR_LINK',
    );

    for (const href of [...allowedHrefs, maximumHref]) {
      const valid = resource(href);
      await command('saveDraft', valid, 0);
      const version = await command<{ editorDocument: unknown[] }>('publishResource', valid.id);
      expect(version.editorDocument).toEqual(valid.editorDocument);
      const changed = { ...valid, editorDocument: documentWithHref(rejectedHrefs[1]) };
      await expect(command('saveDraft', changed, 1)).rejects.toThrow('INVALID_EDITOR_LINK');
      expect(
        (await snapshot()).resources.find(({ id }) => id === valid.id)?.editorDocument,
      ).toEqual(valid.editorDocument);
    }
    const privateContent = resource(allowedHrefs[0]);
    const privateDocument = [
      ...privateContent.editorDocument,
      { type: 'paragraph', props: { hint: 'Reservado', explanation: 'Reservada' } },
    ];
    await expect(
      command('saveDraft', { ...privateContent, editorDocument: privateDocument }, 0),
    ).rejects.toThrow('PRIVATE_EDITOR_CONTENT');
    await expect(
      db.query('select app.assert_editor_href($1)', [JSON.stringify(allowedHrefs[0])]),
    ).rejects.toThrow();
    await db.exec('reset role');
    const privileges = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated','app.assert_editor_href(jsonb)','execute') allowed",
    );
    expect(privileges.rows[0].allowed).toBe(false);
  } finally {
    await db.close();
  }
}, 30_000);
