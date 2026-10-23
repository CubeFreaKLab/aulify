import type { StudentQuestion } from '@/domain/types';

export interface GuestLink {
  token: string;
  title: string;
  opensAt: string;
  closesAt: string;
  durationSeconds: number;
  count: number;
}
export interface GuestView {
  quiz: GuestLink & { status: 'waiting' | 'open' | 'closed' };
  serverNow: string;
  question: StudentQuestion | null;
  run: null | {
    name: string;
    avatarId: string;
    index: number;
    startedAt: string;
    deadline: string;
    finished: boolean;
    points: number;
    maximum: number;
  };
  feedback?: { points: number; maximum: number; explanation: string };
}
