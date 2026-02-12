/**
 * E2E test helpers for Pomofuoco Chrome extension.
 *
 * Launches a real Chromium instance with the extension loaded and provides
 * utilities to interact with the service worker, start/stop focus sessions,
 * and query declarativeNetRequest state.
 */

const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '..');

/**
 * Launch Chrome with the Pomofuoco extension loaded.
 * Returns { browser, extensionId, workerTarget }.
 */
async function launchBrowserWithExtension() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  // Wait for the service worker to register
  const workerTarget = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('background.js'),
    { timeout: 10000 }
  );

  // Extract the extension ID from the worker URL
  // e.g. chrome-extension://abcdef1234/background.js
  const extensionId = new URL(workerTarget.url()).hostname;

  return { browser, extensionId, workerTarget };
}

/**
 * Start a focus session by navigating to the popup and clicking Focus.
 */
async function startFocusViaPopup(browser, extensionId) {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
    waitUntil: 'domcontentloaded',
  });

  // Wait for the popup JS to initialise
  await page.waitForSelector('#popupBtnFocus', { visible: true });

  await page.click('#popupBtnFocus');

  // Give time for activateBlocking() to create rules + redirect existing tabs
  await page.waitForFunction(
    () => {
      const stop = document.querySelector('#popupRunningButtons');
      return stop && !stop.classList.contains('hidden');
    },
    { timeout: 5000 }
  );

  // Extra pause for declarativeNetRequest rules to propagate
  await sleep(500);

  await page.close();
}

/**
 * Stop the running session via the popup.
 */
async function stopSessionViaPopup(browser, extensionId) {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`, {
    waitUntil: 'domcontentloaded',
  });

  // The stop button is inside #popupRunningButtons which is only visible during a session
  const visible = await page
    .waitForSelector('#popupBtnStop', { visible: true, timeout: 2000 })
    .catch(() => null);

  if (visible) {
    await page.click('#popupBtnStop');
    await sleep(500);
  }

  await page.close();
}

/**
 * Query the dynamic declarativeNetRequest rules currently installed.
 * Returns the rule objects.
 */
async function getDynamicRules(workerTarget) {
  const worker = await workerTarget.worker();
  return worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
}

/**
 * Navigate a new page to a URL and return the final URL after any
 * declarativeNetRequest redirects.  We use a short timeout because
 * if blocking works the redirect is instant (no network hit).
 */
async function navigateAndGetUrl(browser, url) {
  const page = await browser.newPage();

  // Attempt navigation — if declarativeNetRequest redirects, the final URL
  // will be the blocked page.  If not, it may load or time out.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

  // Small grace period for any async redirect
  await sleep(1000);

  const finalUrl = page.url();
  await page.close();
  return finalUrl;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  EXTENSION_PATH,
  launchBrowserWithExtension,
  startFocusViaPopup,
  stopSessionViaPopup,
  getDynamicRules,
  navigateAndGetUrl,
  sleep,
};
