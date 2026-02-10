const Storage = require('../shared/storage');

describe('Storage', () => {
  test('get returns null for missing key', async () => {
    const result = await Storage.get('nonexistent');
    expect(result).toBeNull();
  });

  test('set and get round-trip', async () => {
    await Storage.set('testKey', { foo: 'bar' });
    const result = await Storage.get('testKey');
    expect(result).toEqual({ foo: 'bar' });
  });

  test('getTasks returns empty array by default', async () => {
    const tasks = await Storage.getTasks();
    expect(tasks).toEqual([]);
  });

  test('saveTasks and getTasks round-trip', async () => {
    const tasks = [
      { id: '1', title: 'Test', column: 'todo', order: 0 },
    ];
    await Storage.saveTasks(tasks);
    const result = await Storage.getTasks();
    expect(result).toEqual(tasks);
  });

  test('getSessions returns empty array by default', async () => {
    const sessions = await Storage.getSessions();
    expect(sessions).toEqual([]);
  });

  test('getSettings returns defaults', async () => {
    const settings = await Storage.getSettings();
    expect(settings.blockedDomains).toContain('x.com');
    expect(settings.tags).toEqual({});
  });

  test('saveSettings merges with defaults', async () => {
    await Storage.saveSettings({ blockedDomains: ['test.com'], tags: {} });
    const settings = await Storage.getSettings();
    expect(settings.blockedDomains).toEqual(['test.com']);
  });

  test('getTimerState returns idle defaults', async () => {
    const state = await Storage.getTimerState();
    expect(state.status).toBe('idle');
    expect(state.type).toBeNull();
    expect(state.cyclePosition).toBe(1);
  });

  test('saveTimerState and getTimerState round-trip', async () => {
    const state = {
      status: 'running',
      type: 'focus',
      startedAt: '2026-01-01T00:00:00Z',
      duration: 1500,
      cyclePosition: 2,
      sessionId: 'sess-1',
    };
    await Storage.saveTimerState(state);
    const result = await Storage.getTimerState();
    expect(result).toEqual(state);
  });

  test('getTaskTimeEntries returns empty array by default', async () => {
    const entries = await Storage.getTaskTimeEntries();
    expect(entries).toEqual([]);
  });

  test('getDomainVisits returns empty array by default', async () => {
    const visits = await Storage.getDomainVisits();
    expect(visits).toEqual([]);
  });
});
