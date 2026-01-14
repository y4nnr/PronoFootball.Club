#!/bin/bash

# Script to compare local Prisma schema with production database schema
# Usage: ./compare-prisma-schemas.sh

echo "📋 Comparing Prisma schemas..."
echo ""

# Step 1: Save current local schema
echo "1️⃣ Saving current local schema..."
cp prisma/schema.prisma prisma/schema.local.prisma
echo "   ✅ Saved to prisma/schema.local.prisma"

# Step 2: Pull production schema (requires PROD_DATABASE_URL to be set)
if [ -z "$PROD_DATABASE_URL" ]; then
  echo ""
  echo "⚠️  PROD_DATABASE_URL environment variable is not set."
  echo "   To compare with production, run:"
  echo "   export PROD_DATABASE_URL='your-production-database-url'"
  echo "   Then run this script again."
  echo ""
  echo "   Or manually run:"
  echo "   DATABASE_URL=\$PROD_DATABASE_URL npx prisma db pull --schema=prisma/schema.prod.prisma"
  exit 1
fi

echo ""
echo "2️⃣ Pulling production database schema..."
DATABASE_URL=$PROD_DATABASE_URL npx prisma db pull --schema=prisma/schema.prod.prisma
echo "   ✅ Saved to prisma/schema.prod.prisma"

# Step 3: Compare schemas
echo ""
echo "3️⃣ Comparing schemas..."
echo "   Differences:"
diff -u prisma/schema.local.prisma prisma/schema.prod.prisma || echo "   (No differences found or diff command not available)"

echo ""
echo "✅ Comparison complete!"
echo "   Local schema: prisma/schema.local.prisma"
echo "   Production schema: prisma/schema.prod.prisma"





