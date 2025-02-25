/**
 * Focus Nudge - Insights Script
 * 
 * This script handles the insights page UI and data visualization.
 */

// DOM Elements
const timeRangeSelect = document.getElementById('time-range');
const totalBrowsingTimeElement = document.getElementById('total-browsing-time');
const distractionCountElement = document.getElementById('distraction-count');
const nudgeCountElement = document.getElementById('nudge-count');
const focusScoreElement = document.getElementById('focus-score');
const distractionTableBody = document.getElementById('distraction-table-body');
const modelTypeElement = document.getElementById('model-type');
const modelVersionElement = document.getElementById('model-version');
const featureImportanceElement = document.getElementById('feature-importance');

// State
let sessionData = {};
let nudgeFeedback = [];
let modelInfo = {
  type: 'random-forest',
  version: '0.1.0'
};
let stats = {
  totalBrowsingTime: 0,
  distractionCount: 0,
  nudgeCount: 0,
  focusScore: 0,
  distractionsByDomain: {}
};

// Load data from storage
const loadData = () => {
  chrome.storage.local.get(['sessionData', 'nudgeFeedback', 'userPreferences'], (result) => {
    if (result.sessionData) {
      sessionData = result.sessionData;
    }
    
    if (result.nudgeFeedback) {
      nudgeFeedback = result.nudgeFeedback;
    }
    
    // Get model info
    chrome.runtime.sendMessage({ type: 'get_model_info' }, (response) => {
      if (response) {
        modelInfo = response;
        updateModelInfo();
      }
    });
    
    // Process data based on selected time range
    processData(timeRangeSelect.value);
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
  
  modelTypeElement.textContent = modelName;
  modelVersionElement.textContent = modelInfo.version;
  
  // Update feature importance if it's a Random Forest model
  if (modelInfo.type === 'random-forest') {
    updateFeatureImportance();
  } else {
    // Hide feature importance for other models
    const featureSection = featureImportanceElement.closest('.section');
    if (featureSection) {
      if (modelInfo.type === 'rule-based') {
        featureSection.querySelector('p').textContent = 'The rule-based model uses predefined rules to detect distractions based on browsing patterns.';
        featureImportanceElement.style.display = 'none';
      } else {
        featureSection.style.display = 'none';
      }
    }
  }
};

// Update feature importance visualization
const updateFeatureImportance = () => {
  // For MVP, we'll use hardcoded feature importance values
  // In a future version, this would come from the model
  const features = [
    { name: 'Time Spent', importance: 0.3 },
    { name: 'Scroll Count', importance: 0.2 },
    { name: 'Scroll Depth', importance: 0.15 },
    { name: 'Click Count', importance: 0.1 },
    { name: 'Tab Switches', importance: 0.15 },
    { name: 'Video Watch Time', importance: 0.1 }
  ];
  
  // Clear existing content
  featureImportanceElement.innerHTML = '';
  
  // Add feature importance bars
  features.forEach(feature => {
    const featureItem = document.createElement('div');
    featureItem.className = 'feature-item';
    
    const percentValue = Math.round(feature.importance * 100);
    
    featureItem.innerHTML = `
      <div class="feature-name">${feature.name}</div>
      <div class="feature-bar">
        <div class="feature-bar-fill" style="width: ${percentValue}%"></div>
      </div>
      <div class="feature-value">${percentValue}%</div>
    `;
    
    featureImportanceElement.appendChild(featureItem);
  });
};

// Process data based on time range
const processData = (timeRange) => {
  // Reset stats
  stats = {
    totalBrowsingTime: 0,
    distractionCount: 0,
    nudgeCount: 0,
    focusScore: 0,
    distractionsByDomain: {}
  };
  
  // Calculate time range boundaries
  const now = new Date();
  let startTime;
  
  switch (timeRange) {
    case 'today':
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case 'yesterday':
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case 'week':
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0);
      break;
    case 'month':
      startTime = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      break;
    default:
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }
  
  const startTimestamp = startTime.getTime();
  
  // Process session data
  for (const domain in sessionData) {
    const domainData = sessionData[domain];
    
    // Skip if last visit is outside the selected time range
    if (domainData.lastVisit < startTimestamp) continue;
    
    // Accumulate browsing time
    stats.totalBrowsingTime += domainData.totalTimeSpent;
    
    // Count distractions
    if (domainData.distractionScore > 0.7) {
      stats.distractionCount++;
      
      // Store distraction by domain
      if (!stats.distractionsByDomain[domain]) {
        stats.distractionsByDomain[domain] = {
          score: domainData.distractionScore,
          timeSpent: domainData.totalTimeSpent,
          visits: domainData.visits
        };
      }
    }
  }
  
  // Process nudge feedback
  stats.nudgeCount = nudgeFeedback.filter(feedback => feedback.timestamp >= startTimestamp).length;
  
  // Calculate focus score (simple formula: 100 - (distractions / total browsing hours * 10))
  const browsingHours = stats.totalBrowsingTime / (60 * 60 * 1000) || 1; // Avoid division by zero
  stats.focusScore = Math.max(0, Math.min(100, Math.round(100 - (stats.distractionCount / browsingHours * 10))));
  
  // Update UI
  updateUI();
};

// Format time in hours and minutes
const formatTime = (milliseconds) => {
  const hours = Math.floor(milliseconds / (60 * 60 * 1000));
  const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
};

// Update UI with processed data
const updateUI = () => {
  // Update overview stats
  totalBrowsingTimeElement.textContent = formatTime(stats.totalBrowsingTime);
  distractionCountElement.textContent = stats.distractionCount;
  nudgeCountElement.textContent = stats.nudgeCount;
  focusScoreElement.textContent = `${stats.focusScore}%`;
  
  // Update distraction table
  distractionTableBody.innerHTML = '';
  
  // Sort domains by distraction score
  const sortedDomains = Object.keys(stats.distractionsByDomain).sort((a, b) => {
    return stats.distractionsByDomain[b].score - stats.distractionsByDomain[a].score;
  });
  
  if (sortedDomains.length === 0) {
    // No data, show empty state
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="4" style="text-align: center; padding: 30px; color: #999;">
        No distraction data available for the selected time period
      </td>
    `;
    distractionTableBody.appendChild(emptyRow);
  } else {
    // Populate table with data
    sortedDomains.forEach(domain => {
      const domainData = stats.distractionsByDomain[domain];
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${domain}</td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${domainData.score * 100}%"></div>
          </div>
          <div style="margin-top: 5px; font-size: 12px;">${Math.round(domainData.score * 100)}%</div>
        </td>
        <td>${formatTime(domainData.timeSpent)}</td>
        <td>${domainData.visits}</td>
      `;
      
      distractionTableBody.appendChild(row);
    });
  }
  
  // TODO: Add chart visualization in future versions
};

// Event Listeners
timeRangeSelect.addEventListener('change', () => {
  processData(timeRangeSelect.value);
});

// Initialize insights page
document.addEventListener('DOMContentLoaded', loadData); 