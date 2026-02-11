// Chrome Extension API Mock for Jest
// This runs in setupFiles (before test framework loads)

const storageData = {};

const chrome = {
  storage: {
    local: {
      get: jest.fn((keys) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: storageData[keys] ?? undefined });
        }
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach((k) => {
            if (storageData[k] !== undefined) result[k] = storageData[k];
          });
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),
      set: jest.fn((items) => {
        Object.assign(storageData, items);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        Object.keys(storageData).forEach((k) => delete storageData[k]);
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },

  alarms: {
    create: jest.fn(),
    clear: jest.fn(() => Promise.resolve(true)),
    get: jest.fn(() => Promise.resolve(null)),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },

  notifications: {
    create: jest.fn((_id, _opts, cb) => {
      if (cb) cb('notification-id');
      return Promise.resolve('notification-id');
    }),
    clear: jest.fn(() => Promise.resolve(true)),
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },

  runtime: {
    sendMessage: jest.fn(() => Promise.resolve({})),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
    getContexts: jest.fn(() => Promise.resolve([])),
  },

  offscreen: {
    createDocument: jest.fn(() => Promise.resolve()),
  },

  tabs: {
    query: jest.fn(() => Promise.resolve([])),
    update: jest.fn(() => Promise.resolve({})),
    get: jest.fn(() => Promise.resolve({})),
    onActivated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },

  windows: {
    onFocusChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    WINDOW_ID_NONE: -1,
  },

  idle: {
    setDetectionInterval: jest.fn(),
    onStateChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },

  declarativeNetRequest: {
    updateDynamicRules: jest.fn(() => Promise.resolve()),
    getDynamicRules: jest.fn(() => Promise.resolve([])),
  },

  action: {
    setBadgeText: jest.fn(() => Promise.resolve()),
    setBadgeBackgroundColor: jest.fn(() => Promise.resolve()),
  },
};

global.chrome = chrome;

// Helper to reset storage between tests
global.resetChromeStorage = () => {
  Object.keys(storageData).forEach((k) => delete storageData[k]);
};

// Helper to set storage data for tests
global.setChromeStorage = (data) => {
  Object.assign(storageData, data);
};

// Mock crypto.randomUUID
if (!global.crypto) {
  global.crypto = {};
}
global._uuidCounter = 0;
global.crypto.randomUUID = jest.fn(() => {
  global._uuidCounter++;
  return `test-uuid-${global._uuidCounter}`;
});
