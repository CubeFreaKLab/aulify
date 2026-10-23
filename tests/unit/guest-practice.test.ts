import { describe, expect, it } from 'vitest';
import { guestProjection, type GuestRecord } from '../../src/domain/guest-practice';
import {
  ecosystemQuestions,
  createDemoState,
  ensureIllustratedQuiz,
} from '../../src/domain/demo-data';
import { databaseRpcSql } from '../../src/lib/postgres-rpc';

const now = '2026-10-23T12:00:00.000Z';
const record = (): GuestRecord => ({
  quiz: {
    token: 'example',
    title: 'Práctica',
    questions: ecosystemQuestions(),
    opens_at: '2026-10-23T11:00:00.000Z',
    closes_at: '2026-10-23T13:00:00.000Z',
    duration_seconds: 240,
  },
  run: {
    display_name: 'Invitada',
    avatar_id: 'm01',
    started_at: now,
    deadline: '2026-10-23T12:04:00.000Z',
    answers: [],
  },
  serverNow: now,
});
describe('Práctica pública separada', () => {
  it('entrega solo la pregunta actual, sin claves ni explicaciones anticipadas de ningún tipo', () => {
    const source = record();
    for (let index = 0; index < source.quiz.questions.length; index++) {
      source.run!.answers = Array.from({ length: index }, () => ({
        points: 0,
        maximum: 1,
        explanation: '',
        requestId: 'example',
      }));
      const projected = guestProjection(source);
      expect(projected.question?.id).toBe(source.quiz.questions[index].id);
      expect(projected.quiz).not.toHaveProperty('questions');
      for (const key of [
        'correctOptionId',
        'correctOptionIds',
        'correctOrder',
        'manualGuide',
        'explanation',
        'hint',
        'pairs',
        '"correct"',
      ])
        expect(JSON.stringify(projected.question)).not.toContain(key);
    }
  });
  it('no presenta preguntas antes de entrar ni tras cerrar o vencer la partida', () => {
    const source = record();
    source.run = null;
    expect(guestProjection(source).question).toBeNull();
    const expired = record();
    expired.serverNow = '2026-10-23T12:04:00.000Z';
    expect(guestProjection(expired).run?.finished).toBe(true);
    expect(guestProjection(expired).question).toBeNull();
    const scheduled = record();
    scheduled.quiz.opens_at = '2026-10-23T12:01:00.000Z';
    expect(guestProjection(scheduled).quiz.status).toBe('waiting');
    expect(guestProjection(scheduled).question).toBeNull();
  });
  it('mantiene la gestión autenticada y prohíbe confundirla con el servicio privado', () => {
    expect(() => databaseRpcSql('guestManage', null, ['create', {}])).toThrow('INVALID_IDENTITY');
    expect(() =>
      databaseRpcSql('guest', '11111111-1111-4111-8111-111111111111', ['read', {}]),
    ).toThrow('INVALID_PAYLOAD');
    expect(databaseRpcSql('guest', null, ['read', { token: "';select secret;--" }])).toContain(
      'SET LOCAL ROLE service_role',
    );
    expect(() => databaseRpcSql('avatars', null, [])).toThrow('INVALID_IDENTITY');
  });
  it('añadir el ejemplo es idempotente y no altera borradores ni respuestas existentes', () => {
    const state = createDemoState(now);
    const before = JSON.stringify(state);
    expect(ensureIllustratedQuiz(state, now)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    state.activities = state.activities.filter((a) => a.id !== 'activity-quiz-ilustrado');
    const original = structuredClone(state.resources[0]);
    expect(ensureIllustratedQuiz(state, now)).toBe(true);
    expect(state.resources[0]).toEqual(original);
    expect(state.activities.filter((a) => a.id === 'activity-quiz-ilustrado')).toHaveLength(1);
  });
});
