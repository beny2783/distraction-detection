/**
 * Focus Nudge - Background Script
 * 
 * This script runs in the background and processes the event stream
 * from content scripts to detect distractions and provide nudges.
 */

import { EVENT_TYPES } from './src/events/schema.js';
import { storeEvents, getEvents } from './src/events/storage.js';
import ModelManager from './models/ModelManager.js';
import { detectTask, getTaskSpecificNudges, TASK_TYPES } from './src/features/taskDetection.js';

// Configuration
const CONFIG = {
  modelUpdateInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  sessionTimeout: 30 * 60 * 1000,           // 30 minutes in milliseconds
  eventProcessingInterval: 5000,            // Process events every 5 seconds
  maxEventsPerProcessing: 1000,             // Maximum events to process at once
  distractionScoreInterval: 5 * 60 * 1000,  // Calculate distraction score every 5 minutes
  taskDetectionInterval: 2 * 60 * 1000,     // Detect tasks every 2 minutes
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
  allowedSites: [],
  taskDetectionEnabled: true,
  taskSpecificNudgesEnabled: true
};

let sessionData = {};
let activeTabId = null;
let activeTabUrl = '';
let activeTabTitle = '';
let eventQueue = [];
let eventProcessorTimer = null;
let modelManager = null;
let distractionScores = []; // Array to store periodic distraction scores
let currentDetectedTask = {
  taskType: TASK_TYPES.UNKNOWN,
  confidence: 0,
  detectionMethod: 'initial',
  lastUpdated: 0
};

// Focus mode state
let focusMode = {
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

// Load focus stats
chrome.storage.local.get(['focusStats'], (result) => {
  if (result.focusStats) {
    focusMode.stats = result.focusStats;
    
    // Check if it's a new day
    const today = new Date().toDateString();
    if (focusMode.stats.lastActiveDate !== today) {
      // Update streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (focusMode.stats.lastActiveDate === yesterday.toDateString()) {
        focusMode.stats.streakCount++;
      } else {
        focusMode.stats.streakCount = 1;
      }
      
      // Reset daily stats
      focusMode.stats.focusTime = 0;
      focusMode.stats.distractionCount = 0;
      focusMode.stats.lastActiveDate = today;
      
      // Save updated stats
      chrome.storage.local.set({ focusStats: focusMode.stats });
    }
  }
});

// Track focus time
let lastActiveTime = Date.now();
let isTracking = false;

chrome.tabs.onActivated.addListener(() => {
  if (!isTracking) {
    startFocusTracking();
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    stopFocusTracking();
  } else {
    startFocusTracking();
  }
});

function startFocusTracking() {
  isTracking = true;
  lastActiveTime = Date.now();
}

function stopFocusTracking() {
  if (isTracking) {
    const focusSession = (Date.now() - lastActiveTime) / 1000; // Convert to seconds
    focusMode.stats.focusTime += focusSession;
    
    // Update focus score
    updateFocusStats();
    
    // Save stats
    chrome.storage.local.set({ focusStats: focusMode.stats });
    
    isTracking = false;
  }
}

// Update focus stats every minute
setInterval(updateFocusStats, 60000);

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
    
    // Set up alarm for periodic task detection
    chrome.alarms.create('taskDetection', {
      periodInMinutes: CONFIG.taskDetectionInterval / (60 * 1000)
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
 * Handle messages from content scripts and popup
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    const tabId = sender.tab?.id;
    console.log(`[Focus Nudge] Received message type: ${message.type} from tab ${tabId}`, message);
    
    switch (message.type) {
      case 'TRACK_EVENT':
        // Track event
        const event = {
          event_type: message.eventType,
          payload: message.payload,
          url: message.url,
          timestamp: message.timestamp,
          tab_id: tabId,
          session_id: getSessionIdForTab(tabId),
          sequence_id: getNextSequenceId(tabId)
        };
        
        // Add to event queue
        eventQueue.push(event);
        
        sendResponse({ success: true });
        break;
        
      case 'FLUSH_EVENTS':
        // Flush events
        await processEventQueue();
        sendResponse({ success: true });
        break;
        
      case 'GET_EVENT_STREAM_FUNCTIONS':
        // Return event stream functions
        sendResponse({
          success: true,
          functions: {
            trackEvent: true,
            flushEvents: true,
            cleanup: true
          }
        });
        break;
        
      case 'get_model_info':
        // Return model info
        if (modelManager) {
          sendResponse({
            type: modelManager.getActiveModelType(),
            version: modelManager.getActiveModelVersion()
          });
        } else {
          sendResponse(null);
        }
        break;
        
      case 'set_model_type':
        // Set model type
        if (modelManager && message.modelType) {
          const success = modelManager.setActiveModelType(message.modelType);
          sendResponse({
            success,
            modelInfo: {
              type: modelManager.getActiveModelType(),
              version: modelManager.getActiveModelVersion()
            }
          });
        } else {
          sendResponse({ success: false });
        }
        break;
        
      case 'update_preferences':
        // Update preferences
        if (message.preferences) {
          userPreferences = { ...userPreferences, ...message.preferences };
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
        break;
        
      case 'TRIGGER_TASK_DETECTION':
        // Manually trigger task detection
        await detectCurrentTask();
        sendResponse({ success: true });
        break;
        
      case 'ENABLE_TASK_MODE':
        handleEnableTaskMode(message, sender);
        break;
        
      case 'DISABLE_TASK_MODE':
        handleDisableTaskMode();
        break;
        
      case 'distraction_detected':
        focusMode.stats.distractionCount++;
        updateFocusStats();
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
    } else if (alarm.name === 'taskDetection') {
      // Detect current task
      if (userPreferences.taskDetectionEnabled) {
        await detectCurrentTask();
      }
    } else if (alarm.name === 'focusModeEnd') {
      // Focus mode timer expired
      console.log('[Focus Nudge] Focus mode timer expired');
      
      // Disable focus mode
      focusMode.active = false;
      focusMode.startTime = null;
      focusMode.endTime = null;
      
      // Save user preferences
      await chrome.storage.sync.set({ userPreferences });
      
      // Notify user that focus mode has ended
      if (activeTabId) {
        try {
          await chrome.tabs.sendMessage(activeTabId, {
            type: 'FOCUS_MODE_ENDED',
            message: 'Your 30-minute job application focus session has ended.'
          });
        } catch (error) {
          console.error('[Focus Nudge] Error sending focus mode ended notification:', error);
        }
      }
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
    
    // After processing events, check if task detection is due
    const now = Date.now();
    if (userPreferences.taskDetectionEnabled && 
        (now - currentDetectedTask.lastUpdated) > CONFIG.taskDetectionInterval) {
      await detectCurrentTask();
    }
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
    
    // Get current task mode
    const taskMode = focusMode.taskType;
    
    // Define allowed domains for different task modes
    const allowedDomains = {
      'job_application': [
        'linkedin.com',
        'indeed.com',
        'glassdoor.com',
        'monster.com',
        'ziprecruiter.com',
        'careers.google.com',
        'jobs.lever.co',
        'greenhouse.io',
        'workday.com'
      ]
    };
    
    // Check if site is allowed for current task mode
    const isAllowedForTaskMode = taskMode && 
      allowedDomains[taskMode] && 
      allowedDomains[taskMode].some(domain => features.domain.includes(domain));
    
    // Skip if this domain is in the user's allowed sites list or allowed for current task mode
    if (userPreferences.allowedSites.includes(features.domain) || isAllowedForTaskMode) {
      return;
    }
    
    // Skip if not in focus mode time window
    if (focusMode.active) {
      const now = Date.now();
      if (focusMode.startTime && focusMode.endTime) {
        if (!(now >= focusMode.startTime && now <= focusMode.endTime)) {
          return;
        }
      }
    }
    
    // Known distraction domains should always be flagged in task mode
    const knownDistractionDomains = [
      'youtube.com',
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'reddit.com',
      'tiktok.com',
      'netflix.com',
      'hulu.com',
      'twitch.tv'
    ];
    
    // If in task mode and on a known distraction site, mark as distraction
    if (focusMode.active && knownDistractionDomains.some(d => features.domain.includes(d))) {
      console.log('[Focus Nudge] Known distraction domain detected:', features.domain);
      
      // Increment distraction count and update stats
      focusMode.stats.distractionCount++;
      
      // Update focus score based on distractions
      const result = await chrome.storage.local.get(['focusStats']);
      const currentStats = result.focusStats || focusMode.stats;
      currentStats.distractionCount = focusMode.stats.distractionCount;
      
      // Add to recent distractions
      const now = Date.now();
      currentStats.recentDistractions = [
        {
          domain: features.domain,
          timestamp: now
        },
        ...(currentStats.recentDistractions || []).slice(0, 9) // Keep last 10 distractions
      ];
      
      // Save updated stats
      await chrome.storage.local.set({ focusStats: currentStats });
      
      // Update focus mode state
      focusMode.stats = currentStats;
      
      // Send distraction detected message to content script
      if (tabId) {
        try {
          await chrome.tabs.sendMessage(tabId, { 
            type: 'distraction_detected',
            domain: features.domain
          });
        } catch (error) {
          console.error('[Focus Nudge] Error sending distraction alert:', error);
        }
      }
      
      // Generate and send nudge
      const nudge = generateNudge(features.domain, { probability: 1.0, confidence: 1.0 });
      if (nudge) {
        sendNudgeToTab(tabId, nudge);
      }
      return;
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
    
    // If task-specific nudges are enabled and we have a detected task with good confidence,
    // use task-specific nudges
    if (userPreferences.taskSpecificNudgesEnabled && 
        currentDetectedTask.taskType !== TASK_TYPES.UNKNOWN &&
        currentDetectedTask.confidence >= 0.7) {
      return generateTaskSpecificNudge(domain, prediction, currentDetectedTask);
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
 * Generate a task-specific nudge
 * @param {string} domain - Website domain
 * @param {Object} prediction - Prediction object from model
 * @param {Object} detectedTask - Detected task object
 * @returns {Object} Nudge object
 */
function generateTaskSpecificNudge(domain, prediction, detectedTask) {
  // Get task-specific nudges
  const nudges = getTaskSpecificNudges(detectedTask.taskType);
  const randomNudge = nudges[Math.floor(Math.random() * nudges.length)];
  
  return {
    type: 'task_specific',
    title: `${formatTaskType(detectedTask.taskType)} Focus`,
    message: randomNudge,
    taskType: detectedTask.taskType,
    distractionScore: prediction.distraction_score,
    timestamp: Date.now()
  };
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

/**
 * Detect the current task based on recent events
 */
async function detectCurrentTask() {
  try {
    // Skip task detection if focus mode is active
    if (focusMode.active) {
      if (CONFIG.debugMode) {
        console.log('Focus Nudge: Skipping task detection - Focus mode is active');
      }
      return;
    }

    // Get recent events for the active tab
    if (!activeTabId) {
      if (CONFIG.debugMode) {
        console.log('Focus Nudge: No active tab for task detection');
      }
      return;
    }
    
    const sessionId = getSessionIdForTab(activeTabId);
    if (!sessionId) {
      if (CONFIG.debugMode) {
        console.log('Focus Nudge: No session ID for active tab');
      }
      return;
    }
    
    // Get recent events for this session
    const recentEvents = await getEvents({
      sessionId: sessionId,
      limit: 100,
      sortDirection: 'desc'
    });
    
    if (!recentEvents || recentEvents.length === 0) {
      if (CONFIG.debugMode) {
        console.log('Focus Nudge: No recent events for task detection');
      }
      return;
    }
    
    // Detect task
    const taskDetection = detectTask(recentEvents);
    
    // Update current detected task if confidence is higher or if it's a different task with good confidence
    const shouldUpdateTask = 
      taskDetection.confidence > currentDetectedTask.confidence ||
      (taskDetection.taskType !== currentDetectedTask.taskType && 
       taskDetection.confidence >= 0.7);
    
    if (shouldUpdateTask) {
      const previousTask = { ...currentDetectedTask };
      
      // Update current task
      currentDetectedTask = {
        ...taskDetection,
        lastUpdated: Date.now()
      };
      
      // Log task change
      if (CONFIG.debugMode) {
        console.log(`Focus Nudge: Task detected - ${taskDetection.taskType} (${taskDetection.confidence.toFixed(2)})`);
        console.log('Focus Nudge: Task detection evidence:', taskDetection.evidence);
      }
      
      // If task type changed and task-specific nudges are enabled, send a task change notification
      if (previousTask.taskType !== TASK_TYPES.UNKNOWN && 
          taskDetection.taskType !== previousTask.taskType &&
          userPreferences.taskSpecificNudgesEnabled) {
        sendTaskChangeNotification(previousTask.taskType, taskDetection.taskType);
      }
      
      // Store task detection in session data
      if (!sessionData[sessionId]) {
        sessionData[sessionId] = {};
      }
      
      sessionData[sessionId].detectedTask = currentDetectedTask;
      
      // Save session data
      await chrome.storage.local.set({ sessionData });
      
      // Send a notification to the content script for job search detection
      if (taskDetection.taskType === TASK_TYPES.JOB_SEARCH && taskDetection.confidence >= 0.5) {
        try {
          await chrome.tabs.sendMessage(activeTabId, {
            type: 'TASK_DETECTED',
            taskType: taskDetection.taskType,
            confidence: taskDetection.confidence,
            detectionMethod: taskDetection.detectionMethod,
            evidence: taskDetection.evidence
          });
          
          if (CONFIG.debugMode) {
            console.log('Focus Nudge: Sent job search detection alert to content script');
          }
        } catch (error) {
          console.error('Focus Nudge: Error sending task detection alert:', error);
        }
      }
    }
  } catch (error) {
    console.error('Focus Nudge: Error detecting task:', error);
  }
}

/**
 * Send a notification about task change
 * @param {string} previousTaskType - Previous task type
 * @param {string} newTaskType - New task type
 */
async function sendTaskChangeNotification(previousTaskType, newTaskType) {
  try {
    // Only send notification if active tab exists
    if (!activeTabId) {
      return;
    }
    
    // Get task-specific nudge for the new task
    const nudges = getTaskSpecificNudges(newTaskType);
    const randomNudge = nudges[Math.floor(Math.random() * nudges.length)];
    
    // Create task change nudge
    const taskChangeNudge = {
      type: 'task_change',
      title: `Detected: ${formatTaskType(newTaskType)}`,
      message: randomNudge,
      taskType: newTaskType,
      previousTaskType: previousTaskType,
      timestamp: Date.now()
    };
    
    // Send nudge to tab
    await sendNudgeToTab(activeTabId, taskChangeNudge);
    
    if (CONFIG.debugMode) {
      console.log(`Focus Nudge: Sent task change nudge for ${newTaskType}`);
    }
  } catch (error) {
    console.error('Focus Nudge: Error sending task change notification:', error);
  }
}

/**
 * Format task type for display
 * @param {string} taskType - Task type from TASK_TYPES
 * @returns {string} Formatted task type
 */
function formatTaskType(taskType) {
  // Convert from snake_case to Title Case
  return taskType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Handle enabling task mode
 */
async function handleEnableTaskMode(message, sender) {
  try {
    const { taskType, useTimer, timerDuration } = message;
    const startTime = Date.now();
    const endTime = useTimer ? startTime + timerDuration : null;

    // Update focus mode state
    focusMode = {
      active: true,
      startTime,
      endTime,
      taskType,
      stats: {
        ...focusMode.stats,
        focusTime: 0
      }
    };

    // Update user preferences
    const userPreferences = {
      focusMode: true,
      focusModeStartTime: startTime,
      focusModeEndTime: endTime,
      currentTaskType: taskType
    };

    await chrome.storage.local.set({ userPreferences });

    // Set alarm for focus mode end if timer is used
    if (useTimer) {
      chrome.alarms.create('focusModeEnd', {
        when: endTime
      });
    }

    // Start tracking focus time
    updateFocusStats();
  } catch (error) {
    console.error('Error enabling task mode:', error);
  }
}

/**
 * Handle disabling task mode
 */
async function handleDisableTaskMode() {
  try {
    // Update final stats before disabling
    await updateFocusStats();

    // Clear focus mode state
    focusMode = {
      active: false,
      startTime: null,
      endTime: null,
      taskType: null,
      stats: focusMode.stats
    };

    // Update user preferences
    const userPreferences = {
      focusMode: false,
      focusModeStartTime: null,
      focusModeEndTime: null,
      currentTaskType: null
    };

    await chrome.storage.local.set({ userPreferences });

    // Clear focus mode end alarm
    chrome.alarms.clear('focusModeEnd');
  } catch (error) {
    console.error('Error disabling task mode:', error);
  }
}

/**
 * Update focus stats
 */
async function updateFocusStats() {
  if (!focusMode.active) return;

  try {
    const now = Date.now();
    const result = await chrome.storage.local.get(['focusStats']);
    const stats = result.focusStats || focusMode.stats;

    // Calculate focus time (in seconds)
    const focusTime = Math.floor((now - focusMode.startTime) / 1000);

    // Calculate focus score based on:
    // 1. Focus time (40%)
    // 2. Distraction count (30%)
    // 3. Streak (30%)
    const hourlyGoal = 4; // 4 hours of focus time per day
    const maxDistractions = 20;
    const maxStreak = 7;

    const focusTimeScore = Math.min(focusTime / (hourlyGoal * 3600), 1) * 40;
    const distractionScore = Math.max(0, 1 - (stats.distractionCount / maxDistractions)) * 30;
    const streakScore = Math.min(stats.streakCount / maxStreak, 1) * 30;

    // Update stats
    const updatedStats = {
      ...stats,
      focusTime,
      focusScore: Math.round(focusTimeScore + distractionScore + streakScore)
    };

    // Save updated stats
    await chrome.storage.local.set({ focusStats: updatedStats });

    // Update focus mode state
    focusMode.stats = updatedStats;
  } catch (error) {
    console.error('Error updating focus stats:', error);
  }
}

// Initialize the background script
initialize(); 