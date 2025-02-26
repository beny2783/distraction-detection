# Focus Companion Architecture

## Overview

Focus Companion is a browser extension designed to help users maintain focus by detecting distractions and providing contextual nudges. The system uses an event-driven architecture to track user interactions, analyze browsing patterns, and provide timely interventions through a friendly character interface.

## System Components

### 1. Core Extension Components

- **Background Script (`background.js`)**: The central processing unit that runs persistently, managing the event stream, task detection, and distraction analysis.
- **Content Script (`content.js`)**: Injected into web pages to track user interactions and render the Focus Companion UI.
- **Popup UI (`popup.html`, `popup.js`)**: User interface for configuration and displaying insights.
- **Insights Dashboard (`insights.html`, `insights.js`)**: Detailed analytics and usage statistics.

### 2. Event Streaming Architecture

The extension uses an event streaming architecture to capture and process user interactions:

- **Event Capture**: Content script captures DOM events (clicks, scrolls, keypresses) and page metadata.
- **Event Processing**: Background script processes events to extract features and detect patterns.
- **Event Storage**: Events are stored locally for analysis and model training.

### 3. Focus Companion UI

- **Character Interface (`focus-companion.js`, `focus-companion.css`)**: A Clippy-style character that appears in the browser.
- **Interaction States**: Multiple visual states (idle, happy, thinking, alert) to convey different messages.
- **Speech Bubbles**: Contextual messages based on detected tasks and distractions.

### 4. Task Detection System

- **Automatic Task Detection**: Analyzes page content and user behavior to identify the current task.
- **Task-Specific Focus**: Provides customized nudges based on the detected task type.
- **Task Transitions**: Detects when users switch between different types of tasks.

### 5. Distraction Detection

- **Distraction Scoring**: Calculates a distraction score based on browsing patterns and interaction features.
- **Nudge Generation**: Creates contextual nudges when distractions are detected.
- **Intervention Types**: Offers reminders, reflections, and suggestions based on the distraction context.

## Technical Implementation

### Extension Architecture

```
├── background.js         # Background service worker
├── content.js            # Content script injected into pages
├── manifest.json         # Extension configuration
├── popup.html/js         # Extension popup interface
├── insights.html/js      # Analytics dashboard
├── src/
│   ├── events/           # Event schema and storage
│   ├── features/         # Feature extraction and task detection
│   ├── analytics/        # Usage analytics
│   └── ui/               # UI components
│       ├── focus-companion.js   # Character implementation
│       └── focus-companion.css  # Character styling
├── models/               # ML models for task/distraction detection
└── assets/               # Images and other static assets
    └── companion/        # Character expressions (SVG)
```

### Data Flow

1. User interactions are captured by the content script
2. Events are sent to the background script via message passing
3. Background script processes events and updates models
4. Task detection runs periodically to identify current user activity
5. When distractions are detected or tasks change, notifications are sent to the content script
6. Content script renders the Focus Companion character with appropriate messages

### Technical Challenges

- **Content Security Policy (CSP)**: The extension must navigate CSP restrictions when injecting the character UI.
- **Performance Optimization**: Event sampling and throttling to minimize performance impact.
- **Cross-Origin Limitations**: Working within browser security constraints for cross-origin interactions.
- **Resource Loading**: Ensuring character assets load correctly across different web contexts.

### Best Practices for CSP Compatibility

To ensure the Focus Companion works correctly across websites with strict Content Security Policies (CSP), we follow these best practices:

1. **Direct Content Script Execution**: 
   - Use direct execution in the content script context instead of injecting scripts into the page
   - Implement a module-based approach with `focus-companion-direct.js` that initializes components without script injection
   - Avoid using `eval()`, inline event handlers, or dynamically created script elements

2. **Shadow DOM for UI Isolation**:
   - Implement Shadow DOM to isolate the Focus Companion UI from the host page
   - Create a shadow root with `mode: 'open'` to allow access from the content script
   - Import extension CSS directly into the shadow root to avoid style conflicts
   - Use the shadow root for all DOM queries and event listeners

3. **Asset Loading Best Practices**:
   - Always use absolute URLs with `chrome.runtime.getURL()` for all assets
   - Implement fallback mechanisms for image loading failures
   - Verify asset existence with HEAD requests before attempting to use them
   - Add comprehensive error handling for asset loading failures

4. **Element Selection and Event Handling**:
   - Always search for elements within the shadow root context
   - Use timeouts to ensure elements are fully rendered before attaching event listeners
   - Implement null checks before accessing DOM elements or attaching event listeners
   - Use event delegation where appropriate to minimize the number of event listeners

5. **Proxy Pattern for API Access**:
   - Create a proxy object that exposes only the necessary methods to the content script
   - Avoid exposing the entire Focus Companion instance to the global scope
   - Use message passing for communication between content script and background script

By following these practices, the Focus Companion can function reliably across various websites, including those with strict CSP settings that block inline scripts, eval(), and other potentially unsafe practices.

#### Implementation Examples

**1. Direct Module Loading in Content Script:**
```javascript
// In content.js
function loadFocusCompanion() {
  return new Promise((resolve, reject) => {
    try {
      // Import the direct loader module
      import(chrome.runtime.getURL('src/ui/focus-companion-direct.js'))
        .then(module => {
          // Initialize the Focus Companion directly in the content script context
          const focusCompanionInstance = module.initializeFocusCompanion();
          // Store the instance for future use
          window._focusCompanionInstance = focusCompanionInstance;
          resolve(focusCompanionInstance);
        })
        .catch(error => {
          console.error('[Focus Nudge] Error importing module:', error);
          reject(error);
        });
    } catch (error) {
      console.error('[Focus Nudge] Error loading Focus Companion:', error);
      reject(error);
    }
  });
}
```

**2. Shadow DOM Implementation:**
```javascript
// In focus-companion.js
appendToShadowDOM() {
  // Create a shadow host
  const shadowHost = document.createElement('div');
  shadowHost.id = 'focus-companion-shadow-host';
  shadowHost.style.cssText = 'position: fixed; z-index: 2147483647; bottom: 0; right: 0; width: 0; height: 0;';
  document.body.appendChild(shadowHost);
  
  // Create shadow root
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  
  // Add CSS to shadow root
  const style = document.createElement('style');
  style.textContent = `
    /* Import the CSS from the extension */
    @import url('${chrome.runtime.getURL('src/ui/focus-companion.css')}');
    
    /* Additional styles for shadow DOM */
    :host {
      all: initial;
    }
  `;
  shadowRoot.appendChild(style);
  
  // Add container to shadow root
  shadowRoot.appendChild(this.container);
  
  // Store shadow root for future reference
  this.shadowRoot = shadowRoot;
}
```

**3. Absolute Asset Path Handling:**
```javascript
// In focus-companion-direct.js
export function initializeFocusCompanion() {
  // Fix the asset paths to use absolute URLs from the extension
  focusCompanion.expressions = {
    idle: chrome.runtime.getURL('assets/companion/companion.svg'),
    happy: chrome.runtime.getURL('assets/companion/companion-happy.svg'),
    thinking: chrome.runtime.getURL('assets/companion/companion-thinking.svg'),
    alert: chrome.runtime.getURL('assets/companion/companion-alert.svg')
  };
  
  // Verify that the images exist
  Object.entries(focusCompanion.expressions).forEach(([key, url]) => {
    fetch(url, { method: 'HEAD' })
      .then(response => {
        if (!response.ok) {
          console.error(`Asset not found: ${key} -> ${url}`);
        }
      });
  });
  
  // Return a proxy object
  return {
    showWelcomeMessage: () => focusCompanion.showWelcomeMessage(),
    // Other methods...
  };
}
```

**4. Shadow DOM-Aware Element Selection:**
```javascript
// In focus-companion.js
setTimeout(() => {
  // Use the shadow root to find the button
  const button = this.shadowRoot ? 
    this.shadowRoot.getElementById('welcome-got-it') : 
    document.getElementById('welcome-got-it');
    
  if (button) {
    button.addEventListener('click', () => {
      this.hide();
    });
  } else {
    console.error('[Focus Companion] Button not found');
  }
}, 100);
```

#### Common CSP Pitfalls to Avoid

When developing browser extensions that need to work across websites with varying Content Security Policies, avoid these common pitfalls:

1. **Inline Script Injection**: Never inject inline scripts using `innerHTML`, `document.write()`, or by setting the `onclick` attribute directly. These will be blocked by CSP.

   ```javascript
   // DON'T DO THIS - will be blocked by CSP
   element.innerHTML = '<button onclick="alert(\'Hello\')">Click me</button>';
   
   // INSTEAD DO THIS - use proper event listeners
   const button = document.createElement('button');
   button.textContent = 'Click me';
   button.addEventListener('click', () => alert('Hello'));
   element.appendChild(button);
   ```

2. **Blob URLs for Scripts**: Avoid creating scripts from Blob URLs, as these are often blocked by strict CSP.

   ```javascript
   // DON'T DO THIS - will be blocked by CSP
   const blob = new Blob(['console.log("Hello")'], {type: 'application/javascript'});
   const url = URL.createObjectURL(blob);
   const script = document.createElement('script');
   script.src = url;
   document.head.appendChild(script);
   
   // INSTEAD - execute code directly in the content script context
   console.log("Hello");
   ```

3. **Relative Asset Paths**: Never use relative paths for assets, as they will resolve against the host page's origin.

   ```javascript
   // DON'T DO THIS - will try to load from the host page's origin
   img.src = '../assets/image.png';
   
   // INSTEAD - always use absolute URLs with chrome.runtime.getURL
   img.src = chrome.runtime.getURL('assets/image.png');
   ```

4. **Direct DOM Manipulation Without Shadow DOM**: Avoid adding styles or UI elements directly to the page without Shadow DOM isolation.

   ```javascript
   // DON'T DO THIS - styles may conflict or be overridden
   document.body.appendChild(styleElement);
   document.body.appendChild(uiContainer);
   
   // INSTEAD - use Shadow DOM for isolation
   const host = document.createElement('div');
   const shadow = host.attachShadow({mode: 'open'});
   shadow.appendChild(styleElement);
   shadow.appendChild(uiContainer);
   document.body.appendChild(host);
   ```

5. **Assuming DOM API Availability**: Some websites restrict access to certain DOM APIs through CSP.

   ```javascript
   // DON'T DO THIS - may fail on sites with strict CSP
   try {
     // Always wrap potentially restricted operations in try/catch
     const storage = localStorage.getItem('key');
   } catch (error) {
     console.error('LocalStorage access denied:', error);
     // Implement fallback mechanism
   }
   ```

By avoiding these pitfalls and following the best practices outlined above, the Focus Companion can maintain compatibility across a wide range of websites, regardless of their CSP settings.

## Future Enhancements

- **Improved ML Models**: More sophisticated task detection using transformer-based models.
- **Personalization**: Learning from user feedback to customize nudges and interventions.
- **Integration**: Connecting with productivity tools and calendar systems for context-aware assistance.
- **Offline Support**: Local processing of events when offline to maintain functionality.

## Technical Approach

The Focus Companion uses a modular, event-driven approach that separates concerns between data collection, analysis, and intervention. This architecture allows for extensibility and maintainability while providing a responsive user experience with minimal performance impact. 