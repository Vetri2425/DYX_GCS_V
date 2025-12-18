# Socket.IO Connection Diagnostics

## Issue
Backend is emitting data but frontend is not receiving it.

## Enhanced Logging Added

The following diagnostic logging has been added to `useRoverTelemetry.ts`:

1. **Connection Details** - Shows URL, config, socket ID, and transport type
2. **Event Registration** - Lists all event listeners being registered
3. **Data Reception** - Logs when telemetry/rover data is received
4. **Catch-All Listener** - Logs ALL events received from backend (using `socket.onAny()`)
5. **Connection State** - Tracks state changes (connecting → connected → error)

## Diagnostic Steps

### Step 1: Check Backend URL
Current backend URL in `config.ts`:
```
BACKEND_URL: http://192.168.1.31:5001
```

**Verify:**
- Is this IP correct for your backend server?
- Is the backend server running on this IP and port?
- Can you ping this IP from your device?

### Step 2: Test Backend Connectivity

#### Test HTTP Endpoint
```bash
curl http://192.168.1.31:5001/api/rtk/status
```

#### Test Socket.IO Endpoint (from Node.js)
```bash
cd D:\Users\FLASH\Desktop\DYX-Mobile-Development\DYX-GCS-Mobile
node test-socket-connection.js
```

This will:
- Attempt to connect to the backend
- Listen for ALL events
- Report what events are being received
- Show connection status every 10 seconds

### Step 3: Check React Native Console Output

When you run `npx expo start` and open the app, look for these logs:

#### ✅ Successful Connection Logs:
```
[SOCKET] ======================================
[SOCKET] Attempting connection to: http://192.168.1.31:5001
[SOCKET] Config: {...}
[SOCKET] ======================================
[CONNECTION STATE] Changed to: connecting
[SOCKET] ✅ Connected successfully
[SOCKET] Socket ID: <some-id>
[SOCKET] Transport: websocket
[CONNECTION STATE] Changed to: connected
[SOCKET] Registering event listeners:
  - telemetry
  - rover_data
  - mission_event
  - mission_status
```

#### ❌ Connection Error Logs:
```
[SOCKET] ❌ Connection error: <error message>
[CONNECTION STATE] Changed to: error
```

#### 📡 Data Reception Logs:
```
[SOCKET] 📡 Event received: rover_data Args: 1
[TELEMETRY] ✅ Rover data received: ['position', 'battery', 'mode', ...]
```

### Step 4: Common Issues and Solutions

#### Issue 1: Wrong IP Address
**Symptoms:** Connection timeout, connect_error
**Solution:** 
- Update `BACKEND_URL` in `src/config.ts`
- For local network: Use your computer's local IP (check with `ipconfig` on Windows or `ifconfig` on Mac/Linux)
- For same device: Use `http://localhost:5001`

#### Issue 2: CORS Policy
**Symptoms:** Connection error with CORS message
**Solution:**
- Backend needs to allow connections from React Native
- Check backend Socket.IO configuration has correct CORS settings:
```python
socketio = SocketIO(app, cors_allowed_origins="*")
```

#### Issue 3: Wrong Transport
**Symptoms:** Connection timeout or frequent disconnects
**Solution:**
- Try changing transport order in `src/config.ts`:
```typescript
transports: ['polling', 'websocket']  // Try polling first
```

#### Issue 4: Event Name Mismatch
**Symptoms:** Connected but no data received
**Check:**
- Backend event names match frontend expectations
- Look at catch-all listener output: `[SOCKET] 📡 Event received: <event-name>`
- If events are being received but not processed, check event name mapping

#### Issue 5: Firewall/Network Block
**Symptoms:** Connection timeout
**Solution:**
- Check Windows Firewall allows connections on port 5001
- Check your network doesn't block WebSocket connections
- Try connecting from web browser first: `http://192.168.1.31:5001`

### Step 5: Backend Event Names

Make sure your backend is emitting events with these names:
- `telemetry` - For bridge telemetry data
- `rover_data` - For rover data
- `mission_event` - For mission events
- `mission_status` - For mission status updates
- `pong` - Response to ping

### Step 6: Check Backend is Actually Emitting

On the backend, verify it's actually emitting events:
```python
# Backend should have something like:
socketio.emit('rover_data', data, broadcast=True)
# or
socketio.emit('telemetry', data, broadcast=True)
```

Add logging on backend to confirm:
```python
print(f"Emitting rover_data: {data}")
socketio.emit('rover_data', data, broadcast=True)
```

## Quick Test Checklist

- [ ] Backend server is running on correct IP:port
- [ ] Can access backend HTTP endpoint (try in browser: `http://192.168.1.31:5001`)
- [ ] Frontend connects (see "✅ Connected successfully" in logs)
- [ ] Backend is actually emitting events (check backend logs)
- [ ] Event names match between backend and frontend
- [ ] No CORS errors in console
- [ ] Catch-all listener shows events being received

## Next Steps

1. **Run the app** and check the console output
2. **Run the test script**: `node test-socket-connection.js`
3. **Compare backend event names** with frontend expectations
4. **Check if data is being received** via catch-all listener
5. **Verify event payload structure** matches expected format

## Support Information

### Frontend Configuration
- URL: `http://192.168.1.31:5001`
- Transports: `['websocket', 'polling']`
- Reconnection: Enabled (infinite attempts)

### Expected Event Names
- `telemetry` → `handleBridgeTelemetry()`
- `rover_data` → `handleRoverData()`
- `mission_event`, `mission_status`, etc. → Mission handlers

### Debug Mode
All logging is now enabled. The catch-all listener will show EVERY event received from the backend.
