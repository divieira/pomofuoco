/**
 * E2E tests for Focus Mode blocking.
 *
 * These tests load the real extension in Chromium and verify that blocked
 * domains are intercepted by declarativeNetRequest.
 *
 * KEY BUG UNDER TEST:
 *   Opening a NEW tab to x.com during focus mode is NOT blocked,
 *   even though existing tabs on x.com ARE correctly redirected.
 *
 * CRITICAL TEST DESIGN:
 *   The "dNR-only" tests disable the onUpdated fallback listener so that
 *   ONLY declarativeNetRequest can perform the redirect.  This prevents
 *   the fallback from masking dNR failures (which caused previous false
 *   positives in the test suite).
 *
 * Run:  npx jest --config jest.e2e.config.js
 */

const {
  launchBrowserWithExtension,
  startFocusViaPopup,
  stopSessionViaPopup,
  getDynamicRules,
  navigateAndGetUrl,
  navigateAndGetUrlDnrOnly,
  enableOnUpdatedFallback,
} = require('./helpers');

describe('Focus Mode Blocking (E2E)', () => {
  let browser;
  let extensionId;
  let workerTarget;

  beforeAll(async () => {
    ({ browser, extensionId, workerTarget } = await launchBrowserWithExtension());
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  afterEach(async () => {
    // Ensure fallback is re-enabled (in case a test failed mid-way)
    await enableOnUpdatedFallback(workerTarget).catch(() => {});
    // Always clean up: stop any running session
    await stopSessionViaPopup(browser, extensionId).catch(() => {});
  });

  // ─── Sanity checks ──────────────────────────────────────────────

  describe('extension loads correctly', () => {
    test('service worker is active', () => {
      expect(workerTarget).toBeDefined();
      expect(workerTarget.url()).toContain(extensionId);
    });

    test('popup page opens', async () => {
      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
        waitUntil: 'domcontentloaded',
      });
      const text = await page.$eval('#popupLabel', (el) => el.textContent);
      expect(text).toBe('Ready');
      await page.close();
    });

    test('isBlockedUrl helper is available in service worker', async () => {
      const worker = await workerTarget.worker();
      const exists = await worker.evaluate(() => typeof isBlockedUrl);
      expect(exists).toBe('function');
    });
  });

  // ─── declarativeNetRequest rules ─────────────────────────────────

  describe('declarativeNetRequest rules during focus', () => {
    test('rules are installed when focus starts', async () => {
      await startFocusViaPopup(browser, extensionId);

      const rules = await getDynamicRules(workerTarget);

      expect(rules.length).toBeGreaterThanOrEqual(3);

      const domains = rules.map((r) => r.condition.requestDomains).flat();
      expect(domains).toContain('x.com');
      expect(domains).toContain('web.whatsapp.com');
      expect(domains).toContain('mail.google.com');
    });

    test('rules are removed when focus stops', async () => {
      await startFocusViaPopup(browser, extensionId);
      await stopSessionViaPopup(browser, extensionId);

      const rules = await getDynamicRules(workerTarget);
      expect(rules).toHaveLength(0);
    });

    test('each rule targets main_frame only', async () => {
      await startFocusViaPopup(browser, extensionId);
      const rules = await getDynamicRules(workerTarget);

      for (const rule of rules) {
        expect(rule.condition.resourceTypes).toEqual(['main_frame']);
      }
    });

    test('each rule redirects to blocked.html', async () => {
      await startFocusViaPopup(browser, extensionId);
      const rules = await getDynamicRules(workerTarget);

      for (const rule of rules) {
        expect(rule.action.type).toBe('redirect');
        expect(rule.action.redirect.extensionPath).toBe('/blocked/blocked.html');
      }
    });
  });

  // ─── Existing tab blocking (works via chrome.tabs.update) ──────

  describe('existing tabs are blocked when focus starts', () => {
    test('existing tab on x.com is redirected to blocked page', async () => {
      const page = await browser.newPage();
      await page.goto('https://x.com', {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      }).catch(() => {});

      await startFocusViaPopup(browser, extensionId);

      await page
        .waitForFunction(
          () => window.location.href.includes('blocked/blocked.html'),
          { timeout: 5000 }
        )
        .catch(() => {});

      expect(page.url()).toContain('blocked/blocked.html');
      await page.close();
    });
  });

  // ─── dNR-ONLY tests (fallback DISABLED) ────────────────────────
  //
  // These tests disable the chrome.tabs.onUpdated fallback listener so
  // that ONLY declarativeNetRequest can perform the redirect.
  //
  // If these tests FAIL, it proves that dNR alone cannot block the
  // domain — the fallback was masking the failure.

  describe('declarativeNetRequest ONLY (onUpdated fallback disabled)', () => {
    test('dNR alone blocks https://x.com', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrlDnrOnly(
        browser, workerTarget, 'https://x.com'
      );

      expect(finalUrl).toContain('blocked/blocked.html');
    });

    test('dNR alone blocks https://x.com/home', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrlDnrOnly(
        browser, workerTarget, 'https://x.com/home'
      );

      expect(finalUrl).toContain('blocked/blocked.html');
    });

    test('dNR alone blocks https://www.x.com (subdomain)', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrlDnrOnly(
        browser, workerTarget, 'https://www.x.com'
      );

      expect(finalUrl).toContain('blocked/blocked.html');
    });

    test('dNR alone blocks https://mail.google.com', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrlDnrOnly(
        browser, workerTarget, 'https://mail.google.com/mail/u/0/#inbox'
      );

      expect(finalUrl).toContain('blocked/blocked.html');
    });

    test('dNR alone blocks https://web.whatsapp.com', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrlDnrOnly(
        browser, workerTarget, 'https://web.whatsapp.com'
      );

      expect(finalUrl).toContain('blocked/blocked.html');
    });

    test('dNR alone does NOT block https://github.com', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrlDnrOnly(
        browser, workerTarget, 'https://github.com'
      );

      expect(finalUrl).not.toContain('blocked/blocked.html');
    });
  });

  // ─── With both mechanisms (belt and suspenders) ────────────────

  describe('new tabs with both dNR + fallback active', () => {
    test('new tab navigating to https://x.com is blocked', async () => {
      await startFocusViaPopup(browser, extensionId);
      const finalUrl = await navigateAndGetUrl(browser, 'https://x.com');
      expect(finalUrl).toContain('blocked/blocked.html');
    });

    test('new tab navigating to https://mail.google.com is blocked', async () => {
      await startFocusViaPopup(browser, extensionId);
      const finalUrl = await navigateAndGetUrl(
        browser, 'https://mail.google.com/mail/u/0/#inbox'
      );
      expect(finalUrl).toContain('blocked/blocked.html');
    });
  });

  // ─── Non-blocked domains ──────────────────────────────────────

  describe('non-blocked domains are not affected', () => {
    test('new tab to github.com is NOT blocked during focus', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrl(browser, 'https://github.com');

      expect(finalUrl).not.toContain('blocked/blocked.html');
    });
  });

  // ─── Lifecycle ────────────────────────────────────────────────

  describe('blocking lifecycle', () => {
    test('new tab to x.com is allowed after focus stops', async () => {
      await startFocusViaPopup(browser, extensionId);
      await stopSessionViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrl(browser, 'https://x.com');

      expect(finalUrl).not.toContain('blocked/blocked.html');
    });
  });
});
