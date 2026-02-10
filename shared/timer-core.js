// TimerCore — Pomodoro timer state machine
// Works in both service worker (background.js) and test environments

const TimerCore = {
  // Get duration in seconds for a session type
  getDuration(type) {
    switch (type) {
      case 'focus': return CONSTANTS.TIMER.FOCUS_DURATION;
      case 'shortBreak': return CONSTANTS.TIMER.SHORT_BREAK_DURATION;
      case 'longBreak': return CONSTANTS.TIMER.LONG_BREAK_DURATION;
      default: return 0;
    }
  },

  // Calculate remaining seconds from timer state
  getRemaining(timerState) {
    if (timerState.status !== 'running') return 0;
    const elapsed = (Date.now() - new Date(timerState.startedAt).getTime()) / 1000;
    return Math.max(0, timerState.duration - elapsed);
  },

  // Check if timer has exceeded its duration (still running but alarm fired)
  isOvertime(timerState) {
    if (timerState.status !== 'running') return false;
    return this.getRemaining(timerState) === 0;
  },

  // Start a new session. Returns { timerState, session }
  async startSession(type) {
    const timerState = await Storage.getTimerState();

    // If already running, stop current first
    if (timerState.status === 'running') {
      await this.stopSession();
    }

    const now = new Date().toISOString();
    const currentState = await Storage.getTimerState();
    let cyclePosition = currentState.cyclePosition || 1;

    // Only advance cycle for focus sessions
    if (type === 'focus') {
      // cyclePosition is already set from previous stop
    }

    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      type: type,
      startedAt: now,
      endedAt: null,
      status: 'running',
      cyclePosition: type === 'focus' ? cyclePosition : currentState.cyclePosition,
    };

    const sessions = await Storage.getSessions();
    sessions.push(session);
    await Storage.saveSessions(sessions);

    const duration = this.getDuration(type);
    const newTimerState = {
      status: 'running',
      type: type,
      startedAt: now,
      duration: duration,
      cyclePosition: cyclePosition,
      sessionId: sessionId,
      alarmFired: false,
    };
    await Storage.saveTimerState(newTimerState);

    return { timerState: newTimerState, session };
  },

  // Stop the current session. Returns the completed session or null.
  async stopSession() {
    const timerState = await Storage.getTimerState();
    if (timerState.status !== 'running') return null;

    const now = new Date().toISOString();

    // Update session
    const sessions = await Storage.getSessions();
    const session = sessions.find((s) => s.id === timerState.sessionId);
    if (session) {
      session.endedAt = now;
      session.status = 'completed';
      await Storage.saveSessions(sessions);
    }

    // Advance cycle position after completing a focus session
    let nextCyclePosition = timerState.cyclePosition;
    if (timerState.type === 'focus') {
      nextCyclePosition = (timerState.cyclePosition % CONSTANTS.TIMER.LONG_BREAK_AFTER) + 1;
    }

    // Reset timer state
    const newTimerState = {
      status: 'idle',
      type: null,
      startedAt: null,
      duration: null,
      cyclePosition: nextCyclePosition,
      sessionId: null,
      alarmFired: false,
    };
    await Storage.saveTimerState(newTimerState);

    return session || null;
  },

  // Mark alarm as fired (timer continues running, just a notification trigger)
  async onAlarmFired() {
    const timerState = await Storage.getTimerState();
    if (timerState.status !== 'running') return null;

    timerState.alarmFired = true;
    await Storage.saveTimerState(timerState);
    return timerState;
  },

  // Get suggested next session type based on cycle
  async getSuggestedNext() {
    const timerState = await Storage.getTimerState();
    const cyclePos = timerState.cyclePosition || 1;

    // If we just finished the 4th focus, suggest long break
    if (cyclePos === 1 && timerState.status === 'idle') {
      // cyclePos resets to 1 after 4th focus, so if idle and pos is 1
      // check if last session was focus #4
      const sessions = await Storage.getSessions();
      const lastSession = sessions[sessions.length - 1];
      if (lastSession && lastSession.type === 'focus' && lastSession.cyclePosition === CONSTANTS.TIMER.LONG_BREAK_AFTER) {
        return 'longBreak';
      }
    }

    if (timerState.status === 'idle') {
      const sessions = await Storage.getSessions();
      const lastSession = sessions[sessions.length - 1];
      if (!lastSession || lastSession.type !== 'focus') {
        return 'focus';
      }
      return 'shortBreak';
    }

    return 'focus';
  },

  // Get current streak (consecutive days with at least 1 completed focus session)
  async getStreak() {
    const sessions = await Storage.getSessions();
    const focusSessions = sessions.filter(
      (s) => s.type === 'focus' && s.status === 'completed'
    );

    if (focusSessions.length === 0) return 0;

    // Get unique days with focus sessions
    const days = new Set();
    focusSessions.forEach((s) => {
      const date = new Date(s.startedAt);
      days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    });

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    // Check if today or yesterday has a session (streak can include today)
    let streak = 0;
    let checkDate = new Date(today);

    // If today doesn't have a session, start from yesterday
    if (!days.has(todayKey)) {
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (!days.has(yesterdayKey)) return 0;
    }

    // Count consecutive days backwards
    for (let i = 0; i < 365; i++) {
      const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (days.has(key)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  },

  // Format seconds as mm:ss
  formatTime(seconds) {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.floor(Math.abs(seconds) % 60);
    const sign = seconds < 0 ? '+' : '';
    return `${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  // Format seconds as human readable (e.g., "1h 25m")
  formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${mins}m`;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimerCore;
}
