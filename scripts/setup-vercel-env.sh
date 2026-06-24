#!/bin/bash
# Setup Vercel environment variables from .env.local
# Usage: ./scripts/setup-vercel-env.sh
# Requires: npm i -g vercel (Vercel CLI)

set -e

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE not found. Create it first with your values filled in."
  exit 1
fi

echo "🚀 Pushing env vars from $ENV_FILE to Vercel..."
echo ""

# Read each non-comment, non-empty line and add to Vercel
while IFS= read -r line || [ -n "$line" ]; do
  # Skip comments and empty lines
  case "$line" in
    \#*|""|" "*) continue ;;
  esac

  # Extract key and value
  key="${line%%=*}"
  value="${line#*=}"

  # Skip if value is empty
  if [ -z "$value" ]; then
    echo "⏭️  Skipping $key (empty value)"
    continue
  fi

  echo "➕ Adding: $key"
  echo "$value" | vercel env add "$key" production --yes 2>/dev/null || true
  echo "$value" | vercel env add "$key" preview --yes 2>/dev/null || true
  echo "$value" | vercel env add "$key" development --yes 2>/dev/null || true
done < "$ENV_FILE"

echo ""
echo "✅ Done! Env vars pushed to Vercel."
echo "👉 Now redeploy: vercel --prod"
