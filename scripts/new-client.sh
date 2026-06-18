#!/usr/bin/env bash
# Usage: ./scripts/new-client.sh <slot-name> <plan-id>
# Example: ./scripts/new-client.sh slot-4 client-slot-4
#
# Creates a new client branch, copies the generic app template,
# sets a unique PLAN_ID, commits, and pushes to GitHub.
# Then prompts to create a Vercel project from that branch.

set -e

SLOT="$1"
PLAN_ID="$2"

if [[ -z "$SLOT" || -z "$PLAN_ID" ]]; then
  echo "Usage: ./scripts/new-client.sh <slot-name> <plan-id>"
  echo "Example: ./scripts/new-client.sh slot-4 client-slot-4"
  exit 1
fi

BRANCH="client/$SLOT"
FILE="src/HyroxClient$(echo "$SLOT" | sed 's/[^a-zA-Z0-9]//g' | awk '{print toupper(substr($0,1,1)) substr($0,2)}').jsx"

echo ""
echo "Creating client: $SLOT"
echo "  Branch : $BRANCH"
echo "  File   : $FILE"
echo "  PLAN_ID: $PLAN_ID"
echo ""

# Make sure we start from main
git checkout main

# Create and switch to new branch
git checkout -b "$BRANCH"

# Copy template and set unique PLAN_ID
cp src/HyroxTrainingApp.jsx "$FILE"
sed -i '' "s/const PLAN_ID = \"team-walker-dc\"/const PLAN_ID = \"$PLAN_ID\"/" "$FILE"

# Point main.jsx at the new file
BASENAME=$(basename "$FILE" .jsx)
sed -i '' "s|import HyroxTrainer from '.*'|import HyroxTrainer from './${BASENAME}.jsx'|" src/main.jsx

# Commit and push
git add "$FILE" src/main.jsx
git commit -m "Add generic client slot: $SLOT (PLAN_ID: $PLAN_ID)"
git push -u origin "$BRANCH"

echo ""
echo "Done! Branch '$BRANCH' pushed to GitHub."
echo ""
echo "Next step — create a Vercel project:"
echo "  1. vercel.com → Add New Project → Import mrenolayan/Hyrox-Training"
echo "  2. Name the project: hyrox-$SLOT"
echo "  3. After deploy, go to Settings → Environments → Production"
echo "  4. Change branch from 'main' to '$BRANCH' → Save → Redeploy"
echo ""

# Return to main
git checkout main
