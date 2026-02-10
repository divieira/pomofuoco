// This runs in setupFilesAfterFramework (after test framework loads)
// so beforeEach is available

beforeEach(() => {
  global._uuidCounter = 0;
  global.resetChromeStorage();
  jest.clearAllMocks();
});
