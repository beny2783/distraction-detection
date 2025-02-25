/**
 * Random Forest Model
 * 
 * A simple implementation of a Random Forest model for distraction detection.
 */

class RandomForestModel {
  constructor() {
    this.type = 'random-forest';
    this.version = '0.1.0';
    this.initialized = false;
    
    // Simple decision tree thresholds
    this.trees = [
      // Tree 1: Focus on time spent
      {
        predict: (features, domain) => {
          if (features.timeSpent > 15 * 60 * 1000) return 0.9; // > 15 minutes
          if (features.timeSpent > 10 * 60 * 1000) return 0.8; // > 10 minutes
          if (features.timeSpent > 5 * 60 * 1000) return 0.6;  // > 5 minutes
          return 0.3;
        }
      },
      // Tree 2: Focus on scroll behavior
      {
        predict: (features, domain) => {
          if (features.scrollCount > 100) return 0.9;  // Heavy scrolling
          if (features.scrollCount > 50) return 0.7;   // Moderate scrolling
          if (features.scrollCount > 20) return 0.5;   // Light scrolling
          return 0.2;
        }
      },
      // Tree 3: Focus on click count vs scroll count ratio
      {
        predict: (features, domain) => {
          const ratio = features.scrollCount / (features.clickCount || 1);
          if (ratio > 20) return 0.9;  // Lots of scrolling, few clicks
          if (ratio > 10) return 0.7;  // More scrolling than clicking
          if (ratio > 5) return 0.5;   // Some scrolling with clicks
          return 0.3;
        }
      },
      // Tree 4: Focus on known distraction domains
      {
        predict: (features, domain) => {
          const distractionDomains = [
            'youtube.com',
            'facebook.com',
            'twitter.com',
            'instagram.com',
            'reddit.com',
            'tiktok.com'
          ];
          
          for (const d of distractionDomains) {
            if (domain.includes(d)) return 0.8;
          }
          return 0.2;
        }
      },
      // Tree 5: Focus on video watch time
      {
        predict: (features, domain) => {
          if (features.videoWatchTime > 10 * 60) return 0.9;  // > 10 minutes
          if (features.videoWatchTime > 5 * 60) return 0.7;   // > 5 minutes
          if (features.videoWatchTime > 2 * 60) return 0.5;   // > 2 minutes
          return 0.2;
        }
      }
    ];
  }
  
  /**
   * Initialize the model
   * @returns {Promise<void>}
   */
  async initialize() {
    // In a real implementation, this would load model weights
    console.log('Initializing Random Forest model');
    this.initialized = true;
    return Promise.resolve();
  }
  
  /**
   * Make a prediction
   * @param {Object} features - Feature vector
   * @param {string} domain - Domain to classify
   * @returns {Object} - Prediction result
   */
  predict(features, domain) {
    if (!this.initialized) {
      console.warn('Model not initialized, using default prediction');
      return { probability: 0.5, confidence: 0.1 };
    }
    
    // Aggregate predictions from all trees
    let sum = 0;
    const predictions = this.trees.map(tree => tree.predict(features, domain));
    
    // Average the predictions
    const probability = predictions.reduce((acc, val) => acc + val, 0) / this.trees.length;
    
    // Calculate confidence based on variance of predictions
    const variance = predictions.reduce((acc, val) => acc + Math.pow(val - probability, 2), 0) / this.trees.length;
    const confidence = 1 - Math.sqrt(variance);
    
    return {
      probability,
      confidence
    };
  }
}

// Make sure RandomForestModel is available in the global scope
if (typeof self !== 'undefined') {
  self.RandomForestModel = RandomForestModel;
} else if (typeof window !== 'undefined') {
  window.RandomForestModel = RandomForestModel;
} else if (typeof global !== 'undefined') {
  global.RandomForestModel = RandomForestModel;
}

// For ES modules compatibility
try {
  module.exports = { RandomForestModel };
} catch (e) {
  // Not in a module environment, ignore
} 