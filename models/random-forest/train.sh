#!/bin/bash

# Train the Random Forest model for distraction detection

echo "Focus Nudge - Random Forest Model Training"
echo "=========================================="

# Check if Python 3.11 is installed
if ! command -v python3.11 &> /dev/null; then
    echo "Error: Python 3.11 is required but not installed."
    echo "You can install it with: brew install python@3.11"
    exit 1
fi

# Create directories if they don't exist
mkdir -p onnx
mkdir -p model_data

# Install dependencies if needed
if [ "$1" == "--install-deps" ]; then
    echo "Installing Python dependencies..."
    python3.11 -m pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "Error installing dependencies. Please check requirements.txt"
        exit 1
    fi
fi

# Run the training script
echo "Running model training script..."
python3.11 train_model.py

# Check if training was successful
if [ $? -ne 0 ]; then
    echo "Error during model training."
    exit 1
fi

echo "Training completed successfully!"
echo ""
echo "Next steps:"
echo "1. Copy the ONNX model to your extension's assets directory"
echo "2. Update the model.js file to use the ONNX model"
echo "3. Test the model with real user data"

exit 0 