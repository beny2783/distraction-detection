/**
 * Focus Nudge - Event Streaming Test Script
 * 
 * This script tests the event streaming implementation by simulating
 * various events and verifying they are processed correctly.
 */

// Mock chrome API for testing
const mockChrome = {
  runtime: {
    sendMessage: (message, callback) => {
      console.log('Sending message to background script:', message);
      
      // Simulate response from background script
      setTimeout(() => {
        if (message.type === 'GET_TAB_INFO') {
          callback({ tabId: 123, url: 'https://example.com' });
        } else if (message.type === 'GET_EVENT_STREAM_FUNCTIONS') {
          callback({ success: true });
        } else if (message.type === 'TRACK_EVENT') {
          callback({ success: true });
        } else if (message.type === 'FLUSH_EVENTS') {
          callback({ success: true });
        } else if (message.type === 'CLEANUP_EVENTS') {
          callback({ success: true });
        } else {
          callback({ success: false, error: 'Unknown message type' });
        }
      }, 100);
    },
    lastError: null
  },
  storage: {
    local: {
      get: (key, callback) => {
        console.log('Getting from storage:', key);
        callback({});
      },
      set: (data, callback) => {
        console.log('Setting in storage:', data);
        callback();
      }
    },
    sync: {
      get: (key, callback) => {
        console.log('Getting from sync storage:', key);
        callback({});
      },
      set: (data, callback) => {
        console.log('Setting in sync storage:', data);
        callback();
      }
    }
  }
};

// Replace chrome API with mock for testing
window.chrome = mockChrome;

// Test event tracking
async function testEventTracking() {
  console.log('=== Testing Event Tracking ===');
  
  // Simulate page visit event
  console.log('Simulating PAGE_VISIT event...');
  chrome.runtime.sendMessage({
    type: 'TRACK_EVENT',
    eventType: 'PAGE_VISIT',
    payload: {
      page_title: 'Test Page',
      domain: 'example.com',
      referrer: '',
      page_text: 'This is a test page',
      tab_count: 1,
      window_width: 1024,
      window_height: 768,
      is_active_tab: true
    },
    url: 'https://example.com',
    timestamp: Date.now()
  }, response => {
    console.log('PAGE_VISIT response:', response);
  });
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Simulate scroll event
  console.log('Simulating PAGE_SCROLL event...');
  chrome.runtime.sendMessage({
    type: 'TRACK_EVENT',
    eventType: 'PAGE_SCROLL',
    payload: {
      scroll_position_y: 100,
      scroll_position_x: 0,
      scroll_depth: 0.1,
      scroll_direction: 'down',
      scroll_speed: 10,
      viewport_height: 768,
      document_height: 2000
    },
    url: 'https://example.com',
    timestamp: Date.now()
  }, response => {
    console.log('PAGE_SCROLL response:', response);
  });
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Simulate mouse click event
  console.log('Simulating MOUSE_CLICK event...');
  chrome.runtime.sendMessage({
    type: 'TRACK_EVENT',
    eventType: 'MOUSE_CLICK',
    payload: {
      x: 100,
      y: 200,
      target_element: 'button',
      target_text: 'Click me',
      is_link: false,
      link_url: '',
      button: 0
    },
    url: 'https://example.com',
    timestamp: Date.now()
  }, response => {
    console.log('MOUSE_CLICK response:', response);
  });
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Simulate flush events
  console.log('Simulating FLUSH_EVENTS...');
  chrome.runtime.sendMessage({
    type: 'FLUSH_EVENTS'
  }, response => {
    console.log('FLUSH_EVENTS response:', response);
  });
  
  console.log('=== Event Tracking Test Complete ===');
}

// Run tests
async function runTests() {
  console.log('Starting event streaming tests...');
  
  // Test event tracking
  await testEventTracking();
  
  console.log('All tests complete!');
}

// Run tests when script is loaded
runTests(); 