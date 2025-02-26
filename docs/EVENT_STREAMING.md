# Focus Nudge - Event Streaming Architecture

This document describes the event streaming architecture used in the Focus Nudge extension to track user interactions, detect distractions, and provide timely nudges.

## Overview

The event streaming architecture is designed to:

1. Capture user interactions in real-time
2. Process events efficiently
3. Extract meaningful features from event streams
4. Make predictions about distraction levels
5. Generate appropriate nudges when needed

## Components

### 1. Content Script (`content.js`)

The content script runs in the context of web pages and is responsible for:

- Capturing user interactions (clicks, scrolls, key presses, etc.)
- Tracking page metadata and content
- Monitoring video and audio interactions
- Detecting idle states
- Sending events to the background script

The content script uses message passing to communicate with the background script:

```javascript
// Send an event to the background script
function sendEvent(eventType, payload = {}) {
  chrome.runtime.sendMessage({
    type: 'TRACK_EVENT',
    eventType,
    payload,
    url: window.location.href,
    timestamp: Date.now()
  });
}
```

### 2. Event Schema (`src/events/schema.js`)

The event schema defines the structure of all events in the system:

- Base event schema with common fields
- Event types enumeration
- Event-specific payload schemas
- Helper function to create valid events

```javascript
// Base event schema
const BASE_EVENT_SCHEMA = {
  timestamp: 0,           // Unix timestamp in milliseconds
  event_type: '',         // Type of event (see EVENT_TYPES)
  url: '',                // Current URL
  tab_id: 0,              // Browser tab ID
  session_id: '',         // Unique session identifier
  sequence_id: 0          // Sequence number within session
};
```

### 3. Event Storage (`src/events/storage.js`)

The event storage module handles persisting events to IndexedDB:

- Storing events efficiently
- Retrieving events based on various criteria
- Managing storage limits and pruning old events
- Providing storage statistics

```javascript
// Store events in the database
async function storeEvents(events) {
  // Implementation details...
}

// Retrieve events from the database
async function getEvents(options = {}) {
  // Implementation details...
}
```

### 4. Background Script (`background.js`)

The background script processes the event stream:

- Receiving events from content scripts
- Queuing and batch processing events
- Extracting features from events
- Making predictions using the model manager
- Generating and sending nudges when appropriate

```javascript
// Process the event queue
async function processEventQueue() {
  // Get events to process
  const eventsToProcess = eventQueue.splice(0, CONFIG.maxEventsPerProcessing);
  
  // Store events in storage
  await storeEvents(eventsToProcess);
  
  // Process events
  await processEvents(eventsToProcess);
}
```

### 5. Feature Extraction (`src/features/extractor.js`)

The feature extractor computes meaningful metrics from event streams:

- Session duration and active/idle time
- Interaction counts (scrolls, clicks, key presses)
- Navigation patterns (page visits, tab switches)
- Content features (load counts, video presence)
- Derived metrics (scroll rate, engagement score)

### 6. Model Manager (`models/ModelManager.js`)

The model manager handles distraction prediction:

- Loading and managing different model types
- Processing input data from event streams
- Making predictions about distraction levels
- Applying user preferences to predictions

## Event Flow

1. User interacts with a web page
2. Content script captures the interaction as an event
3. Event is sent to the background script via message passing
4. Background script queues the event for processing
5. Events are periodically processed in batches
6. Features are extracted from the event stream
7. Model makes a prediction about distraction level
8. If distraction threshold is exceeded, a nudge is generated
9. Nudge is sent back to the content script for display

## Message Types

The following message types are used for communication:

- `GET_TAB_INFO`: Request tab information
- `GET_EVENT_STREAM_FUNCTIONS`: Request event stream functions
- `TRACK_EVENT`: Send an event to be tracked
- `FLUSH_EVENTS`: Request immediate processing of queued events
- `CLEANUP_EVENTS`: Clean up event tracking for a tab
- `STREAM_EVENTS`: Legacy event streaming (for backward compatibility)
- `SHOW_NUDGE`: Send a nudge to be displayed

## Testing

The event streaming architecture can be tested using:

- `test/test-events.html`: A simple UI for running tests
- `test/test-events.js`: Test script that simulates events

## Best Practices

1. **Throttle high-frequency events**: Events like scrolls and mouse moves should be throttled to avoid overwhelming the system.

2. **Batch process events**: Process events in batches to improve performance.

3. **Prioritize important events**: Some events (like page visits) should be processed immediately.

4. **Handle errors gracefully**: All event processing should include proper error handling.

5. **Respect user privacy**: Only collect the minimum data needed for distraction detection.

6. **Clean up resources**: Properly clean up event listeners and intervals when tabs are closed.

7. **Test thoroughly**: Ensure the event streaming system works correctly across different websites and scenarios. 