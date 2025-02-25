/**
 * Model Manager
 * 
 * This module manages the machine learning models used for distraction detection.
 */

// Model types
export const MODEL_TYPES = {
  RULE_BASED: 'rule-based',
  RANDOM_FOREST: 'random-forest',
  NEURAL_NETWORK: 'neural-network'
};

/**
 * Model Manager class
 */
export class ModelManager {
  constructor() {
    this.models = {};
    this.activeModel = null;
    this.activeModelType = MODEL_TYPES.RULE_BASED;
  }

  /**
   * Initialize the model manager
   * @returns {Promise<void>}
   */
  async initialize() {
    console.log('Initializing Model Manager');
    
    // Load user preferences to determine which model to use
    const result = await new Promise(resolve => {
      chrome.storage.local.get('userPreferences', resolve);
    });
    
    const userPreferences = result.userPreferences || {};
    const preferredModelType = userPreferences.modelType || MODEL_TYPES.RANDOM_FOREST;
    
    // Load the preferred model
    await this.loadModel(preferredModelType);
  }

  /**
   * Load a model
   * @param {string} modelType - Type of model to load
   * @returns {Promise<boolean>} - Whether the model was loaded successfully
   */
  async loadModel(modelType) {
    console.log(`Loading model: ${modelType}`);
    
    // If we already have this model loaded, just activate it
    if (this.models[modelType]) {
      this.activeModel = this.models[modelType];
      this.activeModelType = modelType;
      return true;
    }
    
    try {
      switch (modelType) {
        case MODEL_TYPES.RULE_BASED:
          // Rule-based model is built-in, no need to load anything
          this.models[modelType] = {
            predict: (features, domain) => {
              // Simple rule-based prediction
              const knownDistractions = [
                'youtube.com', 'facebook.com', 'twitter.com', 
                'instagram.com', 'reddit.com', 'tiktok.com'
              ];
              
              if (knownDistractions.some(d => domain.includes(d))) {
                return { 
                  probability: 0.9, 
                  confidence: 0.8 
                };
              }
              
              return { 
                probability: 0.2, 
                confidence: 0.6 
              };
            },
            getVersion: () => '0.1.0'
          };
          break;
          
        case MODEL_TYPES.RANDOM_FOREST:
          // Define the RandomForestModel class
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
                // Tree 3: Focus on known distraction domains
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
                }
              ];
            }
            
            async initialize() {
              console.log('Initializing Random Forest model');
              this.initialized = true;
              return Promise.resolve();
            }
            
            predict(features, domain) {
              if (!this.initialized) {
                console.warn('Model not initialized, using default prediction');
                return { probability: 0.5, confidence: 0.1 };
              }
              
              // Aggregate predictions from all trees
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
          
          // Create a new instance of the model
          this.models[modelType] = new RandomForestModel();
          await this.models[modelType].initialize();
          console.log('Random Forest model initialized successfully');
          break;
          
        case MODEL_TYPES.NEURAL_NETWORK:
          // Neural Network model not implemented yet
          console.warn('Neural Network model not implemented yet');
          return false;
          
        default:
          console.warn(`Unknown model type: ${modelType}`);
          return false;
      }
      
      this.activeModel = this.models[modelType];
      this.activeModelType = modelType;
      return true;
    } catch (error) {
      console.error(`Error loading model ${modelType}:`, error);
      return false;
    }
  }

  /**
   * Get the active model
   * @returns {Object|null} - The active model or null if no model is active
   */
  getActiveModel() {
    return this.activeModel;
  }

  /**
   * Get the active model type
   * @returns {string} - The active model type
   */
  getActiveModelType() {
    return this.activeModelType;
  }

  /**
   * Get the active model version
   * @returns {string} - The active model version
   */
  getActiveModelVersion() {
    if (!this.activeModel) return '0.0.0';
    
    if (typeof this.activeModel.version === 'string') {
      return this.activeModel.version;
    }
    
    if (typeof this.activeModel.getVersion === 'function') {
      return this.activeModel.getVersion();
    }
    
    return '0.0.0';
  }
  
  /**
   * Make a prediction using the active model
   * @param {Object} features - Feature vector
   * @param {string} domain - Domain to classify
   * @returns {Object|number} - Prediction result
   */
  predict(features, domain) {
    if (!this.activeModel) {
      console.warn('No active model, using default prediction');
      return { probability: 0.5, confidence: 0.1 };
    }
    
    if (typeof this.activeModel.predict !== 'function') {
      console.warn('Active model does not have a predict method');
      return 0.5;
    }
    
    return this.activeModel.predict(features, domain);
  }
} 