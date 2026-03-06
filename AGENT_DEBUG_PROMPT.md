# Debug Prompt for Antigravity Agent

## Problem Summary
GPS Failsafe mode is not persisting correctly between frontend and backend. When user sets it to "relax", it gets saved to backend config file, but the frontend still shows "disable" after refresh.

---

## System Architecture

### Frontend:
- React Native Web application
- Uses RoverContext for state management
- Settings screen at: `src/screens/SettingsScreen.tsx`
- Context at: `src/context/RoverContext.ts`

### Backend:
- Python FastAPI + Socket.IO server
- Main file: `Backend/Backend/server.py`
- Config file: `Backend/Backend/config/mission_controller_config.json`
- Runs as systemd service: `nrp-service`

---

## Current Behavior

### Backend (Working Correctly ✅):
```bash
# Set to "relax"
✅ Saved gps_failsafe_mode = relax to config

# Restart service
✅ Loaded GPS failsafe mode from config: relax

# Send to clients
📤 Sent GPS failsafe mode to new client: relax
```

### Frontend (Not Working ❌):
```javascript
// Console log when Settings opens:
✅ GPS Failsafe Mode (from backend via context): DISABLE

// UI shows:
Current Mode: DISABLE
Description: "Disabled - No GPS accuracy checks"
```

---

## What We've Tried

1. **Backend Persistence** ✅
   - Added `load_system_settings()` function to load from config on startup
   - Added `save_system_setting()` function to save to config on change
   - Backend correctly loads and broadcasts "relax" mode

2. **Removed AsyncStorage from Frontend** ✅
   - Previously, frontend loaded old "disable" from AsyncStorage and sent it back to backend
   - Removed AsyncStorage saving/loading for GPS failsafe
   - Made backend the single source of truth

3. **Fixed Infinite Loop** ✅
   - Removed `onMissionEvent` from useEffect dependency array
   - Fixed "Maximum update depth exceeded" error

---

## Code Snippets

### Backend - Handle GPS Failsafe Mode
**File:** `Backend/Backend/server.py` (lines ~3532-3568)
```python
@sio.on('set_gps_failsafe_mode')
async def handle_set_gps_failsafe_mode(sid, data):
    mode = data.get('mode', 'disable')

    # Update current state
    current_state.gps_failsafe_mode = mode

    # Save to config file for persistence
    save_system_setting('gps_failsafe_mode', mode)

    # Emit confirmation to frontend
    await sio.emit('failsafe_mode_changed', {
        'mode': mode,
        'timestamp': time.time(),
    })
```

### Backend - Send on Connect
**File:** `Backend/Backend/server.py` (lines ~3106-3112)
```python
@sio.on('connect')
async def handle_connect(sid, environ):
    # Send system settings to new client
    await sio.emit('failsafe_mode_changed', {
        'mode': current_state.gps_failsafe_mode,
        'timestamp': time.time()
    }, to=sid)
```

### Frontend - RoverContext
**File:** `src/context/RoverContext.ts` (lines 59, 132-140, 171-174)
```typescript
// Initial state
const [gpsFailsafeMode, setGpsFailsafeModeState] = useState<GpsFailsafeMode>('disable');

// Setter (emits to backend)
const setGpsFailsafeMode = useCallback((mode: GpsFailsafeMode) => {
  console.log('[RoverContext] Setting GPS failsafe mode:', mode);
  setGpsFailsafeModeState(mode);

  // Emit to backend
  if (rover.socket) {
    rover.socket.emit('set_gps_failsafe_mode', { mode });
  }
}, [rover.socket]);

// Listener (receives from backend)
const handleFailsafeModeChanged = (data: { mode: GpsFailsafeMode }) => {
  console.log('[RoverContext] ⚙️ Failsafe mode changed from backend:', data.mode);
  setGpsFailsafeModeState(data.mode);
};

rover.socket.on('failsafe_mode_changed', handleFailsafeModeChanged);
```

### Frontend - Settings Screen
**File:** `src/screens/SettingsScreen.tsx` (lines 22-24, 369-389)
```typescript
// Get mode from context
const { gpsFailsafeMode, setGpsFailsafeMode } = useRover();

// UI Display
<Text style={styles.settingDescription}>
  {gpsFailsafeMode === 'disable'
    ? 'Disabled - No GPS accuracy checks'
    : gpsFailsafeMode === 'strict'
    ? 'Strict - Pause on low accuracy'
    : 'Relax - Warning only'}
</Text>

<TouchableOpacity
  style={styles.changeButton}
  onPress={() => setShowFailsafeSelector(true)}
>
  <Text style={styles.changeButtonText}>
    {gpsFailsafeMode.toUpperCase()}
  </Text>
</TouchableOpacity>
```

---

## Specific Questions

1. **Why does frontend RoverContext show "disable" when backend sends "relax"?**
   - Is there a timing issue?
   - Is the socket event listener not working?
   - Is the state not updating correctly?

2. **Is the UI reactive to RoverContext state changes?**
   - Should the UI update automatically when backend sends "relax"?
   - Or do we need to force a re-render?

3. **Config file issue?**
   The config file still shows `"gps_failsafe_mode": "disable"` even though logs show it saved "relax". Is the file not being written correctly?

4. **Should we verify the socket connection is established before Settings loads?**
   - Currently there's a 100ms delay, is that enough?

---

## Expected Behavior

1. User sets GPS failsafe to "relax"
2. Frontend sends to backend via socket
3. Backend saves "relax" to config file
4. Backend broadcasts "relax" to all clients
5. **User refreshes page**
6. Backend loads "relax" from config file
7. Frontend connects to backend
8. Backend sends "relax" to frontend
9. RoverContext updates state to "relax"
10. **Settings UI shows "RELAX"** ✅

---

## Debug Tasks

Please analyze and identify:

1. **Why is RoverContext not receiving the backend "relax" value?**
2. **Why does the config file show "disable" when logs show "relax" was saved?**
3. **Is there a race condition between Settings loading and socket connection?**
4. **Should we add logging to track the socket message flow?**
5. **Is the React component re-rendering when RoverContext state changes?**

---

## Files to Investigate

1. `src/context/RoverContext.ts` - State management and socket listeners
2. `src/screens/SettingsScreen.tsx` - UI display
3. `Backend/Backend/server.py` - Backend logic (lines 3532-3568, 3091-3115)
4. `Backend/Backend/config/mission_controller_config.json` - Persistence file

---

## Success Criteria

✅ User sets GPS failsafe to "relax"
✅ Refreshes page
✅ Settings UI shows "RELAX" (not "DISABLE")
✅ Backend logs show: `Loaded GPS failsafe mode from config: relax`
✅ Config file contains: `"gps_failsafe_mode": "relax"`

---

## Additional Context

- Frontend connects to backend at: `http://192.168.0.212:5001`
- Socket.IO is used for real-time communication
- The obstacle detection setting (similar implementation) works correctly
- Backend is running as a systemd service and can be restarted with: `sudo systemctl restart nrp-service`

---

**Please help identify the root cause and provide a solution!** 🙏
