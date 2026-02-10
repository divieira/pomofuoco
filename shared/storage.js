const Storage = {
  async get(key) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  },

  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },

  async getAll(keys) {
    return chrome.storage.local.get(keys);
  },

  async getTasks() {
    return (await this.get('tasks')) || [];
  },

  async saveTasks(tasks) {
    await this.set('tasks', tasks);
  },

  async getSessions() {
    return (await this.get('sessions')) || [];
  },

  async saveSessions(sessions) {
    await this.set('sessions', sessions);
  },

  async getTaskTimeEntries() {
    return (await this.get('taskTimeEntries')) || [];
  },

  async saveTaskTimeEntries(entries) {
    await this.set('taskTimeEntries', entries);
  },

  async getDomainVisits() {
    return (await this.get('domainVisits')) || [];
  },

  async saveDomainVisits(visits) {
    await this.set('domainVisits', visits);
  },

  async getSettings() {
    const defaults = {
      blockedDomains: ['x.com', 'web.whatsapp.com', 'mail.google.com'],
      tags: {},
    };
    const settings = await this.get('settings');
    return settings ? { ...defaults, ...settings } : defaults;
  },

  async saveSettings(settings) {
    await this.set('settings', settings);
  },

  async getTimerState() {
    const defaults = {
      status: 'idle',
      type: null,
      startedAt: null,
      duration: null,
      cyclePosition: 1,
      sessionId: null,
    };
    const state = await this.get('timerState');
    return state ? { ...defaults, ...state } : defaults;
  },

  async saveTimerState(state) {
    await this.set('timerState', state);
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
