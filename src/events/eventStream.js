/**
 * Focus Nudge - Event Stream Manager
 * 
 * This module manages the collection, buffering, and transmission of events
 * in the streaming architecture. It provides a unified interface for working
 * with the event stream across the extension.
 */

// We'll use dynamic imports for schema.js
let createEvent, EVENT_TYPES;

// Import schema module
async function importDependencies() {
  try {
    const schemaURL = chrome.runtime.getURL('src/events/schema.js');
    const schemaModule = await import(schemaURL);
    
    createEvent = schemaModule.createEvent;
    EVENT_TYPES = schemaModule.EVENT_TYPES;
    
    return true;
  } catch (error) {
    console.error('Failed to import schema module:', error);
    return false;
  }
}

// Configuration
const CONFIG = {
  bufferSize: 100,                // Max events to buffer before flushing
  flushInterval: 5000,            // Flush interval in ms (5 seconds)
  samplingRates: {                // Sampling rates for high-frequency events
    MOUSE_MOVE: 500,              // Sample mouse moves every 500ms
    PAGE_SCROLL: 250,             // Sample scrolls every 250ms
    VIDEO_PROGRESS: 1000          // Sample video progress every 1s
  },
  sessionTimeout: 30 * 60 * 1000, // Session timeout (30 minutes)
  compressionEnabled: true,       // Whether to compress events before sending
  persistEvents: true,            // Whether to persist events to IndexedDB
  debugMode: false                // Enable debug logging
};

// State
let eventBuffer = [];
let sessionId = null;
let sequenceCounter = 0;
let lastFlushTime = Date.now();
let flushTimer = null;
let samplingTimers = {};
let isInitialized = false;
let eventHandlers = [];
let currentTabId = null;

/**
 * Initialize the event stream
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
async function initialize(options = {}) {
  if (isInitialized) return true;
  
  try {
    // First, import dependencies
    const dependenciesLoaded = await importDependencies();
    if (!dependenciesLoaded) {
      throw new Error('Failed to load dependencies');
    }
    
    // Merge configuration options
    Object.assign(CONFIG, options);
    
    // Generate a new session ID
    sessionId = generateSessionId();
    
    // Reset sequence counter
    sequenceCounter = 0;
    
    // Get current tab ID if in content script context
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        const tabInfo = await new Promise(resolve => {
          chrome.runtime.sendMessage({ type: 'GET_TAB_INFO' }, resolve);
        });
        currentTabId = tabInfo?.tabId;
      } catch (e) {
        console.warn('Failed to get tab ID:', e);
      }
    }
    
    // Set up periodic flush
    flushTimer = setInterval(flushEvents, CONFIG.flushInterval);
    
    // Initialize event persistence if enabled
    if (CONFIG.persistEvents) {
      await initializeEventStorage();
    }
    
    // Log initialization
    if (CONFIG.debugMode) {
      console.log(`Event stream initialized with session ID: ${sessionId}`);
    }
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize event stream:', error);
    return false;
  }
}

/**
 * Clean up the event stream
 */
function cleanup() {
  if (!isInitialized) return;
  
  // Flush any remaining events
  flushEvents();
  
  // Clear timers
  clearInterval(flushTimer);
  Object.values(samplingTimers).forEach(timer => clearTimeout(timer));
  
  // Reset state
  eventBuffer = [];
  samplingTimers = {};
  isInitialized = false;
  
  if (CONFIG.debugMode) {
    console.log('Event stream cleaned up');
  }
}

/**
 * Track an event
 * @param {string} eventType - Type of event from EVENT_TYPES
 * @param {Object} payload - Event-specific data
 * @returns {Object} The created event
 */
function trackEvent(eventType, payload = {}) {
  if (!isInitialized) {
    console.warn('Event stream not initialized');
    return null;
  }
  
  // Check if this event type should be sampled
  if (CONFIG.samplingRates[eventType]) {
    const now = Date.now();
    const lastSampleTime = samplingTimers[eventType] || 0;
    
    // Skip if we've sampled this event type recently
    if (now - lastSampleTime < CONFIG.samplingRates[eventType]) {
      return null;
    }
    
    // Update last sample time
    samplingTimers[eventType] = now;
  }
  
  // Create the event
  const event = createEvent(eventType, payload, {
    session_id: sessionId,
    sequence_id: sequenceCounter++,
    tab_id: currentTabId
  });
  
  // Add to buffer
  eventBuffer.push(event);
  
  // Notify handlers
  notifyEventHandlers(event);
  
  // Flush if buffer is full
  if (eventBuffer.length >= CONFIG.bufferSize) {
    flushEvents();
  }
  
  return event;
}

/**
 * Flush events from buffer
 * @returns {Promise<boolean>} Whether flush was successful
 */
async function flushEvents() {
  if (eventBuffer.length === 0) return true;
  
  try {
    const eventsToFlush = [...eventBuffer];
    eventBuffer = [];
    lastFlushTime = Date.now();
    
    // Persist events if enabled
    if (CONFIG.persistEvents) {
      await persistEvents(eventsToFlush);
    }
    
    // Send events to background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        await new Promise(resolve => {
          chrome.runtime.sendMessage({
            type: 'STREAM_EVENTS',
            events: CONFIG.compressionEnabled ? compressEvents(eventsToFlush) : eventsToFlush
          }, resolve);
        });
      } catch (e) {
        console.warn('Failed to send events to background:', e);
        // Put events back in buffer
        eventBuffer = [...eventsToFlush, ...eventBuffer];
        return false;
      }
    }
    
    if (CONFIG.debugMode) {
      console.log(`Flushed ${eventsToFlush.length} events`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to flush events:', error);
    return false;
  }
}

/**
 * Register an event handler
 * @param {Function} handler - Function to call for each event
 * @returns {Function} Function to unregister the handler
 */
function registerEventHandler(handler) {
  if (typeof handler !== 'function') {
    throw new Error('Event handler must be a function');
  }
  
  eventHandlers.push(handler);
  
  // Return unregister function
  return () => {
    const index = eventHandlers.indexOf(handler);
    if (index !== -1) {
      eventHandlers.splice(index, 1);
    }
  };
}

/**
 * Notify all event handlers of a new event
 * @param {Object} event - The event to notify about
 */
function notifyEventHandlers(event) {
  eventHandlers.forEach(handler => {
    try {
      handler(event);
    } catch (error) {
      console.error('Error in event handler:', error);
    }
  });
}

/**
 * Generate a unique session ID
 * @returns {string} Session ID
 */
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Initialize event storage
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initializeEventStorage() {
  // Implementation depends on storage mechanism (IndexedDB, etc.)
  // For now, we'll just return true
  return true;
}

/**
 * Persist events to storage
 * @param {Array} events - Events to persist
 * @returns {Promise<boolean>} Whether persistence was successful
 */
async function persistEvents(events) {
  // Implementation depends on storage mechanism (IndexedDB, etc.)
  // For now, we'll just return true
  return true;
}

/**
 * Compress events for transmission
 * @param {Array} events - Events to compress
 * @returns {Object} Compressed events
 */
function compressEvents(events) {
  // Simple implementation - in a real system, we'd use a proper compression algorithm
  // For now, we'll just return the events
  return events;
}

/**
 * Get current session information
 * @returns {Object} Session information
 */
function getSessionInfo() {
  return {
    sessionId,
    sequenceCounter,
    bufferSize: eventBuffer.length,
    lastFlushTime
  };
}

export {
  initialize,
  cleanup,
  trackEvent,
  flushEvents,
  registerEventHandler,
  getSessionInfo,
  EVENT_TYPES
}; 