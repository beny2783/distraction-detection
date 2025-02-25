# Machine Learning Models

This directory contains the machine learning models used by Focus Nudge for distraction detection.

## Current Implementation

The current MVP includes a JavaScript implementation of a Random Forest model for distraction detection. The model is implemented in `random-forest/model.js` and managed by `model-manager.js`.

### Random Forest Model

The Random Forest model considers the following features:

- **Time Spent**: How long you've been on a website (30% importance)
- **Scroll Count**: How much you've been scrolling (20% importance)
- **Scroll Depth**: How far you've scrolled down the page (15% importance)
- **Click Count**: How many times you've clicked (10% importance)
- **Tab Switches**: How often you switch between tabs (15% importance)
- **Video Watch Time**: How long you've been watching videos (10% importance)

For the MVP, the model uses a simplified decision tree approach with predefined thresholds for each feature. Future versions will use a proper trained model.

### Model Manager

The `model-manager.js` file provides a unified interface for loading and using different types of models:

- **Rule-based**: Simple heuristic rules for distraction detection
- **Random Forest**: The current ML approach
- **Neural Network**: Planned for future versions

Users can switch between these models in the extension settings.

## Planned Improvements

### Phase 1: ONNX Runtime Web Integration (v0.2.0)

- Convert the JavaScript model to ONNX format
- Use ONNX Runtime Web for efficient inference
- Improve performance and reduce resource usage

### Phase 2: Deep Learning (v0.3.0)

- LSTM/GRU for sequential pattern detection
- Implemented in TensorFlow.js
- Better at detecting complex patterns of distraction

### Phase 3: Content Analysis (v0.4.0)

- TinyBERT (ONNX) for content-based classification
- Analyze page content to understand context
- More accurate distraction detection based on content

## Model Training

Future models will be trained on labeled browsing data, with sessions marked as "Focused" or "Distracted".

## Deployment

Models are optimized for browser execution with:
- Sub-100ms inference time
- Minimal memory footprint
- Efficient use of browser resources 