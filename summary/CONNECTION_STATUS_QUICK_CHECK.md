# Quick Connection Status Check

## What to Look For in Console

### 1. Module Loading (Should appear immediately)
```
[useRoverTelemetry] Module loaded
[useRoverTelemetry] BACKEND_URL: http://192.168.1.31:5001
[useRoverTelemetry] SOCKET_EVENTS: ['telemetry', 'rover_data', ...]
[RoverContext] Provider initializing...
```

### 2. Connection Attempt (Should appear within 1 second)
```
[CONNECTION STATE] Changed to: connecting
[SOCKET] ========================================
[SOCKET] Attempting connection to: http://192.168.1.31:5001
[SOCKET] Config: { ... }
[SOCKET] ========================================
```

### 3. Successful Connection (Should appear within 5-10 seconds)
```
[SOCKET] ✅ Connected successfully
[SOCKET] Socket ID: abc123xyz
[SOCKET] Transport: websocket
[CONNECTION STATE] Changed to: connected
[SOCKET] Registering event listeners:
  - telemetry
  - rover_data
  - mission_event
  - mission_status
[SOCKET] 🏓 Pong received - connection alive
```

### 4. Data Reception (Should appear when backend sends data)
```
[SOCKET] 📡 Event received: rover_data Args: 1
[TELEMETRY] ✅ Rover data received: ['position', 'battery', 'mode']
```
OR
```
[SOCKET] 📡 Event received: telemetry Args: 1
[TELEMETRY] ✅ Bridge telemetry received: ['state', 'global', 'battery']
```

## Problem Indicators

### ❌ No Connection Logs at All
**Problem:** Module not initializing or hook not being called
**Check:** 
- Is RoverProvider wrapping the app in App.tsx?
- Any errors preventing app from loading?

### ❌ Connection Error
```
[SOCKET] ❌ Connection error: timeout
[CONNECTION STATE] Changed to: error
```
**Problem:** Cannot reach backend
**Check:**
- Is backend URL correct? (Currently: http://192.168.1.31:5001)
- Is backend server running?
- Can you access http://192.168.1.31:5001 in a browser?
- Is your device on the same network?

### ❌ Connected but No Data
```
[SOCKET] ✅ Connected successfully
...
(but no 📡 Event received logs)
```
**Problem:** Backend not emitting data OR event name mismatch
**Check:**
- Backend logs - is it actually emitting events?
- Backend event names - do they match frontend expectations?
- The catch-all listener will show ALL events, even with wrong names

### ⚠️ Data Received but Not Processed
```
[SOCKET] 📡 Event received: rover_data Args: 1
[TELEMETRY] ⚠️ Failed to convert rover data to envelope
```
**Problem:** Data format doesn't match expected structure
**Check:**
- Look at the event data preview in logs
- Compare with expected format in conversion functions

## Test Commands

### Test from Command Line (requires socket.io-client installed)
```powershell
cd D:\Users\FLASH\Desktop\DYX-Mobile-Development\DYX-GCS-Mobile
npm install socket.io-client
node test-socket-connection.js
```

### Test Backend HTTP Endpoint
```powershell
curl http://192.168.1.31:5001/api/rtk/status
```

### Test Backend in Browser
Open: `http://192.168.1.31:5001`

## Common Fixes

### Fix 1: Wrong IP Address
Edit `src/config.ts`:
```typescript
export const BACKEND_URL = 'http://YOUR_ACTUAL_IP:5001';
```

### Fix 2: Transport Issues
Edit `src/config.ts`, try polling first:
```typescript
export const SOCKET_CONFIG = {
  transports: ['polling', 'websocket'],  // Changed order
  // ...
};
```

### Fix 3: Increase Timeout
Edit `src/config.ts`:
```typescript
export const SOCKET_CONFIG = {
  // ...
  timeout: 30000,  // Increased from 20000
};
```

## Expected Flow Timeline

```
0ms:    App loads
0ms:    [useRoverTelemetry] Module loaded
0ms:    [RoverContext] Provider initializing...
0ms:    [CONNECTION STATE] Changed to: connecting
100ms:  [SOCKET] Attempting connection to: ...
500ms:  [SOCKET] ✅ Connected successfully
500ms:  [CONNECTION STATE] Changed to: connected
500ms:  [SOCKET] Registering event listeners...
5000ms: [SOCKET] 🏓 Pong received (every 5 seconds)
???:    [SOCKET] 📡 Event received: rover_data (when backend sends)
```

If you don't see this flow, note where it stops and check the corresponding section above.
