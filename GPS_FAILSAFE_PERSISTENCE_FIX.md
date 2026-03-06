# GPS Failsafe Mode Persistence Fix

## Problem Analysis

### Root Cause
GPS failsafe mode was not persisting across backend restarts because:

1. **Backend Default Hardcoded:**
   ```python
   # server.py line 826
   gps_failsafe_mode: str = "disable"  # Always starts with "disable"
   ```

2. **In-Memory Only:**
   - When frontend set GPS failsafe to "relax", backend updated in-memory only
   - No config file persistence
   - On restart: backend reset to "disable" default

3. **Backend Override:**
   - Frontend saved "relax" to AsyncStorage ✅
   - On refresh, frontend loaded "relax" from AsyncStorage ✅
   - But RoverContext listened for `failsafe_mode_changed` from backend
   - Backend sent "disable" → overwrote AsyncStorage value ❌

### Why Obstacle Detection Worked
- Used **local state** in SettingsScreen
- Backend events only confirmed changes, didn't override on load
- No backend listener overwriting the value

### Why GPS Failsafe Didn't Work
- Used **RoverContext state**
- RoverContext **always** listened to backend `failsafe_mode_changed`
- Backend broadcast "disable" on connect → overwrote user preference

---

## Solution Implemented

### Backend Changes (server.py)

#### 1. Config File Updated
**File:** `Backend/Backend/config/mission_controller_config.json`

Added new section:
```json
"system_settings": {
  "gps_failsafe_mode": "disable",
  "obstacle_detection_enabled": false
}
```

#### 2. Load System Settings on Startup
**Added function:** `load_system_settings()`
- Loads GPS failsafe mode from config file
- Loads obstacle detection state from config file
- Called during backend startup

#### 3. Save System Settings on Change
**Added function:** `save_system_setting(setting_name, setting_value)`
- Saves individual settings to config file
- Updates metadata timestamp
- Called when GPS failsafe or obstacle detection changes

#### 4. Updated Socket Event Handlers

**GPS Failsafe Mode Handler:**
```python
@sio.on('set_gps_failsafe_mode')
async def handle_set_gps_failsafe_mode(sid, data):
    # ... validation ...
    current_state.gps_failsafe_mode = mode

    # ✨ NEW: Save to config file for persistence
    save_system_setting('gps_failsafe_mode', mode)

    # Update mission controller...
    # Emit confirmation...
```

**Obstacle Detection Handler:**
```python
@sio.on('set_obstacle_detection')
async def handle_set_obstacle_detection(sid, data):
    enabled = bool(data.get('enabled', False))

    # ✨ NEW: Save to config file for persistence
    save_system_setting('obstacle_detection_enabled', enabled)

    # Update mission controller...
    # Emit confirmation...
```

#### 5. Broadcast Settings on Client Connect
**Updated:** `@sio.on('connect')` handler
- Sends current GPS failsafe mode to new clients
- Ensures frontend gets correct value from backend

---

## How It Works Now

### GPS Failsafe Mode Flow:
1. User sets GPS failsafe to "relax" in Settings
2. Frontend saves "relax" to AsyncStorage
3. Frontend emits `set_gps_failsafe_mode` to backend
4. Backend:
   - Updates `current_state.gps_failsafe_mode = "relax"`
   - **Saves "relax" to config file** ✨
   - Updates mission controller
   - Broadcasts confirmation to all clients

5. On backend restart:
   - Backend loads "relax" from config file ✨
   - Sets `current_state.gps_failsafe_mode = "relax"`

6. On frontend refresh:
   - Frontend loads "relax" from AsyncStorage
   - RoverContext receives "relax" from backend
   - **Both match!** ✅

### Obstacle Detection Flow:
Same as above - now also persisted to config file.

---

## Testing Instructions

### Test 1: GPS Failsafe Persistence
1. Open Settings
2. Set GPS Failsafe to "relax"
3. **Restart backend server** (important!)
4. Refresh frontend
5. Open Settings
6. **Expected:** GPS Failsafe shows "RELAX" ✅

### Test 2: Obstacle Detection Persistence
1. Open Settings
2. Enable Obstacle Detection
3. **Restart backend server** (important!)
4. Refresh frontend
5. Open Settings
6. **Expected:** Obstacle Detection shows "ENABLED" ✅

### Test 3: Verify Config File
After changing settings, check:
```bash
cat Backend/Backend/config/mission_controller_config.json
```

Should show:
```json
{
  "system_settings": {
    "gps_failsafe_mode": "relax",
    "obstacle_detection_enabled": true
  }
}
```

### Test 4: Backend Logs
Watch backend console when:
1. **On startup:**
   ```
   ✅ Loaded GPS failsafe mode from config: relax
   ✅ Loaded obstacle detection from config: true
   ```

2. **On setting change:**
   ```
   ✅ Saved gps_failsafe_mode = relax to config
   ```

3. **On client connect:**
   ```
   📤 Sent GPS failsafe mode to new client: relax
   ```

---

## Files Modified

### Backend:
1. `Backend/Backend/config/mission_controller_config.json`
   - Added `system_settings` section

2. `Backend/Backend/server.py`
   - Added `load_system_settings()` function
   - Added `save_system_setting()` function
   - Updated `startup()` to load settings
   - Updated `handle_set_gps_failsafe_mode()` to save setting
   - Updated `handle_set_obstacle_detection()` to save setting
   - Updated `handle_connect()` to broadcast settings

### Frontend:
No changes needed! Existing code works correctly now that backend persists settings.

---

## Benefits

✅ **GPS failsafe mode persists across backend restarts**
✅ **Obstacle detection state persists across backend restarts**
✅ **Settings saved to config file (can be version controlled)**
✅ **All clients get correct settings on connect**
✅ **No frontend changes needed**
✅ **Consistent with existing sprayer config pattern**

---

## Next Steps

1. **Test thoroughly** using instructions above
2. **Consider adding REST endpoints** for GET/SET system settings
3. **Add obstacle detection to mission controller initialization** (apply loaded setting when mission controller starts)
4. **Document system settings** in API documentation

---

**Created:** 2026-02-25
**Issue:** GPS failsafe mode not persisting ("relax" → "disable" after refresh)
**Status:** ✅ FIXED - Backend now persists settings to config file
