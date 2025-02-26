/**
 * Random Forest Model for Distraction Detection
 * 
 * This module implements a Random Forest model for distraction detection.
 * It uses a simplified JavaScript implementation for service worker compatibility.
 */

// ONNX Runtime is not supported in service workers, so we'll use only the JS implementation
const ort = null;

// Feature names and their importance (based on actual model training)
const FEATURES = [
  { name: 'timeSpent', importance: 0.3644 },
  { name: 'scrollDepth', importance: 0.3392 },
  { name: 'videoWatchTime', importance: 0.1497 },
  { name: 'tabSwitches', importance: 0.0577 },
  { name: 'clickCount', importance: 0.0570 },
  { name: 'scrollCount', importance: 0.0320 }
];

// Decision thresholds for each feature (simplified decision trees)
const DECISION_THRESHOLDS = {
  timeSpent: [
    { threshold: 5 * 60 * 1000, score: 0.3 },    // 5 minutes
    { threshold: 10 * 60 * 1000, score: 0.6 },   // 10 minutes
    { threshold: 20 * 60 * 1000, score: 0.9 }    // 20 minutes
  ],
  scrollCount: [
    { threshold: 20, score: 0.2 },
    { threshold: 50, score: 0.5 },
    { threshold: 100, score: 0.8 }
  ],
  scrollDepth: [
    { threshold: 0.3, score: 0.2 },
    { threshold: 0.7, score: 0.4 },
    { threshold: 1.0, score: 0.6 }
  ],
  clickCount: [
    { threshold: 5, score: 0.1 },
    { threshold: 15, score: 0.3 },
    { threshold: 30, score: 0.5 }
  ],
  tabSwitches: [
    { threshold: 3, score: 0.3 },
    { threshold: 7, score: 0.6 },
    { threshold: 15, score: 0.9 }
  ],
  videoWatchTime: [
    { threshold: 2 * 60, score: 0.3 },    // 2 minutes
    { threshold: 5 * 60, score: 0.6 },    // 5 minutes
    { threshold: 10 * 60, score: 0.9 }    // 10 minutes
  ]
};

// Domain-specific adjustments
const DOMAIN_ADJUSTMENTS = {
  'youtube.com': 0.2,
  'facebook.com': 0.2,
  'twitter.com': 0.2,
  'instagram.com': 0.2,
  'reddit.com': 0.2,
  'tiktok.com': 0.3,
  'netflix.com': 0.2,
  'hulu.com': 0.2,
  'amazon.com': 0.1,
  'ebay.com': 0.1
};

/**
 * Random Forest Model class
 */
export default class RandomForestModel {
  constructor() {
    this.version = '0.2.0';
    this.isLoaded = false;
    this.trees = [];
    this.featureImportance = FEATURES.reduce((acc, feature) => {
      acc[feature.name] = feature.importance;
      return acc;
    }, {});
    
    // ONNX is disabled in service workers
    this.useOnnx = false;
    this.onnxSession = null;
    this.onnxModel = null;
  }

  /**
   * Load the model
   * @returns {Promise<boolean>}
   */
  async load() {
    try {
      console.log('Loading Random Forest model (JavaScript implementation)');
      
      // Always use JavaScript implementation in service workers
      this.useOnnx = false;
      this.trees = this._createDecisionTrees();
      
      this.isLoaded = true;
      return true;
    } catch (error) {
      console.error('Failed to load Random Forest model:', error);
      return false;
    }
  }

  /**
   * Predict whether the current behavior is a distraction
   * @param {Object} features - Feature values
   * @param {string} domain - Current domain
   * @returns {Object} Prediction result
   */
  predict(features, domain) {
    if (!this.isLoaded) {
      console.error('Model not loaded');
      return { isDistraction: false, probability: 0, confidence: 0 };
    }
    
    let probability, confidence;
    
    if (this.useOnnx && this.onnxSession) {
      // Use ONNX model for prediction
      const result = this._predictOnnx(features);
      probability = result.probability;
      confidence = result.confidence;
    } else {
      // Use JavaScript implementation
      // Get predictions from each tree
      const predictions = this.trees.map(tree => this._predictTree(tree, features));
      
      // Average the predictions
      probability = predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length;
      
      // Calculate confidence based on variance of predictions
      const variance = predictions.reduce((sum, pred) => sum + Math.pow(pred - probability, 2), 0) / predictions.length;
      confidence = 1 - Math.sqrt(variance);
    }
    
    // Apply domain-specific adjustments
    if (domain) {
      for (const [domainPattern, adjustment] of Object.entries(DOMAIN_ADJUSTMENTS)) {
        if (domain.includes(domainPattern)) {
          probability += adjustment;
          break;
        }
      }
      // Ensure probability is between 0 and 1
      probability = Math.max(0, Math.min(1, probability));
    }
    
    return {
      isDistraction: probability > 0.5,
      probability,
      confidence
    };
  }

  /**
   * Get feature importance
   * @returns {Object} Feature importance
   */
  getFeatureImportance() {
    return this.featureImportance;
  }

  /**
   * Create decision trees
   * @returns {Array} Decision trees
   * @private
   */
  _createDecisionTrees() {
    // In a real implementation, these would be loaded from a trained model
    // For now, we'll create some simple decision trees based on the thresholds
    return [
      // Tree 1: Focus on time spent and scroll behavior
      {
        features: ['timeSpent', 'scrollCount', 'scrollDepth'],
        weights: [0.5, 0.3, 0.2]
      },
      // Tree 2: Focus on interaction patterns
      {
        features: ['clickCount', 'tabSwitches', 'timeSpent'],
        weights: [0.4, 0.4, 0.2]
      },
      // Tree 3: Focus on video watching
      {
        features: ['videoWatchTime', 'timeSpent', 'tabSwitches'],
        weights: [0.6, 0.2, 0.2]
      }
    ];
  }

  /**
   * Predict using a single decision tree
   * @param {Object} tree - Decision tree
   * @param {Object} features - Feature values
   * @returns {number} Prediction
   * @private
   */
  _predictTree(tree, features) {
    let score = 0;
    
    // Calculate score based on feature values and weights
    tree.features.forEach((featureName, index) => {
      const weight = tree.weights[index];
      const value = features[featureName] || 0;
      
      // Find the appropriate threshold
      const thresholds = DECISION_THRESHOLDS[featureName] || [];
      let featureScore = 0;
      
      for (const { threshold, score } of thresholds) {
        if (value >= threshold) {
          featureScore = score;
        } else {
          break;
        }
      }
      
      score += featureScore * weight;
    });
    
    return Math.min(score, 1.0);
  }

  /**
   * Load ONNX model - disabled in service workers
   * @private
   */
  async _loadOnnxModel() {
    console.warn('ONNX models are not supported in service workers');
    throw new Error('ONNX not supported in service workers');
  }

  /**
   * Predict using ONNX model - disabled in service workers
   * @private
   */
  _predictOnnx(features) {
    console.warn('ONNX prediction is not supported in service workers');
    return { probability: 0.5, confidence: 0.5 };
  }
} 