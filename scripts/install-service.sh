#!/bin/bash

# Trellex macOS Service Installer
# This script installs Trellex as a background service using launchd

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_HOST="127.0.0.1"
DEFAULT_PORT="5555"
PLIST_NAME="com.trellex.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRELLEX_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}🚀 Trellex Service Installer${NC}"
echo "================================"
echo ""

# Parse arguments
HOST="${1:-$DEFAULT_HOST}"
PORT="${2:-$DEFAULT_PORT}"

echo -e "Configuration:"
echo -e "  Trellex directory: ${YELLOW}$TRELLEX_DIR${NC}"
echo -e "  Host: ${YELLOW}$HOST${NC}"
echo -e "  Port: ${YELLOW}$PORT${NC}"
echo ""

# Find uv path
UV_PATH=$(which uv 2>/dev/null || echo "")
if [ -z "$UV_PATH" ]; then
    echo -e "${RED}Error: 'uv' not found in PATH${NC}"
    echo "Please install uv first: https://github.com/astral-sh/uv"
    exit 1
fi
echo -e "  uv path: ${YELLOW}$UV_PATH${NC}"
echo ""

# Create logs directory
mkdir -p "$TRELLEX_DIR/logs"
echo -e "${GREEN}✓${NC} Created logs directory"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCH_AGENTS_DIR"
echo -e "${GREEN}✓${NC} Ensured LaunchAgents directory exists"

# Generate plist from template
PLIST_PATH="$LAUNCH_AGENTS_DIR/$PLIST_NAME"
TEMPLATE_PATH="$SCRIPT_DIR/com.trellex.plist.template"

if [ ! -f "$TEMPLATE_PATH" ]; then
    echo -e "${RED}Error: Template file not found: $TEMPLATE_PATH${NC}"
    exit 1
fi

# Replace placeholders
sed -e "s|{{UV_PATH}}|$UV_PATH|g" \
    -e "s|{{TRELLEX_DIR}}|$TRELLEX_DIR|g" \
    -e "s|{{HOST}}|$HOST|g" \
    -e "s|{{PORT}}|$PORT|g" \
    "$TEMPLATE_PATH" > "$PLIST_PATH"

echo -e "${GREEN}✓${NC} Generated plist at $PLIST_PATH"

# Unload existing service if running
if launchctl list | grep -q "com.trellex"; then
    echo "Unloading existing service..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# Load the service
launchctl load "$PLIST_PATH"
echo -e "${GREEN}✓${NC} Loaded Trellex service"

# Wait a moment for the service to start
sleep 2

# Check if service is running
if launchctl list | grep -q "com.trellex"; then
    echo ""
    echo -e "${GREEN}✅ Trellex is now running as a background service!${NC}"
    echo ""
    echo -e "Access it at: ${YELLOW}http://$HOST:$PORT${NC}"
    echo ""
    echo "Useful commands:"
    echo -e "  Stop service:    ${YELLOW}launchctl unload $PLIST_PATH${NC}"
    echo -e "  Start service:   ${YELLOW}launchctl load $PLIST_PATH${NC}"
    echo -e "  View logs:       ${YELLOW}tail -f $TRELLEX_DIR/logs/trellex.log${NC}"
    echo -e "  View errors:     ${YELLOW}tail -f $TRELLEX_DIR/logs/trellex.error.log${NC}"
    echo -e "  Uninstall:       ${YELLOW}$SCRIPT_DIR/uninstall-service.sh${NC}"
else
    echo -e "${RED}⚠ Service may not have started correctly. Check logs:${NC}"
    echo -e "  ${YELLOW}cat $TRELLEX_DIR/logs/trellex.error.log${NC}"
fi
