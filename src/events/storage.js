/**
 * Focus Nudge - Event Storage Service
 * 
 * This module provides storage services for the event stream using IndexedDB.
 * It handles persisting events, retrieving event history, and managing storage limits.
 */

// Database configuration
const DB_CONFIG = {
  name: 'FocusNudgeEvents',
  version: 1,
  stores: {
    events: {
      keyPath: 'id',
      indexes: [
        { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
        { name: 'session_id', keyPath: 'session_id', options: { unique: false } },
        { name: 'event_type', keyPath: 'event_type', options: { unique: false } },
        { name: 'url', keyPath: 'url', options: { unique: false } }
      ]
    },
    sessions: {
      keyPath: 'session_id',
      indexes: [
        { name: 'start_time', keyPath: 'start_time', options: { unique: false } },
        { name: 'end_time', keyPath: 'end_time', options: { unique: false } }
      ]
    }
  },
  maxEvents: 100000,           // Maximum number of events to store
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  pruneThreshold: 0.9,         // Prune when storage is 90% full
  compressionEnabled: true     // Whether to compress stored events
};

// Database instance
let db = null;
let isInitialized = false;

/**
 * Initialize the event storage
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initialize() {
  if (isInitialized) return true;
  
  try {
    // Open database
    db = await openDatabase();
    
    // Check storage usage and prune if necessary
    await pruneOldEvents();
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize event storage:', error);
    return false;
  }
}

/**
 * Open the IndexedDB database
 * @returns {Promise<IDBDatabase>} Database instance
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores and indexes
      for (const [storeName, storeConfig] of Object.entries(DB_CONFIG.stores)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: storeConfig.keyPath });
          
          // Create indexes
          for (const index of storeConfig.indexes) {
            store.createIndex(index.name, index.keyPath, index.options);
          }
        }
      }
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(new Error(`Failed to open database: ${event.target.error}`));
    };
  });
}

/**
 * Store events in the database
 * @param {Array} events - Events to store
 * @returns {Promise<boolean>} Whether storage was successful
 */
async function storeEvents(events) {
  if (!isInitialized) {
    await initialize();
  }
  
  if (!events || events.length === 0) return true;
  
  try {
    // Add unique IDs to events if they don't have them
    const eventsToStore = events.map(event => ({
      ...event,
      id: event.id || `${event.session_id}-${event.sequence_id}`
    }));
    
    // Store events in transaction
    await runTransaction('events', 'readwrite', store => {
      eventsToStore.forEach(event => {
        store.add(DB_CONFIG.compressionEnabled ? compressEvent(event) : event);
      });
    });
    
    return true;
  } catch (error) {
    console.error('Failed to store events:', error);
    return false;
  }
}

/**
 * Retrieve events from the database
 * @param {Object} options - Query options
 * @param {string} options.sessionId - Filter by session ID
 * @param {string} options.eventType - Filter by event type
 * @param {string} options.url - Filter by URL
 * @param {number} options.startTime - Filter by start time
 * @param {number} options.endTime - Filter by end time
 * @param {number} options.limit - Maximum number of events to retrieve
 * @param {boolean} options.reverse - Whether to retrieve in reverse order
 * @returns {Promise<Array>} Retrieved events
 */
async function getEvents(options = {}) {
  if (!isInitialized) {
    await initialize();
  }
  
  try {
    let index = 'timestamp';
    let range = null;
    
    // Determine which index to use
    if (options.sessionId) {
      index = 'session_id';
      range = IDBKeyRange.only(options.sessionId);
    } else if (options.eventType) {
      index = 'event_type';
      range = IDBKeyRange.only(options.eventType);
    } else if (options.url) {
      index = 'url';
      range = IDBKeyRange.only(options.url);
    } else if (options.startTime && options.endTime) {
      index = 'timestamp';
      range = IDBKeyRange.bound(options.startTime, options.endTime);
    } else if (options.startTime) {
      index = 'timestamp';
      range = IDBKeyRange.lowerBound(options.startTime);
    } else if (options.endTime) {
      index = 'timestamp';
      range = IDBKeyRange.upperBound(options.endTime);
    }
    
    // Retrieve events
    const events = await runTransaction('events', 'readonly', store => {
      return getAllFromIndex(store, index, range, options.limit, options.reverse);
    });
    
    // Decompress events if necessary
    return events.map(event => 
      DB_CONFIG.compressionEnabled ? decompressEvent(event) : event
    );
  } catch (error) {
    console.error('Failed to retrieve events:', error);
    return [];
  }
}

/**
 * Get all records from an index
 * @param {IDBObjectStore} store - Object store
 * @param {string} indexName - Index name
 * @param {IDBKeyRange} range - Key range
 * @param {number} limit - Maximum number of records
 * @param {boolean} reverse - Whether to retrieve in reverse order
 * @returns {Promise<Array>} Retrieved records
 */
function getAllFromIndex(store, indexName, range, limit, reverse) {
  return new Promise((resolve, reject) => {
    const index = store.index(indexName);
    const request = index.openCursor(range, reverse ? 'prev' : 'next');
    const results = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      
      if (cursor && (!limit || results.length < limit)) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    
    request.onerror = (event) => {
      reject(new Error(`Failed to retrieve records: ${event.target.error}`));
    };
  });
}

/**
 * Run a transaction on an object store
 * @param {string} storeName - Object store name
 * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
 * @param {Function} callback - Transaction callback
 * @returns {Promise<any>} Transaction result
 */
function runTransaction(storeName, mode, callback) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    
    let result;
    try {
      result = callback(store);
    } catch (error) {
      reject(error);
      return;
    }
    
    transaction.oncomplete = () => {
      resolve(result);
    };
    
    transaction.onerror = (event) => {
      reject(new Error(`Transaction failed: ${event.target.error}`));
    };
  });
}

/**
 * Prune old events to stay within storage limits
 * @returns {Promise<number>} Number of events pruned
 */
async function pruneOldEvents() {
  if (!isInitialized) return 0;
  
  try {
    // Get event count
    const count = await runTransaction('events', 'readonly', store => {
      return new Promise((resolve) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      });
    });
    
    // Check if we need to prune
    if (count < DB_CONFIG.maxEvents * DB_CONFIG.pruneThreshold) {
      return 0;
    }
    
    // Calculate cutoff time for age-based pruning
    const cutoffTime = Date.now() - DB_CONFIG.maxAge;
    
    // Get events to prune
    const oldEvents = await getEvents({
      endTime: cutoffTime,
      limit: count - Math.floor(DB_CONFIG.maxEvents * 0.7) // Prune down to 70% capacity
    });
    
    if (oldEvents.length === 0) return 0;
    
    // Delete old events
    await runTransaction('events', 'readwrite', store => {
      oldEvents.forEach(event => {
        store.delete(event.id);
      });
    });
    
    return oldEvents.length;
  } catch (error) {
    console.error('Failed to prune old events:', error);
    return 0;
  }
}

/**
 * Clear all events from storage
 * @returns {Promise<boolean>} Whether clear was successful
 */
async function clearEvents() {
  if (!isInitialized) {
    await initialize();
  }
  
  try {
    await runTransaction('events', 'readwrite', store => {
      store.clear();
    });
    
    return true;
  } catch (error) {
    console.error('Failed to clear events:', error);
    return false;
  }
}

/**
 * Compress an event for storage
 * @param {Object} event - Event to compress
 * @returns {Object} Compressed event
 */
function compressEvent(event) {
  // In a real implementation, we would use a compression algorithm
  // For now, we'll just return the event
  return event;
}

/**
 * Decompress an event from storage
 * @param {Object} event - Compressed event
 * @returns {Object} Decompressed event
 */
function decompressEvent(event) {
  // In a real implementation, we would use a decompression algorithm
  // For now, we'll just return the event
  return event;
}

/**
 * Get storage statistics
 * @returns {Promise<Object>} Storage statistics
 */
async function getStorageStats() {
  if (!isInitialized) {
    await initialize();
  }
  
  try {
    // Get event count
    const eventCount = await runTransaction('events', 'readonly', store => {
      return new Promise((resolve) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      });
    });
    
    // Get session count
    const sessionCount = await runTransaction('sessions', 'readonly', store => {
      return new Promise((resolve) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      });
    });
    
    // Get oldest event timestamp
    const oldestEvent = await getEvents({
      limit: 1
    });
    
    // Get newest event timestamp
    const newestEvent = await getEvents({
      limit: 1,
      reverse: true
    });
    
    return {
      eventCount,
      sessionCount,
      oldestEventTime: oldestEvent[0]?.timestamp || null,
      newestEventTime: newestEvent[0]?.timestamp || null,
      maxEvents: DB_CONFIG.maxEvents,
      maxAge: DB_CONFIG.maxAge,
      compressionEnabled: DB_CONFIG.compressionEnabled
    };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return {
      eventCount: 0,
      sessionCount: 0,
      oldestEventTime: null,
      newestEventTime: null,
      maxEvents: DB_CONFIG.maxEvents,
      maxAge: DB_CONFIG.maxAge,
      compressionEnabled: DB_CONFIG.compressionEnabled
    };
  }
}

export {
  initialize,
  storeEvents,
  getEvents,
  clearEvents,
  pruneOldEvents,
  getStorageStats
}; 