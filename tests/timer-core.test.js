const CONSTANTS = require('../shared/constants');
const Storage = require('../shared/storage');

// Make CONSTANTS and Storage available globally for TimerCore
global.CONSTANTS = CONSTANTS;
global.Storage = Storage;

const TimerCore = require('../shared/timer-core');

describe('TimerCore', () => {
  describe('getDuration', () => {
    test('returns 25 minutes for focus', () => {
      expect(TimerCore.getDuration('focus')).toBe(25 * 60);
    });

    test('returns 5 minutes for short break', () => {
      expect(TimerCore.getDuration('shortBreak')).toBe(5 * 60);
    });

    test('returns 15 minutes for long break', () => {
      expect(TimerCore.getDuration('longBreak')).toBe(15 * 60);
    });

    test('returns 0 for unknown type', () => {
      expect(TimerCore.getDuration('unknown')).toBe(0);
    });
  });

  describe('getRemaining', () => {
    test('returns 0 for idle state', () => {
      const state = { status: 'idle' };
      expect(TimerCore.getRemaining(state)).toBe(0);
    });

    test('returns remaining seconds for running state', () => {
      const now = Date.now();
      const state = {
        status: 'running',
        startedAt: new Date(now - 60000).toISOString(), // started 60s ago
        duration: 1500, // 25 min
      };
      const remaining = TimerCore.getRemaining(state);
      expect(remaining).toBeCloseTo(1440, 0); // ~24 min
    });

    test('returns 0 when past duration', () => {
      const state = {
        status: 'running',
        startedAt: new Date(Date.now() - 2000000).toISOString(),
        duration: 1500,
      };
      expect(TimerCore.getRemaining(state)).toBe(0);
    });
  });

  describe('isOvertime', () => {
    test('returns false for idle state', () => {
      expect(TimerCore.isOvertime({ status: 'idle' })).toBe(false);
    });

    test('returns false when time remaining', () => {
      const state = {
        status: 'running',
        startedAt: new Date().toISOString(),
        duration: 1500,
      };
      expect(TimerCore.isOvertime(state)).toBe(false);
    });

    test('returns true when past duration', () => {
      const state = {
        status: 'running',
        startedAt: new Date(Date.now() - 2000000).toISOString(),
        duration: 1500,
      };
      expect(TimerCore.isOvertime(state)).toBe(true);
    });
  });

  describe('startSession', () => {
    test('creates a focus session', async () => {
      const { timerState, session } = await TimerCore.startSession('focus');

      expect(timerState.status).toBe('running');
      expect(timerState.type).toBe('focus');
      expect(timerState.duration).toBe(1500);
      expect(timerState.cyclePosition).toBe(1);
      expect(session.type).toBe('focus');
      expect(session.status).toBe('running');
    });

    test('creates a short break session', async () => {
      const { timerState, session } = await TimerCore.startSession('shortBreak');

      expect(timerState.type).toBe('shortBreak');
      expect(timerState.duration).toBe(300);
      expect(session.type).toBe('shortBreak');
    });

    test('creates a long break session', async () => {
      const { session } = await TimerCore.startSession('longBreak');
      expect(session.type).toBe('longBreak');
    });

    test('stops previous session when starting new one', async () => {
      await TimerCore.startSession('focus');
      const sessions1 = await Storage.getSessions();
      expect(sessions1).toHaveLength(1);
      expect(sessions1[0].status).toBe('running');

      await TimerCore.startSession('shortBreak');
      const sessions2 = await Storage.getSessions();
      expect(sessions2).toHaveLength(2);
      expect(sessions2[0].status).toBe('completed');
      expect(sessions2[1].status).toBe('running');
    });

    test('persists session to storage', async () => {
      await TimerCore.startSession('focus');
      const sessions = await Storage.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].type).toBe('focus');
    });
  });

  describe('stopSession', () => {
    test('returns null when not running', async () => {
      const result = await TimerCore.stopSession();
      expect(result).toBeNull();
    });

    test('completes the running session', async () => {
      await TimerCore.startSession('focus');
      const session = await TimerCore.stopSession();

      expect(session.status).toBe('completed');
      expect(session.endedAt).toBeTruthy();
    });

    test('resets timer state to idle', async () => {
      await TimerCore.startSession('focus');
      await TimerCore.stopSession();

      const timerState = await Storage.getTimerState();
      expect(timerState.status).toBe('idle');
      expect(timerState.type).toBeNull();
    });

    test('advances cycle position after focus', async () => {
      await TimerCore.startSession('focus');
      await TimerCore.stopSession();

      const timerState = await Storage.getTimerState();
      expect(timerState.cyclePosition).toBe(2);
    });

    test('does not advance cycle after break', async () => {
      // Set cycle position to 2
      await Storage.saveTimerState({
        status: 'idle', type: null, startedAt: null,
        duration: null, cyclePosition: 2, sessionId: null,
      });

      await TimerCore.startSession('shortBreak');
      await TimerCore.stopSession();

      const timerState = await Storage.getTimerState();
      expect(timerState.cyclePosition).toBe(2);
    });

    test('cycle wraps around after 4 focus sessions', async () => {
      // Simulate 4 focus sessions
      for (let i = 0; i < 4; i++) {
        await TimerCore.startSession('focus');
        await TimerCore.stopSession();
      }

      const timerState = await Storage.getTimerState();
      expect(timerState.cyclePosition).toBe(1); // wrapped
    });
  });

  describe('onAlarmFired', () => {
    test('marks alarm as fired', async () => {
      await TimerCore.startSession('focus');
      const state = await TimerCore.onAlarmFired();

      expect(state.alarmFired).toBe(true);
    });

    test('returns null when not running', async () => {
      const result = await TimerCore.onAlarmFired();
      expect(result).toBeNull();
    });
  });

  describe('getSuggestedNext', () => {
    test('suggests focus when no sessions exist', async () => {
      const next = await TimerCore.getSuggestedNext();
      expect(next).toBe('focus');
    });

    test('suggests short break after focus', async () => {
      await TimerCore.startSession('focus');
      await TimerCore.stopSession();

      const next = await TimerCore.getSuggestedNext();
      expect(next).toBe('shortBreak');
    });

    test('suggests focus after break', async () => {
      await TimerCore.startSession('shortBreak');
      await TimerCore.stopSession();

      const next = await TimerCore.getSuggestedNext();
      expect(next).toBe('focus');
    });

    test('suggests long break after 4th focus', async () => {
      for (let i = 0; i < 4; i++) {
        await TimerCore.startSession('focus');
        await TimerCore.stopSession();
      }

      const next = await TimerCore.getSuggestedNext();
      expect(next).toBe('longBreak');
    });
  });

  describe('getStreak', () => {
    test('returns 0 with no sessions', async () => {
      expect(await TimerCore.getStreak()).toBe(0);
    });

    test('returns 1 for today only', async () => {
      const sessions = [{
        id: '1', type: 'focus', status: 'completed',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      }];
      await Storage.saveSessions(sessions);
      expect(await TimerCore.getStreak()).toBe(1);
    });

    test('returns consecutive days count', async () => {
      const today = new Date();
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        sessions.push({
          id: String(i), type: 'focus', status: 'completed',
          startedAt: date.toISOString(),
          endedAt: date.toISOString(),
        });
      }
      await Storage.saveSessions(sessions);
      expect(await TimerCore.getStreak()).toBe(5);
    });

    test('breaks on gap day', async () => {
      const today = new Date();
      const sessions = [
        {
          id: '1', type: 'focus', status: 'completed',
          startedAt: today.toISOString(),
          endedAt: today.toISOString(),
        },
        {
          id: '2', type: 'focus', status: 'completed',
          startedAt: new Date(today.getTime() - 3 * 86400000).toISOString(), // 3 days ago
          endedAt: new Date(today.getTime() - 3 * 86400000).toISOString(),
        },
      ];
      await Storage.saveSessions(sessions);
      expect(await TimerCore.getStreak()).toBe(1);
    });

    test('ignores non-focus sessions', async () => {
      const sessions = [{
        id: '1', type: 'shortBreak', status: 'completed',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      }];
      await Storage.saveSessions(sessions);
      expect(await TimerCore.getStreak()).toBe(0);
    });
  });

  describe('formatTime', () => {
    test('formats seconds as mm:ss', () => {
      expect(TimerCore.formatTime(1500)).toBe('25:00');
      expect(TimerCore.formatTime(90)).toBe('01:30');
      expect(TimerCore.formatTime(0)).toBe('00:00');
    });

    test('formats overtime with + prefix', () => {
      expect(TimerCore.formatTime(-60)).toBe('+01:00');
    });
  });

  describe('formatDuration', () => {
    test('formats short durations', () => {
      expect(TimerCore.formatDuration(30)).toBe('30s');
      expect(TimerCore.formatDuration(300)).toBe('5m');
      expect(TimerCore.formatDuration(3600)).toBe('1h');
      expect(TimerCore.formatDuration(5400)).toBe('1h 30m');
    });
  });
});
