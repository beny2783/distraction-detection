import { jest, beforeEach } from '@jest/globals';

// Mock browser APIs
globalThis.Date.now = jest.fn(() => 1234567890);

// Mock chrome storage
const storage = {
  local: new Map(),
  sync: new Map()
};

// Mock chrome API
globalThis.chrome = {
  storage: {
    local: {
      get: jest.fn((keys) => {
        return Promise.resolve(
          Array.isArray(keys)
            ? Object.fromEntries(keys.map(key => [key, storage.local.get(key)]))
            : typeof keys === 'string'
            ? { [keys]: storage.local.get(keys) }
            : Object.fromEntries(Array.from(storage.local.entries()))
        );
      }),
      set: jest.fn((items) => {
        Object.entries(items).forEach(([key, value]) => storage.local.set(key, value));
        return Promise.resolve();
      })
    },
    sync: {
      get: jest.fn((keys) => {
        return Promise.resolve(
          Array.isArray(keys)
            ? Object.fromEntries(keys.map(key => [key, storage.sync.get(key)]))
            : typeof keys === 'string'
            ? { [keys]: storage.sync.get(keys) }
            : Object.fromEntries(Array.from(storage.sync.entries()))
        );
      }),
      set: jest.fn((items) => {
        Object.entries(items).forEach(([key, value]) => storage.sync.set(key, value));
        return Promise.resolve();
      })
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  tabs: {
    sendMessage: jest.fn(),
    query: jest.fn(),
    get: jest.fn(),
    onActivated: {
      addListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn()
    }
  },
  windows: {
    WINDOW_ID_NONE: -1,
    onFocusChanged: {
      addListener: jest.fn()
    }
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  }
};

// Reset storage between tests
beforeEach(() => {
  storage.local.clear();
  storage.sync.clear();
  jest.clearAllMocks();
}); 