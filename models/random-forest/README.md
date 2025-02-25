# Random Forest Model for Distraction Detection

This directory contains the implementation of a Random Forest model for detecting distractions during web browsing.

## Model Overview

The model classifies user browsing sessions as "Focused" or "Distracted" based on behavioral data such as:

- Time spent on a page
- Scroll behavior (count and depth)
- Click activity
- Tab switching frequency
- Video watching time

## Implementation

The model is implemented in two ways:

1. **JavaScript Implementation**: A simplified version that runs directly in the browser
2. **ONNX Model**: A trained model exported to ONNX format for efficient inference

## Training the Model

### Prerequisites

- Python 3.7+
- Required Python packages (install with `pip install -r requirements.txt`)

### Training Steps

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Run the training script:
   ```
   python train_model.py
   ```

3. The script will:
   - Generate synthetic training data
   - Train a Random Forest model
   - Evaluate model performance
   - Export the model to ONNX format
   - Save feature importance and tree data

### Output Files

- `onnx/random_forest_model.onnx`: The trained model in ONNX format
- `model_data/feature_importance.json`: Feature importance values
- `model_data/trees_data.json`: Simplified tree data for JavaScript implementation

## Using the Model in JavaScript

The model can be used in two ways:

### 1. JavaScript Implementation

```javascript
import RandomForestModel from './model.js';

// Create and load the model
const model = new RandomForestModel();
await model.load();

// Make predictions
const features = {
  timeSpent: 600000,  // 10 minutes in milliseconds
  scrollCount: 45,
  scrollDepth: 0.7,
  clickCount: 12,
  tabSwitches: 5,
  videoWatchTime: 120  // 2 minutes
};

const domain = 'example.com';
const prediction = model.predict(features, domain);

console.log('Is distraction:', prediction.isDistraction);
console.log('Probability:', prediction.probability);
console.log('Confidence:', prediction.confidence);
```

### 2. ONNX Implementation

```javascript
import RandomForestModel from './model.js';

// Create and load the model with ONNX
const model = new RandomForestModel();
await model.load({ useOnnx: true });

// Make predictions (same as above)
const prediction = model.predict(features, domain);
```

## Production Considerations

For production use:

1. Train on real user behavior data instead of synthetic data
2. Implement proper data collection and labeling
3. Regularly retrain the model to adapt to changing user behaviors
4. Consider privacy implications when collecting behavioral data 