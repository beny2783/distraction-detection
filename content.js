/**
 * Focus Nudge - Content Script
 * 
 * This script is injected into web pages to track user interactions
 * and detect potential distractions.
 */

// Configuration
const CONFIG = {
  eventBufferSize: 100,         // Number of events to buffer before sending
  eventBufferTimeWindow: 5 * 60 * 1000, // 5 minutes in milliseconds
  scrollSampleRate: 250,        // Capture scroll events every 250ms
  mouseSampleRate: 500,         // Capture mouse position every 500ms
  classificationInterval: 30000 // Run classification every 30 seconds
};

// Event buffer to store user interactions
let eventBuffer = [];
let lastScrollTime = 0;
let lastMouseMoveTime = 0;
let pageLoadTime = Date.now();
let lastClassificationTime = Date.now();

// Initialize IndexedDB
let db;
const initDatabase = () => {
  const request = indexedDB.open('FocusNudgeDB', 1);
  
  request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains('events')) {
      const eventStore = db.createObjectStore('events', { autoIncrement: true });
      eventStore.createIndex('timestamp', 'timestamp', { unique: false });
    }
    
    if (!db.objectStoreNames.contains('sessions')) {
      const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
      sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
    }
  };
  
  request.onsuccess = (event) => {
    db = event.target.result;
    console.log('FocusNudge: Database initialized');
  };
  
  request.onerror = (event) => {
    console.error('FocusNudge: Database error:', event.target.error);
  };
};

// Store events in IndexedDB
const storeEvents = (events) => {
  if (!db) return;
  
  const transaction = db.transaction(['events'], 'readwrite');
  const store = transaction.objectStore('events');
  
  events.forEach(event => {
    store.add(event);
  });
};

// Capture page metadata
const capturePageMetadata = () => {
  return {
    type: 'page_metadata',
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname,
    timestamp: Date.now(),
    pageContent: document.body.innerText.substring(0, 1000), // First 1000 chars for content analysis
    pageLoadTime: pageLoadTime
  };
};

// Track scroll events
const trackScroll = () => {
  const now = Date.now();
  if (now - lastScrollTime < CONFIG.scrollSampleRate) return;
  
  lastScrollTime = now;
  const scrollDepth = window.scrollY / (document.body.scrollHeight - window.innerHeight);
  
  eventBuffer.push({
    type: 'scroll',
    scrollY: window.scrollY,
    scrollDepth: scrollDepth,
    timestamp: now,
    url: window.location.href // Add URL to ensure it's valid
  });
};

// Track mouse movements
const trackMouseMovement = (event) => {
  const now = Date.now();
  if (now - lastMouseMoveTime < CONFIG.mouseSampleRate) return;
  
  lastMouseMoveTime = now;
  eventBuffer.push({
    type: 'mouse_move',
    x: event.clientX,
    y: event.clientY,
    timestamp: now,
    url: window.location.href // Add URL to ensure it's valid
  });
};

// Track mouse clicks
const trackMouseClick = (event) => {
  eventBuffer.push({
    type: 'mouse_click',
    x: event.clientX,
    y: event.clientY,
    target: event.target.tagName,
    timestamp: Date.now(),
    url: window.location.href // Add URL to ensure it's valid
  });
};

// Track video interactions
const trackVideoInteractions = () => {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (!video.hasEventListeners) {
      video.addEventListener('play', () => {
        eventBuffer.push({
          type: 'video_play',
          duration: video.duration,
          currentTime: video.currentTime,
          timestamp: Date.now(),
          url: window.location.href // Add URL to ensure it's valid
        });
      });
      
      video.addEventListener('pause', () => {
        eventBuffer.push({
          type: 'video_pause',
          duration: video.duration,
          currentTime: video.currentTime,
          timestamp: Date.now(),
          url: window.location.href // Add URL to ensure it's valid
        });
      });
      
      video.addEventListener('timeupdate', () => {
        // Sample video progress every 5 seconds
        if (Math.floor(video.currentTime) % 5 === 0) {
          eventBuffer.push({
            type: 'video_progress',
            duration: video.duration,
            currentTime: video.currentTime,
            timestamp: Date.now(),
            url: window.location.href // Add URL to ensure it's valid
          });
        }
      });
      
      video.hasEventListeners = true;
    }
  });
};

/**
 * Check if the extension context is valid
 * @returns {boolean} - Whether the extension context is valid
 */
function isExtensionContextValid() {
  try {
    // Try to access chrome.runtime.id, which will throw if context is invalidated
    return Boolean(chrome.runtime.id);
  } catch (e) {
    console.warn('Extension context has been invalidated:', e);
    return false;
  }
}

/**
 * Safely send a message to the background script
 * @param {Object} message - Message to send
 * @returns {Promise<any>} - Response from the background script
 */
function safelySendMessage(message) {
  return new Promise((resolve, reject) => {
    if (!isExtensionContextValid()) {
      reject(new Error('Extension context invalidated'));
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Process the event buffer and send to background script
const processEventBuffer = () => {
  if (eventBuffer.length === 0) return;
  
  if (!isExtensionContextValid()) {
    console.warn('Not processing event buffer due to invalidated extension context');
    return;
  }
  
  // Add page metadata to each event and ensure URL is valid
  const metadata = capturePageMetadata();
  const validEvents = eventBuffer.filter(event => {
    // Ensure each event has a valid URL
    if (!event.url || event.url.trim() === '') {
      event.url = metadata.url;
    }
    
    // Ensure timestamp exists
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    
    // Validate URL format
    try {
      // Basic URL validation
      return event.url && 
             event.url.trim() !== '' && 
             (event.url.startsWith('http://') || event.url.startsWith('https://'));
    } catch (e) {
      console.warn('Filtering out event with invalid URL:', event);
      return false;
    }
  });
  
  // Only send if we have valid events
  if (validEvents.length === 0) {
    console.warn('No valid events to send after filtering');
    eventBuffer = []; // Clear buffer since all events were invalid
    return;
  }
  
  safelySendMessage({
    type: 'events',
    events: validEvents
  }).then(response => {
    if (response && response.success) {
      // Clear the buffer after successful processing
      eventBuffer = [];
    }
  }).catch(error => {
    console.error('Failed to send events:', error);
  });
};

// Send nudge feedback to background script
const sendNudgeFeedback = (nudgeType, url, helpful) => {
  if (!isExtensionContextValid()) {
    console.warn('Not sending nudge feedback due to invalidated extension context');
    return;
  }
  
  safelySendMessage({
    type: 'nudge_feedback',
    nudgeType,
    url,
    helpful
  }).then(response => {
    console.log('Nudge feedback sent:', response);
  }).catch(error => {
    console.error('Failed to send nudge feedback:', error);
  });
};

// Check if the current page is a distraction
const checkDistraction = () => {
  const metadata = capturePageMetadata();
  
  if (!isExtensionContextValid()) {
    console.warn('Not checking distraction due to invalidated extension context');
    return;
  }
  
  safelySendMessage({
    type: 'classify',
    url: metadata.url,
    title: metadata.title
  }).then(response => {
    if (!response) return;
    
    if (response.isDistracted) {
      showNudge(response.message, response.nudgeType);
    }
  }).catch(error => {
    console.error('Failed to check distraction:', error);
  });
};

// Run classification to check if current page is a distraction
const runClassification = () => {
  // Check if extension context is valid
  if (!isExtensionContextValid()) {
    console.warn('FocusNudge: Extension context invalidated, cannot run classification');
    return;
  }
  
  const now = Date.now();
  // Only run classification every CONFIG.classificationInterval milliseconds
  if (now - lastClassificationTime < CONFIG.classificationInterval) {
    return;
  }
  
  lastClassificationTime = now;
  const metadata = capturePageMetadata();
  
  console.log('FocusNudge: Running classification for URL:', metadata.url);
  
  safelySendMessage({
    type: 'classify',
    url: metadata.url,
    title: metadata.title
  }).then(response => {
    if (!response) return;
    
    console.log('FocusNudge: Classification result:', response);
    
    if (response && response.isDistracted) {
      console.log('FocusNudge: Detected distraction, showing nudge');
      // The background script already sends the nudge in the classify response
      if (response.nudgeType && response.message) {
        showNudge({
          nudgeType: response.nudgeType,
          message: response.message
        });
      }
    }
  }).catch(error => {
    console.error('Failed to check distraction:', error);
  });
};

// Show nudge to the user
const showNudge = (nudgeData) => {
  // Handle both formats: direct parameters or object
  const type = typeof nudgeData === 'object' ? nudgeData.nudgeType : nudgeData;
  const message = typeof nudgeData === 'object' ? nudgeData.message : arguments[1];
  
  console.log('FocusNudge: Showing nudge of type:', type, 'with message:', message);
  
  // Create nudge element if it doesn't exist
  let nudgeElement = document.getElementById('focus-nudge-overlay');
  if (!nudgeElement) {
    nudgeElement = document.createElement('div');
    nudgeElement.id = 'focus-nudge-overlay';
    nudgeElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: rgba(255, 255, 255, 0.98);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      padding: 20px;
      z-index: 2147483647; /* Highest possible z-index */
      font-family: Arial, sans-serif;
      max-width: 350px;
      transition: all 0.3s ease-in-out;
      border-left: 5px solid #4285F4;
      opacity: 0;
      transform: translateY(-10px);
    `;
    document.body.appendChild(nudgeElement);
    
    // Animate in
    setTimeout(() => {
      nudgeElement.style.opacity = '1';
      nudgeElement.style.transform = 'translateY(0)';
    }, 10);
  } else {
    // Reset opacity and transform for existing element
    nudgeElement.style.opacity = '1';
    nudgeElement.style.transform = 'translateY(0)';
  }
  
  // Set border color based on nudge type
  let borderColor = '#4285F4'; // Default blue
  let typeIcon = '💡'; // Default icon
  
  switch (type) {
    case 'reminder':
      borderColor = '#4285F4'; // Blue
      typeIcon = '⏰';
      break;
    case 'reflection':
      borderColor = '#9C27B0'; // Purple
      typeIcon = '🤔';
      break;
    case 'suggestion':
      borderColor = '#0F9D58'; // Green
      typeIcon = '💡';
      break;
    case 'stats':
      borderColor = '#F4B400'; // Yellow
      typeIcon = '📊';
      break;
    case 'test':
      borderColor = '#DB4437'; // Red
      typeIcon = '🧪';
      break;
  }
  
  nudgeElement.style.borderLeft = `5px solid ${borderColor}`;
  
  // Set nudge content
  nudgeElement.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="margin: 0; color: #333; font-size: 18px; display: flex; align-items: center;">
        <span style="margin-right: 8px; font-size: 20px;">${typeIcon}</span>
        Focus Nudge
      </h3>
      <button id="focus-nudge-close" style="background: none; border: none; cursor: pointer; font-size: 20px; color: #666; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s;">×</button>
    </div>
    <p style="margin: 0 0 15px 0; color: #333; font-size: 15px; line-height: 1.4;">${message}</p>
    <div style="display: flex; justify-content: space-between;">
      <button id="focus-nudge-helpful" style="background: #0F9D58; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.2s;">Helpful</button>
      <button id="focus-nudge-not-helpful" style="background: #DB4437; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.2s;">Not Helpful</button>
    </div>
  `;
  
  // Add event listeners with hover effects
  const closeButton = document.getElementById('focus-nudge-close');
  closeButton.addEventListener('mouseover', () => {
    closeButton.style.background = 'rgba(0, 0, 0, 0.1)';
  });
  
  closeButton.addEventListener('mouseout', () => {
    closeButton.style.background = 'none';
  });
  
  closeButton.addEventListener('click', () => {
    nudgeElement.style.opacity = '0';
    nudgeElement.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      if (nudgeElement.parentNode) {
        nudgeElement.remove();
      }
    }, 300);
  });
  
  const helpfulButton = document.getElementById('focus-nudge-helpful');
  helpfulButton.addEventListener('mouseover', () => {
    helpfulButton.style.background = '#0B8043';
  });
  
  helpfulButton.addEventListener('mouseout', () => {
    helpfulButton.style.background = '#0F9D58';
  });
  
  helpfulButton.addEventListener('click', () => {
    sendNudgeFeedback(type, window.location.href, true);
    
    // Show thank you message
    nudgeElement.innerHTML = `
      <div style="text-align: center; padding: 10px;">
        <h3 style="margin: 0 0 10px 0; color: #333;">Thanks for your feedback!</h3>
        <p style="margin: 0; color: #555;">We'll use it to improve your experience.</p>
      </div>
    `;
    
    setTimeout(() => {
      nudgeElement.style.opacity = '0';
      nudgeElement.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (nudgeElement.parentNode) {
          nudgeElement.remove();
        }
      }, 300);
    }, 1500);
  });
  
  const notHelpfulButton = document.getElementById('focus-nudge-not-helpful');
  notHelpfulButton.addEventListener('mouseover', () => {
    notHelpfulButton.style.background = '#C53929';
  });
  
  notHelpfulButton.addEventListener('mouseout', () => {
    notHelpfulButton.style.background = '#DB4437';
  });
  
  notHelpfulButton.addEventListener('click', () => {
    sendNudgeFeedback(type, window.location.href, false);
    
    // Show thank you message
    nudgeElement.innerHTML = `
      <div style="text-align: center; padding: 10px;">
        <h3 style="margin: 0 0 10px 0; color: #333;">Thanks for your feedback!</h3>
        <p style="margin: 0; color: #555;">We'll use it to improve your experience.</p>
      </div>
    `;
    
    setTimeout(() => {
      nudgeElement.style.opacity = '0';
      nudgeElement.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (nudgeElement.parentNode) {
          nudgeElement.remove();
        }
      }, 300);
    }, 1500);
  });
  
  // Auto-hide after 15 seconds
  setTimeout(() => {
    if (nudgeElement.parentNode) {
      nudgeElement.style.opacity = '0';
      nudgeElement.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (nudgeElement.parentNode) {
          nudgeElement.remove();
        }
      }, 300);
    }
  }, 15000);
};

// Set up periodic tasks with error handling
const setupPeriodicTasks = () => {
  let intervalId = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 5000; // 5 seconds
  
  // Function to start the periodic tasks
  const startTasks = () => {
    if (intervalId) {
      clearInterval(intervalId); // Clear any existing interval
    }
    
    intervalId = setInterval(() => {
      try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
          console.warn('FocusNudge: Extension context invalidated, pausing periodic tasks');
          clearInterval(intervalId);
          intervalId = null;
          
          // Try to reconnect after a delay
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`FocusNudge: Will attempt to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${RECONNECT_DELAY/1000} seconds`);
            
            setTimeout(() => {
              console.log('FocusNudge: Attempting to reconnect...');
              if (isExtensionContextValid()) {
                console.log('FocusNudge: Reconnection successful, resuming tasks');
                reconnectAttempts = 0;
                startTasks();
              } else if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                // Will try again in the next scheduled attempt
                console.log('FocusNudge: Reconnection failed, will try again');
              } else {
                console.warn('FocusNudge: Maximum reconnection attempts reached, giving up');
              }
            }, RECONNECT_DELAY);
          }
          return;
        }
        
        trackVideoInteractions();
        processEventBuffer();
        runClassification();
      } catch (error) {
        console.error('FocusNudge: Error in periodic tasks:', error);
        
        // If we encounter a context invalidated error, stop the interval and try to reconnect
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.warn('FocusNudge: Extension context invalidated error caught, pausing tasks');
          clearInterval(intervalId);
          intervalId = null;
          
          // Try to reconnect after a delay (same logic as above)
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            setTimeout(() => {
              if (isExtensionContextValid()) {
                reconnectAttempts = 0;
                startTasks();
              }
            }, RECONNECT_DELAY);
          }
        }
      }
    }, 1000);
    
    return intervalId;
  };
  
  // Start the tasks initially
  startTasks();
  
  // Return a function that can be used to stop the tasks
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
};

// Initialize with reconnection support
const initialize = () => {
  try {
    // Check if extension context is valid
    if (!isExtensionContextValid()) {
      console.warn('FocusNudge: Extension context invalidated, cannot initialize');
      
      // Set up a reconnection attempt
      const attemptReconnect = () => {
        console.log('FocusNudge: Attempting to initialize after context invalidation...');
        if (isExtensionContextValid()) {
          console.log('FocusNudge: Context is now valid, initializing');
          initialize();
        } else {
          // Try again after a delay
          setTimeout(attemptReconnect, 5000);
        }
      };
      
      setTimeout(attemptReconnect, 5000);
      return;
    }
    
    // Initialize IndexedDB
    initDatabase();
    
    // Capture initial page metadata
    const metadata = capturePageMetadata();
    eventBuffer.push(metadata);
    
    // Set up event listeners
    window.addEventListener('scroll', trackScroll, { passive: true });
    window.addEventListener('mousemove', trackMouseMovement, { passive: true });
    window.addEventListener('click', trackMouseClick, { passive: true });
    
    // Track tab visibility changes
    document.addEventListener('visibilitychange', () => {
      if (isExtensionContextValid()) {
        eventBuffer.push({
          type: 'visibility_change',
          visible: !document.hidden,
          timestamp: Date.now(),
          url: window.location.href // Add URL to ensure it's valid
        });
      }
    });
    
    // Set up periodic tasks with reconnection support
    const stopTasks = setupPeriodicTasks();
    
    // Store the stop function in case we need to clean up
    window._focusNudgeStopTasks = stopTasks;
    
    console.log('FocusNudge: Content script initialized');
    
    // Inject test functions
    injectTestFunctions();
  } catch (error) {
    console.error('FocusNudge: Error initializing content script:', error);
  }
};

// Start tracking when the page is fully loaded
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (!isExtensionContextValid()) {
      console.warn('Ignoring message due to invalidated extension context');
      return false;
    }
    
    if (message.type === 'get_page_info') {
      // Capture page metadata
      const pageInfo = {
        url: window.location.href,
        title: document.title,
        timestamp: Date.now()
      };
      
      sendResponse(pageInfo);
      return true;
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
  
  return false;
});

// Test function that can be called from the console
window.testFocusNudge = {
  checkDistraction: () => {
    console.log('FocusNudge: Manually triggering distraction check');
    const metadata = capturePageMetadata();
    safelySendMessage({
      type: 'classify',
      url: metadata.url,
      title: metadata.title
    }).then(response => {
      console.log('FocusNudge: Manual classification result:', response);
      
      // Show nudge if distracted
      if (response && response.isDistracted && response.nudgeType && response.message) {
        showNudge({
          nudgeType: response.nudgeType,
          message: response.message
        });
      }
    }).catch(error => {
      console.error('Failed to check distraction:', error);
    });
  },
  
  getNudge: () => {
    console.log('FocusNudge: Manually requesting nudge');
    const metadata = capturePageMetadata();
    safelySendMessage({
      type: 'classify',
      url: metadata.url,
      title: metadata.title
    }).then(response => {
      console.log('FocusNudge: Manual nudge response:', response);
      if (response && response.isDistracted && response.nudgeType && response.message) {
        showNudge({
          nudgeType: response.nudgeType,
          message: response.message
        });
      }
    }).catch(error => {
      console.error('Failed to get nudge:', error);
    });
  },
  
  showTestNudge: () => {
    console.log('FocusNudge: Showing test nudge');
    showNudge({
      nudgeType: 'test',
      message: 'This is a test nudge from the console!'
    });
  }
}; 

// Function to inject test functions for development
const injectTestFunctions = () => {
  try {
    // Set up event listeners for the test functions
    document.addEventListener('focusNudge_checkDistraction', () => {
      safelySendMessage({
        type: 'classify',
        url: window.location.href,
        title: document.title
      }).then(response => {
        console.log('Distraction check result:', response);
      }).catch(error => {
        console.error('Failed to check distraction:', error);
      });
    });
    
    document.addEventListener('focusNudge_getNudge', () => {
      safelySendMessage({
        type: 'classify',
        url: window.location.href,
        title: document.title
      }).then(response => {
        console.log('Nudge result:', response);
      }).catch(error => {
        console.error('Failed to get nudge:', error);
      });
    });
    
    document.addEventListener('focusNudge_showTestNudge', () => {
      showNudge({
        nudgeType: 'test',
        message: 'This is a test nudge. Is it working correctly?'
      });
    });
    
    // Instead of injecting a script, we'll use the existing window.testFocusNudge object
    // that's already defined in the content script context
    
    // Log that test functions are ready
    console.log('FocusNudge: Test functions are ready. Use window.testFocusNudge in the console to test.');
    console.log('Available commands:');
    console.log('- window.testFocusNudge.checkDistraction()');
    console.log('- window.testFocusNudge.getNudge()');
    console.log('- window.testFocusNudge.showTestNudge()');
  } catch (error) {
    console.error('Failed to set up test functions:', error);
  }
};

// Set up the test functions when the page loads
if (document.readyState === 'complete') {
  injectTestFunctions();
} else {
  window.addEventListener('load', injectTestFunctions);
} 