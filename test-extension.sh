#!/bin/bash

# Test Extension Script
# This script opens Chrome with the extension loaded for testing

echo "Starting Chrome with the Focus Companion extension loaded..."

# MacOS path to Chrome
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Check if Chrome exists
if [ ! -f "$CHROME" ]; then
  echo "Chrome not found at $CHROME"
  echo "Please modify the script with the correct path to Chrome"
  exit 1
fi

# Get the absolute path to the extension directory
EXTENSION_DIR="$(pwd)"

# Check if the necessary files exist
echo "Checking for necessary files..."
FILES_TO_CHECK=(
  "src/ui/focus-companion.js"
  "src/ui/focus-companion.css"
  "assets/companion/companion.svg"
  "assets/companion/companion-happy.svg"
  "assets/companion/companion-thinking.svg"
  "assets/companion/companion-alert.svg"
)

for file in "${FILES_TO_CHECK[@]}"; do
  if [ -f "$EXTENSION_DIR/$file" ]; then
    echo "✅ $file exists"
  else
    echo "❌ $file does not exist"
  fi
done

# Open Chrome with the extension loaded and developer tools open
echo "Opening Chrome with extension loaded and developer tools..."
"$CHROME" \
  --load-extension="$EXTENSION_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --auto-open-devtools-for-tabs \
  "https://www.google.com" &

echo "Chrome started with extension loaded."
echo "The Focus Companion should appear in the bottom-right corner of the browser window."
echo "Developer tools should open automatically to help with debugging."
echo ""
echo "Debugging tips:"
echo "1. Check the Console tab for any error messages"
echo "2. Look for the red/yellow debug borders around the Focus Companion elements"
echo "3. Use the Elements tab to inspect the DOM for .focus-companion and .focus-status-indicator"
echo "4. Check the Network tab to see if the SVG files are being loaded correctly"
echo ""
echo "Press Ctrl+C to exit this script (Chrome will continue running)."

# Keep the script running to show logs
read -p "Press Enter to exit..." 