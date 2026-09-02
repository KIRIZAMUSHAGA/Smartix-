---
name: Smartix WebSocket routing
description: Development routing constraint for Smartix's CRA hot-reload socket and backend WebSockets.
---

The frontend development server must use a dedicated hot-reload WebSocket path rather than the backend's `/ws` path. Keep the HMR path fixed in frontend development configuration and register it in the root web artifact's service paths.

**Why:** CRA's default HMR path `/ws` collided with Smartix's backend WebSocket/Socket.IO routes and produced `Invalid frame header` in the proxied preview.

**How to apply:** If the frontend dev server or artifact preview routing changes, preserve the separate HMR path and keep application WebSocket URLs environment-aware.