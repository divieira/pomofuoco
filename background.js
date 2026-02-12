// Pomofuoco Background Service Worker
// Manages timer, blocking, and activity tracking

importScripts('shared/constants.js', 'shared/storage.js', 'shared/timer-core.js');

// --- Notification Sound ---
async function playNotificationSound() {
  const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play timer notification sound',
    });
  }

  chrome.runtime.sendMessage({
    action: 'playSound',
    source: chrome.runtime.getURL('sounds/ding.wav'),
  });
}

// --- Alarm Handler ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CONSTANTS.ALARM_NAME) {
    const timerState = await TimerCore.onAlarmFired();
    if (timerState) {
      const typeLabel = timerState.type === 'focus' ? 'Focus' :
        timerState.type === 'shortBreak' ? 'Short Break' : 'Long Break';

      chrome.notifications.create('pomofuoco-alarm', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Pomofuoco',
        message: `${typeLabel} time is up! Click stop when ready.`,
        requireInteraction: true,
        silent: true,
      });

      playNotificationSound();

      // Update badge to show overtime
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#e94560' });
    }
  }
});

// --- Badge Update Interval ---
// Use alarms for periodic badge updates (every 1 minute)
chrome.alarms.create('pomofuoco-badge-update', { periodInMinutes: 1.0 / 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pomofuoco-badge-update') {
    const timerState = await Storage.getTimerState();
    if (timerState.status === 'running' && !timerState.alarmFired) {
      const remaining = TimerCore.getRemaining(timerState);
      const mins = Math.ceil(remaining / 60);
      chrome.action.setBadgeText({ text: String(mins) });
      const color = timerState.type === 'focus' ? '#e94560' :
        timerState.type === 'shortBreak' ? '#4ecdc4' : '#45b7d1';
      chrome.action.setBadgeBackgroundColor({ color });
    } else if (timerState.status === 'idle') {
      chrome.action.setBadgeText({ text: '' });
    }
  }
});

// --- Idle Detection (screen lock) ---
chrome.idle.setDetectionInterval(CONSTANTS.IDLE_DETECTION_INTERVAL);
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'locked') {
    const timerState = await Storage.getTimerState();
    if (timerState.status === 'running') {
      await handleStopSession();
    }
  }
});

// --- Tab Blocking ---
const blockedTabUrls = new Map(); // tabId -> original URL

function isBlockedUrl(urlString, domains) {
  try {
    const url = new URL(urlString);
    return domains.some((d) => url.hostname === d || url.hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

// Top-level tab listener — persists across service worker restarts.
// Checks persisted timer state on every URL change so it works even after
// the SW goes idle and wakes back up (MV3 lifecycle).
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const blockedPageSuffix = 'blocked/blocked.html';
  if (changeInfo.url.includes(blockedPageSuffix)) return;

  Storage.getTimerState().then((timerState) => {
    if (timerState.status !== 'running' || timerState.type !== 'focus') return;

    Storage.getSettings().then((settings) => {
      if (isBlockedUrl(changeInfo.url, settings.blockedDomains)) {
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL('blocked/blocked.html'),
        });
      }
    });
  });
});

async function activateBlocking() {
  const settings = await Storage.getSettings();
  const domains = settings.blockedDomains;

  if (domains.length === 0) return;

  // Create declarativeNetRequest rules
  const rules = domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { extensionPath: '/blocked/blocked.html' },
    },
    condition: {
      requestDomains: [domain],
      resourceTypes: ['main_frame'],
    },
  }));

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: rules,
  });

  // Redirect existing tabs on blocked domains
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && isBlockedUrl(tab.url, domains)) {
      blockedTabUrls.set(tab.id, tab.url);
      chrome.tabs.update(tab.id, {
        url: chrome.runtime.getURL('blocked/blocked.html'),
      });
    }
  }
}

async function deactivateBlocking() {
  // Remove all dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);
  if (removeRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: [],
    });
  }

  // Restore blocked tabs
  for (const [tabId, url] of blockedTabUrls.entries()) {
    try {
      await chrome.tabs.update(tabId, { url });
    } catch {
      // Tab may have been closed
    }
  }
  blockedTabUrls.clear();
}

// --- Domain Visit Tracking ---
let currentVisit = null;
let isWindowFocused = true;

async function startDomainTracking() {
  // Register listeners for domain tracking during breaks
  chrome.tabs.onActivated.addListener(onTabActivated);
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);

  // Track current active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && activeTab.url) {
    await openVisit(activeTab.url);
  }
}

async function stopDomainTracking() {
  chrome.tabs.onActivated.removeListener(onTabActivated);
  chrome.tabs.onUpdated.removeListener(onTabUpdated);
  chrome.windows.onFocusChanged.removeListener(onWindowFocusChanged);

  await closeCurrentVisit();
}

async function onTabActivated(activeInfo) {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await closeCurrentVisit();
    if (isWindowFocused) {
      await openVisit(tab.url);
    }
  }
}

function onTabUpdated(tabId, changeInfo, _tab) {
  if (changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([activeTab]) => {
      if (activeTab && activeTab.id === tabId) {
        await closeCurrentVisit();
        if (isWindowFocused) {
          await openVisit(changeInfo.url);
        }
      }
    });
  }
}

async function onWindowFocusChanged(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
    await closeCurrentVisit();
  } else {
    isWindowFocused = true;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.url) {
      await openVisit(activeTab.url);
    }
  }
}

async function openVisit(urlString) {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    const timerState = await Storage.getTimerState();
    if (timerState.status !== 'running') return;

    const now = new Date().toISOString();
    currentVisit = {
      id: crypto.randomUUID(),
      sessionId: timerState.sessionId,
      domain: url.hostname,
      startedAt: now,
      endedAt: null,
    };

    const visits = await Storage.getDomainVisits();
    visits.push(currentVisit);
    await Storage.saveDomainVisits(visits);
  } catch {
    // Invalid URL
  }
}

async function closeCurrentVisit() {
  if (!currentVisit) return;

  const now = new Date().toISOString();
  const visits = await Storage.getDomainVisits();
  const visit = visits.find((v) => v.id === currentVisit.id);
  if (visit) {
    visit.endedAt = now;
    await Storage.saveDomainVisits(visits);
  }
  currentVisit = null;
}

// --- Task Time Tracking ---
async function openTaskTimeEntry(taskId) {
  const timerState = await Storage.getTimerState();
  if (timerState.status !== 'running' || timerState.type !== 'focus') return;

  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    taskId: taskId,
    sessionId: timerState.sessionId,
    startedAt: now,
    endedAt: null,
  };

  const entries = await Storage.getTaskTimeEntries();
  entries.push(entry);
  await Storage.saveTaskTimeEntries(entries);
  return entry;
}

async function closeTaskTimeEntry(taskId) {
  const entries = await Storage.getTaskTimeEntries();
  const now = new Date().toISOString();
  let changed = false;

  entries.forEach((e) => {
    if (e.taskId === taskId && !e.endedAt) {
      e.endedAt = now;
      changed = true;
    }
  });

  if (changed) {
    await Storage.saveTaskTimeEntries(entries);
  }
}

async function closeAllOpenTaskEntries() {
  const entries = await Storage.getTaskTimeEntries();
  const now = new Date().toISOString();
  let changed = false;

  entries.forEach((e) => {
    if (!e.endedAt) {
      e.endedAt = now;
      changed = true;
    }
  });

  if (changed) {
    await Storage.saveTaskTimeEntries(entries);
  }
}

// --- Session Lifecycle ---
async function handleStartSession(type) {
  const { timerState, session } = await TimerCore.startSession(type);

  // Set alarm for notification
  chrome.alarms.create(CONSTANTS.ALARM_NAME, {
    delayInMinutes: timerState.duration / 60,
  });

  if (type === 'focus') {
    // Activate blocking
    await activateBlocking();

    // Start tracking doing task
    const tasks = await Storage.getTasks();
    const doingTask = tasks.find((t) => t.column === 'doing');
    if (doingTask) {
      await openTaskTimeEntry(doingTask.id);
    }
  } else {
    // Break — start domain tracking
    await startDomainTracking();
  }

  return { timerState, session };
}

async function handleStopSession() {
  const timerState = await Storage.getTimerState();
  if (timerState.status !== 'running') return null;

  // Clear alarm
  await chrome.alarms.clear(CONSTANTS.ALARM_NAME);

  if (timerState.type === 'focus') {
    // Close task time entries
    await closeAllOpenTaskEntries();
    // Deactivate blocking
    await deactivateBlocking();
  } else {
    // Stop domain tracking
    await stopDomainTracking();
  }

  const session = await TimerCore.stopSession();

  // Clear badge
  chrome.action.setBadgeText({ text: '' });

  return session;
}

// --- Message Handler ---
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = async () => {
    switch (message.action) {
      case 'startSession':
        return handleStartSession(message.type);

      case 'stopSession':
        return handleStopSession();

      case 'getTimerState':
        return Storage.getTimerState();

      case 'getSuggestedNext':
        return TimerCore.getSuggestedNext();

      case 'getStreak':
        return TimerCore.getStreak();

      case 'taskMovedToDoing': {
        const timerState = await Storage.getTimerState();
        if (timerState.status === 'running' && timerState.type === 'focus') {
          await openTaskTimeEntry(message.taskId);
        }
        return { ok: true };
      }

      case 'taskMovedFromDoing': {
        await closeTaskTimeEntry(message.taskId);
        return { ok: true };
      }

      case 'getTasks':
        return Storage.getTasks();

      case 'saveTasks':
        await Storage.saveTasks(message.tasks);
        return { ok: true };

      case 'getSettings':
        return Storage.getSettings();

      case 'saveSettings':
        await Storage.saveSettings(message.settings);
        return { ok: true };

      case 'getSessions':
        return Storage.getSessions();

      case 'getTaskTimeEntries':
        return Storage.getTaskTimeEntries();

      case 'getDomainVisits':
        return Storage.getDomainVisits();

      case 'updateTask': {
        const tasks = await Storage.getTasks();
        const idx = tasks.findIndex((t) => t.id === message.task.id);
        if (idx !== -1) {
          tasks[idx] = message.task;
          await Storage.saveTasks(tasks);
        }
        return { ok: true };
      }

      default:
        return { error: 'Unknown action' };
    }
  };

  handler().then(sendResponse).catch((err) => {
    console.error('Message handler error:', err);
    sendResponse({ error: err.message });
  });

  return true; // Keep channel open for async response
});

// --- Service Worker Install ---
chrome.runtime.onInstalled?.addListener?.(async () => {
  // Initialize default settings if not present
  const settings = await Storage.getSettings();
  await Storage.saveSettings(settings);
  console.log('Pomofuoco installed');
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleStartSession,
    handleStopSession,
    activateBlocking,
    deactivateBlocking,
    openTaskTimeEntry,
    closeTaskTimeEntry,
    closeAllOpenTaskEntries,
  };
}
