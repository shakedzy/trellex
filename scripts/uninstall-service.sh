#!/bin/bash

# Trellex macOS Service Uninstaller
# This script removes the Trellex background service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PLIST_NAME="com.trellex.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo -e "${GREEN}🗑️  Trellex Service Uninstaller${NC}"
echo "================================"
echo ""

# Check if service exists
if [ ! -f "$PLIST_PATH" ]; then
    echo -e "${YELLOW}Service is not installed.${NC}"
    exit 0
fi

# Unload the service
echo "Stopping Trellex service..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true
echo -e "${GREEN}✓${NC} Service stopped"

# Remove the plist file
rm -f "$PLIST_PATH"
echo -e "${GREEN}✓${NC} Removed plist file"

echo ""
echo -e "${GREEN}✅ Trellex service has been uninstalled.${NC}"
echo ""
echo "Note: Your data files in the 'data' directory are preserved."
echo "To reinstall, run: ./scripts/install-service.sh"
