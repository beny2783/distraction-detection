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
const distractionTimelineElement = document.getElementById('distraction-timeline');

// State
let sessionData = {};
let nudgeFeedback = [];
let distractionScores = [];
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
  chrome.storage.local.get(['sessionData', 'nudgeFeedback', 'userPreferences', 'distractionScores'], (result) => {
    if (result.sessionData) {
      sessionData = result.sessionData;
    }
    
    if (result.nudgeFeedback) {
      nudgeFeedback = result.nudgeFeedback;
    }
    
    if (result.distractionScores) {
      distractionScores = result.distractionScores;
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

// Format time in a human-readable format
const formatTime = (milliseconds) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

// Format date for timeline display
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  
  // Filter distraction scores for the selected time range
  const filteredScores = distractionScores.filter(score => score.timestamp >= startTimestamp);
  
  // Update distraction timeline
  updateDistractionTimeline(filteredScores);
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
};

// Update distraction timeline
const updateDistractionTimeline = (scores) => {
  // Clear previous content
  distractionTimelineElement.innerHTML = '';
  
  if (scores.length === 0) {
    // No data, show empty state
    distractionTimelineElement.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 21H4.6C3.1 21 2 19.9 2 18.4V3" stroke="#CCCCCC" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 7L16 12L13 9L9 13L7 11" stroke="#CCCCCC" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>Not enough data to display timeline</p>
      </div>
    `;
    return;
  }
  
  // Create timeline container
  const timelineContainer = document.createElement('div');
  timelineContainer.className = 'timeline-container';
  
  // Create timeline chart
  const chartContainer = document.createElement('div');
  chartContainer.className = 'timeline-chart';
  
  // Create X-axis (time)
  const xAxis = document.createElement('div');
  xAxis.className = 'timeline-x-axis';
  
  // Create bars container
  const barsContainer = document.createElement('div');
  barsContainer.className = 'timeline-bars';
  
  // Add bars for each score
  scores.forEach(score => {
    // Create bar
    const bar = document.createElement('div');
    bar.className = 'timeline-bar';
    
    // Calculate height based on score (0-100%)
    const height = Math.round(score.overallScore * 100);
    bar.style.height = `${height}%`;
    
    // Set color based on score
    if (height >= 70) {
      bar.style.backgroundColor = '#e74c3c'; // Red for high distraction
    } else if (height >= 40) {
      bar.style.backgroundColor = '#f39c12'; // Orange for medium distraction
    } else {
      bar.style.backgroundColor = '#2ecc71'; // Green for low distraction
    }
    
    // Add tooltip with details
    bar.title = `Time: ${formatDate(score.timestamp)}
Score: ${height}%
Events: ${score.totalEvents}`;
    
    // Add to container
    barsContainer.appendChild(bar);
    
    // Add time label to X-axis (only for every 3rd bar to avoid crowding)
    const timeLabel = document.createElement('div');
    timeLabel.className = 'timeline-time-label';
    timeLabel.textContent = formatDate(score.timestamp);
    xAxis.appendChild(timeLabel);
  });
  
  // Assemble chart
  chartContainer.appendChild(barsContainer);
  timelineContainer.appendChild(chartContainer);
  timelineContainer.appendChild(xAxis);
  
  // Add to DOM
  distractionTimelineElement.appendChild(timelineContainer);
  
  // Add CSS for the timeline
  const style = document.createElement('style');
  style.textContent = `
    .timeline-container {
      width: 100%;
      height: 250px;
      margin-top: 20px;
    }
    
    .timeline-chart {
      height: 200px;
      width: 100%;
      position: relative;
      border-left: 1px solid #ddd;
      border-bottom: 1px solid #ddd;
    }
    
    .timeline-bars {
      display: flex;
      height: 100%;
      align-items: flex-end;
      padding: 0 10px;
    }
    
    .timeline-bar {
      flex: 1;
      margin: 0 2px;
      min-width: 10px;
      max-width: 30px;
      border-radius: 2px 2px 0 0;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    
    .timeline-bar:hover {
      opacity: 0.8;
    }
    
    .timeline-x-axis {
      display: flex;
      width: 100%;
      overflow-x: auto;
      padding: 5px 10px;
    }
    
    .timeline-time-label {
      flex: 1;
      text-align: center;
      font-size: 12px;
      color: #666;
      min-width: 10px;
      max-width: 30px;
      margin: 0 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
  
  document.head.appendChild(style);
};

// Listen for message updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DISTRACTION_SCORE_UPDATED') {
    // Add the new score to the array
    distractionScores.push(message.data);
    
    // Re-process data with the updated scores
    processData(timeRangeSelect.value);
  }
});

// Initialize insights page
document.addEventListener('DOMContentLoaded', () => {
  // Load data
  loadData();
  
  // Set up event listeners
  timeRangeSelect.addEventListener('change', () => {
    processData(timeRangeSelect.value);
  });
}); 