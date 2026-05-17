import { describe, it, expect, vi, beforeEach } from 'vitest';

const addMock = vi.fn();
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({ add: addMock, getJob: vi.fn() })),
  Worker: vi.fn(),
}));

vi.mock('../../src/shared/lib/redis.js', () => ({
  redis: { get: vi.fn(), set: vi.fn() },
}));

describe('notifications queue', () => {
  beforeEach(() => {
    addMock.mockClear();
  });

  it('schedules deadline jobs', async () => {
    const { scheduleDeadlineNotifications } = await import('../../src/modules/queue/notifications.queue.js');
    const deadline = new Date(Date.now() + 48 * 3600_000);
    await scheduleDeadlineNotifications('task-1', deadline);
    expect(addMock).toHaveBeenCalled();
  });
});
