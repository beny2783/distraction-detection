/**
 * Focus Companion Direct Loader
 * 
 * This file is used to load the Focus Companion directly in the content script context
 * without requiring script injection into the page. This helps avoid Content Security Policy
 * (CSP) restrictions on websites with strict security policies.
 */

// Import the Focus Companion module
import focusCompanion from './focus-companion.js';

/**
 * Initialize the Focus Companion in the content script context
 * @returns {Object} The initialized Focus Companion instance
 */
export function initializeFocusCompanion() {
  console.log('[Focus Nudge] Initializing Focus Companion directly in content script context');
  
  // Fix the asset paths to use absolute URLs from the extension
  focusCompanion.expressions = {
    idle: chrome.runtime.getURL('assets/companion/companion.svg'),
    happy: chrome.runtime.getURL('assets/companion/companion-happy.svg'),
    thinking: chrome.runtime.getURL('assets/companion/companion-thinking.svg'),
    alert: chrome.runtime.getURL('assets/companion/companion-alert.svg')
  };
  
  // Log the expression paths
  console.log('[Focus Nudge] Expression paths set to absolute URLs:', focusCompanion.expressions);
  
  // Verify that the images exist by making HEAD requests
  Object.entries(focusCompanion.expressions).forEach(([key, url]) => {
    fetch(url, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          console.log(`[Focus Nudge] Asset verified: ${key} -> ${url}`);
        } else {
          console.error(`[Focus Nudge] Asset not found: ${key} -> ${url} (${response.status})`);
        }
      })
      .catch(error => {
        console.error(`[Focus Nudge] Error checking asset: ${key} -> ${url}`, error);
      });
  });
  
  // Create a proxy for the window.focusCompanion that will be accessible to the content script
  // This avoids the need to inject it into the actual page window object
  const focusCompanionProxy = {
    showTaskDetection: (taskData) => focusCompanion.showTaskDetection(taskData),
    showWelcomeMessage: () => focusCompanion.showWelcomeMessage(),
    show: () => focusCompanion.show(),
    hide: () => focusCompanion.hide(),
    setExpression: (expression) => focusCompanion.setExpression(expression),
    showDistraction: (distractionData) => focusCompanion.showDistraction(distractionData),
    showTaskTransition: (previousTask, newTask) => focusCompanion.showTaskTransition(previousTask, newTask)
  };
  
  // Return the proxy
  return focusCompanionProxy;
} 