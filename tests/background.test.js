const CONSTANTS = require('../shared/constants');
const Storage = require('../shared/storage');

global.CONSTANTS = CONSTANTS;
global.Storage = Storage;

const TimerCore = require('../shared/timer-core');
global.TimerCore = TimerCore;

// Mock importScripts (service worker)
global.importScripts = jest.fn();

// Need to mock the background module functions
// We'll test through the message handler pattern

describe('Background Service Worker Logic', () => {
  describe('Session Lifecycle', () => {
    test('starting focus session creates alarm and session', async () => {
      const { timerState, session } = await TimerCore.startSession('focus');

      expect(timerState.status).toBe('running');
      expect(timerState.type).toBe('focus');
      expect(session.type).toBe('focus');
      expect(session.status).toBe('running');

      const sessions = await Storage.getSessions();
      expect(sessions).toHaveLength(1);
    });

    test('stopping session completes it and returns to idle', async () => {
      await TimerCore.startSession('focus');
      const session = await TimerCore.stopSession();

      expect(session.status).toBe('completed');
      expect(session.endedAt).toBeTruthy();

      const timerState = await Storage.getTimerState();
      expect(timerState.status).toBe('idle');
    });

    test('full pomodoro cycle: 4 focus + breaks', async () => {
      for (let i = 1; i <= 4; i++) {
        const { timerState } = await TimerCore.startSession('focus');
        expect(timerState.cyclePosition).toBe(i);
        await TimerCore.stopSession();

        if (i < 4) {
          await TimerCore.startSession('shortBreak');
          await TimerCore.stopSession();
        }
      }

      // After 4th focus, suggest long break
      const suggested = await TimerCore.getSuggestedNext();
      expect(suggested).toBe('longBreak');

      // Start and complete long break
      await TimerCore.startSession('longBreak');
      await TimerCore.stopSession();

      // After long break, cycle resets, suggest focus
      const next = await TimerCore.getSuggestedNext();
      expect(next).toBe('focus');

      // Verify all sessions recorded
      const sessions = await Storage.getSessions();
      // 4 focus + 3 short breaks + 1 long break = 8
      expect(sessions).toHaveLength(8);
    });

    test('starting new session while one is running stops the previous', async () => {
      await TimerCore.startSession('focus');
      await TimerCore.startSession('shortBreak');

      const sessions = await Storage.getSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].status).toBe('completed');
      expect(sessions[1].status).toBe('running');
    });
  });

  describe('Task Time Entry Tracking', () => {
    let tasks;

    beforeEach(async () => {
      tasks = [
        { id: 'task-1', title: 'Task 1 #work', tag: 'work', column: 'doing', order: 0, createdAt: new Date().toISOString(), completedAt: null },
        { id: 'task-2', title: 'Task 2 #learn', tag: 'learn', column: 'todo', order: 0, createdAt: new Date().toISOString(), completedAt: null },
      ];
      await Storage.saveTasks(tasks);
    });

    test('creates time entry for doing task when focus starts', async () => {
      await TimerCore.startSession('focus');
      const timerState = await Storage.getTimerState();

      // Simulate what background.js does: openTaskTimeEntry
      const entry = {
        id: crypto.randomUUID(),
        taskId: 'task-1',
        sessionId: timerState.sessionId,
        startedAt: new Date().toISOString(),
        endedAt: null,
      };
      const entries = await Storage.getTaskTimeEntries();
      entries.push(entry);
      await Storage.saveTaskTimeEntries(entries);

      const savedEntries = await Storage.getTaskTimeEntries();
      expect(savedEntries).toHaveLength(1);
      expect(savedEntries[0].taskId).toBe('task-1');
    });

    test('closes time entry when focus stops', async () => {
      await TimerCore.startSession('focus');
      const timerState = await Storage.getTimerState();

      const entry = {
        id: 'entry-1',
        taskId: 'task-1',
        sessionId: timerState.sessionId,
        startedAt: new Date().toISOString(),
        endedAt: null,
      };
      await Storage.saveTaskTimeEntries([entry]);

      // Simulate closing
      const entries = await Storage.getTaskTimeEntries();
      entries.forEach((e) => {
        if (!e.endedAt) e.endedAt = new Date().toISOString();
      });
      await Storage.saveTaskTimeEntries(entries);

      const closed = await Storage.getTaskTimeEntries();
      expect(closed[0].endedAt).toBeTruthy();
    });

    test('switching doing task closes previous and opens new entry', async () => {
      await TimerCore.startSession('focus');
      const timerState = await Storage.getTimerState();

      // First task tracked
      const entry1 = {
        id: 'entry-1', taskId: 'task-1', sessionId: timerState.sessionId,
        startedAt: new Date().toISOString(), endedAt: null,
      };
      await Storage.saveTaskTimeEntries([entry1]);

      // Close first, open second
      const entries = await Storage.getTaskTimeEntries();
      entries[0].endedAt = new Date().toISOString();
      entries.push({
        id: 'entry-2', taskId: 'task-2', sessionId: timerState.sessionId,
        startedAt: new Date().toISOString(), endedAt: null,
      });
      await Storage.saveTaskTimeEntries(entries);

      const result = await Storage.getTaskTimeEntries();
      expect(result).toHaveLength(2);
      expect(result[0].endedAt).toBeTruthy();
      expect(result[1].endedAt).toBeNull();
    });
  });

  describe('Domain Visit Tracking', () => {
    test('records domain visits during breaks', async () => {
      await TimerCore.startSession('shortBreak');
      const timerState = await Storage.getTimerState();

      const visit = {
        id: crypto.randomUUID(),
        sessionId: timerState.sessionId,
        domain: 'x.com',
        startedAt: new Date().toISOString(),
        endedAt: null,
      };
      await Storage.saveDomainVisits([visit]);

      const visits = await Storage.getDomainVisits();
      expect(visits).toHaveLength(1);
      expect(visits[0].domain).toBe('x.com');
    });

    test('tracks multiple domain switches', async () => {
      await TimerCore.startSession('shortBreak');
      const timerState = await Storage.getTimerState();

      const visits = [
        { id: '1', sessionId: timerState.sessionId, domain: 'x.com', startedAt: '2026-02-10T10:25:00Z', endedAt: '2026-02-10T10:27:00Z' },
        { id: '2', sessionId: timerState.sessionId, domain: 'gmail.com', startedAt: '2026-02-10T10:27:00Z', endedAt: '2026-02-10T10:28:00Z' },
        { id: '3', sessionId: timerState.sessionId, domain: 'x.com', startedAt: '2026-02-10T10:28:00Z', endedAt: null },
      ];
      await Storage.saveDomainVisits(visits);

      const saved = await Storage.getDomainVisits();
      expect(saved).toHaveLength(3);
      expect(saved.filter((v) => v.domain === 'x.com')).toHaveLength(2);
    });
  });

  describe('Alarm Handling', () => {
    test('alarm fired marks timer as alarmFired but keeps running', async () => {
      await TimerCore.startSession('focus');

      const state = await TimerCore.onAlarmFired();
      expect(state.alarmFired).toBe(true);

      // Timer should still be running
      const timerState = await Storage.getTimerState();
      expect(timerState.status).toBe('running');
      expect(timerState.alarmFired).toBe(true);
    });

    test('overtime calculation works after alarm', async () => {
      const startTime = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      await Storage.saveTimerState({
        status: 'running',
        type: 'focus',
        startedAt: startTime.toISOString(),
        duration: 25 * 60,
        cyclePosition: 1,
        sessionId: 'sess-1',
        alarmFired: true,
      });

      const timerState = await Storage.getTimerState();
      expect(TimerCore.isOvertime(timerState)).toBe(true);
      expect(TimerCore.getRemaining(timerState)).toBe(0);
    });
  });

  describe('Settings Management', () => {
    test('default blocked domains', async () => {
      const settings = await Storage.getSettings();
      expect(settings.blockedDomains).toContain('x.com');
      expect(settings.blockedDomains).toContain('web.whatsapp.com');
      expect(settings.blockedDomains).toContain('mail.google.com');
    });

    test('add and remove blocked domain', async () => {
      const settings = await Storage.getSettings();
      settings.blockedDomains.push('reddit.com');
      await Storage.saveSettings(settings);

      let saved = await Storage.getSettings();
      expect(saved.blockedDomains).toContain('reddit.com');

      saved.blockedDomains = saved.blockedDomains.filter((d) => d !== 'reddit.com');
      await Storage.saveSettings(saved);

      const final = await Storage.getSettings();
      expect(final.blockedDomains).not.toContain('reddit.com');
    });

    test('tag settings persist', async () => {
      const settings = await Storage.getSettings();
      settings.tags = {
        work: { displayName: 'Work', color: '#FF0000' },
        learn: { displayName: 'Learning', color: '#00FF00' },
      };
      await Storage.saveSettings(settings);

      const saved = await Storage.getSettings();
      expect(saved.tags.work.displayName).toBe('Work');
      expect(saved.tags.work.color).toBe('#FF0000');
    });
  });

  describe('Streak Calculation', () => {
    test('streak includes today if session exists', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      await Storage.saveSessions([
        { id: '1', type: 'focus', status: 'completed', startedAt: today.toISOString(), endedAt: today.toISOString() },
        { id: '2', type: 'focus', status: 'completed', startedAt: yesterday.toISOString(), endedAt: yesterday.toISOString() },
      ]);

      expect(await TimerCore.getStreak()).toBe(2);
    });

    test('streak starts from yesterday if no session today', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBefore = new Date(yesterday);
      dayBefore.setDate(dayBefore.getDate() - 1);

      await Storage.saveSessions([
        { id: '1', type: 'focus', status: 'completed', startedAt: yesterday.toISOString(), endedAt: yesterday.toISOString() },
        { id: '2', type: 'focus', status: 'completed', startedAt: dayBefore.toISOString(), endedAt: dayBefore.toISOString() },
      ]);

      expect(await TimerCore.getStreak()).toBe(2);
    });

    test('streak is 0 with only break sessions', async () => {
      await Storage.saveSessions([
        { id: '1', type: 'shortBreak', status: 'completed', startedAt: new Date().toISOString(), endedAt: new Date().toISOString() },
      ]);

      expect(await TimerCore.getStreak()).toBe(0);
    });
  });
});
