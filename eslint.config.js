const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        chrome: 'readonly',
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        history: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        crypto: 'readonly',
        HTMLElement: 'readonly',
        CustomEvent: 'readonly',
        DragEvent: 'readonly',
        Event: 'readonly',
        URL: 'readonly',
        Notification: 'readonly',
        Audio: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
    },
  },
  {
    files: ['shared/constants.js'],
    rules: { 'no-redeclare': 'off' },
  },
  {
    files: ['shared/storage.js'],
    rules: { 'no-redeclare': 'off' },
  },
  {
    files: ['shared/timer-core.js'],
    languageOptions: {
      globals: {
        CONSTANTS: 'readonly',
        Storage: 'readonly',
      },
    },
    rules: { 'no-redeclare': 'off' },
  },
  {
    files: ['shared/task-utils.js'],
    languageOptions: {
      globals: {
        CONSTANTS: 'readonly',
      },
    },
    rules: { 'no-redeclare': 'off' },
  },
  {
    files: ['shared/dashboard-utils.js'],
    rules: { 'no-redeclare': 'off' },
  },
  {
    files: ['popup/**/*.js', 'board/**/*.js', 'blocked/**/*.js'],
    languageOptions: {
      globals: {
        Storage: 'readonly',
        CONSTANTS: 'readonly',
        TimerCore: 'readonly',
        DashboardUtils: 'readonly',
        TaskUtils: 'readonly',
        initWeekly: 'readonly',
        initMonthly: 'readonly',
      },
    },
  },
  {
    files: ['board/weekly.js', 'board/monthly.js'],
    rules: { 'no-redeclare': 'off' },
  },
  {
    files: ['background.js'],
    languageOptions: {
      globals: {
        Storage: 'readonly',
        CONSTANTS: 'readonly',
        TimerCore: 'readonly',
        BlockingManager: 'readonly',
        TrackingManager: 'readonly',
        importScripts: 'readonly',
        Map: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.js', 'jest.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        global: 'readonly',
        process: 'readonly',
        resetChromeStorage: 'readonly',
        setChromeStorage: 'readonly',
      },
    },
  },
  {
    files: ['tests/setup.js'],
    rules: { 'no-redeclare': 'off' },
  },
  {
    files: ['tests/**/*.test.js'],
    rules: { 'no-redeclare': 'off' },
  },
  {
    files: ['e2e/**/*.js', 'jest.e2e.config.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        console: 'readonly',
        self: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    files: ['shared/**/*.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/**'],
  },
];
