const CONSTANTS = {
  TIMER: {
    FOCUS_DURATION: 25 * 60,
    SHORT_BREAK_DURATION: 5 * 60,
    LONG_BREAK_DURATION: 15 * 60,
    LONG_BREAK_AFTER: 4,
  },
  SESSION_TYPES: {
    FOCUS: 'focus',
    SHORT_BREAK: 'shortBreak',
    LONG_BREAK: 'longBreak',
  },
  SESSION_STATUS: {
    RUNNING: 'running',
    COMPLETED: 'completed',
  },
  TASK_COLUMNS: {
    TODO: 'todo',
    DOING: 'doing',
    DONE: 'done',
    CLEARED: 'cleared',
  },
  STORAGE_KEYS: {
    TASKS: 'tasks',
    SESSIONS: 'sessions',
    TASK_TIME_ENTRIES: 'taskTimeEntries',
    DOMAIN_VISITS: 'domainVisits',
    SETTINGS: 'settings',
    TIMER_STATE: 'timerState',
  },
  DEFAULT_BLOCKED_DOMAINS: [
    'x.com',
    'web.whatsapp.com',
    'mail.google.com',
  ],
  IDLE_DETECTION_INTERVAL: 60,
  ALARM_NAME: 'pomofuoco-timer',
  PASTEL_COLORS: [
    '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
    '#E8BAFF', '#FFB3E6', '#B3FFE6', '#FFE6B3', '#B3D9FF',
    '#D9B3FF', '#B3FFB3', '#FFB3B3', '#B3FFFF', '#FFD9B3',
    '#D9FFB3',
  ],
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}
