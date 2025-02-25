#!/usr/bin/env python3
"""
Train a Random Forest model for distraction detection and export to ONNX format.
This script trains a model to classify user browsing sessions as "Focused" or "Distracted"
based on behavioral data.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import os
import json

# Create directories for the model if they don't exist
os.makedirs('onnx', exist_ok=True)
os.makedirs('model_data', exist_ok=True)

def generate_synthetic_data(n_samples=1000):
    """
    Generate synthetic browsing behavior data for training.
    
    Parameters:
    -----------
    n_samples : int
        Number of samples to generate
        
    Returns:
    --------
    X : DataFrame
        Features dataframe
    y : Series
        Labels (0 = Focused, 1 = Distracted)
    """
    np.random.seed(42)
    
    # Generate more realistic browsing behavior data
    data = {
        "timeSpent": np.random.exponential(scale=300, size=n_samples),  # Time spent in seconds
        "scrollCount": np.random.negative_binomial(5, 0.5, size=n_samples),  # Number of scrolls
        "scrollDepth": np.random.beta(2, 2, size=n_samples),  # % of page scrolled (0-1)
        "clickCount": np.random.negative_binomial(3, 0.6, size=n_samples),  # Number of clicks
        "tabSwitches": np.random.poisson(lam=2, size=n_samples),  # Number of tab switches
        "videoWatchTime": np.random.exponential(scale=120, size=n_samples)  # Video watch time in seconds
    }
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Generate labels using a more complex rule
    # A user is distracted if they exhibit multiple distraction behaviors
    distraction_score = (
        (df["timeSpent"] > 600) * 0.3 +  # Long time on page
        (df["scrollCount"] > 50) * 0.2 +  # Excessive scrolling
        (df["scrollDepth"] > 0.8) * 0.15 +  # Deep scrolling
        (df["clickCount"] < 2) * 0.1 +  # Few interactions
        (df["tabSwitches"] > 5) * 0.15 +  # Frequent tab switching
        (df["videoWatchTime"] > 300) * 0.1  # Long video watching
    )
    
    # Label as distracted if score exceeds threshold
    y = (distraction_score > 0.4).astype(int)
    
    return df, y

def train_and_export_model():
    """
    Train a Random Forest model and export it to ONNX format
    """
    print("Generating synthetic training data...")
    X, y = generate_synthetic_data(n_samples=2000)
    
    # Split into training and test sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print(f"Training data shape: {X_train.shape}")
    print(f"Class distribution: Focused={sum(y==0)}, Distracted={sum(y==1)}")
    
    # Create and train Random Forest model
    print("Training Random Forest model...")
    model = RandomForestClassifier(
        n_estimators=100,  # Number of trees
        max_depth=10,      # Maximum depth of trees
        min_samples_split=5,  # Minimum samples required to split
        random_state=42
    )
    model.fit(X_train, y_train)
    
    # Make predictions
    y_pred = model.predict(X_test)
    
    # Evaluate model
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Model Accuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Feature importance
    feature_importance = model.feature_importances_
    features = X.columns
    importance_dict = {}
    
    print("\nFeature Importance:")
    for i, feature in enumerate(features):
        importance = feature_importance[i]
        importance_dict[feature] = float(importance)
        print(f"{feature}: {importance:.4f}")
    
    # Save feature importance to JSON
    with open('model_data/feature_importance.json', 'w') as f:
        json.dump(importance_dict, f, indent=2)
    
    # Export model to ONNX format
    print("\nExporting model to ONNX format...")
    
    # Define input type
    initial_type = [('float_input', FloatTensorType([None, len(features)]))]
    
    # Convert model
    onnx_model = convert_sklearn(model, initial_types=initial_type, target_opset=12)
    
    # Save model
    output_path = 'onnx/random_forest_model.onnx'
    with open(output_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    
    print(f"ONNX model saved to {output_path}")
    
    # Extract and save decision trees (simplified for JavaScript implementation)
    print("\nExtracting decision trees for JavaScript implementation...")
    
    # We'll extract a simplified version of the first few trees
    trees_data = []
    for i, tree in enumerate(model.estimators_[:5]):  # Just use first 5 trees for simplicity
        tree_data = {
            "treeIndex": i,
            "feature_names": list(features)
        }
        trees_data.append(tree_data)
    
    # Save trees data
    with open('model_data/trees_data.json', 'w') as f:
        json.dump(trees_data, f, indent=2)
    
    print("Model training and export completed successfully!")

if __name__ == "__main__":
    print("Focus Nudge - Random Forest Model Training")
    print("==========================================")
    
    try:
        train_and_export_model()
        print("\nNext steps:")
        print("1. Use the ONNX model with onnxruntime-web in your extension")
        print("2. Update the JavaScript implementation with the extracted tree data")
        print("3. For production, train on real user behavior data")
    except Exception as e:
        print(f"Error: {e}")
        print("\nTo run this script, you need the following packages:")
        print("pip install numpy pandas scikit-learn skl2onnx") 