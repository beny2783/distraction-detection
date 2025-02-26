/**
 * Focus Nudge - Task Detection
 * 
 * This module provides functionality to automatically detect user tasks
 * based on their browsing behavior and page interactions.
 */

import { EVENT_TYPES } from '../events/schema.js';

// Task types
export const TASK_TYPES = {
  JOB_SEARCH: 'job_search',
  LEARNING: 'learning',
  SOCIAL_BROWSING: 'social_browsing',
  SHOPPING: 'shopping',
  ENTERTAINMENT: 'entertainment',
  RESEARCH: 'research',
  COMMUNICATION: 'communication',
  UNKNOWN: 'unknown'
};

// Task detection configuration
const DEFAULT_CONFIG = {
  // Minimum confidence score to consider a task detected
  minimumConfidence: 0.7,
  
  // Minimum number of events needed for reliable task detection
  minEventsForDetection: 10,
  
  // Time window for task detection (in milliseconds)
  detectionTimeWindow: 5 * 60 * 1000, // 5 minutes
  
  // Whether to use URL patterns for detection
  useUrlPatterns: true,
  
  // Whether to use page content for detection
  usePageContent: true,
  
  // Whether to use user interactions for detection
  useUserInteractions: true
};

/**
 * Detect the current task based on events
 * @param {Array} events - Array of events
 * @param {Object} options - Task detection options
 * @returns {Object} Detected task with confidence score
 */
export function detectTask(events, options = {}) {
  // Merge default config with provided options
  const config = { ...DEFAULT_CONFIG, ...options };
  
  // If no events or too few events, return unknown task
  if (!events || events.length < config.minEventsForDetection) {
    return {
      taskType: TASK_TYPES.UNKNOWN,
      confidence: 0,
      detectionMethod: 'insufficient_data'
    };
  }
  
  // Sort events by timestamp (newest first)
  const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);
  
  // Get recent events within the detection time window
  const currentTime = Date.now();
  const recentEvents = sortedEvents.filter(
    event => (currentTime - event.timestamp) <= config.detectionTimeWindow
  );
  
  // If too few recent events, return unknown task
  if (recentEvents.length < config.minEventsForDetection) {
    return {
      taskType: TASK_TYPES.UNKNOWN,
      confidence: 0,
      detectionMethod: 'insufficient_recent_data'
    };
  }
  
  // Extract domain from events
  const domain = extractDomain(recentEvents);
  
  // Detect task based on domain-specific rules
  let taskDetection = detectTaskByDomain(domain, recentEvents, config);
  
  // If confidence is below threshold, try URL pattern detection
  if (taskDetection.confidence < config.minimumConfidence && config.useUrlPatterns) {
    const urlPatternDetection = detectTaskByUrlPatterns(recentEvents, config);
    if (urlPatternDetection.confidence > taskDetection.confidence) {
      taskDetection = urlPatternDetection;
    }
  }
  
  // If confidence is still below threshold, try page content detection
  if (taskDetection.confidence < config.minimumConfidence && config.usePageContent) {
    const contentDetection = detectTaskByPageContent(recentEvents, config);
    if (contentDetection.confidence > taskDetection.confidence) {
      taskDetection = contentDetection;
    }
  }
  
  // If confidence is still below threshold, try user interaction detection
  if (taskDetection.confidence < config.minimumConfidence && config.useUserInteractions) {
    const interactionDetection = detectTaskByUserInteractions(recentEvents, config);
    if (interactionDetection.confidence > taskDetection.confidence) {
      taskDetection = interactionDetection;
    }
  }
  
  return taskDetection;
}

/**
 * Extract domain from events
 * @param {Array} events - Array of events
 * @returns {string} Domain
 */
function extractDomain(events) {
  // Try to get domain from PAGE_VISIT events first
  const pageVisitEvents = events.filter(event => event.event_type === EVENT_TYPES.PAGE_VISIT);
  if (pageVisitEvents.length > 0 && pageVisitEvents[0].payload && pageVisitEvents[0].payload.domain) {
    return pageVisitEvents[0].payload.domain;
  }
  
  // If no PAGE_VISIT events, try to extract from URL
  if (events.length > 0 && events[0].url) {
    try {
      const url = new URL(events[0].url);
      return url.hostname;
    } catch (error) {
      console.error('Error extracting domain from URL:', error);
    }
  }
  
  return '';
}

/**
 * Detect task based on domain-specific rules
 * @param {string} domain - Website domain
 * @param {Array} events - Array of events
 * @param {Object} config - Task detection configuration
 * @returns {Object} Detected task with confidence score
 */
function detectTaskByDomain(domain, events, config) {
  // LinkedIn job search detection
  if (domain.includes('linkedin.com')) {
    return detectLinkedInJobSearch(events, config);
  }
  
  // Default to unknown task
  return {
    taskType: TASK_TYPES.UNKNOWN,
    confidence: 0,
    detectionMethod: 'domain_rules'
  };
}

/**
 * Detect LinkedIn job search task
 * @param {Array} events - Array of events
 * @param {Object} config - Task detection configuration
 * @returns {Object} Detected task with confidence score
 */
function detectLinkedInJobSearch(events, config) {
  let confidence = 0;
  let evidencePoints = [];
  
  // Check for job-related URL patterns
  const jobUrlPatterns = [
    '/jobs/',
    '/job/',
    '/careers/',
    '/career/',
    'job-search',
    'jobs-search',
    'job-listing',
    'jobs-listing'
  ];
  
  // Check URL patterns in events
  const urlEvents = events.filter(event => event.url);
  const jobUrlMatches = urlEvents.filter(event => {
    return jobUrlPatterns.some(pattern => event.url.includes(pattern));
  });
  
  // Calculate URL pattern confidence
  const urlPatternConfidence = jobUrlMatches.length / Math.max(urlEvents.length, 1);
  // For testing: Lower the threshold to make detection more sensitive
  if (urlPatternConfidence > 0.1) { // Changed from 0.3 to 0.1 for testing
    confidence += 0.5; // Increased from 0.4 to 0.5 for testing
    evidencePoints.push(`URL patterns match job search (${(urlPatternConfidence * 100).toFixed(0)}%)`);
  }
  
  // Check page content for job-related keywords
  const pageVisitEvents = events.filter(event => 
    event.event_type === EVENT_TYPES.PAGE_VISIT && 
    event.payload && 
    event.payload.page_text
  );
  
  const jobKeywords = [
    'job description',
    'apply now',
    'job requirements',
    'qualifications',
    'responsibilities',
    'experience required',
    'full-time',
    'part-time',
    'remote',
    'hybrid',
    'salary',
    'compensation',
    'benefits',
    'job title',
    'position',
    'career',
    'employment',
    'hiring',
    'recruiter',
    'application',
    'resume',
    'cover letter',
    // Add more common LinkedIn job search terms for testing
    'job search',
    'job seeker',
    'looking for work',
    'job opportunity',
    'job opening',
    'apply for job',
    'job alert',
    'job match',
    'recommended job',
    'easy apply'
  ];
  
  let keywordMatches = 0;
  let totalKeywords = 0;
  
  pageVisitEvents.forEach(event => {
    const pageText = event.payload.page_text?.toLowerCase() || '';
    jobKeywords.forEach(keyword => {
      totalKeywords++;
      if (pageText.includes(keyword.toLowerCase())) {
        keywordMatches++;
      }
    });
  });
  
  // Calculate keyword confidence
  const keywordConfidence = pageVisitEvents.length > 0 ? keywordMatches / totalKeywords : 0;
  // For testing: Lower the threshold to make detection more sensitive
  if (keywordConfidence > 0.05) { // Changed from 0.2 to 0.05 for testing
    confidence += 0.4; // Increased from 0.3 to 0.4 for testing
    evidencePoints.push(`Content contains job-related keywords (${(keywordConfidence * 100).toFixed(0)}%)`);
  }
  
  // Check user interactions
  const clickEvents = events.filter(event => 
    event.event_type === EVENT_TYPES.MOUSE_CLICK && 
    event.payload
  );
  
  const jobInteractionKeywords = [
    'apply',
    'save job',
    'easy apply',
    'submit application',
    'upload resume',
    'upload cv',
    'job alert',
    'search jobs'
  ];
  
  let interactionMatches = 0;
  
  clickEvents.forEach(event => {
    if (event.payload.target_text) {
      const targetText = event.payload.target_text.toLowerCase();
      if (jobInteractionKeywords.some(keyword => targetText.includes(keyword.toLowerCase()))) {
        interactionMatches++;
      }
    }
  });
  
  // Calculate interaction confidence
  const interactionConfidence = clickEvents.length > 0 ? interactionMatches / clickEvents.length : 0;
  // For testing: Lower the threshold to make detection more sensitive
  if (interactionConfidence > 0.05) { // Changed from 0.1 to 0.05 for testing
    confidence += 0.4; // Increased from 0.3 to 0.4 for testing
    evidencePoints.push(`User interactions match job search behavior (${(interactionConfidence * 100).toFixed(0)}%)`);
  }
  
  // Special case for testing: If we're on LinkedIn, give a small confidence boost
  if (events.some(event => event.url && event.url.includes('linkedin.com'))) {
    confidence += 0.2;
    evidencePoints.push('LinkedIn domain detected (+20% confidence)');
  }
  
  // Determine final task type and confidence
  if (confidence >= config.minimumConfidence) {
    return {
      taskType: TASK_TYPES.JOB_SEARCH,
      confidence: Math.min(confidence, 1.0),
      detectionMethod: 'linkedin_job_search',
      evidence: evidencePoints
    };
  }
  
  // If confidence is below threshold but still significant, return job search with lower confidence
  if (confidence >= 0.4) { // For testing: Lower this threshold from default
    return {
      taskType: TASK_TYPES.JOB_SEARCH,
      confidence: confidence,
      detectionMethod: 'linkedin_job_search_low_confidence',
      evidence: evidencePoints
    };
  }
  
  // If confidence is below threshold, return social browsing as default for LinkedIn
  return {
    taskType: TASK_TYPES.SOCIAL_BROWSING,
    confidence: 0.6,
    detectionMethod: 'linkedin_default',
    evidence: ['LinkedIn domain detected but insufficient job search signals']
  };
}

/**
 * Detect task based on URL patterns
 * @param {Array} events - Array of events
 * @param {Object} config - Task detection configuration
 * @returns {Object} Detected task with confidence score
 */
function detectTaskByUrlPatterns(events, config) {
  // URL pattern rules for different tasks
  const urlPatternRules = {
    [TASK_TYPES.JOB_SEARCH]: [
      '/jobs/',
      '/job/',
      '/careers/',
      '/career/',
      'job-search',
      'jobs-search',
      'job-listing',
      'jobs-listing',
      'apply',
      'application',
      'employment',
      'recruit',
      'talent',
      'position',
      'vacancy'
    ],
    [TASK_TYPES.LEARNING]: [
      '/course/',
      '/courses/',
      '/learn/',
      '/learning/',
      '/tutorial/',
      '/tutorials/',
      '/education/',
      '/training/',
      '/lesson/',
      '/lessons/',
      '/class/',
      '/classes/',
      '/workshop/',
      '/webinar/'
    ],
    [TASK_TYPES.SHOPPING]: [
      '/shop/',
      '/store/',
      '/product/',
      '/products/',
      '/item/',
      '/items/',
      '/buy/',
      '/purchase/',
      '/cart/',
      '/checkout/',
      '/order/',
      '/payment/'
    ]
  };
  
  // Count URL pattern matches for each task type
  const urlEvents = events.filter(event => event.url);
  const patternMatches = {};
  
  Object.keys(urlPatternRules).forEach(taskType => {
    patternMatches[taskType] = 0;
    
    urlEvents.forEach(event => {
      if (urlPatternRules[taskType].some(pattern => event.url.includes(pattern))) {
        patternMatches[taskType]++;
      }
    });
  });
  
  // Find task type with highest match count
  let bestTaskType = TASK_TYPES.UNKNOWN;
  let highestMatchCount = 0;
  
  Object.keys(patternMatches).forEach(taskType => {
    if (patternMatches[taskType] > highestMatchCount) {
      highestMatchCount = patternMatches[taskType];
      bestTaskType = taskType;
    }
  });
  
  // Calculate confidence based on match ratio
  const confidence = urlEvents.length > 0 ? highestMatchCount / urlEvents.length : 0;
  
  return {
    taskType: bestTaskType,
    confidence: confidence,
    detectionMethod: 'url_patterns',
    evidence: [`URL pattern matches: ${highestMatchCount}/${urlEvents.length}`]
  };
}

/**
 * Detect task based on page content
 * @param {Array} events - Array of events
 * @param {Object} config - Task detection configuration
 * @returns {Object} Detected task with confidence score
 */
function detectTaskByPageContent(events, config) {
  // Content keyword rules for different tasks
  const contentKeywordRules = {
    [TASK_TYPES.JOB_SEARCH]: [
      'job description',
      'apply now',
      'job requirements',
      'qualifications',
      'responsibilities',
      'experience required',
      'full-time',
      'part-time',
      'remote',
      'hybrid',
      'salary',
      'compensation',
      'benefits',
      'job title',
      'position',
      'career',
      'employment',
      'hiring',
      'recruiter',
      'application',
      'resume',
      'cover letter'
    ]
  };
  
  // Get page visit events with content
  const contentEvents = events.filter(event => 
    event.event_type === EVENT_TYPES.PAGE_VISIT && 
    event.payload && 
    event.payload.page_text
  );
  
  if (contentEvents.length === 0) {
    return {
      taskType: TASK_TYPES.UNKNOWN,
      confidence: 0,
      detectionMethod: 'page_content',
      evidence: ['No page content available']
    };
  }
  
  // Count keyword matches for each task type
  const keywordMatches = {};
  const totalKeywords = {};
  
  Object.keys(contentKeywordRules).forEach(taskType => {
    keywordMatches[taskType] = 0;
    totalKeywords[taskType] = contentEvents.length * contentKeywordRules[taskType].length;
    
    contentEvents.forEach(event => {
      const pageText = event.payload.page_text.toLowerCase();
      
      contentKeywordRules[taskType].forEach(keyword => {
        if (pageText.includes(keyword.toLowerCase())) {
          keywordMatches[taskType]++;
        }
      });
    });
  });
  
  // Find task type with highest match ratio
  let bestTaskType = TASK_TYPES.UNKNOWN;
  let highestMatchRatio = 0;
  
  Object.keys(keywordMatches).forEach(taskType => {
    const matchRatio = totalKeywords[taskType] > 0 ? keywordMatches[taskType] / totalKeywords[taskType] : 0;
    
    if (matchRatio > highestMatchRatio) {
      highestMatchRatio = matchRatio;
      bestTaskType = taskType;
    }
  });
  
  // Calculate confidence based on match ratio
  const confidence = Math.min(highestMatchRatio * 3, 1.0); // Multiply by 3 to scale up, cap at 1.0
  
  return {
    taskType: bestTaskType,
    confidence: confidence,
    detectionMethod: 'page_content',
    evidence: [`Content keyword matches: ${keywordMatches[bestTaskType]}/${totalKeywords[bestTaskType]}`]
  };
}

/**
 * Detect task based on user interactions
 * @param {Array} events - Array of events
 * @param {Object} config - Task detection configuration
 * @returns {Object} Detected task with confidence score
 */
function detectTaskByUserInteractions(events, config) {
  // Interaction patterns for different tasks
  const interactionPatterns = {
    [TASK_TYPES.JOB_SEARCH]: {
      clickKeywords: [
        'apply',
        'save job',
        'easy apply',
        'submit application',
        'upload resume',
        'upload cv',
        'job alert',
        'search jobs'
      ],
      highScrollRate: true,
      highPageVisitRate: true
    }
  };
  
  // Get interaction events
  const clickEvents = events.filter(event => 
    event.event_type === EVENT_TYPES.MOUSE_CLICK && 
    event.payload && 
    event.payload.target_text
  );
  
  // Count interaction matches for each task type
  const interactionScores = {};
  
  Object.keys(interactionPatterns).forEach(taskType => {
    interactionScores[taskType] = 0;
    let totalScore = 0;
    
    // Check click keywords
    if (interactionPatterns[taskType].clickKeywords && clickEvents.length > 0) {
      let keywordMatches = 0;
      
      clickEvents.forEach(event => {
        const targetText = event.payload.target_text.toLowerCase();
        
        if (interactionPatterns[taskType].clickKeywords.some(keyword => 
          targetText.includes(keyword.toLowerCase())
        )) {
          keywordMatches++;
        }
      });
      
      const keywordScore = keywordMatches / clickEvents.length;
      interactionScores[taskType] += keywordScore;
      totalScore++;
    }
    
    // Normalize score
    interactionScores[taskType] = totalScore > 0 ? interactionScores[taskType] / totalScore : 0;
  });
  
  // Find task type with highest interaction score
  let bestTaskType = TASK_TYPES.UNKNOWN;
  let highestScore = 0;
  
  Object.keys(interactionScores).forEach(taskType => {
    if (interactionScores[taskType] > highestScore) {
      highestScore = interactionScores[taskType];
      bestTaskType = taskType;
    }
  });
  
  // Calculate confidence based on interaction score
  const confidence = Math.min(highestScore * 2, 1.0); // Multiply by 2 to scale up, cap at 1.0
  
  return {
    taskType: bestTaskType,
    confidence: confidence,
    detectionMethod: 'user_interactions',
    evidence: [`Interaction pattern score: ${(highestScore * 100).toFixed(0)}%`]
  };
}

/**
 * Get task-specific nudge suggestions
 * @param {string} taskType - Detected task type
 * @returns {Array} Array of nudge suggestions
 */
export function getTaskSpecificNudges(taskType) {
  const nudgeSuggestions = {
    [TASK_TYPES.JOB_SEARCH]: [
      "Remember to focus on quality applications rather than quantity.",
      "Take breaks between job applications to avoid burnout.",
      "Consider researching the company before applying to tailor your application.",
      "Keep track of the jobs you've applied to in a spreadsheet or document.",
      "Set a goal for how many applications you want to complete today."
    ],
    [TASK_TYPES.LEARNING]: [
      "Taking notes can help reinforce what you're learning.",
      "Consider setting a timer to maintain focus during your learning session.",
      "Remember to take short breaks to help with information retention.",
      "Try to apply what you're learning with practical exercises.",
      "Consider joining study groups or forums related to what you're learning."
    ],
    [TASK_TYPES.SOCIAL_BROWSING]: [
      "Set a time limit for social browsing to avoid getting distracted.",
      "Consider whether this social browsing is aligned with your goals.",
      "Try to engage meaningfully rather than passively scrolling.",
      "Remember to check in with yourself about how social media makes you feel.",
      "Consider using social media with a specific purpose in mind."
    ],
    [TASK_TYPES.SHOPPING]: [
      "Consider making a list before shopping to avoid impulse purchases.",
      "Take a moment to evaluate if this purchase aligns with your budget.",
      "Compare prices across different sites before making a decision.",
      "Consider waiting 24 hours before completing a non-essential purchase.",
      "Review your cart before checkout to remove unnecessary items."
    ],
    [TASK_TYPES.ENTERTAINMENT]: [
      "Set a time limit for entertainment to maintain balance.",
      "Consider scheduling entertainment as a reward after completing important tasks.",
      "Be mindful of how much time you're spending on entertainment.",
      "Consider whether this activity is helping you relax or just passing time.",
      "Try to choose entertainment that aligns with your values and interests."
    ],
    [TASK_TYPES.RESEARCH]: [
      "Consider organizing your research findings for easier reference later.",
      "Try to focus on quality sources rather than quantity.",
      "Take breaks to process the information you're gathering.",
      "Consider how this research connects to your broader goals.",
      "Try to synthesize information rather than just collecting it."
    ],
    [TASK_TYPES.COMMUNICATION]: [
      "Consider batching your communications to avoid constant interruptions.",
      "Try to be clear and concise in your messages to save time.",
      "Consider whether a different communication medium would be more efficient.",
      "Take breaks between communication sessions to focus on deep work.",
      "Consider setting expectations about your response time."
    ],
    [TASK_TYPES.UNKNOWN]: [
      "Consider setting a clear intention for how you want to use your time online.",
      "Take a moment to reflect on whether this activity aligns with your goals.",
      "Remember to take breaks to maintain focus and productivity.",
      "Consider tracking how you spend your time online to identify patterns.",
      "Try to be mindful about your digital habits and how they affect you."
    ]
  };
  
  return nudgeSuggestions[taskType] || nudgeSuggestions[TASK_TYPES.UNKNOWN];
} 