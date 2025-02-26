/**
 * Focus Nudge - Dashboard Component
 * 
 * This module provides a user interface for visualizing event streams,
 * displaying insights, and managing user preferences.
 */

import { generateInsights } from '../analytics/insights.js';
import { getEvents } from '../events/storage.js';

// Dashboard configuration
const DEFAULT_CONFIG = {
  refreshInterval: 60000, // 1 minute
  maxEventsToDisplay: 100,
  maxInsightsToDisplay: 5,
  chartColors: {
    primary: '#4285F4',
    secondary: '#34A853',
    tertiary: '#FBBC05',
    quaternary: '#EA4335',
    background: '#F8F9FA',
    text: '#202124'
  }
};

/**
 * Dashboard class
 */
export default class Dashboard {
  /**
   * Create a dashboard
   * @param {Object} config - Dashboard configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.container = null;
    this.events = [];
    this.insights = null;
    this.refreshTimer = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the dashboard
   * @param {HTMLElement} container - Container element
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize(container) {
    try {
      this.container = container;
      
      // Create dashboard structure
      this.createDashboardStructure();
      
      // Load initial data
      await this.refreshData();
      
      // Set up refresh timer
      this.refreshTimer = setInterval(() => {
        this.refreshData();
      }, this.config.refreshInterval);
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize dashboard:', error);
      return false;
    }
  }

  /**
   * Create dashboard structure
   */
  createDashboardStructure() {
    if (!this.container) {
      console.error('Dashboard container not set');
      return;
    }
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'dashboard-header';
    header.innerHTML = `
      <h1>Focus Nudge Dashboard</h1>
      <div class="dashboard-controls">
        <button id="refresh-dashboard" class="dashboard-button">Refresh</button>
        <button id="settings-dashboard" class="dashboard-button">Settings</button>
      </div>
    `;
    this.container.appendChild(header);
    
    // Create main content
    const content = document.createElement('div');
    content.className = 'dashboard-content';
    
    // Create insights section
    const insightsSection = document.createElement('div');
    insightsSection.className = 'dashboard-section insights-section';
    insightsSection.innerHTML = `
      <h2>Insights</h2>
      <div id="insights-container" class="insights-container">
        <div class="loading">Loading insights...</div>
      </div>
    `;
    content.appendChild(insightsSection);
    
    // Create stats section
    const statsSection = document.createElement('div');
    statsSection.className = 'dashboard-section stats-section';
    statsSection.innerHTML = `
      <h2>Activity Stats</h2>
      <div id="stats-container" class="stats-container">
        <div class="loading">Loading stats...</div>
      </div>
    `;
    content.appendChild(statsSection);
    
    // Create charts section
    const chartsSection = document.createElement('div');
    chartsSection.className = 'dashboard-section charts-section';
    chartsSection.innerHTML = `
      <h2>Activity Charts</h2>
      <div id="charts-container" class="charts-container">
        <div class="chart-wrapper">
          <canvas id="activity-chart"></canvas>
        </div>
        <div class="chart-wrapper">
          <canvas id="domain-chart"></canvas>
        </div>
      </div>
    `;
    content.appendChild(chartsSection);
    
    // Create events section
    const eventsSection = document.createElement('div');
    eventsSection.className = 'dashboard-section events-section';
    eventsSection.innerHTML = `
      <h2>Recent Events</h2>
      <div id="events-container" class="events-container">
        <div class="loading">Loading events...</div>
      </div>
    `;
    content.appendChild(eventsSection);
    
    this.container.appendChild(content);
    
    // Add event listeners
    document.getElementById('refresh-dashboard').addEventListener('click', () => {
      this.refreshData();
    });
    
    document.getElementById('settings-dashboard').addEventListener('click', () => {
      this.showSettings();
    });
  }

  /**
   * Refresh dashboard data
   * @returns {Promise<boolean>} Whether refresh was successful
   */
  async refreshData() {
    try {
      // Get events from storage
      const now = Date.now();
      const dayAgo = now - (24 * 60 * 60 * 1000);
      
      this.events = await getEvents({
        startTime: dayAgo,
        endTime: now,
        limit: 1000
      });
      
      // Generate insights
      this.insights = generateInsights(this.events);
      
      // Update UI
      this.updateInsights();
      this.updateStats();
      this.updateCharts();
      this.updateEvents();
      
      return true;
    } catch (error) {
      console.error('Failed to refresh dashboard data:', error);
      return false;
    }
  }

  /**
   * Update insights section
   */
  updateInsights() {
    const container = document.getElementById('insights-container');
    
    if (!container) {
      return;
    }
    
    if (!this.insights || !this.insights.insights || this.insights.insights.length === 0) {
      container.innerHTML = '<div class="empty-state">No insights available yet. Keep browsing to generate insights.</div>';
      return;
    }
    
    // Sort insights by importance
    const sortedInsights = [...this.insights.insights].sort((a, b) => {
      const importanceOrder = { high: 0, medium: 1, low: 2 };
      return importanceOrder[a.importance] - importanceOrder[b.importance];
    });
    
    // Limit to max insights to display
    const displayInsights = sortedInsights.slice(0, this.config.maxInsightsToDisplay);
    
    // Create insights HTML
    let insightsHtml = '<div class="insights-list">';
    
    for (const insight of displayInsights) {
      insightsHtml += `
        <div class="insight-item importance-${insight.importance}">
          <div class="insight-icon">${this.getInsightIcon(insight.type)}</div>
          <div class="insight-content">
            <div class="insight-message">${insight.message}</div>
            <div class="insight-type">${this.formatInsightType(insight.type)}</div>
          </div>
        </div>
      `;
    }
    
    insightsHtml += '</div>';
    
    // Add recommendations
    if (this.insights.recommendations && this.insights.recommendations.length > 0) {
      insightsHtml += '<h3>Recommendations</h3><div class="recommendations-list">';
      
      for (const recommendation of this.insights.recommendations) {
        insightsHtml += `
          <div class="recommendation-item">
            <div class="recommendation-icon">💡</div>
            <div class="recommendation-message">${recommendation.message}</div>
          </div>
        `;
      }
      
      insightsHtml += '</div>';
    }
    
    container.innerHTML = insightsHtml;
  }

  /**
   * Update stats section
   */
  updateStats() {
    const container = document.getElementById('stats-container');
    
    if (!container) {
      return;
    }
    
    if (!this.insights || !this.insights.stats) {
      container.innerHTML = '<div class="empty-state">No stats available yet. Keep browsing to generate stats.</div>';
      return;
    }
    
    const { stats } = this.insights;
    
    // Create stats HTML
    let statsHtml = '<div class="stats-grid">';
    
    // Time stats
    statsHtml += `
      <div class="stat-card">
        <div class="stat-title">Time Spent</div>
        <div class="stat-value">${stats.timeSpent}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Active Time</div>
        <div class="stat-value">${stats.activeTime}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Idle Time</div>
        <div class="stat-value">${stats.idleTime}</div>
      </div>
    `;
    
    // Interaction stats
    statsHtml += `
      <div class="stat-card">
        <div class="stat-title">Scrolls</div>
        <div class="stat-value">${stats.scrollCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Clicks</div>
        <div class="stat-value">${stats.clickCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Key Presses</div>
        <div class="stat-value">${stats.keyPressCount}</div>
      </div>
    `;
    
    // Engagement stats
    statsHtml += `
      <div class="stat-card">
        <div class="stat-title">Engagement</div>
        <div class="stat-value">${Math.round(stats.engagementScore * 100)}%</div>
        <div class="stat-meter">
          <div class="stat-meter-fill" style="width: ${stats.engagementScore * 100}%"></div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Focus</div>
        <div class="stat-value">${Math.round(stats.focusRatio * 100)}%</div>
        <div class="stat-meter">
          <div class="stat-meter-fill" style="width: ${stats.focusRatio * 100}%"></div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Content Type</div>
        <div class="stat-value">${this.formatContentType(stats.contentType)}</div>
      </div>
    `;
    
    statsHtml += '</div>';
    
    container.innerHTML = statsHtml;
  }

  /**
   * Update charts section
   */
  updateCharts() {
    // This would use a charting library like Chart.js
    // For simplicity, we'll just show a placeholder
    const activityChart = document.getElementById('activity-chart');
    const domainChart = document.getElementById('domain-chart');
    
    if (!activityChart || !domainChart) {
      return;
    }
    
    // In a real implementation, we would create charts using a library
    activityChart.parentElement.innerHTML = `
      <div class="chart-placeholder">
        <div class="chart-title">Activity Over Time</div>
        <div class="chart-description">
          This chart would show your activity patterns throughout the day,
          including scrolls, clicks, and key presses.
        </div>
      </div>
    `;
    
    domainChart.parentElement.innerHTML = `
      <div class="chart-placeholder">
        <div class="chart-title">Time by Domain</div>
        <div class="chart-description">
          This chart would show how your browsing time is distributed
          across different websites and categories.
        </div>
      </div>
    `;
  }

  /**
   * Update events section
   */
  updateEvents() {
    const container = document.getElementById('events-container');
    
    if (!container) {
      return;
    }
    
    if (!this.events || this.events.length === 0) {
      container.innerHTML = '<div class="empty-state">No events recorded yet. Start browsing to record events.</div>';
      return;
    }
    
    // Sort events by timestamp (newest first)
    const sortedEvents = [...this.events].sort((a, b) => b.timestamp - a.timestamp);
    
    // Limit to max events to display
    const displayEvents = sortedEvents.slice(0, this.config.maxEventsToDisplay);
    
    // Create events HTML
    let eventsHtml = '<div class="events-list">';
    
    for (const event of displayEvents) {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const eventType = this.formatEventType(event.event_type);
      const eventIcon = this.getEventIcon(event.event_type);
      
      eventsHtml += `
        <div class="event-item">
          <div class="event-time">${time}</div>
          <div class="event-icon">${eventIcon}</div>
          <div class="event-type">${eventType}</div>
          <div class="event-url">${this.formatUrl(event.url)}</div>
        </div>
      `;
    }
    
    eventsHtml += '</div>';
    
    container.innerHTML = eventsHtml;
  }

  /**
   * Show settings dialog
   */
  showSettings() {
    // Create settings dialog
    const dialog = document.createElement('div');
    dialog.className = 'dashboard-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <div class="dialog-header">
          <h2>Dashboard Settings</h2>
          <button class="dialog-close">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="settings-group">
            <h3>Display Settings</h3>
            <div class="setting-item">
              <label for="refresh-interval">Refresh Interval (seconds)</label>
              <input type="number" id="refresh-interval" value="${this.config.refreshInterval / 1000}" min="10" max="300">
            </div>
            <div class="setting-item">
              <label for="max-events">Max Events to Display</label>
              <input type="number" id="max-events" value="${this.config.maxEventsToDisplay}" min="10" max="500">
            </div>
            <div class="setting-item">
              <label for="max-insights">Max Insights to Display</label>
              <input type="number" id="max-insights" value="${this.config.maxInsightsToDisplay}" min="1" max="20">
            </div>
          </div>
          <div class="settings-group">
            <h3>Data Management</h3>
            <div class="setting-item">
              <button id="export-data" class="dashboard-button">Export Data</button>
              <button id="clear-data" class="dashboard-button danger">Clear Data</button>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button id="save-settings" class="dashboard-button primary">Save Settings</button>
          <button id="cancel-settings" class="dashboard-button">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add event listeners
    dialog.querySelector('.dialog-close').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    
    dialog.querySelector('#cancel-settings').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    
    dialog.querySelector('#save-settings').addEventListener('click', () => {
      // Save settings
      this.config.refreshInterval = parseInt(document.getElementById('refresh-interval').value) * 1000;
      this.config.maxEventsToDisplay = parseInt(document.getElementById('max-events').value);
      this.config.maxInsightsToDisplay = parseInt(document.getElementById('max-insights').value);
      
      // Reset refresh timer
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
      }
      
      this.refreshTimer = setInterval(() => {
        this.refreshData();
      }, this.config.refreshInterval);
      
      // Update UI
      this.updateInsights();
      this.updateEvents();
      
      document.body.removeChild(dialog);
    });
    
    dialog.querySelector('#export-data').addEventListener('click', () => {
      this.exportData();
    });
    
    dialog.querySelector('#clear-data').addEventListener('click', () => {
      this.clearData();
    });
  }

  /**
   * Export dashboard data
   */
  exportData() {
    const data = {
      events: this.events,
      insights: this.insights,
      exportTime: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileName = `focus-nudge-data-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  }

  /**
   * Clear dashboard data
   */
  clearData() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      // In a real implementation, we would clear the data from storage
      alert('Data clearing would be implemented here. This would remove all stored events and insights.');
    }
  }

  /**
   * Get icon for event type
   * @param {string} eventType - Event type
   * @returns {string} Icon HTML
   */
  getEventIcon(eventType) {
    const icons = {
      'PAGE_VISIT': '🌐',
      'PAGE_EXIT': '🚪',
      'SCROLL': '📜',
      'MOUSE_MOVE': '🖱️',
      'MOUSE_CLICK': '👆',
      'KEY_PRESS': '⌨️',
      'TAB_SWITCH': '📑',
      'NAVIGATION': '🧭',
      'VIDEO_PLAY': '▶️',
      'VIDEO_PAUSE': '⏸️',
      'VIDEO_PROGRESS': '🎞️',
      'AUDIO_PLAY': '🔊',
      'AUDIO_PAUSE': '🔇',
      'CONTENT_LOAD': '📄',
      'VISIBILITY_CHANGE': '👁️',
      'SYSTEM_IDLE': '💤',
      'MODEL_PREDICTION': '🧠'
    };
    
    return icons[eventType] || '📌';
  }

  /**
   * Get icon for insight type
   * @param {string} insightType - Insight type
   * @returns {string} Icon HTML
   */
  getInsightIcon(insightType) {
    const icons = {
      'time_spent': '⏱️',
      'low_engagement': '😴',
      'low_focus': '🔍',
      'work_hours_distraction': '💼',
      'evening_work': '🌙',
      'late_night_usage': '🌜',
      'entertainment_time': '🎭',
      'shopping_time': '🛒',
      'frequent_visits': '🔄',
      'video_time': '📺',
      'deep_reading': '📚',
      'fast_reading': '🏃',
      'passive_scrolling': '👀',
      'frequent_switching': '🔀',
      'frequent_idle': '⏸️'
    };
    
    return icons[insightType] || '💡';
  }

  /**
   * Format event type
   * @param {string} eventType - Event type
   * @returns {string} Formatted event type
   */
  formatEventType(eventType) {
    if (!eventType) {
      return 'Unknown';
    }
    
    // Convert from snake_case to Title Case
    return eventType
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Format insight type
   * @param {string} insightType - Insight type
   * @returns {string} Formatted insight type
   */
  formatInsightType(insightType) {
    if (!insightType) {
      return 'General Insight';
    }
    
    // Convert from snake_case to Title Case
    return insightType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Format content type
   * @param {string} contentType - Content type
   * @returns {string} Formatted content type
   */
  formatContentType(contentType) {
    if (!contentType || contentType === 'unknown') {
      return 'Unknown';
    }
    
    // Capitalize first letter
    return contentType.charAt(0).toUpperCase() + contentType.slice(1);
  }

  /**
   * Format URL
   * @param {string} url - URL
   * @returns {string} Formatted URL
   */
  formatUrl(url) {
    if (!url) {
      return '';
    }
    
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return url;
    }
  }

  /**
   * Clean up dashboard
   */
  cleanup() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.events = [];
    this.insights = null;
    this.isInitialized = false;
  }
} 