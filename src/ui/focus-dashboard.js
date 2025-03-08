/**
 * Focus Nudge - Real-time Focus Dashboard
 * Shows live focus stats during an active focus session
 */

class FocusDashboard {
  constructor(shadowRoot) {
    console.log('[Focus Dashboard] Constructor called');
    this.container = null;
    this.shadowRoot = shadowRoot; // Use the provided shadow root
    this.stats = {
      focusScore: 95,
      focusTime: 0,
      distractionCount: 0,
      streakCount: 0
    };
    this.startTime = null;
    this.updateInterval = null;
    this.initialized = false;
    this.isVisible = false;
  }

  /**
   * Initialize the dashboard
   */
  init() {
    try {
      console.log('[Focus Dashboard] Initializing...');
      
      // Create and append elements
      this.createDashboardElements();
      
      // Start tracking time and updating stats
      this.startTime = Date.now();
      this.updateInterval = setInterval(() => this.updateStats(), 1000);
      
      // Show the dashboard
      this.show();
      
      this.initialized = true;
      console.log('[Focus Dashboard] Initialization complete');
    } catch (error) {
      console.error('[Focus Dashboard] Error during initialization:', error);
    }
  }

  /**
   * Create dashboard UI elements
   */
  createDashboardElements() {
    try {
      console.log('[Focus Dashboard] Creating dashboard elements');
      
      // Create main container with forced styles
      this.container = document.createElement('div');
      this.container.className = 'focus-dashboard';
      this.container.setAttribute('data-extension-element', 'true');
      
      // Create style element
      const style = document.createElement('style');
      style.textContent = `
        .focus-dashboard {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 300px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
          opacity: 0;
          transform: translateY(-20px);
          display: none;
        }
        
        .focus-dashboard.visible {
          opacity: 1;
          transform: translateY(0);
          display: block;
        }
      `;
      
      // Create dashboard content
      this.container.innerHTML = `
        <div class="focus-dashboard-header" style="background: linear-gradient(135deg, #6e8efb, #a777e3); color: white; padding: 15px; border-radius: 12px 12px 0 0;">
          <div class="focus-timer" style="display: flex; justify-content: space-between; align-items: center;">
            <span class="timer-label" style="font-size: 12px; opacity: 0.9;">Focus Time Remaining</span>
            <span class="timer-value" id="focus-time-remaining" style="font-size: 20px; font-weight: 500;">30:00</span>
          </div>
          <button class="minimize-button" style="background: none; border: none; color: white; cursor: pointer; padding: 5px 10px; border-radius: 4px; position: absolute; top: 10px; right: 10px;">_</button>
        </div>
        <div class="focus-dashboard-content" style="padding: 15px;">
          <div class="focus-stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <div class="focus-stat-card" style="background: #f8f9fa; padding: 12px; border-radius: 8px; text-align: center;">
              <div class="stat-value" id="focus-score" style="font-size: 24px; font-weight: 500; color: #6e8efb;">95</div>
              <div class="stat-label" style="font-size: 12px; color: #666;">Focus Score</div>
              <div class="focus-meter" style="height: 4px; background-color: #e0e0e0; border-radius: 2px; overflow: hidden; margin-top: 8px;">
                <div class="focus-meter-fill" style="height: 100%; background: linear-gradient(90deg, #6e8efb, #a777e3); width: 95%;"></div>
              </div>
            </div>
            <div class="focus-stat-card" style="background: #f8f9fa; padding: 12px; border-radius: 8px; text-align: center;">
              <div class="stat-value" id="distraction-count" style="font-size: 24px; font-weight: 500; color: #6e8efb;">0</div>
              <div class="stat-label" style="font-size: 12px; color: #666;">Distractions</div>
            </div>
            <div class="focus-stat-card" style="background: #f8f9fa; padding: 12px; border-radius: 8px; text-align: center;">
              <div class="stat-value" id="active-time" style="font-size: 24px; font-weight: 500; color: #6e8efb;">0m</div>
              <div class="stat-label" style="font-size: 12px; color: #666;">Active Time</div>
            </div>
            <div class="focus-stat-card" style="background: #f8f9fa; padding: 12px; border-radius: 8px; text-align: center;">
              <div class="stat-value" id="engagement-score" style="font-size: 24px; font-weight: 500; color: #6e8efb;">100%</div>
              <div class="stat-label" style="font-size: 12px; color: #666;">Engagement</div>
            </div>
          </div>
        </div>
      `;

      // Add style and container to shadow root
      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(this.container);
      console.log('[Focus Dashboard] Elements created successfully');
      
      // Add event listeners with timeout
      setTimeout(() => this.addEventListeners(), 100);
    } catch (error) {
      console.error('[Focus Dashboard] Error creating dashboard elements:', error);
    }
  }

  /**
   * Add event listeners
   */
  addEventListeners() {
    try {
      console.log('[Focus Dashboard] Adding event listeners');
      
      // Get minimize button from shadow root
      const minimizeButton = this.shadowRoot.querySelector('.minimize-button');
      if (minimizeButton) {
        minimizeButton.addEventListener('click', () => this.hide());
        console.log('[Focus Dashboard] Minimize button listener added');
      } else {
        console.error('[Focus Dashboard] Minimize button not found');
      }
      
      // Add document click handler for hiding
      document.addEventListener('click', (e) => {
        if (this.isVisible && this.container && !this.container.contains(e.target)) {
          this.hide();
        }
      });
      
      console.log('[Focus Dashboard] Event listeners added successfully');
    } catch (error) {
      console.error('[Focus Dashboard] Error adding event listeners:', error);
    }
  }

  /**
   * Show the dashboard
   */
  show() {
    try {
      if (!this.container) return;
      
      console.log('[Focus Dashboard] Showing dashboard');
      this.container.classList.add('visible');
      this.isVisible = true;
      console.log('[Focus Dashboard] Dashboard shown');
    } catch (error) {
      console.error('[Focus Dashboard] Error showing dashboard:', error);
    }
  }

  /**
   * Hide the dashboard
   */
  hide() {
    try {
      if (!this.container) return;
      
      console.log('[Focus Dashboard] Hiding dashboard');
      this.container.classList.remove('visible');
      this.isVisible = false;
      console.log('[Focus Dashboard] Dashboard hidden');
    } catch (error) {
      console.error('[Focus Dashboard] Error hiding dashboard:', error);
    }
  }

  /**
   * Update dashboard stats
   */
  async updateStats() {
    try {
      // Get current stats from storage
      const result = await chrome.storage.local.get(['focusStats', 'userPreferences']);
      const stats = result.focusStats || this.stats;
      const prefs = result.userPreferences || {};

      // Get elements from shadow root
      const focusScoreEl = this.shadowRoot.querySelector('#focus-score');
      const distractionCountEl = this.shadowRoot.querySelector('#distraction-count');
      const activeTimeEl = this.shadowRoot.querySelector('#active-time');
      const engagementScoreEl = this.shadowRoot.querySelector('#engagement-score');
      const timeRemainingEl = this.shadowRoot.querySelector('#focus-time-remaining');
      const meterFill = this.shadowRoot.querySelector('.focus-meter-fill');

      // Update elements if they exist
      if (focusScoreEl) focusScoreEl.textContent = stats.focusScore;
      if (distractionCountEl) distractionCountEl.textContent = stats.distractionCount;
      
      // Calculate and update active time
      const activeTime = Math.floor((Date.now() - this.startTime) / 60000);
      if (activeTimeEl) activeTimeEl.textContent = `${activeTime}m`;
      
      // Calculate and update engagement
      const engagement = Math.max(0, 100 - (stats.distractionCount * 5));
      if (engagementScoreEl) engagementScoreEl.textContent = `${engagement}%`;

      // Update focus meter
      if (meterFill) meterFill.style.width = `${stats.focusScore}%`;

      // Update time remaining
      if (timeRemainingEl && prefs.focusModeEndTime) {
        const remaining = Math.max(0, prefs.focusModeEndTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        timeRemainingEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    } catch (error) {
      console.error('[Focus Dashboard] Error updating stats:', error);
    }
  }

  /**
   * Clean up the dashboard
   */
  destroy() {
    try {
      console.log('[Focus Dashboard] Destroying dashboard');
      
      // Clear update interval
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }
      
      // Remove from DOM if exists
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      
      // Clear references
      this.container = null;
      this.shadowRoot = null;
      this.initialized = false;
      this.isVisible = false;
      
      console.log('[Focus Dashboard] Dashboard destroyed successfully');
    } catch (error) {
      console.error('[Focus Dashboard] Error destroying dashboard:', error);
    }
  }
}

export default FocusDashboard; 