/**
 * Focus Nudge - Feature Extractor
 * 
 * This module extracts features from event streams for use in distraction detection models.
 * It processes raw events and computes meaningful metrics that can be used for prediction.
 */

import { EVENT_TYPES } from '../events/schema.js';

// Feature extraction configuration
const DEFAULT_CONFIG = {
  // Time windows for feature extraction (in milliseconds)
  timeWindows: {
    recent: 5 * 60 * 1000,    // 5 minutes
    medium: 15 * 60 * 1000,   // 15 minutes
    long: 60 * 60 * 1000      // 1 hour
  },
  
  // Minimum number of events needed for reliable feature extraction
  minEventsForExtraction: 5,
  
  // Whether to include domain-specific features
  includeDomainFeatures: true,
  
  // Whether to include temporal features (time of day, day of week)
  includeTemporalFeatures: true
};

/**
 * Extract features from an event stream
 * @param {Array} events - Array of events
 * @param {Object} options - Feature extraction options
 * @returns {Object} Extracted features
 */
export function extractFeatures(events, options = {}) {
  // Merge default config with provided options
  const config = { ...DEFAULT_CONFIG, ...options };
  
  // If no events, return empty features
  if (!events || events.length === 0) {
    return createEmptyFeatures();
  }
  
  // If too few events, return basic features
  if (events.length < config.minEventsForExtraction) {
    return createBasicFeatures(events);
  }
  
  // Sort events by timestamp (oldest first)
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  
  // Extract basic session information
  const domain = extractDomain(sortedEvents);
  const sessionDuration = calculateSessionDuration(sortedEvents);
  const currentTimestamp = Date.now();
  
  // Initialize feature object
  const features = {
    // Basic metadata
    domain,
    timestamp: currentTimestamp,
    sessionDuration,
    eventCount: sortedEvents.length,
    
    // Time-based features
    timeSpent: sessionDuration,
    activeTime: calculateActiveTime(sortedEvents),
    idleTime: calculateIdleTime(sortedEvents),
    
    // Interaction features
    scrollCount: countEventType(sortedEvents, EVENT_TYPES.SCROLL),
    clickCount: countEventType(sortedEvents, EVENT_TYPES.MOUSE_CLICK),
    keyPressCount: countEventType(sortedEvents, EVENT_TYPES.KEY_PRESS),
    
    // Navigation features
    pageVisitCount: countEventType(sortedEvents, EVENT_TYPES.PAGE_VISIT),
    tabSwitchCount: countEventType(sortedEvents, EVENT_TYPES.TAB_SWITCH),
    
    // Content features
    contentLoadCount: countEventType(sortedEvents, EVENT_TYPES.CONTENT_LOAD),
    hasVideo: hasEventType(sortedEvents, EVENT_TYPES.VIDEO_PLAY),
    videoWatchTime: calculateVideoWatchTime(sortedEvents),
    
    // Derived metrics
    scrollRate: calculateRate(countEventType(sortedEvents, EVENT_TYPES.SCROLL), sessionDuration),
    clickRate: calculateRate(countEventType(sortedEvents, EVENT_TYPES.MOUSE_CLICK), sessionDuration),
    keyPressRate: calculateRate(countEventType(sortedEvents, EVENT_TYPES.KEY_PRESS), sessionDuration),
    
    // Engagement metrics
    engagementScore: calculateEngagementScore(sortedEvents),
    focusRatio: calculateFocusRatio(sortedEvents),
    
    // Content type (derived from events)
    contentType: determineContentType(sortedEvents, domain)
  };
  
  // Add time window features
  addTimeWindowFeatures(features, sortedEvents, config.timeWindows);
  
  // Add domain-specific features if enabled
  if (config.includeDomainFeatures) {
    addDomainSpecificFeatures(features, sortedEvents, domain);
  }
  
  // Add temporal features if enabled
  if (config.includeTemporalFeatures) {
    addTemporalFeatures(features, currentTimestamp);
  }
  
  return features;
}

/**
 * Create empty feature object
 * @returns {Object} Empty features
 */
function createEmptyFeatures() {
  return {
    domain: '',
    timestamp: Date.now(),
    sessionDuration: 0,
    eventCount: 0,
    timeSpent: 0,
    activeTime: 0,
    idleTime: 0,
    scrollCount: 0,
    clickCount: 0,
    keyPressCount: 0,
    pageVisitCount: 0,
    tabSwitchCount: 0,
    contentLoadCount: 0,
    hasVideo: false,
    videoWatchTime: 0,
    scrollRate: 0,
    clickRate: 0,
    keyPressRate: 0,
    engagementScore: 0,
    focusRatio: 0,
    contentType: 'unknown'
  };
}

/**
 * Create basic features from minimal events
 * @param {Array} events - Array of events
 * @returns {Object} Basic features
 */
function createBasicFeatures(events) {
  const features = createEmptyFeatures();
  
  if (events.length > 0) {
    // Extract what we can from the limited events
    features.domain = extractDomain(events);
    features.eventCount = events.length;
    features.timestamp = Date.now();
    
    // Sort events by timestamp
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate session duration if possible
    if (sortedEvents.length >= 2) {
      features.sessionDuration = sortedEvents[sortedEvents.length - 1].timestamp - sortedEvents[0].timestamp;
      features.timeSpent = features.sessionDuration;
    }
    
    // Count basic event types
    features.pageVisitCount = countEventType(events, EVENT_TYPES.PAGE_VISIT);
    features.scrollCount = countEventType(events, EVENT_TYPES.SCROLL);
    features.clickCount = countEventType(events, EVENT_TYPES.MOUSE_CLICK);
    
    // Check for video events
    features.hasVideo = hasEventType(events, EVENT_TYPES.VIDEO_PLAY);
    
    // Determine content type
    features.contentType = determineContentType(events, features.domain);
  }
  
  return features;
}

/**
 * Extract domain from events
 * @param {Array} events - Array of events
 * @returns {string} Domain
 */
function extractDomain(events) {
  // Try to find a PAGE_VISIT event
  const pageVisitEvent = events.find(event => event.event_type === EVENT_TYPES.PAGE_VISIT);
  
  if (pageVisitEvent && pageVisitEvent.payload && pageVisitEvent.payload.domain) {
    return pageVisitEvent.payload.domain;
  }
  
  // If no PAGE_VISIT event, try to extract domain from URL of any event
  const eventWithUrl = events.find(event => event.url);
  
  if (eventWithUrl && eventWithUrl.url) {
    try {
      const url = new URL(eventWithUrl.url);
      return url.hostname;
    } catch (error) {
      console.error('Error extracting domain from URL:', error);
    }
  }
  
  return 'unknown';
}

/**
 * Calculate session duration from events
 * @param {Array} events - Array of events sorted by timestamp
 * @returns {number} Session duration in milliseconds
 */
function calculateSessionDuration(events) {
  if (events.length < 2) {
    return 0;
  }
  
  return events[events.length - 1].timestamp - events[0].timestamp;
}

/**
 * Calculate active time from events
 * @param {Array} events - Array of events
 * @returns {number} Active time in milliseconds
 */
function calculateActiveTime(events) {
  let activeTime = 0;
  let lastActiveTimestamp = null;
  
  for (const event of events) {
    // Skip system idle events
    if (event.event_type === EVENT_TYPES.SYSTEM_IDLE) {
      continue;
    }
    
    if (lastActiveTimestamp === null) {
      lastActiveTimestamp = event.timestamp;
      continue;
    }
    
    // If gap between events is less than 30 seconds, consider it active time
    const gap = event.timestamp - lastActiveTimestamp;
    if (gap < 30 * 1000) {
      activeTime += gap;
    }
    
    lastActiveTimestamp = event.timestamp;
  }
  
  return activeTime;
}

/**
 * Calculate idle time from events
 * @param {Array} events - Array of events
 * @returns {number} Idle time in milliseconds
 */
function calculateIdleTime(events) {
  let idleTime = 0;
  
  // Find SYSTEM_IDLE events
  const idleEvents = events.filter(event => 
    event.event_type === EVENT_TYPES.SYSTEM_IDLE);
  
  // Sum up idle durations
  for (const event of idleEvents) {
    if (event.payload && event.payload.duration) {
      idleTime += event.payload.duration;
    }
  }
  
  return idleTime;
}

/**
 * Count occurrences of a specific event type
 * @param {Array} events - Array of events
 * @param {string} eventType - Event type to count
 * @returns {number} Count of events
 */
function countEventType(events, eventType) {
  return events.filter(event => event.event_type === eventType).length;
}

/**
 * Check if events contain a specific event type
 * @param {Array} events - Array of events
 * @param {string} eventType - Event type to check
 * @returns {boolean} Whether events contain the event type
 */
function hasEventType(events, eventType) {
  return events.some(event => event.event_type === eventType);
}

/**
 * Calculate video watch time from events
 * @param {Array} events - Array of events
 * @returns {number} Video watch time in seconds
 */
function calculateVideoWatchTime(events) {
  let watchTime = 0;
  let videoStartTime = null;
  
  for (const event of events) {
    if (event.event_type === EVENT_TYPES.VIDEO_PLAY) {
      videoStartTime = event.timestamp;
    } else if (event.event_type === EVENT_TYPES.VIDEO_PAUSE && videoStartTime !== null) {
      watchTime += (event.timestamp - videoStartTime) / 1000; // Convert to seconds
      videoStartTime = null;
    } else if (event.event_type === EVENT_TYPES.VIDEO_PROGRESS && event.payload && event.payload.currentTime) {
      // Some video progress events might include the current playback time
      watchTime = Math.max(watchTime, event.payload.currentTime);
    }
  }
  
  // If video was playing at the end of the session
  if (videoStartTime !== null && events.length > 0) {
    watchTime += (events[events.length - 1].timestamp - videoStartTime) / 1000;
  }
  
  return watchTime;
}

/**
 * Calculate rate of events per minute
 * @param {number} count - Count of events
 * @param {number} duration - Duration in milliseconds
 * @returns {number} Rate per minute
 */
function calculateRate(count, duration) {
  if (duration === 0) {
    return 0;
  }
  
  // Convert duration to minutes and calculate rate
  const durationMinutes = duration / (60 * 1000);
  return count / durationMinutes;
}

/**
 * Calculate engagement score from events
 * @param {Array} events - Array of events
 * @returns {number} Engagement score (0-1)
 */
function calculateEngagementScore(events) {
  // Define weights for different event types
  const weights = {
    [EVENT_TYPES.MOUSE_CLICK]: 1.0,
    [EVENT_TYPES.KEY_PRESS]: 0.8,
    [EVENT_TYPES.SCROLL]: 0.3,
    [EVENT_TYPES.CONTENT_LOAD]: 0.5,
    [EVENT_TYPES.VIDEO_PLAY]: 0.7,
    [EVENT_TYPES.AUDIO_PLAY]: 0.6
  };
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const event of events) {
    const weight = weights[event.event_type] || 0.1;
    weightedSum += weight;
    totalWeight += 1;
  }
  
  if (totalWeight === 0) {
    return 0;
  }
  
  // Normalize to 0-1 range
  return Math.min(1, weightedSum / (totalWeight * 0.8));
}

/**
 * Calculate focus ratio from events
 * @param {Array} events - Array of events
 * @returns {number} Focus ratio (0-1)
 */
function calculateFocusRatio(events) {
  let focusTime = 0;
  let totalTime = 0;
  
  // Find visibility events
  const visibilityEvents = events.filter(event => 
    event.event_type === EVENT_TYPES.VISIBILITY_CHANGE);
  
  if (visibilityEvents.length < 2) {
    return 1; // Default to focused if not enough data
  }
  
  let isVisible = true; // Assume visible at start
  let lastTimestamp = events[0].timestamp;
  
  for (const event of visibilityEvents) {
    const duration = event.timestamp - lastTimestamp;
    
    if (isVisible) {
      focusTime += duration;
    }
    
    totalTime += duration;
    lastTimestamp = event.timestamp;
    
    // Toggle visibility state
    if (event.payload && typeof event.payload.isVisible === 'boolean') {
      isVisible = event.payload.isVisible;
    } else {
      isVisible = !isVisible; // Toggle if not specified
    }
  }
  
  // Add time since last visibility event
  if (events.length > 0) {
    const duration = events[events.length - 1].timestamp - lastTimestamp;
    if (isVisible) {
      focusTime += duration;
    }
    totalTime += duration;
  }
  
  if (totalTime === 0) {
    return 1;
  }
  
  return focusTime / totalTime;
}

/**
 * Determine content type from events and domain
 * @param {Array} events - Array of events
 * @param {string} domain - Domain
 * @returns {string} Content type
 */
function determineContentType(events, domain) {
  // Check for video content
  if (hasEventType(events, EVENT_TYPES.VIDEO_PLAY)) {
    return 'video';
  }
  
  // Check for audio content
  if (hasEventType(events, EVENT_TYPES.AUDIO_PLAY)) {
    return 'audio';
  }
  
  // Check domain against known types
  const domainTypes = {
    'youtube.com': 'video',
    'vimeo.com': 'video',
    'netflix.com': 'video',
    'hulu.com': 'video',
    'spotify.com': 'audio',
    'soundcloud.com': 'audio',
    'facebook.com': 'social',
    'twitter.com': 'social',
    'instagram.com': 'social',
    'linkedin.com': 'social',
    'reddit.com': 'social',
    'github.com': 'productivity',
    'docs.google.com': 'productivity',
    'sheets.google.com': 'productivity',
    'slides.google.com': 'productivity',
    'notion.so': 'productivity',
    'trello.com': 'productivity',
    'asana.com': 'productivity',
    'jira.com': 'productivity',
    'news.google.com': 'news',
    'nytimes.com': 'news',
    'cnn.com': 'news',
    'bbc.com': 'news',
    'amazon.com': 'shopping',
    'ebay.com': 'shopping',
    'etsy.com': 'shopping'
  };
  
  for (const [domainPattern, type] of Object.entries(domainTypes)) {
    if (domain.includes(domainPattern)) {
      return type;
    }
  }
  
  // Check for content load events with specific types
  const contentLoadEvents = events.filter(event => 
    event.event_type === EVENT_TYPES.CONTENT_LOAD && 
    event.payload && 
    event.payload.contentType);
  
  if (contentLoadEvents.length > 0) {
    // Use the most common content type
    const typeCounts = {};
    for (const event of contentLoadEvents) {
      const type = event.payload.contentType;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    
    let maxCount = 0;
    let maxType = 'unknown';
    
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxType = type;
      }
    }
    
    return maxType;
  }
  
  return 'unknown';
}

/**
 * Add features for different time windows
 * @param {Object} features - Features object to modify
 * @param {Array} events - Array of events
 * @param {Object} timeWindows - Time windows configuration
 */
function addTimeWindowFeatures(features, events, timeWindows) {
  const now = Date.now();
  
  // Add features for each time window
  for (const [windowName, windowDuration] of Object.entries(timeWindows)) {
    const windowStart = now - windowDuration;
    const windowEvents = events.filter(event => event.timestamp >= windowStart);
    
    features[`${windowName}EventCount`] = windowEvents.length;
    features[`${windowName}ScrollCount`] = countEventType(windowEvents, EVENT_TYPES.SCROLL);
    features[`${windowName}ClickCount`] = countEventType(windowEvents, EVENT_TYPES.MOUSE_CLICK);
    features[`${windowName}KeyPressCount`] = countEventType(windowEvents, EVENT_TYPES.KEY_PRESS);
    features[`${windowName}TabSwitchCount`] = countEventType(windowEvents, EVENT_TYPES.TAB_SWITCH);
    features[`${windowName}EngagementScore`] = calculateEngagementScore(windowEvents);
  }
}

/**
 * Add domain-specific features
 * @param {Object} features - Features object to modify
 * @param {Array} events - Array of events
 * @param {string} domain - Domain
 */
function addDomainSpecificFeatures(features, events, domain) {
  // Social media specific features
  if (['facebook.com', 'twitter.com', 'instagram.com', 'reddit.com', 'tiktok.com'].some(d => domain.includes(d))) {
    features.isSocialMedia = true;
    features.feedScrollCount = countEventType(events, EVENT_TYPES.SCROLL);
    features.socialEngagement = calculateSocialEngagement(events);
  } else {
    features.isSocialMedia = false;
  }
  
  // Video platform specific features
  if (['youtube.com', 'netflix.com', 'hulu.com', 'twitch.tv', 'vimeo.com'].some(d => domain.includes(d))) {
    features.isVideoPlatform = true;
    features.videoCount = countVideoEvents(events);
    features.videoCompletionRate = calculateVideoCompletionRate(events);
  } else {
    features.isVideoPlatform = false;
  }
  
  // Shopping platform specific features
  if (['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com'].some(d => domain.includes(d))) {
    features.isShoppingPlatform = true;
    features.productViewCount = countProductViews(events);
  } else {
    features.isShoppingPlatform = false;
  }
  
  // News platform specific features
  if (['cnn.com', 'nytimes.com', 'bbc.com', 'washingtonpost.com', 'news.google.com'].some(d => domain.includes(d))) {
    features.isNewsPlatform = true;
    features.articleCount = countArticleViews(events);
  } else {
    features.isNewsPlatform = false;
  }
  
  // Productivity platform specific features
  if (['github.com', 'docs.google.com', 'notion.so', 'trello.com', 'asana.com', 'jira.com'].some(d => domain.includes(d))) {
    features.isProductivityPlatform = true;
    features.editCount = countEditEvents(events);
  } else {
    features.isProductivityPlatform = false;
  }
}

/**
 * Calculate social engagement score
 * @param {Array} events - Array of events
 * @returns {number} Social engagement score (0-1)
 */
function calculateSocialEngagement(events) {
  // Count interactions that indicate social engagement
  const interactionCount = events.filter(event => 
    event.event_type === EVENT_TYPES.MOUSE_CLICK || 
    event.event_type === EVENT_TYPES.KEY_PRESS).length;
  
  // Count scroll events (passive consumption)
  const scrollCount = countEventType(events, EVENT_TYPES.SCROLL);
  
  if (interactionCount + scrollCount === 0) {
    return 0;
  }
  
  // Higher ratio of interactions to scrolls indicates more engagement
  return Math.min(1, interactionCount / (interactionCount + scrollCount * 0.2));
}

/**
 * Count video-related events
 * @param {Array} events - Array of events
 * @returns {number} Count of video events
 */
function countVideoEvents(events) {
  return events.filter(event => 
    event.event_type === EVENT_TYPES.VIDEO_PLAY || 
    event.event_type === EVENT_TYPES.VIDEO_PAUSE || 
    event.event_type === EVENT_TYPES.VIDEO_PROGRESS).length;
}

/**
 * Calculate video completion rate
 * @param {Array} events - Array of events
 * @returns {number} Video completion rate (0-1)
 */
function calculateVideoCompletionRate(events) {
  const videoProgressEvents = events.filter(event => 
    event.event_type === EVENT_TYPES.VIDEO_PROGRESS && 
    event.payload && 
    typeof event.payload.progress === 'number');
  
  if (videoProgressEvents.length === 0) {
    return 0;
  }
  
  // Find the maximum progress value
  let maxProgress = 0;
  for (const event of videoProgressEvents) {
    maxProgress = Math.max(maxProgress, event.payload.progress);
  }
  
  return Math.min(1, maxProgress);
}

/**
 * Count product view events
 * @param {Array} events - Array of events
 * @returns {number} Count of product views
 */
function countProductViews(events) {
  return events.filter(event => 
    event.event_type === EVENT_TYPES.PAGE_VISIT && 
    event.payload && 
    event.payload.pageType === 'product').length;
}

/**
 * Count article view events
 * @param {Array} events - Array of events
 * @returns {number} Count of article views
 */
function countArticleViews(events) {
  return events.filter(event => 
    event.event_type === EVENT_TYPES.PAGE_VISIT && 
    event.payload && 
    event.payload.pageType === 'article').length;
}

/**
 * Count edit events
 * @param {Array} events - Array of events
 * @returns {number} Count of edit events
 */
function countEditEvents(events) {
  return events.filter(event => 
    event.event_type === EVENT_TYPES.KEY_PRESS && 
    event.payload && 
    event.payload.isEdit).length;
}

/**
 * Add temporal features
 * @param {Object} features - Features object to modify
 * @param {number} timestamp - Current timestamp
 */
function addTemporalFeatures(features, timestamp) {
  const date = new Date(timestamp);
  
  // Time of day (0-23)
  features.hourOfDay = date.getHours();
  
  // Day of week (0-6, 0 is Sunday)
  features.dayOfWeek = date.getDay();
  
  // Is weekend
  features.isWeekend = features.dayOfWeek === 0 || features.dayOfWeek === 6;
  
  // Time categories
  features.isWorkingHours = features.hourOfDay >= 9 && features.hourOfDay < 17 && !features.isWeekend;
  features.isEvening = features.hourOfDay >= 17 && features.hourOfDay < 22;
  features.isNight = features.hourOfDay >= 22 || features.hourOfDay < 6;
  
  // Part of day
  if (features.hourOfDay >= 5 && features.hourOfDay < 12) {
    features.partOfDay = 'morning';
  } else if (features.hourOfDay >= 12 && features.hourOfDay < 17) {
    features.partOfDay = 'afternoon';
  } else if (features.hourOfDay >= 17 && features.hourOfDay < 22) {
    features.partOfDay = 'evening';
  } else {
    features.partOfDay = 'night';
  }
} 