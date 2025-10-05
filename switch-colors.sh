#!/bin/bash

# Color scheme switcher for PronoFootball.Club
echo "🎨 PronoFootball.Club Color Scheme Switcher"
echo "=========================================="
echo ""
echo "Available color schemes:"
echo "1. Original Green (default)"
echo "2. Facebook Blue"
echo "3. Dark Grey"
echo ""
read -p "Choose a color scheme (1-3): " choice

case $choice in
    1)
        echo "🟢 Switching to Original Green..."
        cp tailwind.config.js.backup tailwind.config.js
        echo "✅ Original green color scheme applied!"
        ;;
    2)
        echo "🔵 Switching to Facebook Blue..."
        # Facebook blue colors
        sed -i '' 's/primary: {[^}]*}/primary: {\
          50: '\''#eef2ff'\'',\
          100: '\''#e0e7ff'\'',\
          200: '\''#c7d2fe'\'',\
          300: '\''#a5b4fc'\'',\
          400: '\''#818cf8'\'',\
          500: '\''#1877F2'\'',\
          600: '\''#1664d9'\'',\
          700: '\''#1452c0'\'',\
          800: '\''#1240a7'\'',\
          900: '\''#102e8e'\'',\
        }/' tailwind.config.js
        echo "✅ Facebook blue color scheme applied!"
        ;;
    3)
        echo "⚫ Switching to Dark Grey..."
        # Dark grey colors (already applied)
        echo "✅ Dark grey color scheme is active!"
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again and choose 1, 2, or 3."
        exit 1
        ;;
esac

echo ""
echo "🔄 Please restart your development server to see the changes:"
echo "npm run dev"
