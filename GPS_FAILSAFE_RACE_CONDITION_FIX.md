# GPS Failsafe Race Condition Fix ✅

## Problem Identified

The GPS failsafe mode was not persisting after frontend reload because of a **race condition**:

### Timeline of Events:
1. **Frontend connects** to backend → Socket connects
2. **Backend sends `failsafe_mode_changed`** immediately (line 3107 in server.py)
3. **Message arrives at frontend** → But listener not registered yet! 🚫
4. **Message gets lost**
5. **Later, RoverContext registers listener** → But message already gone
6. **Settings screen loads** → Shows "DISABLE" (initial state from line 59 in RoverContext.ts)

### Evidence:
```
LOG  [SOCKET] ✅ Connected - ID: 5CXuaw42z-JDdD_8AAAr
LOG  [RoverContext] 🔌 Registering GPS failsafe listeners. Connection state: connected
LOG  [RoverContext] ✅ GPS failsafe listeners registered
LOG  ✅ GPS Failsafe Mode (from backend via context): DISABLE
```

The backend **was** sending the mode, but the frontend listener registered **after** the message was sent.

---

## Root Cause

**Backend (server.py lines 3106-3112):**
```python
# Send system settings to new client
await sio.emit('failsafe_mode_changed', {
    'mode': current_state.gps_failsafe_mode,
    'timestamp': time.time()
}, to=sid)
log_message(f"📤 Sent GPS failsafe mode to new client: {current_state.gps_failsafe_mode}", "INFO")
```

**Frontend (RoverContext.ts line 59):**
```typescript
const [gpsFailsafeMode, setGpsFailsafeModeState] = useState<GpsFailsafeMode>('disable');
```

**Frontend (RoverContext.ts lines 164-197):**
```typescript
useEffect(() => {
  if (!rover.socket || !rover.socket.connected) {
    return; // ← Waits for connection
  }

  // Register listeners
  rover.socket.on('failsafe_mode_changed', handleFailsafeModeChanged);
  // ← But by this time, backend already sent the message!
}, [rover.socket, rover.connectionState]);
```

---

## Solution

### Frontend Fix: Request Mode After Registering Listener

**File:** `src/context/RoverContext.ts` (line 191)

Added a request after registering the listener to fetch the current GPS failsafe mode:

```typescript
rover.socket.on('servo_suppressed', handleServoSuppressed);
rover.socket.on('failsafe_mode_changed', handleFailsafeModeChanged);
console.log('[RoverContext] ✅ GPS failsafe listeners registered');

// ✅ FIX: Request current GPS failsafe mode after registering listener
// This prevents race condition where backend sends mode before listener is ready
console.log('[RoverContext] 📡 Requesting current GPS failsafe mode from backend');
rover.socket.emit('request_gps_failsafe_mode');
```

### Backend Fix: Add Request Handler

**File:** `Backend/server.py` (after line 3580)

Added a new Socket.IO handler to respond to GPS failsafe mode requests:

```python
@sio.on('request_gps_failsafe_mode')
async def handle_request_gps_failsafe_mode(sid, data=None):
    """Send current GPS failsafe mode to requesting client."""
    try:
        log_message(f"📡 Client {sid} requested current GPS failsafe mode", "INFO", event_type='gps_failsafe')
        await sio.emit('failsafe_mode_changed', {
            'mode': current_state.gps_failsafe_mode,
            'timestamp': time.time(),
            'message': f'Current failsafe mode: {current_state.gps_failsafe_mode.upper()}'
        }, to=sid)
        log_message(f"✅ Sent GPS failsafe mode to client {sid}: {current_state.gps_failsafe_mode}", "INFO", event_type='gps_failsafe')
    except Exception as e:
        log_message(f"Request failsafe mode error: {e}", "ERROR", event_type='gps_failsafe')
```

---

## How It Works Now

### New Timeline:
1. **Frontend connects** to backend → Socket connects
2. **Backend sends `failsafe_mode_changed`** immediately (old behavior, might get lost)
3. **RoverContext registers listeners**
4. **Frontend emits `request_gps_failsafe_mode`** ← NEW!
5. **Backend receives request** and sends `failsafe_mode_changed` ← NEW!
6. **Frontend listener receives message** ✅
7. **RoverContext state updates** to "relax" ✅
8. **Settings screen shows "RELAX"** ✅

---

## Files Modified

### Frontend:
- ✅ `src/context/RoverContext.ts` (line 191-194)

### Backend (Remote):
- ✅ `/home/flash/NRP_ROS/Backend/server.py` (after line 3580)

### Backend (Local Sync):
- ✅ `Backend/NRP_ROS/Backend/server.py`
- ✅ `Backend/Backend/server.py`

---

## Testing Instructions

### 1. Restart Backend Service
```bash
ssh flash@192.168.0.212
sudo systemctl restart nrp-service.service
```

### 2. Expected Backend Logs
```
📡 Client <sid> requested current GPS failsafe mode
✅ Sent GPS failsafe mode to client <sid>: relax
```

### 3. Expected Frontend Logs
```
LOG  [RoverContext] 🔌 Registering GPS failsafe listeners. Connection state: connected
LOG  [RoverContext] ✅ GPS failsafe listeners registered
LOG  [RoverContext] 📡 Requesting current GPS failsafe mode from backend
LOG  ═══════════════════════════════════════
LOG  [RoverContext] 🔔 RECEIVED FAILSAFE MODE FROM BACKEND
LOG  New Mode: relax
LOG  ✅ State updated to: relax
LOG  ✅ GPS Failsafe Mode (from backend via context): RELAX
```

### 4. Test Full Cycle
1. **Set GPS failsafe to "relax"** in Settings
2. **Refresh frontend** (F5 or reload)
3. **Open Settings** (⚙️ gear icon)
4. **Expected:** GPS Failsafe shows "RELAX" ✅
5. **Restart backend:** `sudo systemctl restart nrp-service.service`
6. **Refresh frontend** again
7. **Open Settings**
8. **Expected:** GPS Failsafe still shows "RELAX" ✅

---

## Success Criteria

✅ Backend loads "relax" from config on startup
✅ Backend sends "relax" on client connection (old behavior)
✅ Frontend registers listeners when socket connects
✅ Frontend requests GPS failsafe mode after registering listener ← **NEW FIX**
✅ Backend responds with current GPS failsafe mode ← **NEW FIX**
✅ Frontend receives and updates state to "relax"
✅ Settings screen displays "RELAX"
✅ Mode persists across frontend reload
✅ Mode persists across backend restart

---

## Backups Created

- `server.py.backup` (initial backup)
- `server.py.backup2` (before mission controller fix)
- `server.py.backup_race_fix` (before race condition fix)

---

## Related Documents

- [GPS_FAILSAFE_FIX_COMPLETE.md](GPS_FAILSAFE_FIX_COMPLETE.md) - Initial persistence fix
- [AGENT_DEBUG_PROMPT.md](AGENT_DEBUG_PROMPT.md) - Debug prompt for Antigravity Agent

---

**Status:** ✅ **COMPLETE - READY TO TEST**

**Next Step:** Restart backend service and verify GPS failsafe mode persists correctly after reload!

**Date:** 2026-02-25
**Issue:** GPS failsafe mode not appearing after frontend reload (race condition)
**Solution:** Frontend requests GPS failsafe mode after registering listener
