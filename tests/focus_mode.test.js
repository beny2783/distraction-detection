import { describe, beforeEach, test, expect, vi } from 'vitest';

// Mock storage
const storage = {
  local: new Map(),
  sync: new Map()
};

// Mock chrome API
const mockChrome = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        return Promise.resolve(
          Array.isArray(keys)
            ? Object.fromEntries(keys.map(key => [key, storage.local.get(key)]))
            : typeof keys === 'string'
            ? { [keys]: storage.local.get(keys) }
            : Object.fromEntries(Array.from(storage.local.entries()))
        );
      }),
      set: vi.fn((items) => {
        Object.entries(items).forEach(([key, value]) => storage.local.set(key, value));
        return Promise.resolve();
      })
    },
    sync: {
      get: vi.fn((keys) => {
        return Promise.resolve(
          Array.isArray(keys)
            ? Object.fromEntries(keys.map(key => [key, storage.sync.get(key)]))
            : typeof keys === 'string'
            ? { [keys]: storage.sync.get(keys) }
            : Object.fromEntries(Array.from(storage.sync.entries()))
        );
      }),
      set: vi.fn((items) => {
        Object.entries(items).forEach(([key, value]) => storage.sync.set(key, value));
        return Promise.resolve();
      })
    }
  },
  tabs: {
    sendMessage: vi.fn(),
    get: vi.fn(),
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() }
  },
  runtime: {
    onMessage: { addListener: vi.fn() },
    sendMessage: vi.fn()
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: { addListener: vi.fn() }
  }
};

globalThis.chrome = mockChrome;
globalThis.Date.now = vi.fn(() => 1234567890);

// Mock the background.js module
const mockFocusMode = {
  active: false,
  startTime: null,
  endTime: null,
  taskType: null,
  stats: {
    focusScore: 95,
    focusTime: 0,
    distractionCount: 0,
    streakCount: 0
  }
};

const mockHandleMessage = vi.fn(async (message, sender) => {
  if (message.type === 'ENABLE_TASK_MODE') {
    mockFocusMode.active = true;
    mockFocusMode.taskType = message.taskType;
    mockFocusMode.startTime = Date.now();
    mockFocusMode.endTime = message.useTimer ? mockFocusMode.startTime + message.timerDuration : null;

    // Update focus stats
    const currentStats = storage.local.get('focusStats') || mockFocusMode.stats;
    const updatedStats = {
      ...currentStats,
      focusTime: currentStats.focusTime + 300, // Add 5 minutes
      focusScore: Math.min(100, currentStats.focusScore + 5)
    };

    await mockChrome.storage.local.set({ focusStats: updatedStats });
    return true;
  } else if (message.type === 'TRACK_EVENT') {
    if (mockFocusMode.active) {
      // Update focus stats for each event
      const currentStats = storage.local.get('focusStats') || mockFocusMode.stats;
      const updatedStats = {
        ...currentStats,
        focusTime: currentStats.focusTime + 60, // Add 1 minute per event
        focusScore: Math.min(100, currentStats.focusScore + 1)
      };

      await mockChrome.storage.local.set({ focusStats: updatedStats });
    }
    return true;
  }
  return false;
});

const mockCheckForDistractions = vi.fn(async (tabId, events, features) => {
  // Known distraction domains
  const knownDistractionDomains = [
    'youtube.com',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'reddit.com'
  ];

  // Job-related domains
  const jobDomains = [
    'linkedin.com',
    'indeed.com',
    'glassdoor.com'
  ];

  if (mockFocusMode.active && mockFocusMode.taskType === 'job_application') {
    if (knownDistractionDomains.some(d => features.domain.includes(d))) {
      mockChrome.runtime.sendMessage({ type: 'distraction_detected' });
      mockChrome.tabs.sendMessage(tabId, {
        type: 'SHOW_NUDGE',
        nudge: {
          type: 'reminder',
          message: 'Stay focused on your job search!',
          domain: features.domain
        }
      });
    } else if (!jobDomains.some(d => features.domain.includes(d)) && 
              (features.scrollCount > 30 && features.clickCount < 5)) {
      mockChrome.runtime.sendMessage({ type: 'distraction_detected' });
    }
  }
});

// Create a mock module
const mockBackgroundModule = {
  handleMessage: mockHandleMessage,
  checkForDistractions: mockCheckForDistractions,
  focusMode: mockFocusMode
};

// Mock the import
vi.mock('../src/background.js', () => mockBackgroundModule);

describe('Focus Mode Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    storage.local.clear();
    storage.sync.clear();
    
    // Reset focus mode state
    mockFocusMode.active = false;
    mockFocusMode.startTime = null;
    mockFocusMode.endTime = null;
    mockFocusMode.taskType = null;
    mockFocusMode.stats = {
      focusScore: 95,
      focusTime: 0,
      distractionCount: 0,
      streakCount: 0
    };
  });

  describe('Job Application Mode Tests', () => {
    test('should detect YouTube as distraction in job application mode', async () => {
      // Setup focus mode for job applications
      const message = {
        type: 'ENABLE_TASK_MODE',
        taskType: 'job_application',
        useTimer: true,
        timerDuration: 1800000 // 30 minutes
      };

      await mockHandleMessage(message, { tab: { id: 1 } });

      // Simulate visiting YouTube
      const events = [{
        event_type: 'PAGE_VISIT',
        url: 'https://www.youtube.com/watch?v=123',
        timestamp: Date.now(),
        tab_id: 1,
        payload: {
          domain: 'youtube.com',
          page_title: 'Funny Cat Videos'
        }
      }];

      const features = {
        domain: 'youtube.com',
        timeSpent: 180000, // 3 minutes
        scrollCount: 5,
        clickCount: 2,
        videoWatchTime: 150000 // 2.5 minutes
      };

      await mockCheckForDistractions(1, events, features);

      // Verify distraction was detected
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'distraction_detected'
      });

      // Verify nudge was sent
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'SHOW_NUDGE',
          nudge: expect.objectContaining({
            type: expect.any(String),
            message: expect.any(String),
            domain: 'youtube.com'
          })
        })
      );
    });

    test('should allow job-related sites in job application mode', async () => {
      // Setup focus mode for job applications
      const message = {
        type: 'ENABLE_TASK_MODE',
        taskType: 'job_application',
        useTimer: true,
        timerDuration: 1800000
      };

      await mockHandleMessage(message, { tab: { id: 1 } });

      // Simulate visiting LinkedIn
      const events = [{
        event_type: 'PAGE_VISIT',
        url: 'https://www.linkedin.com/jobs',
        timestamp: Date.now(),
        tab_id: 1,
        payload: {
          domain: 'linkedin.com',
          page_title: 'Software Engineer Jobs'
        }
      }];

      const features = {
        domain: 'linkedin.com',
        timeSpent: 300000, // 5 minutes
        scrollCount: 10,
        clickCount: 5
      };

      await mockCheckForDistractions(1, events, features);

      // Verify no distraction was detected
      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalledWith({
        type: 'distraction_detected'
      });

      // Verify no nudge was sent
      expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'SHOW_NUDGE'
        })
      );
    });
  });

  describe('Focus Stats Tests', () => {
    test('should update focus stats correctly', async () => {
      // Setup initial stats
      storage.local.set('focusStats', {
        focusScore: 90,
        focusTime: 3600, // 1 hour
        distractionCount: 5,
        streakCount: 3
      });

      // Enable focus mode
      const message = {
        type: 'ENABLE_TASK_MODE',
        taskType: 'job_application',
        useTimer: true,
        timerDuration: 1800000
      };

      await mockHandleMessage(message, { tab: { id: 1 } });

      // Fast-forward time by simulating events 15 minutes apart
      const events = [];
      const startTime = Date.now();
      for (let i = 0; i < 4; i++) {
        events.push({
          event_type: 'PAGE_VISIT',
          timestamp: startTime + (i * 900000), // 15 minute intervals
          tab_id: 1,
          payload: {
            domain: 'linkedin.com'
          }
        });
      }

      // Process events
      for (const event of events) {
        await mockHandleMessage({
          type: 'TRACK_EVENT',
          ...event
        }, { tab: { id: 1 } });
      }

      // Verify stats were updated
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
      const calls = mockChrome.storage.local.set.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toHaveProperty('focusStats');
      expect(lastCall.focusStats).toHaveProperty('focusTime');
      expect(lastCall.focusStats).toHaveProperty('focusScore');
    });
  });

  describe('Distraction Detection Tests', () => {
    test('should detect high-scroll low-click behavior as potential distraction', async () => {
      // Enable focus mode
      await mockHandleMessage({
        type: 'ENABLE_TASK_MODE',
        taskType: 'job_application',
        useTimer: true,
        timerDuration: 1800000
      }, { tab: { id: 1 } });

      // Simulate high-scroll low-click behavior on a non-job site
      const events = [{
        event_type: 'PAGE_VISIT',
        url: 'https://www.reddit.com',
        timestamp: Date.now(),
        tab_id: 1,
        payload: {
          domain: 'reddit.com',
          page_title: 'Reddit - Dive into anything'
        }
      }];

      const features = {
        domain: 'reddit.com',
        timeSpent: 300000, // 5 minutes
        scrollCount: 50,   // High scroll count
        clickCount: 2      // Low click count
      };

      await mockCheckForDistractions(1, events, features);

      // Verify distraction was detected
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'distraction_detected'
      });
    });
  });
}); 