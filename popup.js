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

// User preferences
let userPreferences = {
  nudgingEnabled: true,
  nudgeSensitivity: 'medium',
  focusGoal: '',
  modelType: 'random-forest'
};

// Stats
let stats = {
  distractionCount: 0,
  nudgeCount: 0,
  topDistraction: 'None',
  distractionsByDomain: {}
};

// Model info
let modelInfo = {
  type: 'random-forest',
  version: '0.1.0'
};

// Load user preferences and stats
const loadData = () => {
  chrome.storage.local.get(['userPreferences', 'sessionData', 'nudgeFeedback'], (result) => {
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
    
    // Get model info
    chrome.runtime.sendMessage({ type: 'get_model_info' }, (response) => {
      if (response) {
        modelInfo = response;
        updateModelInfo();
      }
    });
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
};

// Event Listeners
nudgingToggle.addEventListener('change', () => {
  userPreferences.nudgingEnabled = nudgingToggle.checked;
  savePreferences();
});

focusGoalInput.addEventListener('blur', () => {
  userPreferences.focusGoal = focusGoalInput.value.trim();
  savePreferences();
});

// Listen for Enter key in focus goal input
focusGoalInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    userPreferences.focusGoal = focusGoalInput.value.trim();
    savePreferences();
    focusGoalInput.blur();
  }
});

// Listen for sensitivity changes
sensitivityOptions.forEach(option => {
  option.addEventListener('change', () => {
    if (option.checked) {
      userPreferences.nudgeSensitivity = option.value;
      savePreferences();
    }
  });
});

// Listen for model type changes
modelTypeSelect.addEventListener('change', () => {
  userPreferences.modelType = modelTypeSelect.value;
  savePreferences();
  
  // Update model info with loading message
  modelInfoElement.textContent = 'Loading model...';
  
  // Wait for model to load
  setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'get_model_info' }, (response) => {
      if (response) {
        modelInfo = response;
        updateModelInfo();
      }
    });
  }, 500);
});

// View detailed insights
viewInsightsButton.addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('insights.html')
  });
});

// Initialize popup
document.addEventListener('DOMContentLoaded', loadData); 