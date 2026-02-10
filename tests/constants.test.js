const CONSTANTS = require('../shared/constants');

describe('Constants', () => {
  test('timer durations are correct', () => {
    expect(CONSTANTS.TIMER.FOCUS_DURATION).toBe(25 * 60);
    expect(CONSTANTS.TIMER.SHORT_BREAK_DURATION).toBe(5 * 60);
    expect(CONSTANTS.TIMER.LONG_BREAK_DURATION).toBe(15 * 60);
    expect(CONSTANTS.TIMER.LONG_BREAK_AFTER).toBe(4);
  });

  test('session types are defined', () => {
    expect(CONSTANTS.SESSION_TYPES.FOCUS).toBe('focus');
    expect(CONSTANTS.SESSION_TYPES.SHORT_BREAK).toBe('shortBreak');
    expect(CONSTANTS.SESSION_TYPES.LONG_BREAK).toBe('longBreak');
  });

  test('task columns include cleared', () => {
    expect(CONSTANTS.TASK_COLUMNS.TODO).toBe('todo');
    expect(CONSTANTS.TASK_COLUMNS.DOING).toBe('doing');
    expect(CONSTANTS.TASK_COLUMNS.DONE).toBe('done');
    expect(CONSTANTS.TASK_COLUMNS.CLEARED).toBe('cleared');
  });

  test('default blocked domains are set', () => {
    expect(CONSTANTS.DEFAULT_BLOCKED_DOMAINS).toContain('x.com');
    expect(CONSTANTS.DEFAULT_BLOCKED_DOMAINS).toContain('web.whatsapp.com');
    expect(CONSTANTS.DEFAULT_BLOCKED_DOMAINS).toContain('mail.google.com');
  });

  test('pastel colors array is non-empty', () => {
    expect(CONSTANTS.PASTEL_COLORS.length).toBeGreaterThan(0);
    CONSTANTS.PASTEL_COLORS.forEach((c) => {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});
