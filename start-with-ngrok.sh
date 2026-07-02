#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
API_PID=""
UI_PID=""

cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  if [ -n "$API_PID" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [ -n "$UI_PID" ]; then
    kill "$UI_PID" 2>/dev/null || true
  fi
  echo -e "${GREEN}Done!${NC}"
}

trap cleanup EXIT INT TERM

echo -e "${GREEN}🚀 Starting Movie List with ngrok...${NC}"

# Source ngrok credentials if they exist
if [ -f ".ngrok.env" ]; then
    source .ngrok.env
fi

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}ngrok not found. Please install it first.${NC}"
    exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}Starting API server...${NC}"
cd "$PROJECT_ROOT/api"
npm run dev > "$PROJECT_ROOT/api.log" 2>&1 &
API_PID=$!
echo "API PID: $API_PID"

echo -e "${GREEN}Building UI...${NC}"
cd "$PROJECT_ROOT/ui"
npm run build > "$PROJECT_ROOT/ui.log" 2>&1

echo -e "${GREEN}Starting UI preview server...${NC}"
npm run preview -- --host 0.0.0.0 > "$PROJECT_ROOT/ui.log" 2>&1 &
UI_PID=$!
echo "UI PID: $UI_PID"

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 8

if ! kill -0 "$API_PID" 2>/dev/null; then
    echo -e "${YELLOW}API server failed to start. See api.log for details.${NC}"
    exit 1
fi

if ! kill -0 "$UI_PID" 2>/dev/null; then
    echo -e "${YELLOW}UI server failed to start. See ui.log for details. Port 3004 may already be in use.${NC}"
    exit 1
fi

echo -e "${GREEN}Starting ngrok tunnels...${NC}"
cd "$PROJECT_ROOT"

# Show instructions
cat << EOF

${GREEN}════════════════════════════════════════════════════════${NC}
${GREEN}Services started successfully!${NC}
${GREEN}════════════════════════════════════════════════════════${NC}

📝 Local URLs:
  • API: http://localhost:8004
  • UI:  http://localhost:3004

${YELLOW}Starting ngrok tunnels...${NC}
Share the UI URL below. The UI proxies API calls through the same public URL.

${GREEN}════════════════════════════════════════════════════════${NC}

EOF

# Start ngrok with authtoken
if [ -n "$NGROK_AUTHTOKEN" ]; then
    ngrok start --authtoken "$NGROK_AUTHTOKEN" --config ngrok.yml ui
else
    ngrok start --config ngrok.yml ui
fi
