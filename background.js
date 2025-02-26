/**
 * Focus Nudge - Background Script
 * 
 * This script runs in the background and processes the event stream
 * from content scripts to detect distractions and provide nudges.
 */

import { EVENT_TYPES } from './src/events/schema.js';
import { storeEvents, getEvents } from './src/events/storage.js';
import ModelManager from './models/ModelManager.js';

// Configuration
const CONFIG = {
  modelUpdateInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  sessionTimeout: 30 * 60 * 1000,           // 30 minutes in milliseconds
  eventProcessingInterval: 5000,            // Process events every 5 seconds
  maxEventsPerProcessing: 1000,             // Maximum events to process at once
  distractionScoreInterval: 5 * 60 * 1000,  // Calculate distraction score every 5 minutes
  debugMode: true                           // Enable debug logging
};

// State
let userPreferences = {
  nudgingEnabled: true,
  nudgeFrequency: 'medium',
  nudgeTypes: ['reminder', 'reflection', 'suggestion'],
  focusMode: false,
  focusModeStartTime: null,
  focusModeEndTime: null,
  distractionThreshold: 0.7,
  allowedSites: []
};

let sessionData = {};
let activeTabId = null;
let activeTabUrl = '';
let activeTabTitle = '';
let eventQueue = [];
let eventProcessorTimer = null;
let modelManager = null;
let distractionScores = []; // Array to store periodic distraction scores

/**
 * Initialize the background script
 */
async function initialize() {
  try {
    // Load user preferences
    const storedPreferences = await chrome.storage.sync.get('userPreferences');
    if (storedPreferences.userPreferences) {
      userPreferences = { ...userPreferences, ...storedPreferences.userPreferences };
    }
    
    // Load session data
    const storedSessionData = await chrome.storage.local.get('sessionData');
    if (storedSessionData.sessionData) {
      sessionData = storedSessionData.sessionData;
    }
    
    // Load distraction scores
    const storedDistractionScores = await chrome.storage.local.get('distractionScores');
    if (storedDistractionScores.distractionScores) {
      distractionScores = storedDistractionScores.distractionScores;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Start event processor
    startEventProcessor();
    
    // Create and initialize model manager
    modelManager = new ModelManager();
    await modelManager.initialize();
    
    // Set up alarm for periodic model updates
    chrome.alarms.create('modelUpdate', {
      periodInMinutes: CONFIG.modelUpdateInterval / (60 * 1000)
    });
    
    // Set up alarm for periodic distraction score calculation
    chrome.alarms.create('distractionScore', {
      periodInMinutes: CONFIG.distractionScoreInterval / (60 * 1000)
    });
    
    if (CONFIG.debugMode) {
      console.log('Focus Nudge: Background script initialized');
    }
    return true;
  } catch (error) {
    console.error('Focus Nudge: Error initializing background script:', error);
    return false;
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep the message channel open for async responses
  });
  
  // Listen for tab changes
  chrome.tabs.onActivated.addListener(handleTabActivated);
  
  // Listen for tab updates
  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  
  // Listen for alarms
  chrome.alarms.onAlarm.addListener(handleAlarm);
}

/**
 * Handle messages from content scripts
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    const tabId = sender.tab?.id;
    console.log(`[Focus Nudge] Received message type: ${message.type} from tab ${tabId}`, message);
    
    switch (message.type) {
      case 'GET_TAB_INFO':
        sendResponse({ tabId, url: sender.tab?.url });
        break;
        
      case 'GET_EVENT_STREAM_FUNCTIONS':
        // Content script is requesting event stream functions
        // We'll just acknowledge the request since we're handling events directly
        console.log('[Focus Nudge] Content script requested event stream functions');
        sendResponse({ success: true });
        break;
        
      case 'TRACK_EVENT':
        // Content script is sending an event to track
        if (message.eventType && EVENT_TYPES[message.eventType]) {
          console.log(`[Focus Nudge] Processing event: ${message.eventType}`);
          const event = {
            event_type: message.eventType,
            payload: message.payload || {},
            timestamp: message.timestamp || Date.now(),
            url: message.url || sender.tab?.url || '',
            tab_id: tabId || 0,
            session_id: getSessionIdForTab(tabId),
            sequence_id: getNextSequenceId(tabId)
          };
          
          // Add to event queue
          eventQueue.push(event);
          console.log(`[Focus Nudge] Added event to queue. Queue size: ${eventQueue.length}`);
          
          // Process immediately if it's an important event
          const importantEvents = ['PAGE_VISIT', 'PAGE_EXIT', 'VIDEO_PLAY', 'VIDEO_PAUSE'];
          if (importantEvents.includes(message.eventType)) {
            console.log(`[Focus Nudge] Important event detected. Processing queue immediately.`);
            processEventQueue();
          }
          
          sendResponse({ success: true });
        } else {
          console.error(`[Focus Nudge] Invalid event type: ${message.eventType}`);
          sendResponse({ success: false, error: 'Invalid event type' });
        }
        break;
        
      case 'FLUSH_EVENTS':
        // Content script is requesting to flush events
        await processEventQueue();
        sendResponse({ success: true });
        break;
        
      case 'CLEANUP_EVENTS':
        // Content script is cleaning up
        // Nothing special to do here, just acknowledge
        sendResponse({ success: true });
        break;
        
      case 'STREAM_EVENTS':
        // Legacy event streaming - handle for backward compatibility
        if (message.events && Array.isArray(message.events)) {
          eventQueue.push(...message.events);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Invalid events data' });
        }
        break;
        
      case 'GET_USER_PREFERENCES':
        // Get user preferences
        sendResponse({ preferences: userPreferences });
        break;
        
      case 'UPDATE_USER_PREFERENCES':
        // Update user preferences
        if (message.preferences) {
          userPreferences = { ...userPreferences, ...message.preferences };
          await chrome.storage.sync.set({ userPreferences });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No preferences provided' });
        }
        break;
        
      case 'GET_SESSION_DATA':
        // Get session data
        sendResponse({ sessionData });
        break;
        
      case 'CLEAR_SESSION_DATA':
        // Clear session data
        sessionData = {};
        await chrome.storage.local.set({ sessionData });
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Session and sequence ID tracking
const tabSessions = new Map();
const tabSequences = new Map();

/**
 * Get the session ID for a tab
 */
function getSessionIdForTab(tabId) {
  if (!tabSessions.has(tabId)) {
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    tabSessions.set(tabId, sessionId);
  }
  return tabSessions.get(tabId);
}

/**
 * Get the next sequence ID for a tab
 */
function getNextSequenceId(tabId) {
  const currentSequence = tabSequences.get(tabId) || 0;
  const nextSequence = currentSequence + 1;
  tabSequences.set(tabId, nextSequence);
  return nextSequence;
}

/**
 * Handle tab activated event
 */
async function handleTabActivated(activeInfo) {
  try {
    activeTabId = activeInfo.tabId;
    
    // Get tab info
    const tab = await chrome.tabs.get(activeTabId);
    activeTabUrl = tab.url || '';
    activeTabTitle = tab.title || '';
    
    if (CONFIG.debugMode) {
      console.log(`Tab activated: ${activeTabId}, URL: ${activeTabUrl}`);
    }
  } catch (error) {
    console.error('Error handling tab activated:', error);
  }
}

/**
 * Handle tab updated event
 */
function handleTabUpdated(tabId, changeInfo, tab) {
  try {
    // Only process if this is the active tab and it has a URL
    if (tabId === activeTabId && changeInfo.url) {
      activeTabUrl = changeInfo.url;
    }
    
    if (tabId === activeTabId && changeInfo.title) {
      activeTabTitle = changeInfo.title;
    }
    
    if (CONFIG.debugMode && (changeInfo.url || changeInfo.title)) {
      console.log(`Tab updated: ${tabId}, URL: ${changeInfo.url}, Title: ${changeInfo.title}`);
    }
  } catch (error) {
    console.error('Error handling tab updated:', error);
  }
}

/**
 * Handle alarm event
 */
async function handleAlarm(alarm) {
  try {
    if (alarm.name === 'modelUpdate') {
      // Update model
      if (modelManager) {
        await modelManager.updateModels();
      }
    } else if (alarm.name === 'distractionScore') {
      // Calculate distraction scores
      await calculateDistractionScores();
    }
  } catch (error) {
    console.error('Error handling alarm:', error);
  }
}

/**
 * Calculate distraction scores based on recent events
 */
async function calculateDistractionScores() {
  try {
    if (CONFIG.debugMode) {
      console.log('[Focus Nudge] Calculating periodic distraction score...');
    }
    
    // Get events from the last 5 minutes
    const now = Date.now();
    const fiveMinutesAgo = now - CONFIG.distractionScoreInterval;
    const recentEvents = await getEvents(fiveMinutesAgo, now);
    
    if (recentEvents.length === 0) {
      if (CONFIG.debugMode) {
        console.log('[Focus Nudge] No recent events found for distraction score calculation');
      }
      return;
    }
    
    // Group events by domain
    const eventsByDomain = {};
    recentEvents.forEach(event => {
      let domain = '';
      
      // Extract domain from event
      if (event.payload && event.payload.domain) {
        domain = event.payload.domain;
      } else if (event.url) {
        try {
          domain = new URL(event.url).hostname;
        } catch (e) {
          // Invalid URL, skip
          return;
        }
      }
      
      if (!domain) return;
      
      if (!eventsByDomain[domain]) {
        eventsByDomain[domain] = [];
      }
      eventsByDomain[domain].push(event);
    });
    
    // Calculate distraction score for each domain
    const domainScores = {};
    let overallScore = 0;
    let totalEvents = 0;
    
    for (const [domain, events] of Object.entries(eventsByDomain)) {
      // Extract features from events
      const features = extractFeaturesFromEvents(events);
      
      // Get prediction from model
      const modelInput = {
        events: events,
        features: features,
        sessionData: sessionData[domain] || {},
        userPreferences: userPreferences
      };
      
      const prediction = await modelManager.predict(modelInput);
      
      // Store domain score
      domainScores[domain] = {
        score: prediction.probability,
        confidence: prediction.confidence,
        eventCount: events.length,
        features: {
          timeSpent: features.timeSpent,
          scrollCount: features.scrollCount,
          clickCount: features.clickCount,
          keyPressCount: features.keyPressCount
        }
      };
      
      // Contribute to overall score (weighted by event count)
      overallScore += prediction.probability * events.length;
      totalEvents += events.length;
    }
    
    // Calculate overall distraction score
    const finalScore = totalEvents > 0 ? overallScore / totalEvents : 0;
    
    // Create distraction score entry
    const scoreEntry = {
      timestamp: now,
      overallScore: finalScore,
      domainScores: domainScores,
      totalEvents: totalEvents
    };
    
    // Add to distraction scores array
    distractionScores.push(scoreEntry);
    
    // Keep only the last 24 hours of scores (288 entries at 5-minute intervals)
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    distractionScores = distractionScores.filter(score => score.timestamp >= oneDayAgo);
    
    // Store updated distraction scores
    await chrome.storage.local.set({ distractionScores });
    
    if (CONFIG.debugMode) {
      console.log(`[Focus Nudge] Distraction score calculated: ${finalScore.toFixed(2)}`, scoreEntry);
    }
    
    // Send message to any open popup or insights page
    chrome.runtime.sendMessage({
      type: 'DISTRACTION_SCORE_UPDATED',
      data: scoreEntry
    }).catch(() => {
      // Ignore errors if no listeners
    });
  } catch (error) {
    console.error('Error calculating distraction scores:', error);
  }
}

/**
 * Start the event processor
 */
function startEventProcessor() {
  // Clear any existing timer
  if (eventProcessorTimer) {
    clearInterval(eventProcessorTimer);
  }
  
  // Set up new timer
  eventProcessorTimer = setInterval(processEventQueue, CONFIG.eventProcessingInterval);
}

/**
 * Process the event queue
 */
async function processEventQueue() {
  try {
    // Skip if queue is empty
    if (eventQueue.length === 0) {
      console.log('[Focus Nudge] Event queue is empty, nothing to process');
      return;
    }
    
    console.log(`[Focus Nudge] Processing event queue with ${eventQueue.length} events...`);
    
    // Get events to process (up to maxEventsPerProcessing)
    const eventsToProcess = eventQueue.splice(0, CONFIG.maxEventsPerProcessing);
    console.log(`[Focus Nudge] Processing ${eventsToProcess.length} events`);
    
    // Store events in storage
    console.log('[Focus Nudge] Storing events in IndexedDB...');
    await storeEvents(eventsToProcess);
    
    // Process events
    console.log('[Focus Nudge] Processing events for feature extraction and prediction...');
    await processEvents(eventsToProcess);
    
    console.log(`[Focus Nudge] Processed ${eventsToProcess.length} events, ${eventQueue.length} remaining`);
  } catch (error) {
    console.error('[Focus Nudge] Error processing event queue:', error);
  }
}

/**
 * Process events
 */
async function processEvents(events) {
  try {
    // Group events by tab
    const eventsByTab = {};
    
    events.forEach(event => {
      const tabId = event.tab_id;
      if (!eventsByTab[tabId]) {
        eventsByTab[tabId] = [];
      }
      eventsByTab[tabId].push(event);
    });
    
    // Process each tab's events
    for (const [tabId, tabEvents] of Object.entries(eventsByTab)) {
      // Sort events by timestamp
      tabEvents.sort((a, b) => a.timestamp - b.timestamp);
      
      // Extract features from events
      const features = extractFeaturesFromEvents(tabEvents);
      
      // Update session data
      updateSessionData(tabEvents, features);
      
      // Check for distractions
      if (userPreferences.nudgingEnabled) {
        await checkForDistractions(tabId, tabEvents, features);
      }
    }
    
    // Store updated session data
    await chrome.storage.local.set({ sessionData });
  } catch (error) {
    console.error('Error processing events:', error);
  }
}

/**
 * Extract features from events
 */
function extractFeaturesFromEvents(events) {
  // Initialize features
  const features = {
    timeSpent: 0,
    scrollCount: 0,
    scrollDepth: 0,
    clickCount: 0,
    tabSwitches: 0,
    videoPlayCount: 0,
    videoPauseCount: 0,
    videoWatchTime: 0,
    keyPressCount: 0,
    copyCount: 0,
    pasteCount: 0,
    idleTime: 0,
    pageVisits: 0,
    contentType: null,
    hasVideo: false,
    hasAudio: false,
    hasForms: false,
    hasComments: false,
    readabilityScore: 0
  };
  
  // Extract page metadata from PAGE_VISIT events
  const pageVisitEvents = events.filter(event => event.event_type === EVENT_TYPES.PAGE_VISIT);
  if (pageVisitEvents.length > 0) {
    const latestPageVisit = pageVisitEvents[pageVisitEvents.length - 1];
    features.url = latestPageVisit.url;
    features.domain = latestPageVisit.payload?.domain || new URL(latestPageVisit.url).hostname;
    features.pageTitle = latestPageVisit.payload?.page_title || '';
    features.pageVisits = pageVisitEvents.length;
  }
  
  // Calculate time range
  const timestamps = events.map(event => event.timestamp);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  features.timeSpent = maxTime - minTime;
  
  // Process each event
  events.forEach(event => {
    switch (event.event_type) {
      case EVENT_TYPES.PAGE_SCROLL:
        features.scrollCount++;
        features.scrollDepth = Math.max(features.scrollDepth, event.payload?.scroll_depth || 0);
        break;
        
      case EVENT_TYPES.MOUSE_CLICK:
        features.clickCount++;
        break;
        
      case EVENT_TYPES.TAB_SWITCH:
        features.tabSwitches++;
        break;
        
      case EVENT_TYPES.VIDEO_PLAY:
        features.videoPlayCount++;
        features.hasVideo = true;
        break;
        
      case EVENT_TYPES.VIDEO_PAUSE:
        features.videoPauseCount++;
        features.hasVideo = true;
        break;
        
      case EVENT_TYPES.VIDEO_PROGRESS:
        features.videoWatchTime += event.payload?.watch_time || 0;
        features.hasVideo = true;
        break;
        
      case EVENT_TYPES.KEY_PRESS:
        features.keyPressCount++;
        break;
        
      case EVENT_TYPES.COPY:
        features.copyCount++;
        break;
        
      case EVENT_TYPES.PASTE:
        features.pasteCount++;
        break;
        
      case EVENT_TYPES.SYSTEM_IDLE:
        features.idleTime += event.payload?.idle_time || 0;
        break;
        
      case EVENT_TYPES.CONTENT_LOAD:
        features.contentType = event.payload?.content_type || null;
        features.hasVideo = features.hasVideo || event.payload?.has_video || false;
        features.hasAudio = event.payload?.has_audio || false;
        features.hasForms = event.payload?.has_forms || false;
        features.hasComments = event.payload?.has_comments || false;
        features.readabilityScore = event.payload?.readability_score || 0;
        break;
    }
  });
  
  return features;
}

/**
 * Update session data
 */
function updateSessionData(events, features) {
  // Skip if no domain
  if (!features.domain) return;
  
  // Initialize session data for this domain if it doesn't exist
  if (!sessionData[features.domain]) {
    sessionData[features.domain] = {
      visits: 0,
      totalTimeSpent: 0,
      scrollCount: 0,
      clickCount: 0,
      videoWatchTime: 0,
      lastVisit: 0,
      distractionScore: 0,
      distractionHistory: []
    };
  }
  
  // Update session data
  const domainData = sessionData[features.domain];
  domainData.visits += features.pageVisits;
  domainData.totalTimeSpent += features.timeSpent;
  domainData.scrollCount += features.scrollCount;
  domainData.clickCount += features.clickCount;
  domainData.videoWatchTime += features.videoWatchTime;
  domainData.lastVisit = Date.now();
  
  // Store content type if available
  if (features.contentType) {
    domainData.contentType = features.contentType;
  }
  
  // Store page title if available
  if (features.pageTitle) {
    domainData.pageTitle = features.pageTitle;
  }
}

/**
 * Check for distractions
 */
async function checkForDistractions(tabId, events, features) {
  try {
    // Skip if no domain or model manager
    if (!features.domain || !modelManager) return;
    
    // Skip if this domain is in the allowed sites list
    if (userPreferences.allowedSites.includes(features.domain)) return;
    
    // Skip if in focus mode and this is not an allowed site
    if (userPreferences.focusMode) {
      const now = Date.now();
      if (userPreferences.focusModeStartTime && userPreferences.focusModeEndTime) {
        if (now >= userPreferences.focusModeStartTime && now <= userPreferences.focusModeEndTime) {
          // In focus mode time window
          return;
        }
      }
    }
    
    // Prepare input for model
    const modelInput = {
      events: events,
      features: features,
      sessionData: sessionData[features.domain] || {},
      userPreferences: userPreferences
    };
    
    // Get prediction from model
    const prediction = await modelManager.predict(modelInput);
    
    // Update distraction score in session data
    if (sessionData[features.domain]) {
      sessionData[features.domain].distractionScore = prediction.probability;
      
      // Add to distraction history
      sessionData[features.domain].distractionHistory = 
        sessionData[features.domain].distractionHistory || [];
      
      sessionData[features.domain].distractionHistory.push({
        timestamp: Date.now(),
        score: prediction.probability,
        confidence: prediction.confidence
      });
      
      // Keep history limited to last 100 entries
      if (sessionData[features.domain].distractionHistory.length > 100) {
        sessionData[features.domain].distractionHistory.shift();
      }
    }
    
    // Check if distraction threshold is exceeded
    if (prediction.probability >= userPreferences.distractionThreshold) {
      // Generate nudge
      const nudge = generateNudge(features.domain, prediction);
      
      // Send nudge to content script
      if (nudge) {
        sendNudgeToTab(tabId, nudge);
      }
    }
  } catch (error) {
    console.error('Error checking for distractions:', error);
  }
}

/**
 * Generate a nudge
 */
function generateNudge(domain, prediction) {
  try {
    // Skip if nudging is disabled
    if (!userPreferences.nudgingEnabled) return null;
    
    // Get domain data
    const domainData = sessionData[domain] || {};
    
    // Determine nudge type based on user preferences and context
    let nudgeType = 'reminder';
    const enabledNudgeTypes = userPreferences.nudgeTypes;
    
    if (enabledNudgeTypes.length > 0) {
      // Choose a random enabled nudge type
      nudgeType = enabledNudgeTypes[Math.floor(Math.random() * enabledNudgeTypes.length)];
    }
    
    // Generate message based on nudge type
    let message = '';
    
    switch (nudgeType) {
      case 'reminder':
        message = generateReminderNudge(domain, domainData);
        break;
        
      case 'reflection':
        message = generateReflectionNudge(domain, domainData);
        break;
        
      case 'suggestion':
        message = generateSuggestionNudge(domain, domainData);
        break;
        
      default:
        message = `You've spent ${formatTime(domainData.totalTimeSpent)} on ${domain} today.`;
    }
    
    return {
      type: nudgeType,
      message: message,
      domain: domain,
      distractionScore: prediction.probability,
      confidence: prediction.confidence,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error generating nudge:', error);
    return null;
  }
}

/**
 * Generate a reminder nudge
 */
function generateReminderNudge(domain, domainData) {
  const timeSpent = formatTime(domainData.totalTimeSpent);
  
  const reminders = [
    `You've spent ${timeSpent} on ${domain} today.`,
    `Just a reminder: you've been on ${domain} for ${timeSpent} today.`,
    `Time check: ${timeSpent} spent on ${domain} so far.`,
    `${timeSpent} of your day has been spent on ${domain}.`
  ];
  
  return reminders[Math.floor(Math.random() * reminders.length)];
}

/**
 * Generate a reflection nudge
 */
function generateReflectionNudge(domain, domainData) {
  const reflections = [
    `Is this ${domain} activity aligned with your goals right now?`,
    `Question: Is this the best use of your time right now?`,
    `Moment of reflection: Is this helping you accomplish what matters today?`,
    `Consider: What would be the most productive use of your time right now?`
  ];
  
  return reflections[Math.floor(Math.random() * reflections.length)];
}

/**
 * Generate a suggestion nudge
 */
function generateSuggestionNudge(domain, domainData) {
  const suggestions = [
    `Consider taking a short break and returning to your primary task.`,
    `Try the Pomodoro technique: 25 minutes of focused work, then a 5-minute break.`,
    `Setting a specific time limit for browsing can help maintain focus.`,
    `Try closing unnecessary tabs to reduce distractions.`
  ];
  
  return suggestions[Math.floor(Math.random() * suggestions.length)];
}

/**
 * Send nudge to tab
 */
async function sendNudgeToTab(tabId, nudge) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_NUDGE',
      nudge: nudge
    });
    
    if (CONFIG.debugMode) {
      console.log(`Sent nudge to tab ${tabId}:`, nudge);
    }
  } catch (error) {
    console.error('Error sending nudge to tab:', error);
  }
}

/**
 * Format time in a human-readable format
 */
function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  
  const minutes = Math.floor(seconds / 60);
  
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  
  return `${hours} hour${hours === 1 ? '' : 's'} and ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
}

// Initialize the background script
initialize(); 