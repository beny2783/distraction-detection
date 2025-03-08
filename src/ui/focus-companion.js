/**
 * Focus Companion
 * 
 * A friendly assistant that appears when tasks are detected,
 * offering contextual help without being intrusive.
 */

import FocusDashboard from './focus-dashboard.js';

class FocusCompanion {
  constructor() {
    console.log('[Focus Companion] Constructor called');
    this.container = null;
    this.bubble = null;
    this.avatar = null;
    this.statusIndicator = null;
    this.currentState = 'idle';
    this.currentTask = null;
    this.previousTask = null;
    this.isVisible = false;
    this.focusDashboard = null;
    
    // Default expressions with relative paths - these will be updated by the direct loader
    this.expressions = {
      idle: '../assets/companion/companion.svg',
      happy: '../assets/companion/companion-happy.svg',
      thinking: '../assets/companion/companion-thinking.svg',
      alert: '../assets/companion/companion-alert.svg'
    };
    
    // Log the expression paths
    console.log('[Focus Companion] Expression paths:', this.expressions);
    
    // Initialize the companion
    this.init();
  }
  
  /**
   * Initialize the companion
   */
  init() {
    console.log('[Focus Companion] Initializing...');
    
    // Create the companion container
    this.createCompanionElements();
    
    // Add event listeners
    this.addEventListeners();
    
    // Show the companion immediately with a welcome message
    console.log('[Focus Companion] About to show welcome message');
    this.showWelcomeMessage();
    
    console.log('[Focus Companion] Initialized successfully');
  }
  
  /**
   * Create the companion UI elements
   */
  createCompanionElements() {
    console.log('[Focus Companion] Creating UI elements');
    
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'focus-companion';
    this.container.setAttribute('data-extension-element', 'true');
    
    // Create avatar
    this.avatar = document.createElement('div');
    this.avatar.className = 'companion-avatar';
    this.setExpression('idle');
    
    // Create speech bubble
    this.bubble = document.createElement('div');
    this.bubble.className = 'companion-bubble';
    
    // Create status indicator with stats button
    this.statusIndicator = document.createElement('div');
    this.statusIndicator.className = 'focus-status-indicator';
    this.statusIndicator.setAttribute('data-extension-element', 'true');
    
    // Add stats button
    const statsButton = document.createElement('button');
    statsButton.className = 'stats-button';
    statsButton.innerHTML = '📊';
    statsButton.title = 'View Focus Stats';
    
    // Add magnifying glass
    const magnifyingGlass = document.createElement('div');
    magnifyingGlass.className = 'status-icon';
    magnifyingGlass.innerHTML = '🔍';
    
    this.statusIndicator.appendChild(magnifyingGlass);
    this.statusIndicator.appendChild(statsButton);
    
    // Add elements to container
    this.container.appendChild(this.avatar);
    this.container.appendChild(this.bubble);
    
    // Add elements to document
    this.appendToShadowDOM();
    
    console.log('[Focus Companion] UI elements created and added to document');
    console.log('[Focus Companion] Container:', this.container);
    console.log('[Focus Companion] Avatar:', this.avatar);
    console.log('[Focus Companion] Bubble:', this.bubble);
    console.log('[Focus Companion] Status Indicator:', this.statusIndicator);
  }
  
  /**
   * Append elements to Shadow DOM to avoid CSS conflicts with the page
   */
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
    
    // Add container and status indicator to shadow root
    shadowRoot.appendChild(this.container);
    shadowRoot.appendChild(this.statusIndicator);
    
    // Store shadow root for future reference
    this.shadowRoot = shadowRoot;
    this.shadowHost = shadowHost;
  }
  
  /**
   * Add event listeners
   */
  addEventListeners() {
    // Status indicator click (magnifying glass)
    const magnifyingGlass = this.statusIndicator.querySelector('.status-icon');
    if (magnifyingGlass) {
      magnifyingGlass.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        this.showWelcomeMessage(); // Show welcome message instead of just show()
      });
    }
    
    // Stats button click
    const statsButton = this.statusIndicator.querySelector('.stats-button');
    if (statsButton) {
      statsButton.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent event bubbling
        try {
          // Get focus stats
          const result = await chrome.storage.local.get(['focusStats']);
          const stats = result.focusStats || {
            focusScore: 95,
            focusTime: 0,
            distractionCount: 0,
            streakCount: 0
          };
          
          // Show stats in bubble
          this.showStats(stats);
        } catch (error) {
          console.error('[Focus Companion] Error showing stats:', error);
        }
      });
    }
    
    // Document click (for hiding)
    document.addEventListener('click', (e) => {
      if (this.isVisible && 
          !this.container.contains(e.target) && 
          !this.statusIndicator.contains(e.target)) {
        this.hide();
      }
    });
  }
  
  /**
   * Set the companion expression
   * @param {string} expression - The expression to set
   */
  setExpression(expression) {
    console.log(`[Focus Companion] Setting expression to "${expression}"`);
    
    // Default to idle if expression not found
    if (!this.expressions[expression]) {
      console.log(`[Focus Companion] Expression "${expression}" not found, using idle`);
      expression = 'idle';
    }
    
    const imagePath = this.expressions[expression];
    console.log(`[Focus Companion] Using image path: ${imagePath}`);
    
    // Always ensure we're using an absolute URL
    let finalImagePath = imagePath;
    if (!imagePath.startsWith('chrome-extension://') && !imagePath.startsWith('http')) {
      // If it's a relative path, convert to absolute using chrome.runtime.getURL
      const assetName = expression === 'idle' ? 'companion' : `companion-${expression}`;
      finalImagePath = chrome.runtime.getURL(`assets/companion/${assetName}.svg`);
      console.log(`[Focus Companion] Converted relative path to absolute: ${finalImagePath}`);
    }
    
    this.currentState = expression;
    this.avatar.innerHTML = `<img src="${finalImagePath}" alt="Focus Companion" />`;
    
    // Check if the image loaded correctly
    setTimeout(() => {
      const img = this.avatar.querySelector('img');
      if (img) {
        console.log(`[Focus Companion] Image element created:`, img);
        img.onerror = () => {
          console.error(`[Focus Companion] Failed to load image: ${finalImagePath}`);
          // Try to use chrome.runtime.getURL as a fallback
          if (!finalImagePath.startsWith('chrome-extension://')) {
            const assetName = expression === 'idle' ? 'companion' : `companion-${expression}`;
            const fallbackPath = chrome.runtime.getURL(`assets/companion/${assetName}.svg`);
            console.log(`[Focus Companion] Trying fallback path: ${fallbackPath}`);
            img.src = fallbackPath;
          }
        };
        img.onload = () => console.log(`[Focus Companion] Successfully loaded image: ${finalImagePath}`);
      } else {
        console.error(`[Focus Companion] No image element found in avatar`);
      }
    }, 100);
  }
  
  /**
   * Show the companion
   */
  show() {
    console.log('[Focus Companion] Show method called, isVisible:', this.isVisible);
    
    if (this.isVisible) return;
    
    console.log('[Focus Companion] Adding visible class to container');
    this.container.classList.add('visible');
    console.log('[Focus Companion] Removing visible class from status indicator');
    this.statusIndicator.classList.remove('visible');
    this.isVisible = true;
    
    // Debug element visibility
    setTimeout(() => {
      console.log('[Focus Companion] Container classes:', this.container.className);
      console.log('[Focus Companion] Container style (computed):', window.getComputedStyle(this.container));
      console.log('[Focus Companion] Status indicator classes:', this.statusIndicator.className);
    }, 100);
  }
  
  /**
   * Hide the companion
   */
  hide() {
    console.log('[Focus Companion] Hide method called, isVisible:', this.isVisible);
    
    if (!this.isVisible) return;
    
    console.log('[Focus Companion] Removing visible class from container');
    this.container.classList.remove('visible');
    console.log('[Focus Companion] Adding visible class to status indicator');
    this.statusIndicator.classList.add('visible');
    this.isVisible = false;

    // Stop updating stats when hidden
    this.stopStatsInterval();
  }
  
  /**
   * Show a task detection notification
   * @param {Object} taskData - The detected task data
   */
  showTaskDetection(taskData) {
    console.log('[Focus Companion] Task detected:', taskData);
    
    // Update task tracking
    this.previousTask = this.currentTask;
    this.currentTask = taskData;
    
    // Set appropriate expression
    this.setExpression('thinking');
    
    // Get task name and message
    const taskName = this.getTaskName(taskData.taskType);
    const taskMessage = this.getTaskMessage(taskData.taskType);
    const taskIcon = this.getTaskIcon(taskData.taskType);
    
    // Log the task details for debugging
    console.log(`[Focus Companion] Displaying task: ${taskData.taskType} (${taskName})`);
    console.log(`[Focus Companion] Task message: ${taskMessage}`);
    
    // Create bubble content with timer option for job applications
    if (taskData.taskType === 'job_application') {
      this.bubble.innerHTML = `
        <div class="bubble-header">
          <span class="task-icon">${taskIcon}</span>
          <span class="task-name">${taskName}</span>
          <span class="confidence">${Math.round(taskData.confidence * 100)}%</span>
        </div>
        <div class="bubble-content">
          ${taskMessage}
        </div>
        <div class="bubble-actions">
          <button class="action-button primary" id="enable-task-mode">Enable</button>
          <button class="action-button primary" id="enable-task-mode-timer">Enable for 30 min</button>
          <button class="action-button secondary" id="dismiss-task">Not now</button>
          <button class="action-button tertiary" id="task-settings">Settings</button>
        </div>
      `;
    } else {
      this.bubble.innerHTML = `
        <div class="bubble-header">
          <span class="task-icon">${taskIcon}</span>
          <span class="task-name">${taskName}</span>
          <span class="confidence">${Math.round(taskData.confidence * 100)}%</span>
        </div>
        <div class="bubble-content">
          ${taskMessage}
        </div>
        <div class="bubble-actions">
          <button class="action-button primary" id="enable-task-mode">Enable</button>
          <button class="action-button secondary" id="dismiss-task">Not now</button>
          <button class="action-button tertiary" id="task-settings">Settings</button>
        </div>
      `;
    }
    
    // Add event listeners to buttons
    setTimeout(() => {
      // Use the shadow root to find the buttons
      const root = this.shadowRoot || document;
      const enableButton = root.getElementById('enable-task-mode');
      const enableTimerButton = root.getElementById('enable-task-mode-timer');
      const dismissButton = root.getElementById('dismiss-task');
      const settingsButton = root.getElementById('task-settings');
      
      if (enableButton) {
        enableButton.addEventListener('click', () => {
          this.enableTaskMode(taskData);
        });
      }
      
      if (enableTimerButton) {
        enableTimerButton.addEventListener('click', () => {
          this.enableTaskMode(taskData, true);
        });
      }
      
      if (dismissButton) {
        dismissButton.addEventListener('click', () => {
          this.dismissTask();
        });
      }
      
      if (settingsButton) {
        settingsButton.addEventListener('click', () => {
          this.openTaskSettings();
        });
      }
    }, 100);
    
    // Show the companion
    this.show();
    
    // If this is a task switch, show the transition UI
    if (this.previousTask && this.previousTask.taskType !== taskData.taskType) {
      this.showTaskTransition(this.previousTask, taskData);
    }
  }
  
  /**
   * Show a message in the bubble
   * @param {string} message - The message to show
   */
  showMessage(message) {
    this.bubble.innerHTML = `
      <div class="bubble-content">
        ${message}
      </div>
      <div class="bubble-actions">
        <button class="action-button primary" id="message-got-it">Got it!</button>
      </div>
    `;

    // Add event listener using shadow root
    setTimeout(() => {
      const root = this.shadowRoot || document;
      const gotItButton = root.getElementById('message-got-it');
      if (gotItButton) {
        gotItButton.addEventListener('click', () => {
          this.hide();
        });
      }
    }, 100);

    this.show();
  }
  
  /**
   * Enable task mode
   * @param {Object} taskData - The task data
   * @param {boolean} useTimer - Whether to use a timer (30 minutes)
   */
  async enableTaskMode(taskData, useTimer = false) {
    try {
      console.log('[Focus Companion] Enabling task mode with data:', taskData, 'useTimer:', useTimer);
      
      // Set happy expression
      this.setExpression('happy');
      
      // Calculate end time if timer is used
      let endTimeMessage = '';
      if (useTimer) {
        const endTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
        const hours = endTime.getHours();
        const minutes = endTime.getMinutes();
        const formattedTime = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
        endTimeMessage = ` until ${formattedTime}`;
      }
      
      // Update bubble content
      this.bubble.innerHTML = `
        <div class="bubble-header">
          <span class="task-icon">${this.getTaskIcon(taskData.taskType)}</span>
          <span class="task-name">${this.getTaskName(taskData.taskType)} Mode</span>
          <span class="confidence">${Math.round(taskData.confidence * 100)}%</span>
        </div>
        <div class="bubble-content">
          ${this.getTaskName(taskData.taskType)} Mode enabled${endTimeMessage}! I'll help you stay focused.
        </div>
        <div class="bubble-actions">
          <button class="action-button primary" id="enable-got-it">Got it!</button>
        </div>
      `;
      
      // Add event listener using shadow root
      setTimeout(() => {
        const root = this.shadowRoot || document;
        const gotItButton = root.getElementById('enable-got-it');
        if (gotItButton) {
          gotItButton.addEventListener('click', () => {
            // Show stats instead of hiding
            const result = chrome.storage.local.get(['focusStats']);
            result.then(data => {
              this.showStats(data.focusStats || this.stats);
            });
          });
        }
      }, 100);
      
      // Send message to background script to enable task mode
      console.log('[Focus Companion] Sending ENABLE_TASK_MODE message to background script');
      await chrome.runtime.sendMessage({
        type: 'ENABLE_TASK_MODE',
        taskType: taskData.taskType,
        confidence: taskData.confidence,
        useTimer: useTimer,
        timerDuration: useTimer ? 30 * 60 * 1000 : null // 30 minutes in milliseconds
      });
      
      // Show the companion
      this.show();
    } catch (error) {
      console.error('[Focus Companion] Error enabling task mode:', error);
      this.setExpression('sad');
      this.showMessage('Oops! Something went wrong. Please try again.');
    }
  }
  
  /**
   * Disable task mode
   */
  async disableTaskMode() {
    try {
      console.log('[Focus Companion] Disabling task mode');
      
      // Send message to background script
      await chrome.runtime.sendMessage({ type: 'DISABLE_TASK_MODE' });

      // Clean up focus dashboard
      if (this.focusDashboard) {
        console.log('[Focus Companion] Destroying focus dashboard');
        this.focusDashboard.destroy();
        this.focusDashboard = null;
        console.log('[Focus Companion] Focus dashboard destroyed');
      }

      // Show success message
      this.setExpression('happy');
      this.showMessage('Focus mode disabled. Great job staying focused!');
    } catch (error) {
      console.error('[Focus Companion] Error disabling task mode:', error);
      this.setExpression('sad');
      this.showMessage('Oops! Something went wrong. Please try again.');
    }
  }
  
  /**
   * Dismiss task
   */
  dismissTask() {
    console.log('[Focus Companion] Task dismissed');
    
    // Set idle expression
    this.setExpression('idle');
    
    // Hide the companion
    this.hide();
    
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'DISMISS_TASK',
      taskType: this.currentTask.taskType
    });
  }
  
  /**
   * Open task settings
   */
  openTaskSettings() {
    console.log('[Focus Companion] Opening task settings');
    
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'OPEN_TASK_SETTINGS',
      taskType: this.currentTask.taskType
    });
  }
  
  /**
   * Show task transition UI
   * @param {Object} previousTask - The previous task
   * @param {Object} newTask - The new task
   */
  showTaskTransition(previousTask, newTask) {
    console.log('[Focus Companion] Task transition:', previousTask, newTask);
    
    // Create transition element
    const transitionEl = document.createElement('div');
    transitionEl.className = 'task-transition';
    
    // Set content
    transitionEl.innerHTML = `
      <div class="transition-header">
        <span class="transition-icon">🔄</span>
        <span class="transition-title">Task Switching</span>
      </div>
      <div class="transition-content">
        You're switching tasks. Would you like to update your focus mode?
      </div>
      <div class="transition-tasks">
        <div class="previous-task">
          <div class="task-label">Previous</div>
          <div class="task-value">${this.getTaskName(previousTask.taskType)}</div>
        </div>
        <div class="task-arrow">→</div>
        <div class="new-task">
          <div class="task-label">New</div>
          <div class="task-value">${this.getTaskName(newTask.taskType)}</div>
        </div>
      </div>
      <div class="bubble-actions">
        <button class="action-button primary" id="update-task">Update</button>
        <button class="action-button secondary" id="ignore-switch">Ignore</button>
      </div>
    `;
    
    // Add to document
    document.body.appendChild(transitionEl);
    
    // Add event listeners
    document.getElementById('update-task').addEventListener('click', () => {
      this.enableTaskMode(newTask);
      document.body.removeChild(transitionEl);
    });
    
    document.getElementById('ignore-switch').addEventListener('click', () => {
      document.body.removeChild(transitionEl);
    });
    
    // Show the transition
    setTimeout(() => {
      transitionEl.classList.add('visible');
    }, 100);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (document.body.contains(transitionEl)) {
        transitionEl.classList.remove('visible');
        setTimeout(() => {
          if (document.body.contains(transitionEl)) {
            document.body.removeChild(transitionEl);
          }
        }, 400);
      }
    }, 10000);
  }
  
  /**
   * Show a distraction alert
   * @param {Object} distractionData - The distraction data
   */
  showDistractionAlert(distractionData) {
    console.log('[Focus Companion] Distraction detected:', distractionData);
    
    // Set alert expression
    this.setExpression('alert');
    
    // Create bubble content
    this.bubble.innerHTML = `
      <div class="bubble-header">
        <span class="task-icon">⚠️</span>
        <span class="task-name">Distraction Alert</span>
        <span class="confidence">${Math.round(distractionData.confidence * 100)}%</span>
      </div>
      <div class="bubble-content">
        ${this.getDistractionMessage(distractionData.distractionType)}
      </div>
      <div class="bubble-actions">
        <button class="action-button primary" id="refocus">Refocus</button>
        <button class="action-button secondary" id="dismiss-distraction">Dismiss</button>
      </div>
    `;
    
    // Add event listeners to buttons
    document.getElementById('refocus').addEventListener('click', () => {
      this.refocus(distractionData);
    });
    
    document.getElementById('dismiss-distraction').addEventListener('click', () => {
      this.dismissDistraction();
    });
    
    // Show the companion
    this.show();
  }
  
  /**
   * Refocus after distraction
   * @param {Object} distractionData - The distraction data
   */
  refocus(distractionData) {
    console.log('[Focus Companion] Refocusing:', distractionData);
    
    // Set thinking expression
    this.setExpression('thinking');
    
    // Update bubble content
    this.bubble.innerHTML = `
      <div class="bubble-header">
        <span class="task-icon">${this.getTaskIcon(this.currentTask.taskType)}</span>
        <span class="task-name">${this.getTaskName(this.currentTask.taskType)} Mode</span>
      </div>
      <div class="bubble-content">
        Let's get back to ${this.getTaskName(this.currentTask.taskType.toLowerCase())}. You can do this!
      </div>
      <div class="bubble-actions">
        <button class="action-button primary" id="got-it-refocus">Got it!</button>
      </div>
    `;
    
    // Add event listener to button
    document.getElementById('got-it-refocus').addEventListener('click', () => {
      this.hide();
    });
    
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'REFOCUS',
      taskType: this.currentTask.taskType,
      distractionType: distractionData.distractionType
    });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hide();
    }, 5000);
  }
  
  /**
   * Dismiss distraction
   */
  dismissDistraction() {
    console.log('[Focus Companion] Distraction dismissed');
    
    // Set idle expression
    this.setExpression('idle');
    
    // Hide the companion
    this.hide();
    
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'DISMISS_DISTRACTION'
    });
  }
  
  /**
   * Get task icon based on task type
   * @param {string} taskType - The task type
   * @returns {string} - The task icon
   */
  getTaskIcon(taskType) {
    const icons = {
      'research': '🔍',
      'writing': '✏️',
      'coding': '💻',
      'reading': '📚',
      'job_application': '📝',
      'learning': '🧠',
      'email': '📧',
      'social_media': '👥',
      'shopping': '🛒',
      'default': '🎯'
    };
    
    return icons[taskType] || icons.default;
  }
  
  /**
   * Get task name based on task type
   * @param {string} taskType - The task type
   * @returns {string} - The task name
   */
  getTaskName(taskType) {
    const names = {
      'research': 'Research',
      'writing': 'Writing',
      'coding': 'Coding',
      'reading': 'Reading',
      'job_application': 'Job Application',
      'learning': 'Learning',
      'email': 'Email',
      'social_media': 'Social Media',
      'shopping': 'Shopping',
      'default': 'Focus'
    };
    
    return names[taskType] || names.default;
  }
  
  /**
   * Get task message based on task type
   * @param {string} taskType - The task type
   * @returns {string} - The task message
   */
  getTaskMessage(taskType) {
    const messages = {
      'research': 'I notice you\'re researching a topic. Would you like to enable Research Focus Mode?',
      'writing': 'It looks like you\'re writing. Would you like to enable Writing Focus Mode?',
      'coding': 'I see you\'re coding. Would you like to enable Coding Focus Mode?',
      'reading': 'It seems you\'re reading. Would you like to enable Reading Focus Mode?',
      'job_application': 'I notice you\'re applying for jobs. Would you like to enable Job Application Focus Mode?',
      'learning': 'It looks like you\'re learning something new. Would you like to enable Learning Focus Mode?',
      'email': 'I see you\'re managing emails. Would you like to enable Email Focus Mode?',
      'social_media': 'You\'re browsing social media. Would you like to set a time limit?',
      'shopping': 'I notice you\'re shopping. Would you like to set a budget reminder?',
      'default': 'I\'ve detected a task. Would you like to enable Focus Mode?'
    };
    
    return messages[taskType] || messages.default;
  }
  
  /**
   * Get distraction message based on distraction type
   * @param {string} distractionType - The distraction type
   * @returns {string} - The distraction message
   */
  getDistractionMessage(distractionType) {
    const messages = {
      'social_media': 'You seem to be getting distracted by social media. Would you like to refocus?',
      'entertainment': 'You appear to be browsing entertainment content. Would you like to get back on track?',
      'shopping': 'You\'ve switched to shopping. Would you like to return to your task?',
      'news': 'You\'re browsing news sites. Would you like to refocus on your task?',
      'default': 'You seem to be getting distracted. Would you like to refocus on your task?'
    };
    
    return messages[distractionType] || messages.default;
  }
  
  /**
   * Show a welcome message
   */
  showWelcomeMessage() {
    console.log('[Focus Companion] Showing welcome message');
    
    // Set happy expression
    this.setExpression('happy');
    
    // Create bubble content
    this.bubble.innerHTML = `
      <div class="bubble-header">
        <span class="task-icon">👋</span>
        <span class="task-name">Welcome!</span>
      </div>
      <div class="bubble-content">
        Hello! I'm your Focus Companion. I'll help you stay on track and be more productive.
      </div>
      <div class="bubble-actions">
        <button class="action-button primary" id="welcome-got-it">Got it!</button>
      </div>
    `;
    
    // Add event listener to button
    setTimeout(() => {
      // Use the shadow root to find the button
      const button = this.shadowRoot ? 
        this.shadowRoot.getElementById('welcome-got-it') : 
        document.getElementById('welcome-got-it');
        
      if (button) {
        console.log('[Focus Companion] Welcome button found, adding event listener');
        button.addEventListener('click', () => {
          this.hide();
        });
      } else {
        console.error('[Focus Companion] Welcome button not found');
      }
    }, 100);
    
    // Show the companion
    console.log('[Focus Companion] Calling show() method');
    this.show();
  }
  
  /**
   * Show a notification when focus mode timer ends
   * @param {Object} data - The notification data
   */
  showFocusModeEndedNotification(data) {
    console.log('[Focus Companion] Focus mode ended:', data);
    
    // Set appropriate expression
    this.setExpression('happy');
    
    // Update bubble content
    this.bubble.innerHTML = `
      <div class="bubble-header">
        <span class="task-icon">⏰</span>
        <span class="task-name">Focus Mode Ended</span>
      </div>
      <div class="bubble-content">
        ${data.message || 'Your focus session has ended.'}
      </div>
      <div class="bubble-actions">
        <button class="action-button primary" id="got-it-focus-ended">Got it!</button>
      </div>
    `;
    
    // Add event listener to button
    setTimeout(() => {
      const root = this.shadowRoot || document;
      const gotItButton = root.getElementById('got-it-focus-ended');
      
      if (gotItButton) {
        gotItButton.addEventListener('click', () => {
          this.hide();
        });
      }
    }, 100);
    
    // Show the companion
    this.show();
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      this.hide();
    }, 10000);
  }
  
  /**
   * Show focus stats
   * @param {Object} stats - The focus stats to display
   */
  showStats(stats) {
    this.setExpression('happy');
    
    // Create stats HTML with real-time timer and all metrics
    const statsHtml = `
      <div class="stats-display" style="padding: 15px;">
        <div class="focus-timer" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: linear-gradient(135deg, #6e8efb, #a777e3); padding: 10px; border-radius: 8px; color: white;">
          <span class="timer-label" style="font-size: 12px; opacity: 0.9;">Focus Time Remaining</span>
          <span class="timer-value" id="focus-time-remaining" style="font-size: 20px; font-weight: 500;">--:--</span>
        </div>
        
        <div class="focus-stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          <div class="stat-card" style="background: #f8f9fa; padding: 12px; border-radius: 8px; text-align: center;">
            <div class="stat-value" id="focus-score" style="font-size: 24px; font-weight: 500; color: #6e8efb;">${stats.focusScore}</div>
            <div class="stat-label" style="font-size: 12px; color: #666;">Focus Score</div>
            <div class="focus-meter" style="height: 4px; background-color: #e0e0e0; border-radius: 2px; overflow: hidden; margin-top: 8px;">
              <div class="focus-meter-fill" style="height: 100%; background: linear-gradient(90deg, #6e8efb, #a777e3); width: ${stats.focusScore}%;"></div>
            </div>
          </div>
          
          <div class="stat-card" style="background: #f8f9fa; padding: 12px; border-radius: 8px; text-align: center;">
            <div class="stat-value" id="distraction-count" style="font-size: 24px; font-weight: 500; color: #6e8efb;">${stats.distractionCount}</div>
            <div class="stat-label" style="font-size: 12px; color: #666;">Distractions</div>
          </div>
          
          <div class="stat-card" style="background: #f8f9fa; padding: 12px; border-radius: 8px; text-align: center;">
            <div class="stat-value" id="active-time" style="font-size: 24px; font-weight: 500; color: #6e8efb;">0m</div>
            <div class="stat-label" style="font-size: 12px; color: #666;">Active Time</div>
          </div>
          
          <div class="stat-card" style="background: #f8f9fa; padding: 12px; border-radius: 8px; text-align: center;">
            <div class="stat-value" id="streak-count" style="font-size: 24px; font-weight: 500; color: #6e8efb;">${stats.streakCount}</div>
            <div class="stat-label" style="font-size: 12px; color: #666;">Day Streak</div>
          </div>
        </div>
        
        <div class="bubble-actions" style="margin-top: 15px; text-align: right;">
          <button class="action-button secondary" id="minimize-stats">Minimize</button>
        </div>
      </div>
    `;
    
    this.bubble.innerHTML = statsHtml;
    
    // Start updating stats in real-time
    this.startStatsInterval();
    
    // Add event listeners
    setTimeout(() => {
      const minimizeButton = this.shadowRoot.getElementById('minimize-stats');
      if (minimizeButton) {
        minimizeButton.addEventListener('click', () => {
          this.hide();
        });
      }
    }, 100);

    this.show();
  }

  /**
   * Start updating stats in real-time
   */
  startStatsInterval() {
    // Clear any existing interval
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Store start time
    this.statsStartTime = Date.now();

    // Update stats every second
    this.statsInterval = setInterval(async () => {
      try {
        // Get current stats and preferences
        const result = await chrome.storage.local.get(['focusStats', 'userPreferences']);
        const stats = result.focusStats || this.stats;
        const prefs = result.userPreferences || {};

        // Update stats if elements exist
        const focusScoreEl = this.shadowRoot.getElementById('focus-score');
        const distractionCountEl = this.shadowRoot.getElementById('distraction-count');
        const activeTimeEl = this.shadowRoot.getElementById('active-time');
        const timeRemainingEl = this.shadowRoot.getElementById('focus-time-remaining');
        const meterFill = this.shadowRoot.querySelector('.focus-meter-fill');

        if (focusScoreEl) focusScoreEl.textContent = stats.focusScore;
        if (distractionCountEl) distractionCountEl.textContent = stats.distractionCount;
        
        // Calculate and update active time
        const activeTime = Math.floor((Date.now() - this.statsStartTime) / 60000);
        if (activeTimeEl) activeTimeEl.textContent = `${activeTime}m`;

        // Update focus meter
        if (meterFill) meterFill.style.width = `${stats.focusScore}%`;

        // Update time remaining if timer is active
        if (timeRemainingEl && prefs.focusModeEndTime) {
          const remaining = Math.max(0, prefs.focusModeEndTime - Date.now());
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          timeRemainingEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      } catch (error) {
        console.error('[Focus Companion] Error updating stats:', error);
      }
    }, 1000);
  }

  /**
   * Stop updating stats
   */
  stopStatsInterval() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
}

// Create and export the companion instance
const focusCompanion = new FocusCompanion();
export default focusCompanion; 