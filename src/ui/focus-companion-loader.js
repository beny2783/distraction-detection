/**
 * Focus Companion Loader
 * 
 * This file is used to load the Focus Companion module and expose it to the window object.
 * It's designed to be loaded as a separate script file rather than using inline scripts,
 * which helps avoid Content Security Policy (CSP) restrictions.
 */

// The URL will be replaced by the content script before loading
const FOCUS_COMPANION_URL = '{{FOCUS_COMPANION_URL}}';

console.log('[Focus Nudge] Importing Focus Companion module...');
import(FOCUS_COMPANION_URL).then(module => {
  console.log('[Focus Nudge] Focus Companion module imported:', module.default);
  window.focusCompanion = module.default;
  console.log('[Focus Nudge] Focus Companion assigned to window object');
  document.dispatchEvent(new CustomEvent('focus-companion-loaded'));
}).catch(error => {
  console.error('[Focus Nudge] Error importing Focus Companion module:', error);
}); 