import { toStudentQuestion } from './operations';
import type { Question } from './types';
import type { GuestView } from '../lib/guest-types';

export interface GuestRecord {
  quiz: {
    token: string;
    title: string;
    questions: Question[];
    opens_at: string;
    closes_at: string;
    duration_seconds: number;
  };
  run: null | {
    display_name: string;
    avatar_id: string;
    started_at: string;
    deadline: string;
    answers: { points: number; maximum: number; explanation: string; requestId: string }[];
  };
  serverNow: string;
}
export function guestProjection(record: GuestRecord): GuestView {
  const { quiz: q, run: r } = record;
  const now = Date.parse(record.serverNow);
  const finished = Boolean(
    r &&
    (r.answers.length >= q.questions.length ||
      now >= Date.parse(r.deadline) ||
      now >= Date.parse(q.closes_at)),
  );
  const status =
    now < Date.parse(q.opens_at) ? 'waiting' : now >= Date.parse(q.closes_at) ? 'closed' : 'open';
  return {
    quiz: {
      token: q.token,
      title: q.title,
      count: q.questions.length,
      opensAt: q.opens_at,
      closesAt: q.closes_at,
      durationSeconds: q.duration_seconds,
      status,
    },
    serverNow: record.serverNow,
    run: r
      ? {
          name: r.display_name,
          avatarId: r.avatar_id,
          index: r.answers.length,
          startedAt: r.started_at,
          deadline: r.deadline,
          finished,
          points: r.answers.reduce((sum, a) => sum + a.points, 0),
          maximum: q.questions.reduce((sum, question) => sum + question.points, 0),
        }
      : null,
    question:
      r && !finished && status === 'open' ? toStudentQuestion(q.questions[r.answers.length]) : null,
  };
}
