#!/bin/bash

# Create a simple blue square icon with "FN" text for Focus Nudge
# This script requires ImageMagick to be installed

# Create 16x16 icon
convert -size 16x16 xc:none -fill "#6e8efb" -draw "roundrectangle 0,0 16,16 3,3" \
  -pointsize 8 -fill white -gravity center -annotate +0+0 "FN" icons/icon16.png

# Create 48x48 icon
convert -size 48x48 xc:none -fill "#6e8efb" -draw "roundrectangle 0,0 48,48 6,6" \
  -pointsize 24 -fill white -gravity center -annotate +0+0 "FN" icons/icon48.png

# Create 128x128 icon
convert -size 128x128 xc:none -fill "#6e8efb" -draw "roundrectangle 0,0 128,128 12,12" \
  -pointsize 64 -fill white -gravity center -annotate +0+0 "FN" icons/icon128.png

echo "Icons created successfully!" 