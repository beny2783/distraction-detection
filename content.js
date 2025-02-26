/**
 * Focus Nudge - Content Script
 * 
 * This script is injected into web pages to track user interactions
 * and detect potential distractions using the event streaming architecture.
 */

// Define variables to hold our functions
let initEventStream, trackEvent, flushEvents, cleanup, EVENT_TYPES;

// Configuration
const CONFIG = {
  contentSampleLength: 1000,    // Length of page content to sample
  scrollSampleRate: 250,        // Capture scroll events every 250ms
  mouseSampleRate: 500,         // Capture mouse position every 500ms
  idleThreshold: 60000,         // 1 minute of inactivity is considered idle
  periodicFlushInterval: 30000, // Flush events every 30 seconds
  debugMode: true               // Enable debug logging
};

// State
let lastScrollTime = 0;
let lastMouseMoveTime = 0;
let lastActivityTime = Date.now();
let pageLoadTime = Date.now();
let isIdle = false;
let periodicTasksInterval = null;
let isInitialized = false;
let pageMetadata = null;

/**
 * Load the event stream functionality
 */
function loadEventStream() {
  console.log('[Focus Nudge] Loading event stream functionality...');
  
  // We'll use message passing to communicate with the background script
  chrome.runtime.sendMessage({ type: 'GET_EVENT_STREAM_FUNCTIONS' }, response => {
    if (chrome.runtime.lastError) {
      console.error('[Focus Nudge] Error loading event stream:', chrome.runtime.lastError);
      // Try again after a delay
      console.log('[Focus Nudge] Retrying in 1 second...');
      setTimeout(loadEventStream, 1000);
      return;
    }

    if (!response || !response.success) {
      console.error('[Focus Nudge] Failed to get event stream functions:', response?.error || 'Unknown error');
      return;
    }

    console.log('[Focus Nudge] Event stream functions loaded successfully');
    
    // Initialize the content script now that we have the functions
    initialize();
  });
}

/**
 * Initialize the content script
 */
async function initialize() {
  if (isInitialized) return;
  
  console.log('[Focus Nudge] Initializing content script...');
  
  try {
    // Capture initial page metadata
    console.log('[Focus Nudge] Capturing page metadata...');
    pageMetadata = capturePageMetadata();
    
    // Track page visit event
    console.log('[Focus Nudge] Tracking page visit event...');
    sendEvent('PAGE_VISIT', {
      page_title: pageMetadata.title,
      domain: pageMetadata.domain,
      referrer: document.referrer,
      page_text: pageMetadata.pageContent,
      tab_count: 0, // Will be filled in by background script
      window_width: window.innerWidth,
      window_height: window.innerHeight,
      is_active_tab: !document.hidden
    });
    
    // Track content load
    console.log('[Focus Nudge] Tracking content load...');
    trackContentLoad();
    
    // Set up event listeners
    console.log('[Focus Nudge] Setting up event listeners...');
    setupEventListeners();
    
    // Set up periodic tasks
    console.log('[Focus Nudge] Setting up periodic tasks...');
    setupPeriodicTasks();
    
    // Load Focus Companion immediately
    console.log('[Focus Nudge] Loading Focus Companion...');
    loadFocusCompanion().catch(error => {
      console.error('[Focus Nudge] Error loading Focus Companion:', error);
    });
    
    isInitialized = true;
    
    console.log('[Focus Nudge] Content script initialized successfully');
  } catch (error) {
    console.error('[Focus Nudge] Error initializing content script:', error);
  }
}

/**
 * Send an event to the background script
 */
function sendEvent(eventType, payload = {}) {
  console.log(`[Focus Nudge] Sending event: ${eventType}`, payload);
  
  chrome.runtime.sendMessage({
    type: 'TRACK_EVENT',
    eventType,
    payload,
    url: window.location.href,
    timestamp: Date.now()
  }, response => {
    if (response && response.success) {
      console.log(`[Focus Nudge] Event ${eventType} sent successfully`);
    } else {
      console.error(`[Focus Nudge] Failed to send event ${eventType}:`, response?.error || 'Unknown error');
    }
  });
}

// Start loading the event stream
loadEventStream();

/**
 * Check if extension resources are accessible
 */
function checkExtensionResources() {
  console.log('[Focus Nudge] Checking extension resources...');
  
  // List of resources to check
  const resources = [
    'src/ui/focus-companion.css',
    'src/ui/focus-companion.js',
    'assets/companion/companion.svg',
    'assets/companion/companion-happy.svg',
    'assets/companion/companion-thinking.svg',
    'assets/companion/companion-alert.svg'
  ];
  
  // Check each resource
  resources.forEach(resource => {
    const url = chrome.runtime.getURL(resource);
    console.log(`[Focus Nudge] Checking resource: ${resource}`);
    console.log(`[Focus Nudge] URL: ${url}`);
    
    // Try to fetch the resource
    fetch(url)
      .then(response => {
        if (response.ok) {
          console.log(`[Focus Nudge] Resource accessible: ${resource}`);
        } else {
          console.error(`[Focus Nudge] Resource not accessible: ${resource}, status: ${response.status}`);
        }
      })
      .catch(error => {
        console.error(`[Focus Nudge] Error accessing resource: ${resource}`, error);
      });
  });
}

// Add a call to check extension resources after initialization
setTimeout(checkExtensionResources, 2000);

/**
 * Set up event listeners for user interactions
 */
function setupEventListeners() {
  // Scroll events
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  // Mouse events
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  window.addEventListener('click', handleMouseClick);
  
  // Keyboard events
  document.addEventListener('keydown', handleKeyPress);
  
  // Copy/paste events
  document.addEventListener('copy', () => sendEvent('COPY'));
  document.addEventListener('paste', () => sendEvent('PASTE'));
  
  // Tab visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Video interactions
  trackVideoElements();
  
  // Track DOM mutations to detect new videos
  const observer = new MutationObserver(() => {
    trackVideoElements();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Window resize
  window.addEventListener('resize', () => {
    sendEvent('PAGE_RESIZE', {
      window_width: window.innerWidth,
      window_height: window.innerHeight
    });
  });
  
  // Before unload
  window.addEventListener('beforeunload', () => {
    sendEvent('PAGE_EXIT', {
      page_title: document.title,
      time_spent: Date.now() - pageLoadTime
    });
    
    // Flush events synchronously before page unloads
    chrome.runtime.sendMessage({ type: 'FLUSH_EVENTS' });
  });
}

/**
 * Set up periodic tasks
 */
function setupPeriodicTasks() {
  // Clear any existing interval
  if (periodicTasksInterval) {
    clearInterval(periodicTasksInterval);
  }
  
  // Set up new interval
  periodicTasksInterval = setInterval(() => {
    // Check for idle state
    checkIdleState();
    
    // Flush events periodically
    chrome.runtime.sendMessage({ type: 'FLUSH_EVENTS' });
    
    // Update content analysis periodically
    if (!isIdle) {
      trackContentLoad();
    }
  }, CONFIG.periodicFlushInterval);
  
  // Return cleanup function
  return () => {
    clearInterval(periodicTasksInterval);
  };
}

/**
 * Handle scroll events
 */
function handleScroll() {
  const now = Date.now();
  updateActivityTime();
  
  // Throttle scroll events
  if (now - lastScrollTime < CONFIG.scrollSampleRate) return;
  
  lastScrollTime = now;
  
  // Calculate scroll metrics
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  const scrollDepth = Math.min(1, scrollY / (document.body.scrollHeight - window.innerHeight));
  
  sendEvent('PAGE_SCROLL', {
    scroll_position_y: scrollY,
    scroll_position_x: scrollX,
    scroll_depth: scrollDepth,
    scroll_direction: lastScrollY < scrollY ? 'down' : 'up',
    scroll_speed: Math.abs(scrollY - lastScrollY) / (now - lastScrollTime),
    viewport_height: window.innerHeight,
    document_height: document.body.scrollHeight
  });
  
  lastScrollY = scrollY;
}

/**
 * Handle mouse move events
 */
function handleMouseMove(event) {
  const now = Date.now();
  updateActivityTime();
  
  // Throttle mouse move events
  if (now - lastMouseMoveTime < CONFIG.mouseSampleRate) return;
  
  lastMouseMoveTime = now;
  
  sendEvent('MOUSE_MOVE', {
    x: event.clientX,
    y: event.clientY,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight
  });
}

/**
 * Handle mouse click events
 */
function handleMouseClick(event) {
  updateActivityTime();
  
  // Get information about the clicked element
  const target = event.target;
  const targetText = target.textContent?.trim().substring(0, 100) || '';
  const isLink = target.tagName === 'A' || target.closest('a') !== null;
  const linkElement = isLink ? (target.tagName === 'A' ? target : target.closest('a')) : null;
  const linkUrl = linkElement?.href || '';
  
  sendEvent('MOUSE_CLICK', {
    x: event.clientX,
    y: event.clientY,
    target_element: target.tagName.toLowerCase(),
    target_text: targetText,
    is_link: isLink,
    link_url: linkUrl,
    button: event.button
  });
}

/**
 * Handle key press events
 */
function handleKeyPress(event) {
  updateActivityTime();
  
  // Don't track modifier keys alone
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
    return;
  }
  
  // Get information about the target element
  const target = event.target;
  const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName) || 
                  target.isContentEditable;
  
  sendEvent('KEY_PRESS', {
    key: event.key,
    is_input: isInput,
    target_element: target.tagName.toLowerCase(),
    has_modifier: event.ctrlKey || event.altKey || event.shiftKey || event.metaKey
  });
}

/**
 * Handle visibility change events
 */
function handleVisibilityChange() {
  const isVisible = !document.hidden;
  
  if (isVisible) {
    updateActivityTime();
    sendEvent('PAGE_FOCUS', {
      page_title: document.title,
      url: window.location.href
    });
  } else {
    sendEvent('PAGE_BLUR', {
      page_title: document.title,
      url: window.location.href,
      time_spent: Date.now() - pageLoadTime
    });
    
    // Flush events when tab loses focus
    chrome.runtime.sendMessage({ type: 'FLUSH_EVENTS' });
  }
}

/**
 * Track video elements on the page
 */
function trackVideoElements() {
  const videos = document.querySelectorAll('video');
  
  videos.forEach(video => {
    // Skip if we've already attached listeners
    if (video._focusNudgeTracked) return;
    
    // Mark as tracked
    video._focusNudgeTracked = true;
    
    // Get video metadata
    const videoTitle = getVideoTitle(video);
    
    // Play event
    video.addEventListener('play', () => {
      updateActivityTime();
      sendEvent('VIDEO_PLAY', {
        video_url: video.currentSrc,
        video_title: videoTitle,
        video_duration: video.duration,
        video_current_time: video.currentTime,
        is_fullscreen: isFullscreen(),
        player_type: detectPlayerType(video)
      });
    });
    
    // Pause event
    video.addEventListener('pause', () => {
      updateActivityTime();
      sendEvent('VIDEO_PAUSE', {
        video_url: video.currentSrc,
        video_title: videoTitle,
        video_duration: video.duration,
        video_current_time: video.currentTime,
        is_fullscreen: isFullscreen(),
        player_type: detectPlayerType(video)
      });
    });
    
    // Progress event
    video.addEventListener('timeupdate', () => {
      // Only track progress periodically
      if (Math.floor(video.currentTime) % 5 === 0 && video.currentTime > 0) {
        updateActivityTime();
        sendEvent('VIDEO_PROGRESS', {
          video_url: video.currentSrc,
          video_title: videoTitle,
          video_duration: video.duration,
          video_current_time: video.currentTime,
          watch_time: 5, // Approximate, since we sample every 5 seconds
          is_fullscreen: isFullscreen(),
          player_type: detectPlayerType(video)
        });
      }
    });
  });
}

/**
 * Track content load
 */
function trackContentLoad() {
  // Extract page content
  const content = document.body.innerText.substring(0, CONFIG.contentSampleLength);
  
  // Check for various content types
  const hasVideo = document.querySelectorAll('video').length > 0;
  const hasAudio = document.querySelectorAll('audio').length > 0;
  const hasForms = document.querySelectorAll('form, input, textarea, select').length > 0;
  const hasComments = document.querySelectorAll('.comments, .comment, #comments, [id*="comment"]').length > 0;
  
  // Calculate simple readability score (characters per word)
  const words = content.split(/\s+/).filter(word => word.length > 0);
  const chars = content.replace(/\s+/g, '').length;
  const readabilityScore = words.length > 0 ? chars / words.length : 0;
  
  sendEvent('CONTENT_LOAD', {
    content_type: detectContentType(),
    content_length: content.length,
    content_summary: content.substring(0, 100),
    has_video: hasVideo,
    has_audio: hasAudio,
    has_forms: hasForms,
    has_comments: hasComments,
    readability_score: readabilityScore
  });
}

/**
 * Update the last activity time
 */
function updateActivityTime() {
  lastActivityTime = Date.now();
  
  // If we were idle, we're now active
  if (isIdle) {
    isIdle = false;
    sendEvent('SYSTEM_ACTIVE');
  }
}

/**
 * Check if the user is idle
 */
function checkIdleState() {
  const now = Date.now();
  const idleTime = now - lastActivityTime;
  
  // If idle time exceeds threshold and we're not already marked as idle
  if (idleTime >= CONFIG.idleThreshold && !isIdle) {
    isIdle = true;
    sendEvent('SYSTEM_IDLE', {
      idle_time: idleTime
    });
  }
}

/**
 * Clean up the content script
 */
function cleanupContentScript() {
  // Remove event listeners
  window.removeEventListener('scroll', handleScroll);
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('click', handleMouseClick);
  document.removeEventListener('keydown', handleKeyPress);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  // Clear intervals
  if (periodicTasksInterval) {
    clearInterval(periodicTasksInterval);
  }
  
  // Clean up event stream
  chrome.runtime.sendMessage({ type: 'CLEANUP_EVENTS' });
  
  isInitialized = false;
}

// Export cleanup function for testing
window._focusNudgeCleanup = cleanupContentScript;

// Helper functions (these remain the same)
function getVideoTitle(video) {
  // Try to find video title from various sources
  
  // 1. Check for YouTube-specific elements
  if (window.location.hostname.includes('youtube.com')) {
    const ytTitle = document.querySelector('.title .ytd-video-primary-info-renderer');
    if (ytTitle) return ytTitle.textContent.trim();
  }
  
  // 2. Check for common video title elements
  const possibleTitleElements = [
    // Common video player title elements
    '.video-title', '.media-title', '.player-title',
    // Netflix
    '.video-title', '.title-text',
    // Vimeo
    '.vp-title'
  ];
  
  for (const selector of possibleTitleElements) {
    const element = document.querySelector(selector);
    if (element) return element.textContent.trim();
  }
  
  // 3. Look for title in parent elements
  let parent = video.parentElement;
  while (parent) {
    const headings = parent.querySelectorAll('h1, h2, h3');
    if (headings.length > 0) {
      return headings[0].textContent.trim();
    }
    parent = parent.parentElement;
  }
  
  // 4. Fallback to page title
  return document.title;
}

function detectPlayerType(video) {
  const url = window.location.href;
  
  if (url.includes('youtube.com')) return 'youtube';
  if (url.includes('netflix.com')) return 'netflix';
  if (url.includes('vimeo.com')) return 'vimeo';
  if (url.includes('twitch.tv')) return 'twitch';
  
  // Check for common player classes
  const parent = video.closest('.video-player, .media-player, .player');
  if (parent) {
    const classes = parent.className;
    if (classes.includes('youtube')) return 'youtube';
    if (classes.includes('vimeo')) return 'vimeo';
    if (classes.includes('jwplayer')) return 'jwplayer';
    if (classes.includes('video-js')) return 'videojs';
    if (classes.includes('plyr')) return 'plyr';
  }
  
  return 'generic';
}

function isFullscreen() {
  return !!(document.fullscreenElement || 
           document.webkitFullscreenElement || 
           document.mozFullScreenElement || 
           document.msFullscreenElement);
}

function detectContentType() {
  const url = window.location.href;
  const title = document.title.toLowerCase();
  
  // Check URL patterns
  if (url.includes('youtube.com/watch')) return 'video';
  if (url.includes('netflix.com/watch')) return 'video';
  if (url.includes('/article/') || url.includes('/blog/')) return 'article';
  if (url.includes('/news/')) return 'news';
  if (url.includes('/product/') || url.includes('/item/')) return 'product';
  if (url.includes('/search')) return 'search';
  
  // Check page structure
  if (document.querySelectorAll('article, .article').length > 0) return 'article';
  if (document.querySelectorAll('video').length > 0) return 'video';
  if (document.querySelectorAll('.product, .item, [itemtype*="Product"]').length > 0) return 'product';
  if (document.querySelectorAll('form').length > 0) return 'form';
  
  // Check title patterns
  if (title.includes('login') || title.includes('sign in')) return 'login';
  if (title.includes('search')) return 'search';
  
  return 'generic';
}

function capturePageMetadata() {
  return {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname,
    pageContent: document.body.innerText.substring(0, CONFIG.contentSampleLength),
    pageLoadTime: pageLoadTime
  };
}

/**
 * Handle messages from the background script
 * @param {Object} message - Message object
 * @param {Object} sender - Sender information
 * @param {Function} sendResponse - Function to send response
 */
function handleMessage(message, sender, sendResponse) {
  if (message.type === 'SHOW_NUDGE') {
    showNudge(message.nudge);
    sendResponse({ success: true });
  } else if (message.type === 'GET_PAGE_CONTENT') {
    const pageContent = document.body.innerText.substring(0, 5000);
    sendResponse({ success: true, pageContent });
  } else if (message.type === 'TASK_DETECTED') {
    // Handle task detection events
    if (message.taskType === 'job_search') {
      showTaskDetectionAlert(message);
    }
    sendResponse({ success: true });
  }
}

/**
 * Show a nudge to the user
 * @param {Object} nudge - Nudge object
 */
function showNudge(nudge) {
  // Create nudge container if it doesn't exist
  let nudgeContainer = document.getElementById('focus-nudge-container');
  
  if (!nudgeContainer) {
    nudgeContainer = document.createElement('div');
    nudgeContainer.id = 'focus-nudge-container';
    nudgeContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      width: 300px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    document.body.appendChild(nudgeContainer);
  }
  
  // Create nudge element
  const nudgeElement = document.createElement('div');
  nudgeElement.className = 'focus-nudge';
  nudgeElement.style.cssText = `
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    margin-top: 10px;
    overflow: hidden;
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateY(20px);
  `;
  
  // Add task-specific styling if applicable
  if (nudge.type === 'task_specific' || nudge.type === 'task_change') {
    nudgeElement.classList.add('task-specific-nudge');
  }
  
  // Create nudge header
  const nudgeHeader = document.createElement('div');
  nudgeHeader.className = 'focus-nudge-header';
  nudgeHeader.style.cssText = `
    padding: 12px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #eee;
  `;
  
  // Set header background color based on nudge type
  if (nudge.type === 'task_specific') {
    nudgeHeader.style.background = 'linear-gradient(135deg, #4CAF50, #8BC34A)';
    nudgeHeader.style.color = 'white';
  } else if (nudge.type === 'task_change') {
    nudgeHeader.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
    nudgeHeader.style.color = 'white';
  } else {
    nudgeHeader.style.background = 'linear-gradient(135deg, #6e8efb, #a777e3)';
    nudgeHeader.style.color = 'white';
  }
  
  // Create title
  const title = document.createElement('div');
  title.className = 'focus-nudge-title';
  title.textContent = nudge.title;
  title.style.cssText = `
    font-weight: 500;
    font-size: 14px;
  `;
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.className = 'focus-nudge-close';
  closeButton.innerHTML = '&times;';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: inherit;
    font-size: 18px;
    cursor: pointer;
    opacity: 0.8;
    padding: 0;
    margin: 0;
  `;
  
  // Add close button event listener
  closeButton.addEventListener('click', () => {
    nudgeElement.style.opacity = '0';
    nudgeElement.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      nudgeContainer.removeChild(nudgeElement);
    }, 300);
  });
  
  // Add title and close button to header
  nudgeHeader.appendChild(title);
  nudgeHeader.appendChild(closeButton);
  
  // Create nudge content
  const nudgeContent = document.createElement('div');
  nudgeContent.className = 'focus-nudge-content';
  nudgeContent.style.cssText = `
    padding: 15px;
    font-size: 13px;
    color: #333;
  `;
  
  // Create message
  const message = document.createElement('p');
  message.className = 'focus-nudge-message';
  message.textContent = nudge.message;
  message.style.cssText = `
    margin: 0 0 10px 0;
    line-height: 1.4;
  `;
  
  // Add task-specific information if applicable
  if (nudge.type === 'task_change') {
    const taskInfo = document.createElement('div');
    taskInfo.className = 'focus-nudge-task-info';
    taskInfo.style.cssText = `
      font-size: 12px;
      color: #666;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #eee;
    `;
    
    taskInfo.textContent = `Switched from ${formatTaskType(nudge.previousTaskType)} to ${formatTaskType(nudge.taskType)}`;
    nudgeContent.appendChild(taskInfo);
  }
  
  // Add message to content
  nudgeContent.appendChild(message);
  
  // Add header and content to nudge
  nudgeElement.appendChild(nudgeHeader);
  nudgeElement.appendChild(nudgeContent);
  
  // Add nudge to container
  nudgeContainer.appendChild(nudgeElement);
  
  // Animate nudge in
  setTimeout(() => {
    nudgeElement.style.opacity = '1';
    nudgeElement.style.transform = 'translateY(0)';
  }, 10);
  
  // Auto-remove nudge after 10 seconds
  setTimeout(() => {
    if (nudgeContainer.contains(nudgeElement)) {
      nudgeElement.style.opacity = '0';
      nudgeElement.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        if (nudgeContainer.contains(nudgeElement)) {
          nudgeContainer.removeChild(nudgeElement);
        }
      }, 300);
    }
  }, 10000);
}

/**
 * Format task type for display
 * @param {string} taskType - Task type
 * @returns {string} Formatted task type
 */
function formatTaskType(taskType) {
  return taskType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Show a simple alert when job searching is detected (for testing purposes)
 * @param {Object} taskData - Task detection data
 */
function showTaskDetectionAlert(taskData) {
  console.log('Task detection alert:', taskData);
  
  // Check if Focus Companion is already loaded
  if (window.focusCompanion) {
    // Use the Focus Companion to show the task detection
    window.focusCompanion.showTaskDetection(taskData);
    return;
  }
  
  // If Focus Companion is not loaded, load it
  loadFocusCompanion().then(() => {
    // Use the Focus Companion to show the task detection
    window.focusCompanion.showTaskDetection(taskData);
  }).catch(error => {
    console.error('[Focus Nudge] Error loading Focus Companion:', error);
    
    // Fallback to simple alert if Focus Companion fails to load
    showSimpleTaskAlert(taskData);
  });
}

/**
 * Load the Focus Companion
 * @returns {Promise} - A promise that resolves when the Focus Companion is loaded
 */
function loadFocusCompanion() {
  return new Promise((resolve, reject) => {
    try {
      console.log('[Focus Nudge] Starting to load Focus Companion...');
      
      // Check if already loaded
      if (window.focusCompanion) {
        console.log('[Focus Nudge] Focus Companion already loaded, reusing existing instance');
        resolve();
        return;
      }
      
      // Log the URLs we're trying to load
      const cssUrl = chrome.runtime.getURL('src/ui/focus-companion.css');
      const jsUrl = chrome.runtime.getURL('src/ui/focus-companion.js');
      console.log('[Focus Nudge] Loading CSS from:', cssUrl);
      console.log('[Focus Nudge] Loading JS from:', jsUrl);
      
      // Load CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = cssUrl;
      document.head.appendChild(link);
      console.log('[Focus Nudge] CSS link added to document head');
      
      // Create script element
      const script = document.createElement('script');
      script.type = 'module';
      
      // Set script content
      script.textContent = `
        console.log('[Focus Nudge] Importing Focus Companion module...');
        import focusCompanion from '${jsUrl}';
        console.log('[Focus Nudge] Focus Companion module imported:', focusCompanion);
        window.focusCompanion = focusCompanion;
        console.log('[Focus Nudge] Focus Companion assigned to window object');
        document.dispatchEvent(new CustomEvent('focus-companion-loaded'));
      `;
      
      // Add to document
      document.head.appendChild(script);
      console.log('[Focus Nudge] Script element added to document head');
      
      // Listen for load event
      document.addEventListener('focus-companion-loaded', () => {
        console.log('[Focus Nudge] Focus Companion loaded successfully');
        console.log('[Focus Nudge] Focus Companion object:', window.focusCompanion);
        
        // Check if the DOM elements were created
        const companionElement = document.querySelector('.focus-companion');
        const statusIndicator = document.querySelector('.focus-status-indicator');
        console.log('[Focus Nudge] Companion element exists:', !!companionElement);
        console.log('[Focus Nudge] Status indicator exists:', !!statusIndicator);
        
        resolve();
      }, { once: true });
      
      // Set timeout for loading
      setTimeout(() => {
        if (!window.focusCompanion) {
          console.error('[Focus Nudge] Focus Companion loading timed out');
          console.error('[Focus Nudge] Document head contents:', document.head.innerHTML);
          reject(new Error('Focus Companion loading timed out'));
        }
      }, 5000);
    } catch (error) {
      console.error('[Focus Nudge] Error loading Focus Companion:', error);
      reject(error);
    }
  });
}

/**
 * Show a simple alert when task detection fails to use Focus Companion
 * @param {Object} taskData - Task detection data
 */
function showSimpleTaskAlert(taskData) {
  // Create alert container
  const alertContainer = document.createElement('div');
  alertContainer.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  
  // Create icon
  const icon = document.createElement('div');
  icon.innerHTML = '🔍';
  icon.style.fontSize = '20px';
  
  // Create message
  const message = document.createElement('div');
  message.innerHTML = `
    <strong>Job Search Detected!</strong><br>
    Confidence: ${Math.round(taskData.confidence * 100)}%<br>
    Method: ${taskData.detectionMethod}
  `;
  
  // Add elements to container
  alertContainer.appendChild(icon);
  alertContainer.appendChild(message);
  
  // Add to document
  document.body.appendChild(alertContainer);
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (document.body.contains(alertContainer)) {
      document.body.removeChild(alertContainer);
    }
  }, 5000);
}

// Set up message listener
chrome.runtime.onMessage.addListener(handleMessage); 