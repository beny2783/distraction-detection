/**
 * Focus Nudge - Popup Script
 * 
 * This script handles the popup UI interactions and displays user statistics.
 */

console.log('[Focus Nudge] Popup script loading...');

// DOM Elements
const focusScoreElement = document.getElementById('focus-score');
const focusTimeElement = document.getElementById('focus-time');
const distractionCountElement = document.getElementById('distraction-count');
const streakCountElement = document.getElementById('streak-count');
const nudgeCountElement = document.getElementById('nudge-count');
const refreshStatsButton = document.getElementById('refresh-stats');
const nudgingToggle = document.getElementById('nudging-toggle');
const taskDetectionToggle = document.getElementById('task-detection-toggle');
const viewInsightsButton = document.getElementById('view-insights');

console.log('[Focus Nudge] DOM Elements initialized:', {
  focusScore: !!focusScoreElement,
  focusTime: !!focusTimeElement,
  distractionCount: !!distractionCountElement,
  streakCount: !!streakCountElement,
  nudgeCount: !!nudgeCountElement,
  refreshStats: !!refreshStatsButton,
  nudgingToggle: !!nudgingToggle,
  taskDetectionToggle: !!taskDetectionToggle,
  viewInsights: !!viewInsightsButton
});

// User preferences
let userPreferences = {
  nudgingEnabled: true,
  taskDetectionEnabled: true
};

// Stats
let stats = {
  focusScore: 95,
  focusTime: 0,
  distractionCount: 0,
  streakCount: 0,
  nudgeCount: 0
};

// Load user preferences and stats
const loadData = () => {
  chrome.storage.local.get(['userPreferences', 'sessionData', 'nudgeFeedback', 'focusStats'], (result) => {
    try {
      // Load preferences
      if (result.userPreferences) {
        userPreferences = result.userPreferences;
        
        // Update UI to reflect preferences
        if (nudgingToggle) {
          nudgingToggle.checked = userPreferences.nudgingEnabled;
        }
        
        if (taskDetectionToggle) {
          taskDetectionToggle.checked = userPreferences.taskDetectionEnabled !== false;
        }
      }
      
      // Load focus stats
      if (result.focusStats) {
        stats = {
          ...stats,
          ...result.focusStats
        };
      }
      
      // Calculate focus time from session data
      if (result.sessionData) {
        let totalFocusTime = 0;
        Object.values(result.sessionData).forEach(session => {
          if (session.focusTime) {
            totalFocusTime += session.focusTime;
          }
        });
        stats.focusTime = Math.round(totalFocusTime / 3600); // Convert to hours
      }
      
      // Get nudge count
      if (result.nudgeFeedback) {
        stats.nudgeCount = result.nudgeFeedback.length;
      }
      
      updateUI();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  });
};

// Save user preferences
const savePreferences = () => {
  try {
    // Get task detection preferences
    if (taskDetectionToggle) {
      userPreferences.taskDetectionEnabled = taskDetectionToggle.checked;
    }
    
    if (nudgingToggle) {
      userPreferences.nudgingEnabled = nudgingToggle.checked;
    }
    
    // Save to local storage
    chrome.storage.local.set({ userPreferences }, () => {
      console.log('Preferences saved:', userPreferences);
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'update_preferences',
        preferences: userPreferences
      });
    });
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
};

// Update UI with current stats
const updateUI = () => {
  try {
    if (focusScoreElement) {
      focusScoreElement.textContent = stats.focusScore;
      
      // Update focus score color based on value
      if (stats.focusScore >= 80) {
        focusScoreElement.style.color = '#4CAF50';
      } else if (stats.focusScore >= 60) {
        focusScoreElement.style.color = '#FFC107';
      } else {
        focusScoreElement.style.color = '#F44336';
      }
    }
    
    if (focusTimeElement) {
      focusTimeElement.textContent = `${stats.focusTime}h`;
    }
    
    if (distractionCountElement) {
      distractionCountElement.textContent = stats.distractionCount;
    }
    
    if (streakCountElement) {
      streakCountElement.textContent = stats.streakCount;
    }
    
    if (nudgeCountElement) {
      nudgeCountElement.textContent = stats.nudgeCount;
    }
  } catch (error) {
    console.error('Error updating UI:', error);
  }
};

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Load initial data
    loadData();
    
    // Set up event listeners
    if (nudgingToggle) {
      nudgingToggle.addEventListener('change', savePreferences);
    }
    
    if (taskDetectionToggle) {
      taskDetectionToggle.addEventListener('change', savePreferences);
    }
    
    if (viewInsightsButton) {
      viewInsightsButton.addEventListener('click', () => {
        chrome.tabs.create({ url: 'insights.html' });
      });
    }
    
    if (refreshStatsButton) {
      refreshStatsButton.addEventListener('click', () => {
        refreshStatsButton.style.transform = 'rotate(360deg)';
        refreshStatsButton.style.transition = 'transform 0.5s';
        setTimeout(() => {
          refreshStatsButton.style.transform = '';
          loadData();
        }, 500);
      });
    }
    
    // Refresh stats every minute
    setInterval(loadData, 60000);
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
}); 