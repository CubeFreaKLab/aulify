import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
  remove: vi.fn(),
  broadcast: null as null | ((v: { payload: unknown }) => void),
  status: null as null | ((v: string) => void),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/activity-events', () => import('../../src/lib/activity-events'));
vi.mock('../../src/lib/supabase/config', () => ({
  supabaseConfig: () => ({ url: 'https://example.test' }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    channel: mocks.channel,
    removeChannel: mocks.remove,
    realtime: { disconnect: vi.fn() },
  }),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it('comparte el canal de servidor, filtra el destinatario y libera la última conexión', async () => {
  vi.useFakeTimers();
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-only');
  const channel = {
    on: vi.fn((_name, _filter, callback) => {
      mocks.broadcast = callback;
      return channel;
    }),
    subscribe: vi.fn((callback) => {
      mocks.status = callback;
      return channel;
    }),
  };
  mocks.channel.mockReturnValue(channel);
  mocks.remove.mockResolvedValue('ok');
  const { subscribeActivityHints } = await import('../../src/lib/supabase/activity-events');
  const activity = '10000000-0000-4000-8000-000000000001';
  const one = '10000000-0000-4000-8000-000000000002';
  const two = '10000000-0000-4000-8000-000000000003';
  const a = { userId: one, changed: vi.fn(), connected: vi.fn() };
  const b = { userId: two, changed: vi.fn(), connected: vi.fn() };
  const leaveA = subscribeActivityHints(activity, a),
    leaveB = subscribeActivityHints(activity, b);
  expect(mocks.channel).toHaveBeenCalledExactlyOnceWith(`aulify:activity:${activity}`, {
    config: { private: true },
  });
  mocks.status!('SUBSCRIBED');
  expect(a.connected).toHaveBeenLastCalledWith(true);
  mocks.broadcast!({ payload: { activityId: activity, studentId: one, revoked: true } });
  expect(a.changed).toHaveBeenCalledWith(true, false);
  expect(b.changed).not.toHaveBeenCalled();
  mocks.broadcast!({ payload: { activityId: 'invalid' } });
  expect(a.changed).toHaveBeenCalledOnce();
  mocks.broadcast!({ payload: { activityId: activity } });
  expect(b.changed).toHaveBeenCalledWith(false, true);
  leaveA();
  expect(mocks.remove).not.toHaveBeenCalled();
  leaveB();
  leaveB();
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(channel);
  await vi.advanceTimersByTimeAsync(5000);
});
