/**
 * Focus Nudge - Model Manager
 * 
 * This module manages the machine learning models used for distraction detection.
 * It supports loading different model types and provides a unified interface for
 * making predictions based on event streams.
 */

import RandomForestModel from './random-forest/model.js';

// Model types
export const MODEL_TYPES = {
  RANDOM_FOREST: 'random-forest',
  SEQUENCE_MODEL: 'sequence-model',
  RULE_BASED: 'rule-based'
};

/**
 * Model Manager class
 */
export default class ModelManager {
  constructor() {
    this.models = {};
    this.activeModelType = MODEL_TYPES.RANDOM_FOREST;
    this.isInitialized = false;
    this.version = '0.2.0';
  }

  /**
   * Initialize the model manager
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      // Load Random Forest model
      this.models[MODEL_TYPES.RANDOM_FOREST] = new RandomForestModel();
      await this.models[MODEL_TYPES.RANDOM_FOREST].load();
      
      // Initialize rule-based model
      this.models[MODEL_TYPES.RULE_BASED] = {
        predict: this.ruleBasedPredict.bind(this),
        version: '0.1.0',
        isLoaded: true
      };
      
      this.isInitialized = true;
      console.log(`Model Manager initialized with ${Object.keys(this.models).length} models`);
      return true;
    } catch (error) {
      console.error('Failed to initialize Model Manager:', error);
      return false;
    }
  }

  /**
   * Update models
   * @returns {Promise<boolean>} Whether update was successful
   */
  async updateModels() {
    try {
      // Reload Random Forest model
      if (this.models[MODEL_TYPES.RANDOM_FOREST]) {
        await this.models[MODEL_TYPES.RANDOM_FOREST].load();
      }
      
      console.log('Models updated successfully');
      return true;
    } catch (error) {
      console.error('Failed to update models:', error);
      return false;
    }
  }

  /**
   * Set active model type
   * @param {string} modelType - Model type from MODEL_TYPES
   * @returns {boolean} Whether model type was set successfully
   */
  setActiveModelType(modelType) {
    if (!this.models[modelType]) {
      console.error(`Model type ${modelType} not available`);
      return false;
    }
    
    this.activeModelType = modelType;
    console.log(`Active model set to ${modelType}`);
    return true;
  }

  /**
   * Get active model type
   * @returns {string} Active model type
   */
  getActiveModelType() {
    return this.activeModelType;
  }

  /**
   * Get active model version
   * @returns {string} Active model version
   */
  getActiveModelVersion() {
    const model = this.models[this.activeModelType];
    return model ? model.version : 'unknown';
  }

  /**
   * Predict whether the current behavior is a distraction
   * @param {Object} input - Input data
   * @param {Array} input.events - Event stream
   * @param {Object} input.features - Extracted features
   * @param {Object} input.sessionData - Session data for the domain
   * @param {Object} input.userPreferences - User preferences
   * @returns {Object} Prediction result
   */
  async predict(input) {
    if (!this.isInitialized) {
      console.error('Model Manager not initialized');
      return { isDistraction: false, probability: 0, confidence: 0 };
    }
    
    try {
      const model = this.models[this.activeModelType];
      
      if (!model) {
        console.error(`Model ${this.activeModelType} not available`);
        return { isDistraction: false, probability: 0, confidence: 0 };
      }
      
      if (!model.isLoaded) {
        console.error(`Model ${this.activeModelType} not loaded`);
        return { isDistraction: false, probability: 0, confidence: 0 };
      }
      
      // Different models may require different input formats
      let prediction;
      
      switch (this.activeModelType) {
        case MODEL_TYPES.RANDOM_FOREST:
          // Random Forest model expects features and domain
          prediction = model.predict(input.features, input.features.domain);
          break;
          
        case MODEL_TYPES.SEQUENCE_MODEL:
          // Sequence model would expect the raw event stream
          prediction = model.predict(input.events, input.features.domain);
          break;
          
        case MODEL_TYPES.RULE_BASED:
          // Rule-based model uses our custom function
          prediction = this.ruleBasedPredict(input);
          break;
          
        default:
          console.error(`Unknown model type: ${this.activeModelType}`);
          return { isDistraction: false, probability: 0, confidence: 0 };
      }
      
      // Ensure prediction has the expected format
      if (typeof prediction === 'number') {
        prediction = {
          isDistraction: prediction > 0.5,
          probability: prediction,
          confidence: 0.7 // Default confidence for simple models
        };
      }
      
      // Apply user preference adjustments
      prediction = this.applyUserPreferences(prediction, input.userPreferences);
      
      return prediction;
    } catch (error) {
      console.error('Prediction error:', error);
      return { isDistraction: false, probability: 0, confidence: 0 };
    }
  }

  /**
   * Apply user preferences to prediction
   * @param {Object} prediction - Prediction result
   * @param {Object} userPreferences - User preferences
   * @returns {Object} Adjusted prediction
   */
  applyUserPreferences(prediction, userPreferences) {
    // Clone prediction to avoid modifying the original
    const adjustedPrediction = { ...prediction };
    
    // Adjust based on nudge frequency preference
    switch (userPreferences.nudgeFrequency) {
      case 'low':
        adjustedPrediction.probability *= 0.7;
        break;
      case 'high':
        adjustedPrediction.probability *= 1.3;
        break;
      // 'medium' is default, no adjustment needed
    }
    
    // Cap probability at 1.0
    adjustedPrediction.probability = Math.min(adjustedPrediction.probability, 1.0);
    
    // Update isDistraction based on adjusted probability
    adjustedPrediction.isDistraction = adjustedPrediction.probability > userPreferences.distractionThreshold;
    
    return adjustedPrediction;
  }

  /**
   * Rule-based prediction function
   * @param {Object} input - Input data
   * @returns {Object} Prediction result
   */
  ruleBasedPredict(input) {
    const { features, sessionData } = input;
    const domain = features.domain;
    
    let distractionScore = 0;
    let confidence = 0.6; // Base confidence for rule-based model
    
    // Rule 1: Known distraction domains
    const knownDistractionDomains = [
      'youtube.com',
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'reddit.com',
      'tiktok.com',
      'netflix.com',
      'hulu.com',
      'twitch.tv'
    ];
    
    if (knownDistractionDomains.some(d => domain.includes(d))) {
      distractionScore += 0.4;
    }
    
    // Rule 2: Time spent on domain
    if (features.timeSpent > 15 * 60 * 1000) { // More than 15 minutes
      distractionScore += 0.4;
    } else if (features.timeSpent > 10 * 60 * 1000) { // More than 10 minutes
      distractionScore += 0.3;
    } else if (features.timeSpent > 5 * 60 * 1000) { // More than 5 minutes
      distractionScore += 0.2;
    }
    
    // Rule 3: Scroll behavior (high scroll count with low click count suggests mindless scrolling)
    if (features.scrollCount > 50 && features.clickCount < 5) {
      distractionScore += 0.3;
    }
    
    // Rule 4: Video watching
    if (features.hasVideo && features.videoWatchTime > 5 * 60) { // More than 5 minutes
      distractionScore += 0.3;
    }
    
    // Rule 5: Content type
    if (features.contentType === 'video' || features.contentType === 'social') {
      distractionScore += 0.2;
    }
    
    // Rule 6: Session history
    if (sessionData.visits > 5) { // Visited many times
      distractionScore += 0.1;
    }
    
    // Rule 7: Idle time
    if (features.idleTime > 2 * 60 * 1000) { // More than 2 minutes idle
      distractionScore -= 0.2; // Less likely to be a distraction if user is idle
    }
    
    // Cap at 1.0
    distractionScore = Math.min(distractionScore, 1.0);
    
    return {
      isDistraction: distractionScore > 0.5,
      probability: distractionScore,
      confidence: confidence
    };
  }
} 