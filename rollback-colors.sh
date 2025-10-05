#!/bin/bash

# Rollback script to restore original green color scheme
echo "🔄 Rolling back to original green color scheme..."

# Restore the original tailwind config
cp tailwind.config.js.backup tailwind.config.js

echo "✅ Color scheme rolled back to original green!"
echo "🔄 Please restart your development server to see the changes."
echo "Run: npm run dev"
