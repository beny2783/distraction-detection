/**
 * Focus Nudge - Event Schema
 * 
 * This module defines the standardized schema for all events in the streaming architecture.
 * Each event follows a consistent format with common fields and event-specific payloads.
 */

// Base event schema that all events must follow
const BASE_EVENT_SCHEMA = {
  timestamp: 0,           // Unix timestamp in milliseconds
  event_type: '',         // Type of event (see EVENT_TYPES)
  url: '',                // Current URL
  tab_id: 0,              // Browser tab ID
  session_id: '',         // Unique session identifier
  sequence_id: 0          // Sequence number within session
};

// All supported event types
const EVENT_TYPES = {
  // Page-related events
  PAGE_VISIT: 'PAGE_VISIT',
  PAGE_EXIT: 'PAGE_EXIT',
  PAGE_FOCUS: 'PAGE_FOCUS',
  PAGE_BLUR: 'PAGE_BLUR',
  PAGE_SCROLL: 'PAGE_SCROLL',
  PAGE_IDLE: 'PAGE_IDLE',
  PAGE_ACTIVE: 'PAGE_ACTIVE',
  
  // User interaction events
  MOUSE_CLICK: 'MOUSE_CLICK',
  MOUSE_MOVE: 'MOUSE_MOVE',
  KEY_PRESS: 'KEY_PRESS',
  COPY: 'COPY',
  PASTE: 'PASTE',
  
  // Navigation events
  TAB_SWITCH: 'TAB_SWITCH',
  TAB_OPEN: 'TAB_OPEN',
  TAB_CLOSE: 'TAB_CLOSE',
  NAVIGATION: 'NAVIGATION',
  
  // Media events
  VIDEO_PLAY: 'VIDEO_PLAY',
  VIDEO_PAUSE: 'VIDEO_PAUSE',
  VIDEO_PROGRESS: 'VIDEO_PROGRESS',
  AUDIO_PLAY: 'AUDIO_PLAY',
  AUDIO_PAUSE: 'AUDIO_PAUSE',
  
  // Content events
  CONTENT_LOAD: 'CONTENT_LOAD',
  CONTENT_MUTATION: 'CONTENT_MUTATION',
  
  // System events
  SYSTEM_IDLE: 'SYSTEM_IDLE',
  SYSTEM_ACTIVE: 'SYSTEM_ACTIVE',
  
  // Extension events
  MODEL_PREDICTION: 'MODEL_PREDICTION',
  NUDGE_SHOWN: 'NUDGE_SHOWN',
  NUDGE_INTERACTION: 'NUDGE_INTERACTION',
  USER_FEEDBACK: 'USER_FEEDBACK'
};

// Event-specific payload schemas
const EVENT_PAYLOAD_SCHEMAS = {
  [EVENT_TYPES.PAGE_VISIT]: {
    page_title: '',
    domain: '',
    referrer: '',
    page_text: '',
    tab_count: 0,
    window_width: 0,
    window_height: 0,
    is_active_tab: true
  },
  
  [EVENT_TYPES.PAGE_SCROLL]: {
    scroll_position_y: 0,
    scroll_position_x: 0,
    scroll_depth: 0,
    scroll_direction: '',
    scroll_speed: 0,
    viewport_height: 0,
    document_height: 0
  },
  
  [EVENT_TYPES.MOUSE_CLICK]: {
    x: 0,
    y: 0,
    target_element: '',
    target_text: '',
    is_link: false,
    link_url: '',
    button: 0
  },
  
  [EVENT_TYPES.TAB_SWITCH]: {
    from_url: '',
    from_title: '',
    to_url: '',
    to_title: '',
    time_on_previous_tab: 0
  },
  
  [EVENT_TYPES.VIDEO_PLAY]: {
    video_url: '',
    video_title: '',
    video_duration: 0,
    video_current_time: 0,
    is_fullscreen: false,
    player_type: ''
  },
  
  [EVENT_TYPES.VIDEO_PROGRESS]: {
    video_url: '',
    video_title: '',
    video_duration: 0,
    video_current_time: 0,
    watch_time: 0,
    is_fullscreen: false,
    player_type: ''
  },
  
  [EVENT_TYPES.CONTENT_LOAD]: {
    content_type: '',
    content_length: 0,
    content_summary: '',
    has_video: false,
    has_audio: false,
    has_forms: false,
    has_comments: false,
    readability_score: 0
  },
  
  [EVENT_TYPES.MODEL_PREDICTION]: {
    prediction_type: '',
    distraction_score: 0,
    confidence: 0,
    features_used: [],
    model_version: ''
  }
};

/**
 * Create a new event object with the specified type and payload
 * @param {string} eventType - Type of event from EVENT_TYPES
 * @param {Object} payload - Event-specific data
 * @param {Object} baseData - Base event data (timestamp, url, etc.)
 * @returns {Object} Complete event object
 */
function createEvent(eventType, payload = {}, baseData = {}) {
  // Validate event type
  if (!EVENT_TYPES[eventType]) {
    console.error(`Invalid event type: ${eventType}`);
    return null;
  }
  
  // Create base event
  const event = {
    ...BASE_EVENT_SCHEMA,
    ...baseData,
    event_type: eventType,
    timestamp: baseData.timestamp || Date.now()
  };
  
  // Add event-specific payload
  if (EVENT_PAYLOAD_SCHEMAS[eventType]) {
    event.payload = {
      ...EVENT_PAYLOAD_SCHEMAS[eventType],
      ...payload
    };
  } else {
    event.payload = payload;
  }
  
  return event;
}

export {
  EVENT_TYPES,
  createEvent,
  BASE_EVENT_SCHEMA,
  EVENT_PAYLOAD_SCHEMAS
}; 