import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import {
  calculateAverage,
  defaultActivitySettings,
  type DemoState,
  type Evaluation,
} from '../../src/domain';

it('AC-38: un quiz no iniciado solo cuenta como cero después de una decisión publicada con motivo', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
      alter table storage.objects enable row level security;
      grant all on storage.objects to authenticated;
      grant usage on schema storage to authenticated;
    `);
    const migrations = (await readdir('supabase/migrations'))
      .filter((file) => file.endsWith('.sql'))
      .sort();
    for (const migration of migrations)
      await db.exec(await readFile(`supabase/migrations/${migration}`, 'utf8'));
    const teacher = randomUUID();
    const student = randomUUID();
    for (const [role, id] of [
      ['teacher', teacher],
      ['student', student],
    ])
      await db.query('insert into auth.users values($1,$2,now(),$3)', [
        id,
        `${role}@example.test`,
        { name: role, role },
      ]);
    await db.exec('set role authenticated');
    const as = async (userId: string) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
    };
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

    await as(teacher);
    const subject = await command<{ id: string }>('createSubject', {
      name: 'AC-38 · Ausencia en quiz',
      course: '3.º A',
      year: 2026,
      description: 'Prueba ficticia aislada.',
    });
    const code = (await snapshot()).subjects.find(({ id }) => id === subject.id)!.code;
    await as(student);
    const request = await command<{ id: string }>('requestMembership', code);
    await as(teacher);
    await command('decideMembership', request.id, 'approved');
    const questionId = randomUUID();
    const resourceId = randomUUID();
    await command(
      'saveDraft',
      {
        id: resourceId,
        ownerId: teacher,
        title: 'Pregunta de control',
        kind: 'quiz',
        revision: 1,
        updatedAt: new Date().toISOString(),
        blocks: [
          {
            id: randomUUID(),
            type: 'quiz',
            questions: [
              {
                id: questionId,
                type: 'true-false',
                prompt: 'Las plantas son seres vivos.',
                points: 2,
                correct: true,
              },
            ],
          },
        ],
      },
      0,
    );
    const version = await command<{ id: string }>('publishResource', resourceId);
    const settings = {
      ...defaultActivitySettings(),
      maxGrade: 100,
      weight: 1,
      countsTowardAverage: true,
    };
    const answered = await command<{ id: string }>(
      'createActivity',
      version.id,
      subject.id,
      settings,
      'Quiz respondido',
    );
    const absent = await command<{ id: string }>(
      'createActivity',
      version.id,
      subject.id,
      {
        ...settings,
        opensAt: new Date(Date.now() - 120_000).toISOString(),
        closesAt: new Date(Date.now() - 60_000).toISOString(),
      },
      'Quiz no iniciado',
    );
    await as(student);
    const attempt = await command<{ id: string }>('startAttempt', answered.id);
    await command(
      'submitAnswer',
      attempt.id,
      questionId,
      { type: 'true-false', value: true },
      randomUUID(),
      false,
    );
    await as(teacher);
    await command('publishGrade', answered.id, student);

    await as(student);
    const before = await snapshot();
    expect(before.attempts.some(({ activityId }) => activityId === absent.id)).toBe(false);
    expect(before.evaluations.some(({ activityId }) => activityId === absent.id)).toBe(false);
    expect(calculateAverage(before.evaluations)).toBe(100);
    await expect(
      command('recordNonparticipation', absent.id, student, 0, '', 'No participó.', true),
    ).rejects.toThrow();

    await as(teacher);
    await expect(
      command('recordNonparticipation', absent.id, student, 0, '', '', true),
    ).rejects.toThrow('INVALID_NONPARTICIPATION');
    expect((await snapshot()).evaluations.some(({ activityId }) => activityId === absent.id)).toBe(
      false,
    );
    const reason = 'No inició el quiz cerrado; se registra la decisión docente.';
    const zero = await command<Evaluation>(
      'recordNonparticipation',
      absent.id,
      student,
      0,
      'Puedes consultar el motivo con tu docente.',
      reason,
      true,
    );
    expect(zero).toMatchObject({ grade: 0, reason, actorId: teacher, source: 'quiz' });
    expect(zero.publishedAt).toBeTruthy();
    expect(zero.attemptId).toBeUndefined();

    await as(student);
    const after = await snapshot();
    expect(after.evaluations.find(({ activityId }) => activityId === absent.id)).toMatchObject({
      grade: 0,
      reason,
      publishedAt: zero.publishedAt,
    });
    expect(after.attempts.filter(({ activityId }) => activityId === absent.id)).toEqual([]);
    expect(after.evaluations).toHaveLength(2);
    expect(calculateAverage(after.evaluations)).toBe(50);
    expect(after.evaluations.find(({ activityId }) => activityId === answered.id)?.attemptId).toBe(
      attempt.id,
    );
    await db.exec('reset role');
    const stored = await db.query<{
      source_kind: string;
      attempt_id: string | null;
      submission_version_id: string | null;
    }>(
      'select source_kind,attempt_id,submission_version_id from app.evaluation_revisions where id=$1',
      [zero.id],
    );
    expect(stored.rows).toEqual([
      { source_kind: 'nonparticipation', attempt_id: null, submission_version_id: null },
    ]);
  } finally {
    await db.close();
  }
}, 30_000);
