#!/bin/bash

# Simple script to run the Focus Companion demo
echo "Starting Focus Companion demo server..."
echo "Open http://localhost:8000/test/focus-companion-demo.html in your browser"

# Check if Python 3 is available
if command -v python3 &>/dev/null; then
    python3 -m http.server
elif command -v python &>/dev/null; then
    python -m http.server
else
    echo "Error: Python is not installed. Please install Python to run the demo server."
    exit 1
fi