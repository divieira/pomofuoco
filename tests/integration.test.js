const CONSTANTS = require('../shared/constants');
const Storage = require('../shared/storage');
const DashboardUtils = require('../shared/dashboard-utils');

global.CONSTANTS = CONSTANTS;
global.Storage = Storage;

const TimerCore = require('../shared/timer-core');
global.TimerCore = TimerCore;

const TaskUtils = require('../shared/task-utils');

describe('Integration Tests', () => {
  describe('Full workflow: tasks + sessions + tracking', () => {
    test('complete pomodoro workflow with task tracking', async () => {
      // 1. Create tasks
      const task1 = TaskUtils.createTask('Write report #work', []);
      const task2 = TaskUtils.createTask('Review PR #work', []);
      const task3 = TaskUtils.createTask('Read article #learn', []);
      const tasks = [task1, task2, task3];
      await Storage.saveTasks(tasks);

      // 2. Move task1 to doing
      TaskUtils.moveTask(tasks, task1.id, 'doing');
      await Storage.saveTasks(tasks);
      expect(tasks.find((t) => t.id === task1.id).column).toBe('doing');

      // 3. Start focus
      const { timerState } = await TimerCore.startSession('focus');
      expect(timerState.type).toBe('focus');

      // 4. Create time entry for doing task
      const entry1 = {
        id: 'entry-1', taskId: task1.id, sessionId: timerState.sessionId,
        startedAt: '2026-02-10T09:00:00', endedAt: '2026-02-10T09:15:00',
      };
      await Storage.saveTaskTimeEntries([entry1]);

      // 5. Switch task — move task1 to done, task2 to doing
      TaskUtils.moveTask(tasks, task1.id, 'done');
      TaskUtils.moveTask(tasks, task2.id, 'doing');
      await Storage.saveTasks(tasks);

      const entry2 = {
        id: 'entry-2', taskId: task2.id, sessionId: timerState.sessionId,
        startedAt: '2026-02-10T09:15:00', endedAt: '2026-02-10T09:25:00',
      };
      const entries = await Storage.getTaskTimeEntries();
      entries.push(entry2);
      await Storage.saveTaskTimeEntries(entries);

      // 6. Stop focus
      const session = await TimerCore.stopSession();
      expect(session.status).toBe('completed');

      // 7. Verify data
      const allEntries = await Storage.getTaskTimeEntries();
      expect(allEntries).toHaveLength(2);

      // task1 working time: 15 min = 900s
      const t1Time = DashboardUtils.getTaskWorkingTime(task1.id, allEntries);
      expect(t1Time).toBe(900);

      // task2 working time: 10 min = 600s
      const t2Time = DashboardUtils.getTaskWorkingTime(task2.id, allEntries);
      expect(t2Time).toBe(600);
    });

    test('break session with domain tracking', async () => {
      // Start break
      const { timerState } = await TimerCore.startSession('shortBreak');

      // Track domain visits
      const visits = [
        { id: '1', sessionId: timerState.sessionId, domain: 'x.com', startedAt: '2026-02-10T09:25:00', endedAt: '2026-02-10T09:27:00' },
        { id: '2', sessionId: timerState.sessionId, domain: 'mail.google.com', startedAt: '2026-02-10T09:27:00', endedAt: '2026-02-10T09:28:00' },
        { id: '3', sessionId: timerState.sessionId, domain: 'x.com', startedAt: '2026-02-10T09:28:00', endedAt: '2026-02-10T09:30:00' },
      ];
      await Storage.saveDomainVisits(visits);

      // Stop break
      await TimerCore.stopSession();

      // Verify domain stats
      const allVisits = await Storage.getDomainVisits();
      const stats = DashboardUtils.computeDomainStats(allVisits);

      expect(stats['x.com'].visits).toBe(2);
      expect(stats['x.com'].totalTime).toBe(240); // 4 min
      expect(stats['mail.google.com'].visits).toBe(1);
      expect(stats['mail.google.com'].totalTime).toBe(60); // 1 min
    });
  });

  describe('Dashboard data aggregation', () => {
    beforeEach(async () => {
      // Set up a week's worth of data
      const sessions = [
        { id: 's1', type: 'focus', status: 'completed', startedAt: '2026-02-09T09:00:00', endedAt: '2026-02-09T09:25:00', cyclePosition: 1 },
        { id: 's2', type: 'shortBreak', status: 'completed', startedAt: '2026-02-09T09:30:00', endedAt: '2026-02-09T09:35:00', cyclePosition: 1 },
        { id: 's3', type: 'focus', status: 'completed', startedAt: '2026-02-09T09:40:00', endedAt: '2026-02-09T10:05:00', cyclePosition: 2 },
        { id: 's4', type: 'focus', status: 'completed', startedAt: '2026-02-10T10:00:00', endedAt: '2026-02-10T10:25:00', cyclePosition: 1 },
        { id: 's5', type: 'shortBreak', status: 'completed', startedAt: '2026-02-10T10:30:00', endedAt: '2026-02-10T10:35:00', cyclePosition: 1 },
      ];
      await Storage.saveSessions(sessions);

      const tasks = [
        { id: 't1', title: 'Task 1 #work', tag: 'work', column: 'done', order: 0, createdAt: '2026-02-09T08:00:00', completedAt: '2026-02-09T10:00:00' },
        { id: 't2', title: 'Task 2 #learn', tag: 'learn', column: 'done', order: 0, createdAt: '2026-02-10T09:00:00', completedAt: '2026-02-10T10:30:00' },
      ];
      await Storage.saveTasks(tasks);

      const entries = [
        { id: 'e1', taskId: 't1', sessionId: 's1', startedAt: '2026-02-09T09:00:00', endedAt: '2026-02-09T09:25:00' },
        { id: 'e2', taskId: 't1', sessionId: 's3', startedAt: '2026-02-09T09:40:00', endedAt: '2026-02-09T10:05:00' },
        { id: 'e3', taskId: 't2', sessionId: 's4', startedAt: '2026-02-10T10:00:00', endedAt: '2026-02-10T10:25:00' },
      ];
      await Storage.saveTaskTimeEntries(entries);

      const visits = [
        { id: 'v1', sessionId: 's2', domain: 'x.com', startedAt: '2026-02-09T09:30:00', endedAt: '2026-02-09T09:33:00' },
        { id: 'v2', sessionId: 's2', domain: 'gmail.com', startedAt: '2026-02-09T09:33:00', endedAt: '2026-02-09T09:35:00' },
        { id: 'v3', sessionId: 's5', domain: 'x.com', startedAt: '2026-02-10T10:30:00', endedAt: '2026-02-10T10:33:00' },
      ];
      await Storage.saveDomainVisits(visits);
    });

    test('weekly session stats aggregate correctly', async () => {
      const sessions = await Storage.getSessions();
      const weekStart = new Date('2026-02-09T00:00:00');
      const weekEnd = DashboardUtils.getWeekEnd(weekStart);
      const weekSessions = DashboardUtils.filterByDateRange(sessions, 'startedAt', weekStart, weekEnd);
      const stats = DashboardUtils.computeSessionStats(weekSessions);

      expect(stats.focus.count).toBe(3);
      expect(stats.focus.totalTime).toBe(4500); // 75 min
      expect(stats.shortBreak.count).toBe(2);
      expect(stats.shortBreak.totalTime).toBe(600); // 10 min
    });

    test('weekly tag stats aggregate correctly', async () => {
      const entries = await Storage.getTaskTimeEntries();
      const tasks = await Storage.getTasks();
      const weekStart = new Date('2026-02-09T00:00:00');
      const weekEnd = DashboardUtils.getWeekEnd(weekStart);
      const weekEntries = DashboardUtils.filterByDateRange(entries, 'startedAt', weekStart, weekEnd);
      const stats = DashboardUtils.computeTagStats(weekEntries, tasks);

      expect(stats.work.totalTime).toBe(3000); // 50 min
      expect(stats.learn.totalTime).toBe(1500); // 25 min
    });

    test('weekly domain stats aggregate correctly', async () => {
      const visits = await Storage.getDomainVisits();
      const weekStart = new Date('2026-02-09T00:00:00');
      const weekEnd = DashboardUtils.getWeekEnd(weekStart);
      const weekVisits = DashboardUtils.filterByDateRange(visits, 'startedAt', weekStart, weekEnd);
      const stats = DashboardUtils.computeDomainStats(weekVisits);

      expect(stats['x.com'].visits).toBe(2);
      expect(stats['x.com'].totalTime).toBe(360); // 6 min
      expect(stats['gmail.com'].visits).toBe(1);
    });

    test('monthly completed tasks grouped by tag', async () => {
      const tasks = await Storage.getTasks();
      const entries = await Storage.getTaskTimeEntries();
      const monthStart = new Date('2026-02-01T00:00:00');
      const monthEnd = DashboardUtils.getMonthEnd(monthStart);

      const completedInMonth = tasks.filter((t) => {
        if (!t.completedAt) return false;
        const cd = new Date(t.completedAt);
        return cd >= monthStart && cd <= monthEnd;
      });

      const byTag = DashboardUtils.getCompletedTasksByTag(completedInMonth, entries);

      expect(byTag.work).toHaveLength(1);
      expect(byTag.work[0].workingTime).toBe(3000); // 50 min
      expect(byTag.learn).toHaveLength(1);
      expect(byTag.learn[0].workingTime).toBe(1500); // 25 min
    });

    test('time range calculation for weekly view', async () => {
      const sessions = await Storage.getSessions();
      const range = DashboardUtils.getTimeRange(sessions);

      expect(range.minHour).toBe(9);
      expect(range.maxHour).toBeGreaterThanOrEqual(11);
    });
  });

  describe('Task state transitions', () => {
    test('todo -> doing -> done -> cleared lifecycle', () => {
      const tasks = [TaskUtils.createTask('Test #work', [])];
      expect(tasks[0].column).toBe('todo');

      TaskUtils.moveTask(tasks, tasks[0].id, 'doing');
      expect(tasks[0].column).toBe('doing');

      TaskUtils.moveTask(tasks, tasks[0].id, 'done');
      expect(tasks[0].column).toBe('done');
      expect(tasks[0].completedAt).toBeTruthy();

      TaskUtils.clearTask(tasks, tasks[0].id);
      expect(tasks[0].column).toBe('cleared');

      // Cleared tasks are hidden
      const visible = TaskUtils.getVisibleTasks(tasks);
      expect(visible).toHaveLength(0);
    });

    test('todo -> clear directly', () => {
      const tasks = [TaskUtils.createTask('Test', [])];
      TaskUtils.clearTask(tasks, tasks[0].id);
      expect(tasks[0].column).toBe('cleared');
    });

    test('doing constraint: only one task in doing', () => {
      const t1 = TaskUtils.createTask('Task 1', []);
      const t2 = TaskUtils.createTask('Task 2', []);
      const tasks = [t1, t2];

      TaskUtils.moveTask(tasks, t1.id, 'doing');
      expect(tasks.find((t) => t.id === t1.id).column).toBe('doing');

      const result = TaskUtils.moveTask(tasks, t2.id, 'doing');
      expect(tasks.find((t) => t.id === t2.id).column).toBe('doing');
      expect(tasks.find((t) => t.id === t1.id).column).toBe('todo');
      expect(result.displaced.id).toBe(t1.id);
    });

    test('clear all done moves all to cleared', () => {
      const tasks = [
        TaskUtils.createTask('Task 1', []),
        TaskUtils.createTask('Task 2', []),
        TaskUtils.createTask('Task 3', []),
      ];
      tasks[0].column = 'done';
      tasks[1].column = 'done';

      TaskUtils.clearAllDone(tasks);
      expect(tasks[0].column).toBe('cleared');
      expect(tasks[1].column).toBe('cleared');
      expect(tasks[2].column).toBe('todo'); // unaffected
    });
  });

  describe('Tag system', () => {
    test('tags extracted from various positions in title', () => {
      expect(TaskUtils.extractTag('#work Write report')).toBe('work');
      expect(TaskUtils.extractTag('Write #work report')).toBe('work');
      expect(TaskUtils.extractTag('Write report #work')).toBe('work');
    });

    test('tag colors auto-assigned and unique', () => {
      const settings = { tags: {} };
      TaskUtils.assignTagColor('work', settings);
      TaskUtils.assignTagColor('learn', settings);
      TaskUtils.assignTagColor('personal', settings);

      const colors = Object.values(settings.tags).map((t) => t.color);
      const unique = new Set(colors);
      expect(unique.size).toBe(3);
    });

    test('tag renaming persists', async () => {
      const settings = {
        blockedDomains: [],
        tags: { work: { displayName: 'Work Projects', color: '#FF0000' } },
      };
      await Storage.saveSettings(settings);

      const saved = await Storage.getSettings();
      expect(saved.tags.work.displayName).toBe('Work Projects');
    });
  });
});
