const CONSTANTS = require('../shared/constants');
const Storage = require('../shared/storage');

global.CONSTANTS = CONSTANTS;
global.Storage = Storage;

const TimerCore = require('../shared/timer-core');
global.TimerCore = TimerCore;
global.importScripts = jest.fn();

const {
  activateBlocking,
  deactivateBlocking,
} = require('../background');

// Capture the top-level onUpdated listener that background.js registers at
// module load time — before jest.clearAllMocks() wipes mock call history.
const topLevelOnUpdatedListener = chrome.tabs.onUpdated.addListener.mock.calls[0]?.[0];

describe('Focus Mode Blocking', () => {
  beforeEach(async () => {
    resetChromeStorage();
    chrome.declarativeNetRequest.updateDynamicRules.mockClear();
    chrome.declarativeNetRequest.getDynamicRules.mockReturnValue(Promise.resolve([]));
    chrome.tabs.query.mockReturnValue(Promise.resolve([]));
    chrome.tabs.update.mockClear();
  });

  describe('declarativeNetRequest rules (blocks new tab navigations)', () => {
    test('creates requestDomains rule for every blocked domain', async () => {
      await activateBlocking();

      const call = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      const rules = call.addRules;

      expect(rules).toHaveLength(3);

      const domains = rules.map((r) => r.condition.requestDomains);
      expect(domains).toContainEqual(['x.com']);
      expect(domains).toContainEqual(['web.whatsapp.com']);
      expect(domains).toContainEqual(['mail.google.com']);
    });

    test('x.com rule is structurally identical to mail.google.com rule', async () => {
      await activateBlocking();

      const rules = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0].addRules;
      const xRule = rules.find((r) => r.condition.requestDomains[0] === 'x.com');
      const mailRule = rules.find((r) => r.condition.requestDomains[0] === 'mail.google.com');

      // Same action type
      expect(xRule.action).toEqual(mailRule.action);

      // Same resource types
      expect(xRule.condition.resourceTypes).toEqual(mailRule.condition.resourceTypes);

      // Both use requestDomains (not urlFilter)
      expect(xRule.condition.urlFilter).toBeUndefined();
      expect(mailRule.condition.urlFilter).toBeUndefined();
      expect(xRule.condition.requestDomains).toBeDefined();
      expect(mailRule.condition.requestDomains).toBeDefined();
    });

    test('does NOT use urlFilter for domain matching', async () => {
      await activateBlocking();

      const rules = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0].addRules;
      rules.forEach((rule) => {
        expect(rule.condition.urlFilter).toBeUndefined();
        expect(rule.condition.requestDomains).toHaveLength(1);
      });
    });

    test('all rules redirect to blocked page', async () => {
      await activateBlocking();

      const rules = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0].addRules;
      rules.forEach((rule) => {
        expect(rule.action.type).toBe('redirect');
        expect(rule.action.redirect.extensionPath).toBe('/blocked/blocked.html');
      });
    });

    test('rules only target main_frame', async () => {
      await activateBlocking();

      const rules = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0].addRules;
      rules.forEach((rule) => {
        expect(rule.condition.resourceTypes).toEqual(['main_frame']);
      });
    });

    test('clears previous rules before adding new ones', async () => {
      chrome.declarativeNetRequest.getDynamicRules.mockReturnValue(
        Promise.resolve([{ id: 99 }, { id: 100 }])
      );

      await activateBlocking();

      const call = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      expect(call.removeRuleIds).toEqual([99, 100]);
    });

    test('skips rule creation when no blocked domains', async () => {
      await Storage.saveSettings({ blockedDomains: [], tags: {} });

      await activateBlocking();

      expect(chrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
    });
  });

  describe('existing tab redirection', () => {
    test('redirects existing x.com tab', async () => {
      chrome.tabs.query.mockReturnValue(Promise.resolve([
        { id: 1, url: 'https://x.com/home' },
      ]));

      await activateBlocking();

      expect(chrome.tabs.update).toHaveBeenCalledWith(1, {
        url: expect.stringContaining('blocked/blocked.html'),
      });
    });

    test('redirects existing mail.google.com tab', async () => {
      chrome.tabs.query.mockReturnValue(Promise.resolve([
        { id: 2, url: 'https://mail.google.com/mail/u/0/#inbox' },
      ]));

      await activateBlocking();

      expect(chrome.tabs.update).toHaveBeenCalledWith(2, {
        url: expect.stringContaining('blocked/blocked.html'),
      });
    });

    test('redirects tabs on subdomains of blocked domains', async () => {
      chrome.tabs.query.mockReturnValue(Promise.resolve([
        { id: 3, url: 'https://subdomain.x.com/feed' },
      ]));

      await activateBlocking();

      expect(chrome.tabs.update).toHaveBeenCalledWith(3, {
        url: expect.stringContaining('blocked/blocked.html'),
      });
    });

    test('does not redirect non-blocked domains', async () => {
      chrome.tabs.query.mockReturnValue(Promise.resolve([
        { id: 4, url: 'https://github.com/repo' },
        { id: 5, url: 'https://stackoverflow.com/questions' },
      ]));

      await activateBlocking();

      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });

    test('handles mix of blocked and non-blocked tabs', async () => {
      chrome.tabs.query.mockReturnValue(Promise.resolve([
        { id: 1, url: 'https://x.com/home' },
        { id: 2, url: 'https://github.com' },
        { id: 3, url: 'https://mail.google.com/inbox' },
        { id: 4, url: 'https://docs.google.com' },
      ]));

      await activateBlocking();

      expect(chrome.tabs.update).toHaveBeenCalledTimes(2);
      expect(chrome.tabs.update).toHaveBeenCalledWith(1, expect.any(Object));
      expect(chrome.tabs.update).toHaveBeenCalledWith(3, expect.any(Object));
    });
  });

  describe('top-level onUpdated fallback listener', () => {
    test('top-level listener is registered at module load', () => {
      expect(topLevelOnUpdatedListener).toEqual(expect.any(Function));
    });

    test('top-level listener redirects blocked domain during focus', async () => {
      await Storage.saveTimerState({
        status: 'running',
        type: 'focus',
        startedAt: new Date().toISOString(),
        duration: 1500,
      });

      chrome.tabs.update.mockClear();
      topLevelOnUpdatedListener(99, { url: 'https://x.com/home' });
      await new Promise((r) => setTimeout(r, 50));

      expect(chrome.tabs.update).toHaveBeenCalledWith(99, {
        url: expect.stringContaining('blocked/blocked.html'),
      });
    });

    test('top-level listener redirects subdomain of blocked domain', async () => {
      await Storage.saveTimerState({
        status: 'running',
        type: 'focus',
        startedAt: new Date().toISOString(),
        duration: 1500,
      });

      chrome.tabs.update.mockClear();
      topLevelOnUpdatedListener(99, { url: 'https://www.x.com/feed' });
      await new Promise((r) => setTimeout(r, 50));

      expect(chrome.tabs.update).toHaveBeenCalledWith(99, {
        url: expect.stringContaining('blocked/blocked.html'),
      });
    });

    test('top-level listener ignores non-blocked domains during focus', async () => {
      await Storage.saveTimerState({
        status: 'running',
        type: 'focus',
        startedAt: new Date().toISOString(),
        duration: 1500,
      });

      chrome.tabs.update.mockClear();
      topLevelOnUpdatedListener(99, { url: 'https://github.com/repo' });
      await new Promise((r) => setTimeout(r, 50));

      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });

    test('top-level listener ignores blocked domains when not in focus', async () => {
      await Storage.saveTimerState({ status: 'idle' });

      chrome.tabs.update.mockClear();
      topLevelOnUpdatedListener(99, { url: 'https://x.com/home' });
      await new Promise((r) => setTimeout(r, 50));

      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });

    test('top-level listener ignores blocked domains during break', async () => {
      await Storage.saveTimerState({
        status: 'running',
        type: 'shortBreak',
        startedAt: new Date().toISOString(),
        duration: 300,
      });

      chrome.tabs.update.mockClear();
      topLevelOnUpdatedListener(99, { url: 'https://x.com/home' });
      await new Promise((r) => setTimeout(r, 50));

      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });

    test('top-level listener ignores updates without url change', async () => {
      await Storage.saveTimerState({
        status: 'running',
        type: 'focus',
        startedAt: new Date().toISOString(),
        duration: 1500,
      });

      chrome.tabs.update.mockClear();
      topLevelOnUpdatedListener(99, { status: 'loading' });
      await new Promise((r) => setTimeout(r, 50));

      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });

    test('top-level listener does not redirect blocked.html itself', async () => {
      await Storage.saveTimerState({
        status: 'running',
        type: 'focus',
        startedAt: new Date().toISOString(),
        duration: 1500,
      });

      chrome.tabs.update.mockClear();
      topLevelOnUpdatedListener(99, { url: 'chrome-extension://mock-id/blocked/blocked.html' });
      await new Promise((r) => setTimeout(r, 50));

      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivation', () => {
    test('removes all dynamic rules', async () => {
      chrome.declarativeNetRequest.getDynamicRules.mockReturnValue(
        Promise.resolve([{ id: 1 }, { id: 2 }, { id: 3 }])
      );

      await deactivateBlocking();

      const call = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      expect(call.removeRuleIds).toEqual([1, 2, 3]);
      expect(call.addRules).toEqual([]);
    });
  });
});
