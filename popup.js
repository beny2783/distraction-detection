/**
 * Focus Nudge - Popup Script
 * 
 * This script handles the popup UI interactions and displays user statistics.
 */

// DOM Elements
const nudgingToggle = document.getElementById('nudging-toggle');
const focusGoalInput = document.getElementById('focus-goal');
const sensitivityOptions = document.querySelectorAll('input[name="sensitivity"]');
const modelTypeSelect = document.getElementById('model-type');
const modelInfoElement = document.getElementById('model-info');
const viewInsightsButton = document.getElementById('view-insights');
const distractionCountElement = document.getElementById('distraction-count');
const nudgeCountElement = document.getElementById('nudge-count');
const topDistractionElement = document.getElementById('top-distraction');
const currentDistractionScoreElement = document.getElementById('current-distraction-score');
const taskDetectionToggle = document.getElementById('task-detection-toggle');
const taskSpecificNudgesToggle = document.getElementById('task-specific-nudges-toggle');
const detectedTaskElement = document.getElementById('detected-task');
const taskConfidenceElement = document.getElementById('task-confidence');

// User preferences
let userPreferences = {
  nudgingEnabled: true,
  nudgeSensitivity: 'medium',
  focusGoal: '',
  modelType: 'random-forest',
  taskDetectionEnabled: true,
  taskSpecificNudgesEnabled: true
};

// Stats
let stats = {
  distractionCount: 0,
  nudgeCount: 0,
  topDistraction: 'None',
  distractionsByDomain: {},
  currentDistractionScore: 0,
  currentTask: {
    taskType: 'unknown',
    confidence: 0
  }
};

// Model info
let modelInfo = {
  type: 'random-forest',
  version: '0.1.0'
};

// Load user preferences and stats
const loadData = () => {
  chrome.storage.local.get(['userPreferences', 'sessionData', 'nudgeFeedback', 'distractionScores'], (result) => {
    // Load preferences
    if (result.userPreferences) {
      userPreferences = result.userPreferences;
      
      // Update UI to reflect preferences
      nudgingToggle.checked = userPreferences.nudgingEnabled;
      focusGoalInput.value = userPreferences.focusGoal || '';
      
      // Set sensitivity radio button
      document.getElementById(`sensitivity-${userPreferences.nudgeSensitivity}`).checked = true;
      
      // Set model type
      if (userPreferences.modelType) {
        modelTypeSelect.value = userPreferences.modelType;
      }
      
      // Set task detection toggles
      if (taskDetectionToggle) {
        taskDetectionToggle.checked = userPreferences.taskDetectionEnabled !== false;
      }
      
      if (taskSpecificNudgesToggle) {
        taskSpecificNudgesToggle.checked = userPreferences.taskSpecificNudgesEnabled !== false;
      }
    }
    
    // Calculate stats from session data
    if (result.sessionData) {
      const sessionData = result.sessionData;
      let distractionCount = 0;
      let topDistractionScore = 0;
      let topDistractionDomain = 'None';
      
      // Process session data
      for (const domain in sessionData) {
        const domainData = sessionData[domain];
        
        // Count as distraction if score is above threshold
        if (domainData.distractionScore > 0.7) {
          distractionCount++;
          
          // Track top distraction
          if (domainData.distractionScore > topDistractionScore) {
            topDistractionScore = domainData.distractionScore;
            topDistractionDomain = domain;
          }
          
          // Store in stats object
          if (!stats.distractionsByDomain[domain]) {
            stats.distractionsByDomain[domain] = {
              count: 0,
              totalScore: 0
            };
          }
          
          stats.distractionsByDomain[domain].count++;
          stats.distractionsByDomain[domain].totalScore += domainData.distractionScore;
        }
      }
      
      stats.distractionCount = distractionCount;
      stats.topDistraction = topDistractionDomain;
      
      // Update UI with stats
      distractionCountElement.textContent = distractionCount;
      topDistractionElement.textContent = topDistractionDomain === 'None' ? 'None' : topDistractionDomain;
    }
    
    // Calculate nudge count from feedback data
    if (result.nudgeFeedback) {
      stats.nudgeCount = result.nudgeFeedback.length;
      nudgeCountElement.textContent = stats.nudgeCount;
    }
    
    // Get current distraction score from distraction scores data
    if (result.distractionScores && result.distractionScores.length > 0) {
      // Get the most recent distraction score
      const latestScore = result.distractionScores[result.distractionScores.length - 1];
      stats.currentDistractionScore = latestScore.overallScore;
      
      // Update UI with current distraction score
      updateDistractionScoreUI(stats.currentDistractionScore);
    } else {
      // No distraction scores available
      currentDistractionScoreElement.textContent = 'N/A';
    }
    
    // Get model info
    chrome.runtime.sendMessage({ type: 'get_model_info' }, (response) => {
      if (response) {
        modelInfo = response;
        updateModelInfo();
      }
    });
    
    // Get current detected task from active tab's session
    if (result.sessionData) {
      // Find the active tab's session
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const activeTabId = tabs[0].id;
          
          // Look for session data with detected task
          for (const sessionId in result.sessionData) {
            const session = result.sessionData[sessionId];
            
            if (session.tabId === activeTabId && session.detectedTask) {
              stats.currentTask = {
                taskType: session.detectedTask.taskType,
                confidence: session.detectedTask.confidence
              };
              
              // Update task detection UI
              updateTaskDetectionUI();
              break;
            }
          }
        }
      });
    }
  });
};

// Update model info display
const updateModelInfo = () => {
  let modelName = 'Unknown';
  
  switch (modelInfo.type) {
    case 'rule-based':
      modelName = 'Rule-based';
      break;
    case 'random-forest':
      modelName = 'Random Forest';
      break;
    case 'neural-network':
      modelName = 'Neural Network';
      break;
  }
  
  modelInfoElement.textContent = `${modelName} v${modelInfo.version}`;
};

// Save user preferences
const savePreferences = () => {
  chrome.storage.local.set({ userPreferences }, () => {
    console.log('Preferences saved:', userPreferences);
    
    // Notify background script of preference update
    chrome.runtime.sendMessage({
      type: 'update_preferences',
      preferences: userPreferences
    });
  });
  
  // Get task detection preferences
  if (taskDetectionToggle) {
    userPreferences.taskDetectionEnabled = taskDetectionToggle.checked;
  }
  
  if (taskSpecificNudgesToggle) {
    userPreferences.taskSpecificNudgesEnabled = taskSpecificNudgesToggle.checked;
  }
  
  // Save preferences
  chrome.storage.sync.set({ userPreferences }, () => {
    console.log('Preferences saved');
    
    // Show saved message
    const savedMessage = document.getElementById('saved-message');
    if (savedMessage) {
      savedMessage.classList.add('visible');
      setTimeout(() => {
        savedMessage.classList.remove('visible');
      }, 2000);
    }
  });
};

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Load data
  loadData();
  
  // Set up event listeners
  nudgingToggle.addEventListener('change', () => {
    userPreferences.nudgingEnabled = nudgingToggle.checked;
    savePreferences();
  });
  
  focusGoalInput.addEventListener('change', () => {
    userPreferences.focusGoal = focusGoalInput.value;
    savePreferences();
  });
  
  sensitivityOptions.forEach(option => {
    option.addEventListener('change', () => {
      if (option.checked) {
        userPreferences.nudgeSensitivity = option.value;
        savePreferences();
      }
    });
  });
  
  modelTypeSelect.addEventListener('change', () => {
    userPreferences.modelType = modelTypeSelect.value;
    savePreferences();
    
    // Update model info
    chrome.runtime.sendMessage({ 
      type: 'set_model_type',
      modelType: modelTypeSelect.value
    }, (response) => {
      if (response && response.success) {
        modelInfo = response.modelInfo;
        updateModelInfo();
      }
    });
  });
  
  viewInsightsButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'insights.html' });
  });
  
  // Listen for distraction score updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DISTRACTION_SCORE_UPDATED') {
      // Update the distraction score in the UI
      stats.currentDistractionScore = message.data.overallScore;
      updateDistractionScoreUI(stats.currentDistractionScore);
    }
  });
  
  // Task detection toggle
  if (taskDetectionToggle) {
    taskDetectionToggle.addEventListener('change', savePreferences);
  }
  
  // Task-specific nudges toggle
  if (taskSpecificNudgesToggle) {
    taskSpecificNudgesToggle.addEventListener('change', savePreferences);
  }
  
  // Test detection button
  const testDetectionButton = document.getElementById('test-detection-button');
  if (testDetectionButton) {
    testDetectionButton.addEventListener('click', () => {
      // Show loading state
      testDetectionButton.textContent = 'Detecting...';
      testDetectionButton.disabled = true;
      
      // Send message to background script to trigger task detection
      chrome.runtime.sendMessage({ type: 'TRIGGER_TASK_DETECTION' }, (response) => {
        // Reset button state
        setTimeout(() => {
          testDetectionButton.textContent = 'Test Detection Now';
          testDetectionButton.disabled = false;
          
          // Reload data to update UI with new detection
          loadData();
        }, 1000);
      });
    });
  }
});

// Update distraction score UI
const updateDistractionScoreUI = (score) => {
  // Convert score to percentage and format
  const scorePercentage = Math.round(score * 100);
  
  // Update UI element
  currentDistractionScoreElement.textContent = `${scorePercentage}%`;
  
  // Add color coding based on score
  if (scorePercentage >= 70) {
    currentDistractionScoreElement.style.color = '#e74c3c'; // Red for high distraction
  } else if (scorePercentage >= 40) {
    currentDistractionScoreElement.style.color = '#f39c12'; // Orange for medium distraction
  } else {
    currentDistractionScoreElement.style.color = '#2ecc71'; // Green for low distraction
  }
};

/**
 * Update the task detection UI
 */
const updateTaskDetectionUI = () => {
  if (detectedTaskElement && taskConfidenceElement) {
    // Format task type for display
    const formattedTaskType = stats.currentTask.taskType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Update detected task
    detectedTaskElement.textContent = formattedTaskType;
    
    // Update confidence
    const confidencePercent = Math.round(stats.currentTask.confidence * 100);
    taskConfidenceElement.textContent = `${confidencePercent}%`;
    
    // Update confidence color
    if (confidencePercent >= 80) {
      taskConfidenceElement.className = 'high-confidence';
    } else if (confidencePercent >= 50) {
      taskConfidenceElement.className = 'medium-confidence';
    } else {
      taskConfidenceElement.className = 'low-confidence';
    }
  }
}; 