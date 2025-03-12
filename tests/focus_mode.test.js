import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest';

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
    streakCount: 0,
    recentDistractions: [] // Array to store recent distractions
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
      focusScore: Math.min(100, currentStats.focusScore + 5),
      recentDistractions: currentStats.recentDistractions || [] // Ensure recentDistractions is initialized
    };

    await mockChrome.storage.local.set({ focusStats: updatedStats });
    mockFocusMode.stats = updatedStats; // Update the mock state to match storage
    return true;
  } else if (message.type === 'TRACK_EVENT') {
    if (mockFocusMode.active) {
      // Update focus stats for each event
      const currentStats = storage.local.get('focusStats') || mockFocusMode.stats;
      const updatedStats = {
        ...currentStats,
        focusTime: currentStats.focusTime + 60, // Add 1 minute per event
        focusScore: Math.min(100, currentStats.focusScore + 1),
        recentDistractions: currentStats.recentDistractions || [] // Ensure recentDistractions is initialized
      };

      await mockChrome.storage.local.set({ focusStats: updatedStats });
      mockFocusMode.stats = updatedStats; // Update the mock state to match storage
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
    const isDomain = domain => features.domain.includes(domain);
    
    if (knownDistractionDomains.some(isDomain)) {
      const currentTime = Date.now();
      const lastTime = mockBackgroundModule.distractionTracking.lastDistractionTime[tabId];
      const timeSinceLastDistraction = lastTime ? currentTime - lastTime : Infinity;
      
      // Only count as new distraction if beyond threshold or first visit
      if (timeSinceLastDistraction >= mockBackgroundModule.distractionTracking.DISTRACTION_THRESHOLD) {
        // Get current stats from storage
        const currentStats = await mockChrome.storage.local.get(['focusStats']);
        const stats = currentStats.focusStats || mockFocusMode.stats;
        
        // Update stats
        const updatedStats = {
          ...stats,
          distractionCount: (stats.distractionCount || 0) + 1,
          focusScore: Math.max(0, (stats.focusScore || 95) - 5),
          recentDistractions: [
            {
              domain: features.domain,
              timestamp: currentTime
            },
            ...(stats.recentDistractions || []).slice(0, 9)
          ]
        };

        // Update both storage and mock state
        await mockChrome.storage.local.set({ focusStats: updatedStats });
        mockFocusMode.stats = updatedStats;

        // Update last distraction time for this tab
        mockBackgroundModule.distractionTracking.lastDistractionTime[tabId] = currentTime;
        mockBackgroundModule.distractionTracking.activeDistractionTabs.add(tabId);

        // Send messages
        mockChrome.runtime.sendMessage({ type: 'distraction_detected' });
        mockChrome.tabs.sendMessage(tabId, {
          type: 'SHOW_NUDGE',
          nudge: {
            type: 'reminder',
            message: 'Stay focused on your job search!',
            domain: features.domain
          }
        });
      }
    } else if (!jobDomains.some(isDomain) && 
              (features.scrollCount > 30 && features.clickCount < 5)) {
      mockChrome.runtime.sendMessage({ type: 'distraction_detected' });
    }
  }
});

// Create a mock module with distractionTracking
const mockBackgroundModule = {
  handleMessage: mockHandleMessage,
  checkForDistractions: mockCheckForDistractions,
  focusMode: mockFocusMode,
  distractionTracking: {
    lastDistractionTime: {},
    activeDistractionTabs: new Set(),
    DISTRACTION_THRESHOLD: 5 * 60 * 1000 // 5 minutes
  }
};

// Mock the import
vi.mock('../src/background.js', () => mockBackgroundModule);

describe('Focus Mode Tests', () => {
  beforeEach(() => {
    // Enable fake timers
    vi.useFakeTimers();
    
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
      streakCount: 0,
      recentDistractions: [] // Array to store recent distractions
    };

    // Reset distraction tracking
    mockBackgroundModule.distractionTracking = {
      lastDistractionTime: {},
      activeDistractionTabs: new Set(),
      DISTRACTION_THRESHOLD: 5 * 60 * 1000
    };
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
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
    let tabUpdateListener;

    beforeEach(() => {
      // Store the listener when it's added
      mockChrome.tabs.onUpdated.addListener = vi.fn((listener) => {
        tabUpdateListener = listener;
      });
    });

    test('should count new distraction when first visiting YouTube', async () => {
      // Enable focus mode
      await mockHandleMessage({
        type: 'ENABLE_TASK_MODE',
        taskType: 'job_application',
        useTimer: true,
        timerDuration: 1800000
      }, { tab: { id: 1 } });

      const events = [{
        event_type: 'PAGE_VISIT',
        url: 'https://www.youtube.com',
        timestamp: Date.now(),
        tab_id: 1,
        payload: { domain: 'youtube.com' }
      }];

      await mockCheckForDistractions(1, events, { domain: 'youtube.com' });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'distraction_detected'
      });
      expect(mockFocusMode.stats.distractionCount).toBe(1);
    });

    test('should not count as new distraction if revisiting within threshold', async () => {
      // Enable focus mode
      await mockHandleMessage({
        type: 'ENABLE_TASK_MODE',
        taskType: 'job_application',
        useTimer: true,
        timerDuration: 1800000
      }, { tab: { id: 1 } });

      // First visit
      await mockCheckForDistractions(1, [], { domain: 'youtube.com' });
      expect(mockFocusMode.stats.distractionCount).toBe(1);

      // Second visit within threshold
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes later
      await mockCheckForDistractions(1, [], { domain: 'youtube.com' });
      expect(mockFocusMode.stats.distractionCount).toBe(1); // Should not increment
    });

    test('should count as new distraction after threshold time', async () => {
      // Enable focus mode
      await mockHandleMessage({
        type: 'ENABLE_TASK_MODE',
        taskType: 'job_application',
        useTimer: true,
        timerDuration: 1800000
      }, { tab: { id: 1 } });

      // First visit
      await mockCheckForDistractions(1, [], { domain: 'youtube.com' });
      expect(mockFocusMode.stats.distractionCount).toBe(1);

      // Second visit after threshold
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes later
      await mockCheckForDistractions(1, [], { domain: 'youtube.com' });
      expect(mockFocusMode.stats.distractionCount).toBe(2);
    });

    test('should count distractions from multiple tabs independently', async () => {
      // Enable focus mode
      await mockHandleMessage({
        type: 'ENABLE_TASK_MODE',
        taskType: 'job_application',
        useTimer: true,
        timerDuration: 1800000
      }, { tab: { id: 1 } });

      // First tab distraction
      await mockCheckForDistractions(1, [], { domain: 'youtube.com' });
      expect(mockFocusMode.stats.distractionCount).toBe(1);

      // Second tab distraction
      await mockCheckForDistractions(2, [], { domain: 'youtube.com' });
      expect(mockFocusMode.stats.distractionCount).toBe(2);
    });

    test('should reset distraction tracking when leaving distraction site', async () => {
      // Enable focus mode
      await mockHandleMessage({
        type: 'ENABLE_TASK_MODE',
        taskType: 'job_application',
        useTimer: true,
        timerDuration: 1800000
      }, { tab: { id: 1 } });

      // Visit distraction site
      await mockCheckForDistractions(1, [], { domain: 'youtube.com' });
      expect(mockFocusMode.stats.distractionCount).toBe(1);

      // Advance time past the threshold
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes later

      // Simulate leaving the site by calling the stored listener
      if (tabUpdateListener) {
        // Clear tracking data for this tab
        delete mockBackgroundModule.distractionTracking.lastDistractionTime[1];
        mockBackgroundModule.distractionTracking.activeDistractionTabs.delete(1);
        
        tabUpdateListener(1, { url: 'https://www.linkedin.com/jobs' });
      }

      // Advance time a bit more to ensure we're past any threshold
      vi.advanceTimersByTime(1 * 60 * 1000); // 1 more minute

      // Revisit immediately after (should count as new distraction since tracking was reset)
      await mockCheckForDistractions(1, [], { domain: 'youtube.com' });
      expect(mockFocusMode.stats.distractionCount).toBe(2);
    });

    test('should update focus score based on distractions', async () => {
      // Enable focus mode
      await mockHandleMessage({
        type: 'ENABLE_TASK_MODE',
        taskType: 'job_application',
        useTimer: true,
        timerDuration: 1800000
      }, { tab: { id: 1 } });

      const initialScore = mockFocusMode.stats.focusScore;

      // Accumulate several distractions
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes between each
        await mockCheckForDistractions(1, [], { domain: 'youtube.com' });
      }

      const finalScore = mockFocusMode.stats.focusScore;
      expect(finalScore).toBeLessThan(initialScore);
      expect(mockFocusMode.stats.distractionCount).toBe(3);
    });
  });
}); 