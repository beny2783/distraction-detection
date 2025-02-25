/**
 * Focus Nudge - Background Script
 * 
 * This script runs in the background and processes user interaction data,
 * runs the ML model, and manages the nudging system.
 */

// Import the ModelManager and MODEL_TYPES from the model-manager.js module
import { ModelManager, MODEL_TYPES } from './models/model-manager.js';

// Configuration
const CONFIG = {
  modelUpdateInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  distractionThreshold: 0.7,                // Probability threshold for distraction detection
  nudgeFrequency: 5 * 60 * 1000,            // Minimum time between nudges (5 minutes)
  knownDistractionDomains: [
    'youtube.com',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'reddit.com',
    'tiktok.com'
  ]
};

// State
let modelManager = null;
let lastModelUpdate = 0;
let lastNudgeTime = 0;
let sessionData = {};
let userPreferences = {
  nudgingEnabled: true,
  nudgeSensitivity: 'medium', // 'low', 'medium', 'high'
  focusGoal: '',
  modelType: 'random-forest'  // Default to Random Forest model
};

// Initialize
const initialize = async () => {
  console.log('FocusNudge: Background script initialized');
  
  // Load user preferences
  chrome.storage.local.get('userPreferences', (result) => {
    if (result.userPreferences) {
      userPreferences = result.userPreferences;
    } else {
      // Set default preferences
      chrome.storage.local.set({ userPreferences });
    }
  });
  
  try {
    // Initialize model manager directly since we're importing it as a module
    modelManager = new ModelManager();
    try {
      await modelManager.initialize();
      console.log('Model manager initialized successfully');
    } catch (initError) {
      console.error('Failed to initialize model manager:', initError);
      // Continue with rule-based classification
    }
    
    // Set up alarm for periodic model updates
    chrome.alarms.create('modelUpdate', {
      periodInMinutes: CONFIG.modelUpdateInterval / (60 * 1000)
    });
  } catch (error) {
    console.error('Failed to initialize model manager:', error);
    // Continue without model manager, will use fallback rule-based classification
  }
};

// Process events from content script
const processEvents = (events) => {
  if (!events || events.length === 0) return;
  
  // Extract features from events
  const features = extractFeatures(events);
  
  // Update session data
  const url = events[0]?.url || '';
  
  // Validate URL before constructing URL object
  let domain = '';
  try {
    // Check if URL is valid and not empty
    if (url && url.trim() !== '' && (url.startsWith('http://') || url.startsWith('https://'))) {
      domain = new URL(url).hostname;
    } else {
      console.warn('Invalid URL received in events:', url);
      return; // Exit early if URL is invalid
    }
  } catch (error) {
    console.warn('Error parsing URL:', error, 'URL was:', url);
    return; // Exit early if URL parsing fails
  }
  
  // Only proceed if we have a valid domain
  if (!domain) {
    console.warn('Empty domain extracted from URL:', url);
    return;
  }
  
  if (!sessionData[domain]) {
    sessionData[domain] = {
      visits: 0,
      totalTimeSpent: 0,
      scrollCount: 0,
      clickCount: 0,
      lastVisit: 0,
      distractionScore: 0
    };
  }
  
  sessionData[domain].visits++;
  sessionData[domain].totalTimeSpent += features.timeSpent;
  sessionData[domain].scrollCount += features.scrollCount;
  sessionData[domain].clickCount += features.clickCount;
  sessionData[domain].lastVisit = Date.now();
  
  // Store processed data
  chrome.storage.local.set({ sessionData });
};

// Extract features from events
const extractFeatures = (events) => {
  const features = {
    timeSpent: 0,
    scrollCount: 0,
    scrollDepth: 0,
    clickCount: 0,
    tabSwitches: 0,
    videoPlayCount: 0,
    videoPauseCount: 0,
    videoWatchTime: 0
  };
  
  // Calculate time range
  const timestamps = events.map(event => event.timestamp);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  features.timeSpent = maxTime - minTime;
  
  // Count event types
  events.forEach(event => {
    switch (event.type) {
      case 'scroll':
        features.scrollCount++;
        features.scrollDepth = Math.max(features.scrollDepth, event.scrollDepth || 0);
        break;
      case 'mouse_click':
        features.clickCount++;
        break;
      case 'visibility_change':
        if (event.visible === false) {
          features.tabSwitches++;
        }
        break;
      case 'video_play':
        features.videoPlayCount++;
        break;
      case 'video_pause':
        features.videoPauseCount++;
        break;
      case 'video_progress':
        features.videoWatchTime += 5; // Approximate, since we sample every 5 seconds
        break;
    }
  });
  
  return features;
};

// Classify whether the user is distracted
const classifyDistraction = (url, title) => {
  if (!userPreferences.nudgingEnabled) return false;
  
  // Extract domain
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch (error) {
    console.error('FocusNudge: Invalid URL', url);
    return false;
  }
  
  // Get session data for this domain
  const domainData = sessionData[domain] || {
    visits: 0,
    totalTimeSpent: 0,
    scrollCount: 0,
    clickCount: 0,
    lastVisit: 0
  };
  
  // Extract features for prediction
  const features = {
    timeSpent: domainData.totalTimeSpent,
    scrollCount: domainData.scrollCount,
    scrollDepth: 0, // Not tracked in session data yet
    clickCount: domainData.clickCount,
    tabSwitches: 0, // Not tracked in session data yet
    videoWatchTime: 0 // Not tracked in session data yet
  };
  
  // Use model manager for prediction if available
  let distractionScore = 0;
  
  if (modelManager) {
    try {
      // Check if predict method exists
      if (typeof modelManager.predict === 'function') {
        const prediction = modelManager.predict(features, domain);
        
        // Handle both object and scalar return types
        if (typeof prediction === 'object' && prediction !== null) {
          distractionScore = prediction.probability || 0;
        } else {
          distractionScore = prediction || 0;
        }
        
        console.log(`Model prediction for ${domain}: ${distractionScore}`);
      } else {
        console.warn('Model manager does not have a predict method, using rule-based classification');
        distractionScore = simpleRuleBasedClassification(domain, domainData);
      }
    } catch (error) {
      console.error('Model prediction failed:', error);
      
      // Fallback to simple rule-based classification
      distractionScore = simpleRuleBasedClassification(domain, domainData);
    }
  } else {
    // Fallback to simple rule-based classification
    distractionScore = simpleRuleBasedClassification(domain, domainData);
  }
  
  // Adjust based on user sensitivity preference
  switch (userPreferences.nudgeSensitivity) {
    case 'low':
      distractionScore *= 0.7;
      break;
    case 'high':
      distractionScore *= 1.3;
      break;
    // 'medium' is default, no adjustment needed
  }
  
  // Cap at 1.0
  distractionScore = Math.min(distractionScore, 1.0);
  
  // Update session data with distraction score
  if (sessionData[domain]) {
    sessionData[domain].distractionScore = distractionScore;
    chrome.storage.local.set({ sessionData });
  }
  
  return distractionScore > CONFIG.distractionThreshold;
};

// Simple rule-based classification (fallback)
const simpleRuleBasedClassification = (domain, domainData) => {
  let distractionScore = 0;
  
  // Factor 1: Known distraction domain
  if (CONFIG.knownDistractionDomains.some(d => domain.includes(d))) {
    distractionScore += 0.4;
  }
  
  // Factor 2: Time spent on domain
  if (domainData.totalTimeSpent > 10 * 60 * 1000) { // More than 10 minutes
    distractionScore += 0.3;
  } else if (domainData.totalTimeSpent > 5 * 60 * 1000) { // More than 5 minutes
    distractionScore += 0.2;
  }
  
  // Factor 3: Scroll behavior (high scroll count with low click count suggests mindless scrolling)
  if (domainData.scrollCount > 50 && domainData.clickCount < 5) {
    distractionScore += 0.3;
  }
  
  return distractionScore;
};

// Generate a nudge message
const generateNudge = (url) => {
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch (error) {
    domain = 'this site';
  }
  
  // Different types of nudges
  const nudges = [
    {
      type: 'question',
      messages: [
        `Are you still on track with your goals?`,
        `Is ${domain} helping you achieve what you set out to do?`,
        `Does this align with your focus goal: "${userPreferences.focusGoal || 'being productive'}"?`
      ]
    },
    {
      type: 'time_awareness',
      messages: [
        `You've been on ${domain} for a while now.`,
        `Time check: You might want to take a break from ${domain}.`,
        `Just a gentle reminder about how you're spending your time.`
      ]
    },
    {
      type: 'suggestion',
      messages: [
        `Consider setting a time limit for ${domain}.`,
        `Maybe it's time to switch to a more productive task?`,
        `Would this be a good time to take a short break and then refocus?`
      ]
    }
  ];
  
  // Randomly select a nudge type and message
  const nudgeType = nudges[Math.floor(Math.random() * nudges.length)];
  const message = nudgeType.messages[Math.floor(Math.random() * nudgeType.messages.length)];
  
  return {
    type: nudgeType.type,
    message
  };
};

// Process nudge feedback
const processNudgeFeedback = (feedback) => {
  console.log('Processing nudge feedback:', feedback);
  
  // Store feedback for model improvement
  chrome.storage.local.get('nudgeFeedback', (result) => {
    const feedbackData = result.nudgeFeedback || [];
    
    // Handle both old and new feedback formats
    const feedbackToStore = {
      timestamp: Date.now(),
      url: feedback.url || feedback.feedback?.url || '',
      helpful: typeof feedback.helpful === 'boolean' ? feedback.helpful : feedback.feedback?.helpful || false,
      nudgeType: feedback.nudgeType || feedback.feedback?.nudgeType || 'unknown'
    };
    
    feedbackData.push(feedbackToStore);
    chrome.storage.local.set({ nudgeFeedback: feedbackData });
    
    console.log('Stored feedback:', feedbackToStore);
  });
};

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (!message || !message.type) {
      console.error('Invalid message received:', message);
      sendResponse({ error: 'Invalid message format' });
      return true;
    }
    
    // Get sender URL if available
    const senderUrl = sender && sender.url ? sender.url : '';
    
    switch (message.type) {
      case 'events':
        try {
          // Validate events array
          if (!Array.isArray(message.events) || message.events.length === 0) {
            console.warn('Empty or invalid events array received');
            sendResponse({ success: false, error: 'Invalid events array' });
            return true;
          }
          
          // Process events
          processEvents(message.events);
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error processing events:', error);
          sendResponse({ error: 'Failed to process events', details: error.message });
        }
        break;
        
      case 'classify':
        try {
          // Validate URL
          if (!message.url || typeof message.url !== 'string' || 
              !(message.url.startsWith('http://') || message.url.startsWith('https://'))) {
            console.warn('Invalid URL received for classification:', message.url);
            sendResponse({ isDistracted: false, error: 'Invalid URL' });
            return true;
          }
          
          const now = Date.now();
          // Check if we should show a nudge (based on frequency)
          if (now - lastNudgeTime < CONFIG.nudgeFrequency) {
            sendResponse({ isDistracted: false, reason: 'Too soon since last nudge' });
            return true;
          }
          
          const isDistracted = classifyDistraction(message.url, message.title);
          if (isDistracted) {
            lastNudgeTime = now;
            const nudge = generateNudge(message.url);
            sendResponse({
              isDistracted: true,
              nudgeType: nudge.type,
              message: nudge.message
            });
          } else {
            sendResponse({ isDistracted: false });
          }
        } catch (error) {
          console.error('Error classifying distraction:', error);
          sendResponse({ error: 'Failed to classify distraction', details: error.message });
        }
        break;
        
      case 'nudge_feedback':
        try {
          processNudgeFeedback(message);
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error processing nudge feedback:', error);
          sendResponse({ error: 'Failed to process nudge feedback', details: error.message });
        }
        break;
        
      case 'update_preferences':
        try {
          userPreferences = message.preferences;
          chrome.storage.local.set({ userPreferences });
          
          // If model type changed, reload the model
          if (modelManager && message.preferences.modelType && 
              message.preferences.modelType !== modelManager.getActiveModelType()) {
            modelManager.loadModel(message.preferences.modelType);
          }
          
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error updating preferences:', error);
          sendResponse({ error: 'Failed to update preferences', details: error.message });
        }
        break;
        
      case 'get_model_info':
        try {
          if (modelManager) {
            sendResponse({
              type: modelManager.getActiveModelType(),
              version: modelManager.getActiveModelVersion()
            });
          } else {
            sendResponse({
              type: 'rule-based',
              version: '0.1.0'
            });
          }
        } catch (error) {
          console.error('Error getting model info:', error);
          sendResponse({ error: 'Failed to get model info', details: error.message });
        }
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: 'Failed to handle message', details: error.message });
  }
  
  return true; // Keep the message channel open for async responses
});

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'modelUpdate') {
    if (modelManager) {
      modelManager.loadModel(userPreferences.modelType || 'random-forest');
    }
  }
});

// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(initialize);

// Initialize when the background script loads
initialize(); 