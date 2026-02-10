const DashboardUtils = require('../shared/dashboard-utils');

describe('DashboardUtils', () => {
  describe('getWeekStart', () => {
    test('returns Monday for a Wednesday', () => {
      const wed = new Date(2026, 1, 11); // Wed Feb 11
      const monday = DashboardUtils.getWeekStart(wed);
      expect(monday.getDay()).toBe(1); // Monday
      expect(monday.getDate()).toBe(9);
    });

    test('returns Monday for a Monday', () => {
      const mon = new Date(2026, 1, 9); // Mon Feb 9
      const result = DashboardUtils.getWeekStart(mon);
      expect(result.getDate()).toBe(9);
    });

    test('returns previous Monday for a Sunday', () => {
      const sun = new Date(2026, 1, 15); // Sun Feb 15
      const result = DashboardUtils.getWeekStart(sun);
      expect(result.getDate()).toBe(9);
    });
  });

  describe('getWeekEnd', () => {
    test('returns Sunday', () => {
      const wed = new Date(2026, 1, 11);
      const sunday = DashboardUtils.getWeekEnd(wed);
      expect(sunday.getDay()).toBe(0); // Sunday
      expect(sunday.getDate()).toBe(15);
    });
  });

  describe('getMonthStart', () => {
    test('returns first of month', () => {
      const d = new Date(2026, 1, 15);
      const result = DashboardUtils.getMonthStart(d);
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(1);
    });
  });

  describe('getMonthEnd', () => {
    test('returns last of month', () => {
      const d = new Date(2026, 1, 15); // Feb 2026
      const result = DashboardUtils.getMonthEnd(d);
      expect(result.getDate()).toBe(28);
    });
  });

  describe('isSameDay', () => {
    test('returns true for same day', () => {
      const d1 = new Date(2026, 1, 10, 9, 0);
      const d2 = new Date(2026, 1, 10, 17, 0);
      expect(DashboardUtils.isSameDay(d1, d2)).toBe(true);
    });

    test('returns false for different days', () => {
      const d1 = new Date(2026, 1, 10);
      const d2 = new Date(2026, 1, 11);
      expect(DashboardUtils.isSameDay(d1, d2)).toBe(false);
    });
  });

  describe('formatDate', () => {
    test('formats correctly', () => {
      expect(DashboardUtils.formatDate(new Date(2026, 1, 10))).toBe('Feb 10');
    });
  });

  describe('formatTime24', () => {
    test('formats with zero padding', () => {
      expect(DashboardUtils.formatTime24(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
    });
  });

  describe('formatMonthYear', () => {
    test('formats month and year', () => {
      expect(DashboardUtils.formatMonthYear(new Date(2026, 1, 1))).toBe('February 2026');
    });
  });

  describe('filterByDateRange', () => {
    test('filters items within range', () => {
      const items = [
        { startedAt: '2026-02-09T10:00:00Z' },
        { startedAt: '2026-02-10T10:00:00Z' },
        { startedAt: '2026-02-11T10:00:00Z' },
      ];
      const start = new Date('2026-02-09T00:00:00Z');
      const end = new Date('2026-02-10T23:59:59Z');
      const result = DashboardUtils.filterByDateRange(items, 'startedAt', start, end);
      expect(result).toHaveLength(2);
    });
  });

  describe('sumDuration', () => {
    test('sums durations in seconds', () => {
      const items = [
        { startedAt: '2026-02-10T10:00:00Z', endedAt: '2026-02-10T10:25:00Z' },
        { startedAt: '2026-02-10T11:00:00Z', endedAt: '2026-02-10T11:25:00Z' },
      ];
      expect(DashboardUtils.sumDuration(items, 'startedAt', 'endedAt')).toBe(3000);
    });

    test('skips items without endedAt', () => {
      const items = [
        { startedAt: '2026-02-10T10:00:00Z', endedAt: null },
      ];
      expect(DashboardUtils.sumDuration(items, 'startedAt', 'endedAt')).toBe(0);
    });
  });

  describe('groupByField', () => {
    test('groups by specified field', () => {
      const items = [
        { type: 'focus' },
        { type: 'focus' },
        { type: 'shortBreak' },
      ];
      const groups = DashboardUtils.groupByField(items, 'type');
      expect(groups.focus).toHaveLength(2);
      expect(groups.shortBreak).toHaveLength(1);
    });

    test('uses "untagged" for null values', () => {
      const items = [{ type: null }];
      const groups = DashboardUtils.groupByField(items, 'type');
      expect(groups.untagged).toHaveLength(1);
    });
  });

  describe('computeSessionStats', () => {
    test('computes counts and times per type', () => {
      const sessions = [
        { type: 'focus', status: 'completed', startedAt: '2026-02-10T10:00:00Z', endedAt: '2026-02-10T10:25:00Z' },
        { type: 'focus', status: 'completed', startedAt: '2026-02-10T11:00:00Z', endedAt: '2026-02-10T11:25:00Z' },
        { type: 'shortBreak', status: 'completed', startedAt: '2026-02-10T10:25:00Z', endedAt: '2026-02-10T10:30:00Z' },
      ];
      const stats = DashboardUtils.computeSessionStats(sessions);
      expect(stats.focus.count).toBe(2);
      expect(stats.focus.totalTime).toBe(3000);
      expect(stats.shortBreak.count).toBe(1);
      expect(stats.shortBreak.totalTime).toBe(300);
    });

    test('skips non-completed sessions', () => {
      const sessions = [
        { type: 'focus', status: 'running', startedAt: '2026-02-10T10:00:00Z', endedAt: null },
      ];
      const stats = DashboardUtils.computeSessionStats(sessions);
      expect(stats.focus.count).toBe(0);
    });
  });

  describe('computeTagStats', () => {
    test('computes tag totals from entries and tasks', () => {
      const tasks = [
        { id: 't1', tag: 'work' },
        { id: 't2', tag: 'learn' },
      ];
      const entries = [
        { taskId: 't1', startedAt: '2026-02-10T10:00:00Z', endedAt: '2026-02-10T10:25:00Z' },
        { taskId: 't1', startedAt: '2026-02-10T11:00:00Z', endedAt: '2026-02-10T11:10:00Z' },
        { taskId: 't2', startedAt: '2026-02-10T12:00:00Z', endedAt: '2026-02-10T12:15:00Z' },
      ];
      const stats = DashboardUtils.computeTagStats(entries, tasks);
      expect(stats.work.totalTime).toBe(2100);
      expect(stats.work.count).toBe(1);
      expect(stats.learn.totalTime).toBe(900);
      expect(stats.learn.count).toBe(1);
    });
  });

  describe('computeDomainStats', () => {
    test('computes visit counts and times', () => {
      const visits = [
        { domain: 'x.com', startedAt: '2026-02-10T10:25:00Z', endedAt: '2026-02-10T10:27:00Z' },
        { domain: 'x.com', startedAt: '2026-02-10T10:28:00Z', endedAt: '2026-02-10T10:29:00Z' },
        { domain: 'gmail.com', startedAt: '2026-02-10T10:27:00Z', endedAt: '2026-02-10T10:28:00Z' },
      ];
      const stats = DashboardUtils.computeDomainStats(visits);
      expect(stats['x.com'].visits).toBe(2);
      expect(stats['x.com'].totalTime).toBe(180);
      expect(stats['gmail.com'].visits).toBe(1);
    });
  });

  describe('getTimeRange', () => {
    test('returns min/max hours from sessions', () => {
      const sessions = [
        { startedAt: '2026-02-10T09:30:00Z', endedAt: '2026-02-10T09:55:00Z' },
        { startedAt: '2026-02-10T14:00:00Z', endedAt: '2026-02-10T14:25:00Z' },
      ];
      const range = DashboardUtils.getTimeRange(sessions);
      expect(range.minHour).toBe(9);
      expect(range.maxHour).toBeLessThanOrEqual(16);
    });

    test('returns defaults for empty sessions', () => {
      const range = DashboardUtils.getTimeRange([]);
      expect(range.minHour).toBe(9);
      expect(range.maxHour).toBe(17);
    });
  });

  describe('getWeekDays', () => {
    test('returns 7 days starting from given date', () => {
      const monday = new Date(2026, 1, 9);
      const days = DashboardUtils.getWeekDays(monday);
      expect(days).toHaveLength(7);
      expect(days[0].getDate()).toBe(9);
      expect(days[6].getDate()).toBe(15);
    });
  });

  describe('getTaskWorkingTime', () => {
    test('sums time entries for a task', () => {
      const entries = [
        { taskId: 't1', startedAt: '2026-02-10T10:00:00Z', endedAt: '2026-02-10T10:25:00Z' },
        { taskId: 't1', startedAt: '2026-02-10T11:00:00Z', endedAt: '2026-02-10T11:10:00Z' },
        { taskId: 't2', startedAt: '2026-02-10T12:00:00Z', endedAt: '2026-02-10T12:15:00Z' },
      ];
      expect(DashboardUtils.getTaskWorkingTime('t1', entries)).toBe(2100);
    });
  });

  describe('getCompletedTasksByTag', () => {
    test('groups completed tasks with working time', () => {
      const tasks = [
        { id: 't1', tag: 'work', column: 'done', title: 'Task 1', completedAt: '2026-02-10' },
        { id: 't2', tag: 'work', column: 'cleared', title: 'Task 2', completedAt: '2026-02-09' },
        { id: 't3', tag: 'learn', column: 'todo', title: 'Task 3', completedAt: null },
      ];
      const entries = [
        { taskId: 't1', startedAt: '2026-02-10T10:00:00Z', endedAt: '2026-02-10T10:25:00Z' },
      ];
      const result = DashboardUtils.getCompletedTasksByTag(tasks, entries);
      expect(result.work).toHaveLength(2);
      expect(result.work[0].workingTime).toBe(1500);
      expect(result.learn).toBeUndefined();
    });
  });
});
