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
 * Run:  npx jest --config jest.e2e.config.js
 */

const {
  launchBrowserWithExtension,
  startFocusViaPopup,
  stopSessionViaPopup,
  getDynamicRules,
  navigateAndGetUrl,
  sleep,
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

  // ─── Existing tab blocking (works) ──────────────────────────────

  describe('existing tabs are blocked when focus starts', () => {
    test('existing tab on x.com is redirected to blocked page', async () => {
      // Open x.com BEFORE starting focus
      const page = await browser.newPage();
      await page.goto('https://x.com', {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      }).catch(() => {});

      // Start focus — activateBlocking() should redirect this tab
      await startFocusViaPopup(browser, extensionId);

      // Wait for the tab to be redirected
      await page
        .waitForFunction(
          () => window.location.href.includes('blocked/blocked.html'),
          { timeout: 5000 }
        )
        .catch(() => {});

      expect(page.url()).toContain('blocked/blocked.html');
      await page.close();
    });

    test('existing tab on mail.google.com is redirected', async () => {
      // NOTE: Gmail often server-redirects to accounts.google.com for sign-in.
      // When that happens, the tab URL is no longer on mail.google.com by the
      // time activateBlocking() checks tab.url, so existing-tab blocking won't
      // catch it.  The declarativeNetRequest rule (new-tab blocking) still
      // intercepts at the request level, before any redirect.
      //
      // This test verifies whichever state the tab ends up in — if it stayed
      // on mail.google.com it should be blocked; if it redirected away, the
      // test is skipped to avoid false negatives.
      const page = await browser.newPage();
      await page.goto('https://mail.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      }).catch(() => {});

      const urlBeforeFocus = page.url();
      const hostnameBeforeFocus = new URL(urlBeforeFocus).hostname;
      const stayedOnGmail = hostnameBeforeFocus === 'mail.google.com' ||
        hostnameBeforeFocus.endsWith('.mail.google.com');

      if (!stayedOnGmail) {
        // Tab redirected away from blocked domain — skip assertion.
        // Gmail redirects to accounts.google.com for sign-in; the tab
        // is no longer on a blocked domain so existing-tab blocking
        // correctly ignores it.
        console.log(
          `  [skip] mail.google.com redirected to ${hostnameBeforeFocus} before focus started`
        );
        await page.close();
        return;
      }

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

  // ─── NEW tab blocking (BUG) ─────────────────────────────────────

  describe('new tabs to blocked domains during focus', () => {
    /**
     * BUG: Opening a new tab and navigating to x.com AFTER focus has
     * started should be intercepted by the declarativeNetRequest redirect
     * rule.  In practice, the redirect sometimes does NOT fire for new
     * tabs, particularly for short domains like x.com.
     *
     * These tests will FAIL while the bug is present.
     */

    test('new tab navigating to https://x.com is blocked', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrl(browser, 'https://x.com');

      expect(finalUrl).toContain('blocked/blocked.html');
    });

    test('new tab navigating to https://x.com/home is blocked', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrl(browser, 'https://x.com/home');

      expect(finalUrl).toContain('blocked/blocked.html');
    });

    test('new tab navigating to https://mail.google.com is blocked', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrl(
        browser,
        'https://mail.google.com/mail/u/0/#inbox'
      );

      expect(finalUrl).toContain('blocked/blocked.html');
    });

    test('new tab navigating to https://web.whatsapp.com is blocked', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrl(browser, 'https://web.whatsapp.com');

      expect(finalUrl).toContain('blocked/blocked.html');
    });

    test('new tab navigating to subdomain of blocked domain is blocked', async () => {
      await startFocusViaPopup(browser, extensionId);

      // www.x.com is a subdomain of x.com — requestDomains should match
      const finalUrl = await navigateAndGetUrl(browser, 'https://www.x.com');

      expect(finalUrl).toContain('blocked/blocked.html');
    });
  });

  // ─── Race condition scenarios ────────────────────────────────────

  describe('timing / race condition scenarios', () => {
    /**
     * The bug may be caused by a race between activateBlocking() completing
     * and the user opening a new tab.  These tests vary the timing to try
     * to expose the window where declarativeNetRequest rules aren't yet
     * active.
     */

    test('navigate to x.com immediately after focus starts (no extra delay)', async () => {
      // Start focus but don't add extra sleep — navigate ASAP
      const popupPage = await browser.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
        waitUntil: 'domcontentloaded',
      });
      await popupPage.waitForSelector('#popupBtnFocus', { visible: true });
      await popupPage.click('#popupBtnFocus');

      // Navigate immediately — no waiting for rules to propagate
      const page = await browser.newPage();
      await page.goto('https://x.com', {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      }).catch(() => {});
      await sleep(1000);

      const url = page.url();
      await page.close();
      await popupPage.close();

      expect(url).toContain('blocked/blocked.html');
    });

    test('rapid sequential navigations to x.com during focus', async () => {
      await startFocusViaPopup(browser, extensionId);

      // Open 3 tabs in rapid succession to x.com
      const results = [];
      for (let i = 0; i < 3; i++) {
        const url = await navigateAndGetUrl(browser, 'https://x.com');
        results.push(url);
      }

      // ALL should be blocked
      for (const url of results) {
        expect(url).toContain('blocked/blocked.html');
      }
    });

    test('navigate to x.com from about:blank (simulates address bar entry)', async () => {
      await startFocusViaPopup(browser, extensionId);

      // Open a blank tab first, then navigate — closer to typing a URL
      const page = await browser.newPage();
      await page.goto('about:blank');
      await sleep(200);

      // Now navigate to x.com from the blank tab
      await page.goto('https://x.com', {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      }).catch(() => {});
      await sleep(1000);

      const url = page.url();
      await page.close();

      expect(url).toContain('blocked/blocked.html');
    });

    test('navigate via window.location assignment (client-side navigation)', async () => {
      await startFocusViaPopup(browser, extensionId);

      // Start from the extension's board page (a real page, not about:blank
      // which has origin restrictions in headless Chromium)
      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/board/board.html`, {
        waitUntil: 'domcontentloaded',
      });

      // Navigate via JavaScript — different code path than page.goto()
      await page.evaluate(() => {
        window.location.href = 'https://x.com';
      });

      // Wait for navigation to settle
      await sleep(3000);

      const url = page.url();
      await page.close();

      expect(url).toContain('blocked/blocked.html');
    });

    test('navigate via clicking a link to x.com', async () => {
      await startFocusViaPopup(browser, extensionId);

      // Start from the extension's board page (a real page, not about:blank)
      const page = await browser.newPage();
      await page.goto(`chrome-extension://${extensionId}/board/board.html`, {
        waitUntil: 'domcontentloaded',
      });

      // Create and click a link — simulates clicking a link on another page
      await page.evaluate(() => {
        const a = document.createElement('a');
        a.href = 'https://x.com';
        a.textContent = 'Go to X';
        document.body.appendChild(a);
      });
      await page.click('a');

      await sleep(3000);

      const url = page.url();
      await page.close();

      expect(url).toContain('blocked/blocked.html');
    });
  });

  // ─── No fallback: missing onUpdated listener during focus ────────

  describe('fallback blocking (chrome.tabs.onUpdated during focus)', () => {
    /**
     * Focus mode registers a chrome.tabs.onUpdated listener as a fallback
     * to catch navigations that declarativeNetRequest misses (race
     * conditions, client-side navigations, etc.)
     */

    test('onBlockedTabUpdated function exists in service worker', async () => {
      const worker = await workerTarget.worker();
      const exists = await worker.evaluate(() => typeof onBlockedTabUpdated);

      expect(exists).toBe('function');
    });
  });

  // ─── Non-blocked domains should NOT be blocked ──────────────────

  describe('non-blocked domains are not affected', () => {
    test('new tab to github.com is NOT blocked during focus', async () => {
      await startFocusViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrl(browser, 'https://github.com');

      expect(finalUrl).not.toContain('blocked/blocked.html');
    });
  });

  // ─── Comparison: same domain, existing vs new tab ───────────────

  describe('existing vs new tab comparison for x.com', () => {
    /**
     * This test explicitly shows the discrepancy:
     *   - An existing x.com tab IS blocked  (via chrome.tabs.update)
     *   - A new x.com tab may NOT be blocked (declarativeNetRequest only)
     */
    test('both existing and new x.com tabs should be blocked', async () => {
      // ── Existing tab ──
      const existingPage = await browser.newPage();
      await existingPage
        .goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 10000 })
        .catch(() => {});

      await startFocusViaPopup(browser, extensionId);

      await existingPage
        .waitForFunction(
          () => window.location.href.includes('blocked/blocked.html'),
          { timeout: 5000 }
        )
        .catch(() => {});

      const existingTabBlocked = existingPage.url().includes('blocked/blocked.html');
      await existingPage.close();

      // ── New tab ──
      const newUrl = await navigateAndGetUrl(browser, 'https://x.com');
      const newTabBlocked = newUrl.includes('blocked/blocked.html');

      // Log the comparison for clarity
      console.log(`  Existing x.com tab blocked: ${existingTabBlocked}`);
      console.log(`  New x.com tab blocked:      ${newTabBlocked}`);

      // Both should be true — but new tab blocking may be broken
      expect(existingTabBlocked).toBe(true);
      expect(newTabBlocked).toBe(true);
    });
  });

  // ─── Lifecycle: blocking cleans up after stop ───────────────────

  describe('blocking lifecycle', () => {
    test('new tab to x.com is allowed after focus stops', async () => {
      await startFocusViaPopup(browser, extensionId);
      await stopSessionViaPopup(browser, extensionId);

      const finalUrl = await navigateAndGetUrl(browser, 'https://x.com');

      expect(finalUrl).not.toContain('blocked/blocked.html');
    });
  });
});
