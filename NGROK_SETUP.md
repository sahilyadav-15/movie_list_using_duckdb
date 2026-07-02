# Running on ngrok

This guide explains how to share your movie list application publicly using ngrok.

## Prerequisites

- ngrok installed on your machine
- ngrok account (free tier is fine)
- Both `api/` and `ui/` dependencies installed

## Setup Steps

### 1. Get your ngrok authtoken

1. Sign up at [ngrok.com](https://ngrok.com) (free account)
2. Go to your dashboard and copy your authtoken
3. Set it as an environment variable:
   ```bash
   export NGROK_AUTHTOKEN=your_authtoken_here
   ```

### 2. Start the backend API

In the `api/` directory:

```bash
npm run dev
# Or for production
npm run build
npm run start
```

The API will be running on `http://localhost:8004`

### 3. Start the frontend UI

In the `ui/` directory:

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

The UI preview will be running on `http://localhost:3004`

### 4. Start ngrok to expose the UI

In the project root, run:

```bash
ngrok start --config ngrok.yml ui
```

This exposes the UI. The Vite dev server proxies `/movies/*` API calls to the local API server, so people only need the UI URL.

- UI: `https://xxxx-xx-xxx-xxx-xx.ngrok.io` (for the ui tunnel)

If you prefer separate API and UI tunnels, run `ngrok start --config ngrok.yml api ui` and start the UI with `VITE_API_URL=<api-ngrok-url> npm run dev`.

## Alternative: Single ngrok tunnel with reverse proxy

If you want a single URL for both the UI and API, you can:

1. Set up a reverse proxy (like nginx locally)
2. Route `/api/*` to localhost:8004
3. Route everything else to localhost:3004
4. Expose the proxy through a single ngrok tunnel

Or simply access both via their separate ngrok URLs.

## Quick Start Script

Create a file `start-with-ngrok.sh`:

```bash
#!/bin/bash
set -e

# Start API in background
cd api
npm run dev &
API_PID=$!

# Build and start UI preview in background
cd ../ui
npm run build
npm run preview -- --host 0.0.0.0 &
UI_PID=$!

# Wait for services to start
sleep 5

# Start ngrok
ngrok start --config ../ngrok.yml ui

# Cleanup on exit
trap "kill $API_PID $UI_PID" EXIT
```

Then run:

```bash
chmod +x start-with-ngrok.sh
./start-with-ngrok.sh
```

## Troubleshooting

- **API URLs not updating:** Make sure to rebuild the UI after getting ngrok URLs with `VITE_API_URL=<api-url> npm run build`
- **CORS issues:** The API is already configured with CORS enabled
- **Different URLs on restart:** This is normal with free ngrok tier. Use the paid plan for static URLs
