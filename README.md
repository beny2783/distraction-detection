# Focus Nudge: AI-Powered Distraction Detection

Focus Nudge is a Chrome extension that intelligently detects when you're distracted online and provides gentle nudges to help you stay focused on your goals.

## Features

- **Intelligent Distraction Detection**: Monitors your browsing behavior to identify potential distractions
- **Machine Learning Model**: Uses a Random Forest model to predict distraction levels
- **Gentle Nudges**: Provides non-intrusive reminders when you might be getting off track
- **Customizable Sensitivity**: Adjust how sensitive the extension is to potential distractions
- **Focus Goals**: Set daily focus goals to keep yourself accountable
- **Privacy-First**: All data is stored locally on your device, nothing is sent to external servers
- **Detailed Insights**: View statistics about your browsing habits and focus patterns

## Installation

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store
2. Search for "Focus Nudge"
3. Click "Add to Chrome"

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension should now be installed and active

## How It Works

Focus Nudge uses a combination of machine learning and rule-based heuristics to detect when you might be distracted:

1. **Data Collection**: The extension tracks your browsing behavior, including:
   - Time spent on different websites
   - Scroll patterns
   - Tab switching frequency
   - Video watching behavior

2. **Machine Learning**: A Random Forest model analyzes these features to calculate a "distraction score" for each website you visit

3. **Nudging System**: When the distraction score exceeds a certain threshold, the extension shows a gentle nudge to help you refocus

4. **Feedback Loop**: Your feedback on nudges helps the system improve over time

## Machine Learning Model

The extension uses a Random Forest model implemented in JavaScript, with plans to upgrade to ONNX Runtime Web for more efficient inference. The model considers the following features:

- **Time Spent**: How long you've been on a website (30% importance)
- **Scroll Count**: How much you've been scrolling (20% importance)
- **Scroll Depth**: How far you've scrolled down the page (15% importance)
- **Click Count**: How many times you've clicked (10% importance)
- **Tab Switches**: How often you switch between tabs (15% importance)
- **Video Watch Time**: How long you've been watching videos (10% importance)

You can switch between the ML model and a simpler rule-based approach in the extension settings.

## Privacy

Focus Nudge is designed with privacy in mind:

- All data is stored locally on your device using Chrome's storage API
- No data is sent to external servers
- No personally identifiable information is collected
- You can clear all stored data at any time from the extension settings

## Development

### Project Structure

- `manifest.json`: Chrome extension configuration
- `background.js`: Background service worker for event processing and ML inference
- `content.js`: Content script injected into web pages to track user interactions
- `popup.html/js`: Extension popup UI for settings and quick stats
- `insights.html/js`: Detailed insights page
- `models/`: Directory for ML models
  - `random-forest/`: Random Forest model implementation
  - `model-manager.js`: Model loading and inference management
- `lib/`: Directory for libraries
  - `onnx-runtime.js`: ONNX Runtime Web integration

### Building from Source

1. Clone the repository
2. Make your changes
3. Load the extension in developer mode as described in the installation section

## Roadmap

- **v0.1.0**: Initial MVP with Random Forest model
- **v0.2.0**: ONNX Runtime Web integration for more efficient inference
- **v0.3.0**: Advanced ML models with TensorFlow.js
- **v0.4.0**: Improved nudging strategies with A/B testing
- **v0.5.0**: Reinforcement learning for adaptive nudging

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- This project was inspired by the need to maintain focus in an increasingly distracting digital environment
- Thanks to all the open-source libraries and tools that made this possible 