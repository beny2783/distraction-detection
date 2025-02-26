/**
 * Focus Nudge - Analytics Insights Service
 * 
 * This module analyzes event streams to generate insights about user behavior,
 * distraction patterns, and productivity trends. These insights can be used
 * to provide personalized feedback and recommendations to users.
 */

import { EVENT_TYPES } from '../events/schema.js';
import { extractFeatures } from '../features/extractor.js';

/**
 * Generate insights from event streams
 * @param {Array} events - Array of events
 * @param {Object} options - Options for insight generation
 * @returns {Object} Generated insights
 */
export function generateInsights(events, options = {}) {
  // Default options
  const config = {
    includeBasicStats: true,
    includeTemporalAnalysis: true,
    includeDomainAnalysis: true,
    includeContentAnalysis: true,
    includeInteractionAnalysis: true,
    includeRecommendations: true,
    ...options
  };
  
  // If no events, return empty insights
  if (!events || events.length === 0) {
    return {
      timestamp: Date.now(),
      eventCount: 0,
      insights: [],
      recommendations: []
    };
  }
  
  // Sort events by timestamp (oldest first)
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  
  // Extract features for analysis
  const features = extractFeatures(sortedEvents);
  
  // Initialize insights object
  const insights = {
    timestamp: Date.now(),
    eventCount: sortedEvents.length,
    domain: features.domain,
    sessionDuration: features.sessionDuration,
    insights: [],
    recommendations: []
  };
  
  // Add basic statistics if enabled
  if (config.includeBasicStats) {
    addBasicStats(insights, sortedEvents, features);
  }
  
  // Add temporal analysis if enabled
  if (config.includeTemporalAnalysis) {
    addTemporalAnalysis(insights, sortedEvents, features);
  }
  
  // Add domain analysis if enabled
  if (config.includeDomainAnalysis) {
    addDomainAnalysis(insights, sortedEvents, features);
  }
  
  // Add content analysis if enabled
  if (config.includeContentAnalysis) {
    addContentAnalysis(insights, sortedEvents, features);
  }
  
  // Add interaction analysis if enabled
  if (config.includeInteractionAnalysis) {
    addInteractionAnalysis(insights, sortedEvents, features);
  }
  
  // Add recommendations if enabled
  if (config.includeRecommendations) {
    addRecommendations(insights, sortedEvents, features);
  }
  
  return insights;
}

/**
 * Add basic statistics to insights
 * @param {Object} insights - Insights object to modify
 * @param {Array} events - Array of events
 * @param {Object} features - Extracted features
 */
function addBasicStats(insights, events, features) {
  insights.stats = {
    // Time metrics
    timeSpent: formatDuration(features.timeSpent),
    activeTime: formatDuration(features.activeTime),
    idleTime: formatDuration(features.idleTime),
    
    // Interaction metrics
    scrollCount: features.scrollCount,
    clickCount: features.clickCount,
    keyPressCount: features.keyPressCount,
    
    // Navigation metrics
    pageVisitCount: features.pageVisitCount,
    tabSwitchCount: features.tabSwitchCount,
    
    // Engagement metrics
    engagementScore: features.engagementScore,
    focusRatio: features.focusRatio,
    
    // Content metrics
    contentType: features.contentType,
    hasVideo: features.hasVideo,
    videoWatchTime: features.hasVideo ? formatDuration(features.videoWatchTime * 1000) : '0s'
  };
  
  // Add basic insights
  if (features.timeSpent > 15 * 60 * 1000) { // More than 15 minutes
    insights.insights.push({
      type: 'time_spent',
      importance: 'high',
      message: `You've spent ${formatDuration(features.timeSpent)} on ${features.domain}.`
    });
  }
  
  if (features.engagementScore < 0.3 && features.timeSpent > 5 * 60 * 1000) {
    insights.insights.push({
      type: 'low_engagement',
      importance: 'medium',
      message: 'Your engagement with this content is relatively low, suggesting passive consumption.'
    });
  }
  
  if (features.focusRatio < 0.7 && features.timeSpent > 5 * 60 * 1000) {
    insights.insights.push({
      type: 'low_focus',
      importance: 'medium',
      message: 'You frequently switched away from this tab, indicating potential distractions.'
    });
  }
}

/**
 * Add temporal analysis to insights
 * @param {Object} insights - Insights object to modify
 * @param {Array} events - Array of events
 * @param {Object} features - Extracted features
 */
function addTemporalAnalysis(insights, events, features) {
  // Analyze time of day patterns
  const hourOfDay = new Date().getHours();
  const isWorkingHours = hourOfDay >= 9 && hourOfDay < 17;
  const isEvening = hourOfDay >= 17 && hourOfDay < 22;
  
  insights.temporalAnalysis = {
    timeOfDay: formatTimeOfDay(hourOfDay),
    isWorkingHours,
    isEvening,
    isWeekend: features.isWeekend
  };
  
  // Add temporal insights
  if (isWorkingHours && features.contentType === 'social' && features.timeSpent > 10 * 60 * 1000) {
    insights.insights.push({
      type: 'work_hours_distraction',
      importance: 'high',
      message: 'You\'re spending significant time on social media during work hours.'
    });
  }
  
  if (isEvening && features.contentType === 'productivity' && features.timeSpent > 30 * 60 * 1000) {
    insights.insights.push({
      type: 'evening_work',
      importance: 'medium',
      message: 'You\'re working late in the evening. Consider setting boundaries for work-life balance.'
    });
  }
  
  // Analyze session timing
  const sessionStartTime = events[0].timestamp;
  const sessionEndTime = events[events.length - 1].timestamp;
  
  insights.temporalAnalysis.sessionStart = new Date(sessionStartTime).toLocaleTimeString();
  insights.temporalAnalysis.sessionEnd = new Date(sessionEndTime).toLocaleTimeString();
  
  // Check for late night usage
  const startHour = new Date(sessionStartTime).getHours();
  if ((startHour >= 23 || startHour < 5) && features.timeSpent > 15 * 60 * 1000) {
    insights.insights.push({
      type: 'late_night_usage',
      importance: 'medium',
      message: 'Late night screen time can affect sleep quality. Consider using night mode or taking a break.'
    });
  }
}

/**
 * Add domain analysis to insights
 * @param {Object} insights - Insights object to modify
 * @param {Array} events - Array of events
 * @param {Object} features - Extracted features
 */
function addDomainAnalysis(insights, events, features) {
  // Categorize domain
  const domainCategory = categorizeDomain(features.domain);
  
  insights.domainAnalysis = {
    domain: features.domain,
    category: domainCategory,
    isProductivity: domainCategory === 'productivity',
    isEntertainment: ['social', 'video', 'gaming'].includes(domainCategory),
    isShopping: domainCategory === 'shopping',
    isNews: domainCategory === 'news'
  };
  
  // Add domain-specific insights
  if (insights.domainAnalysis.isEntertainment && features.timeSpent > 30 * 60 * 1000) {
    insights.insights.push({
      type: 'entertainment_time',
      importance: 'medium',
      message: `You've spent ${formatDuration(features.timeSpent)} on entertainment content.`
    });
  }
  
  if (insights.domainAnalysis.isShopping && features.timeSpent > 20 * 60 * 1000) {
    insights.insights.push({
      type: 'shopping_time',
      importance: 'medium',
      message: 'Extended shopping sessions can lead to impulse purchases. Consider making a list before shopping.'
    });
  }
  
  // Check for frequent domain visits
  if (features.pageVisitCount > 5 && features.sessionDuration < 10 * 60 * 1000) {
    insights.insights.push({
      type: 'frequent_visits',
      importance: 'medium',
      message: 'You\'ve visited this site multiple times in a short period, which may indicate habitual checking.'
    });
  }
}

/**
 * Add content analysis to insights
 * @param {Object} insights - Insights object to modify
 * @param {Array} events - Array of events
 * @param {Object} features - Extracted features
 */
function addContentAnalysis(insights, events, features) {
  insights.contentAnalysis = {
    contentType: features.contentType,
    hasVideo: features.hasVideo,
    videoWatchTime: features.videoWatchTime,
    contentDepth: calculateContentDepth(events, features)
  };
  
  // Add content-specific insights
  if (features.hasVideo && features.videoWatchTime > 30 * 60) {
    insights.insights.push({
      type: 'video_time',
      importance: 'medium',
      message: `You've watched videos for ${formatDuration(features.videoWatchTime * 1000)}.`
    });
  }
  
  // Analyze scroll depth
  const scrollDepth = calculateScrollDepth(events);
  insights.contentAnalysis.scrollDepth = scrollDepth;
  
  if (scrollDepth > 0.8 && features.contentType === 'article') {
    insights.insights.push({
      type: 'deep_reading',
      importance: 'low',
      message: 'You\'ve read this article thoroughly, indicating good engagement with the content.'
    });
  }
  
  // Analyze content consumption rate
  if (features.contentType === 'article' && features.scrollRate > 5 && scrollDepth > 0.7) {
    insights.insights.push({
      type: 'fast_reading',
      importance: 'low',
      message: 'You\'re reading quickly while still covering most of the content.'
    });
  }
}

/**
 * Add interaction analysis to insights
 * @param {Object} insights - Insights object to modify
 * @param {Array} events - Array of events
 * @param {Object} features - Extracted features
 */
function addInteractionAnalysis(insights, events, features) {
  insights.interactionAnalysis = {
    scrollRate: features.scrollRate,
    clickRate: features.clickRate,
    keyPressRate: features.keyPressRate,
    interactionPatterns: analyzeInteractionPatterns(events)
  };
  
  // Add interaction-specific insights
  if (features.scrollRate > 10 && features.clickCount < 3 && features.timeSpent > 5 * 60 * 1000) {
    insights.insights.push({
      type: 'passive_scrolling',
      importance: 'high',
      message: 'Your browsing pattern shows mostly passive scrolling with minimal interaction.'
    });
  }
  
  if (features.tabSwitchCount > 10 && features.sessionDuration < 15 * 60 * 1000) {
    insights.insights.push({
      type: 'frequent_switching',
      importance: 'high',
      message: 'You\'re frequently switching between tabs, which may indicate distraction or multitasking.'
    });
  }
  
  // Analyze idle periods
  const idlePeriods = countIdlePeriods(events);
  insights.interactionAnalysis.idlePeriods = idlePeriods;
  
  if (idlePeriods > 3 && features.sessionDuration > 15 * 60 * 1000) {
    insights.insights.push({
      type: 'frequent_idle',
      importance: 'medium',
      message: 'You have several periods of inactivity, suggesting potential disengagement.'
    });
  }
}

/**
 * Add recommendations to insights
 * @param {Object} insights - Insights object to modify
 * @param {Array} events - Array of events
 * @param {Object} features - Extracted features
 */
function addRecommendations(insights, events, features) {
  // Base recommendations on insights
  for (const insight of insights.insights) {
    switch (insight.type) {
      case 'time_spent':
        insights.recommendations.push({
          type: 'time_limit',
          message: 'Consider setting a time limit for this site to maintain balance.'
        });
        break;
        
      case 'low_engagement':
        insights.recommendations.push({
          type: 'engagement',
          message: 'If this content is important, try to engage more actively by taking notes or summarizing key points.'
        });
        break;
        
      case 'low_focus':
        insights.recommendations.push({
          type: 'focus',
          message: 'Try using focus mode or closing unnecessary tabs to reduce distractions.'
        });
        break;
        
      case 'work_hours_distraction':
        insights.recommendations.push({
          type: 'work_focus',
          message: 'Consider scheduling specific break times for social media during work hours.'
        });
        break;
        
      case 'evening_work':
        insights.recommendations.push({
          type: 'work_life_balance',
          message: 'Set a cutoff time for work activities to maintain work-life balance.'
        });
        break;
        
      case 'late_night_usage':
        insights.recommendations.push({
          type: 'sleep_hygiene',
          message: 'Try to avoid screens at least 1 hour before bedtime for better sleep quality.'
        });
        break;
        
      case 'entertainment_time':
        insights.recommendations.push({
          type: 'entertainment_balance',
          message: 'Schedule entertainment time intentionally rather than defaulting to it.'
        });
        break;
        
      case 'shopping_time':
        insights.recommendations.push({
          type: 'shopping_intention',
          message: 'Make a shopping list before browsing to avoid impulse purchases.'
        });
        break;
        
      case 'frequent_visits':
        insights.recommendations.push({
          type: 'habit_awareness',
          message: 'Try to batch-check this site at specific times rather than frequently throughout the day.'
        });
        break;
        
      case 'video_time':
        insights.recommendations.push({
          type: 'video_breaks',
          message: 'Take short breaks between videos to reflect on what you\'ve watched.'
        });
        break;
        
      case 'passive_scrolling':
        insights.recommendations.push({
          type: 'active_browsing',
          message: 'Set an intention for your browsing session to make it more purposeful.'
        });
        break;
        
      case 'frequent_switching':
        insights.recommendations.push({
          type: 'single_tasking',
          message: 'Try focusing on one task at a time for better productivity and focus.'
        });
        break;
        
      case 'frequent_idle':
        insights.recommendations.push({
          type: 'engagement_check',
          message: 'Check if this content is truly engaging you or if you might benefit from a different activity.'
        });
        break;
    }
  }
  
  // Add general recommendations based on features
  if (insights.recommendations.length === 0) {
    // If no specific recommendations, add general ones
    if (features.contentType === 'social' || features.contentType === 'video') {
      insights.recommendations.push({
        type: 'content_awareness',
        message: 'Be mindful of how much time you spend on entertainment content throughout the day.'
      });
    }
    
    if (features.timeSpent > 20 * 60 * 1000) {
      insights.recommendations.push({
        type: 'break_reminder',
        message: 'Remember to take short breaks every 20-30 minutes to rest your eyes and move around.'
      });
    }
  }
}

/**
 * Format duration in milliseconds to human-readable string
 * @param {number} duration - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(duration) {
  const seconds = Math.floor(duration / 1000) % 60;
  const minutes = Math.floor(duration / (1000 * 60)) % 60;
  const hours = Math.floor(duration / (1000 * 60 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format time of day
 * @param {number} hour - Hour of day (0-23)
 * @returns {string} Formatted time of day
 */
function formatTimeOfDay(hour) {
  if (hour >= 5 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 17) {
    return 'afternoon';
  } else if (hour >= 17 && hour < 22) {
    return 'evening';
  } else {
    return 'night';
  }
}

/**
 * Categorize domain
 * @param {string} domain - Domain
 * @returns {string} Domain category
 */
function categorizeDomain(domain) {
  const categories = {
    'social': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'reddit.com', 'tiktok.com'],
    'video': ['youtube.com', 'netflix.com', 'hulu.com', 'twitch.tv', 'vimeo.com', 'disney.com'],
    'productivity': ['github.com', 'docs.google.com', 'sheets.google.com', 'notion.so', 'trello.com', 'asana.com', 'jira.com'],
    'news': ['cnn.com', 'nytimes.com', 'bbc.com', 'washingtonpost.com', 'news.google.com', 'reuters.com'],
    'shopping': ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com', 'bestbuy.com'],
    'education': ['coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'duolingo.com'],
    'gaming': ['twitch.tv', 'steam.com', 'epicgames.com', 'roblox.com', 'minecraft.net'],
    'finance': ['chase.com', 'bankofamerica.com', 'wellsfargo.com', 'mint.com', 'robinhood.com']
  };
  
  for (const [category, domains] of Object.entries(categories)) {
    if (domains.some(d => domain.includes(d))) {
      return category;
    }
  }
  
  return 'other';
}

/**
 * Calculate content depth based on events
 * @param {Array} events - Array of events
 * @param {Object} features - Extracted features
 * @returns {number} Content depth score (0-1)
 */
function calculateContentDepth(events, features) {
  // For articles, use scroll depth
  if (features.contentType === 'article') {
    return calculateScrollDepth(events);
  }
  
  // For videos, use video completion rate
  if (features.hasVideo) {
    const videoProgressEvents = events.filter(event => 
      event.event_type === EVENT_TYPES.VIDEO_PROGRESS && 
      event.payload && 
      typeof event.payload.progress === 'number');
    
    if (videoProgressEvents.length > 0) {
      let maxProgress = 0;
      for (const event of videoProgressEvents) {
        maxProgress = Math.max(maxProgress, event.payload.progress);
      }
      return Math.min(1, maxProgress);
    }
  }
  
  // For other content, use a combination of time spent and interaction
  const timeWeight = Math.min(1, features.timeSpent / (10 * 60 * 1000)); // Cap at 10 minutes
  const interactionWeight = Math.min(1, (features.clickCount + features.keyPressCount) / 20); // Cap at 20 interactions
  
  return (timeWeight * 0.7) + (interactionWeight * 0.3);
}

/**
 * Calculate scroll depth from events
 * @param {Array} events - Array of events
 * @returns {number} Scroll depth (0-1)
 */
function calculateScrollDepth(events) {
  const scrollEvents = events.filter(event => 
    event.event_type === EVENT_TYPES.SCROLL && 
    event.payload && 
    typeof event.payload.scrollDepth === 'number');
  
  if (scrollEvents.length === 0) {
    return 0;
  }
  
  // Find the maximum scroll depth
  let maxScrollDepth = 0;
  for (const event of scrollEvents) {
    maxScrollDepth = Math.max(maxScrollDepth, event.payload.scrollDepth);
  }
  
  return Math.min(1, maxScrollDepth);
}

/**
 * Analyze interaction patterns from events
 * @param {Array} events - Array of events
 * @returns {Object} Interaction patterns
 */
function analyzeInteractionPatterns(events) {
  // Initialize pattern object
  const patterns = {
    burstCounts: 0,
    longPauses: 0,
    rapidScrolling: 0,
    deepEngagement: 0
  };
  
  // Identify bursts of activity
  let lastActivityTime = null;
  let burstEvents = 0;
  
  for (const event of events) {
    // Skip visibility and idle events
    if (event.event_type === EVENT_TYPES.VISIBILITY_CHANGE || 
        event.event_type === EVENT_TYPES.SYSTEM_IDLE) {
      continue;
    }
    
    if (lastActivityTime === null) {
      lastActivityTime = event.timestamp;
      burstEvents = 1;
      continue;
    }
    
    const timeSinceLastActivity = event.timestamp - lastActivityTime;
    
    if (timeSinceLastActivity < 2000) { // Less than 2 seconds
      burstEvents++;
      
      // If we have 5+ events in quick succession, count as a burst
      if (burstEvents >= 5) {
        patterns.burstCounts++;
        burstEvents = 0;
      }
    } else if (timeSinceLastActivity > 60000) { // More than 1 minute
      patterns.longPauses++;
      burstEvents = 1;
    } else {
      burstEvents = 1;
    }
    
    lastActivityTime = event.timestamp;
  }
  
  // Identify rapid scrolling
  let rapidScrollCount = 0;
  let lastScrollTime = null;
  
  for (const event of events) {
    if (event.event_type !== EVENT_TYPES.SCROLL) {
      continue;
    }
    
    if (lastScrollTime === null) {
      lastScrollTime = event.timestamp;
      continue;
    }
    
    const timeSinceLastScroll = event.timestamp - lastScrollTime;
    
    if (timeSinceLastScroll < 300) { // Less than 300ms between scrolls
      rapidScrollCount++;
      
      if (rapidScrollCount >= 5) {
        patterns.rapidScrolling++;
        rapidScrollCount = 0;
      }
    } else {
      rapidScrollCount = 0;
    }
    
    lastScrollTime = event.timestamp;
  }
  
  // Identify deep engagement (clicks followed by typing)
  for (let i = 0; i < events.length - 2; i++) {
    if (events[i].event_type === EVENT_TYPES.MOUSE_CLICK &&
        events[i+1].event_type === EVENT_TYPES.KEY_PRESS &&
        events[i+2].event_type === EVENT_TYPES.KEY_PRESS) {
      patterns.deepEngagement++;
      i += 2; // Skip the events we just counted
    }
  }
  
  return patterns;
}

/**
 * Count idle periods from events
 * @param {Array} events - Array of events
 * @returns {number} Count of idle periods
 */
function countIdlePeriods(events) {
  let idlePeriods = 0;
  let lastActivityTime = null;
  
  for (const event of events) {
    // Skip visibility and idle events
    if (event.event_type === EVENT_TYPES.VISIBILITY_CHANGE || 
        event.event_type === EVENT_TYPES.SYSTEM_IDLE) {
      continue;
    }
    
    if (lastActivityTime === null) {
      lastActivityTime = event.timestamp;
      continue;
    }
    
    const timeSinceLastActivity = event.timestamp - lastActivityTime;
    
    if (timeSinceLastActivity > 2 * 60 * 1000) { // More than 2 minutes
      idlePeriods++;
    }
    
    lastActivityTime = event.timestamp;
  }
  
  return idlePeriods;
} 