# Distance and Accuracy Calculation Fix Summary

**Date:** 2024-02-24
**Issue:** Backend was using wrong distance calculations and data fields were not properly synced between backend and frontend

---

## Problem Statement

### Issues Identified

1. **Backend `distanceToNext` field incorrect** - Using altitude instead of actual distance to next waypoint
2. **Backend `gps_failsafe_accuracy_error_mm` not synced** - Field existed but was never populated from mission controller events
3. **Inconsistent distance calculation methods** - Mission controller used Haversine, while GPS failsafe monitor used Karney geodesic
4. **Frontend using `distanceToNext` as altitude** - Frontend bug incorrectly mapped distance field to altitude display

---

## Fixes Applied

### Backend Fixes

#### 1. **Mission Controller - Distance Calculation Method**
**File:** `Backend/NRP_ROS/Backend/integrated_mission_controller.py`
**Location:** Lines 1703-1739 (`calculate_distance()` method)

**Before:**
```python
def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two GPS coordinates in meters"""
    try:
        # Haversine formula
        R = 6371000  # Earth radius in meters
        ...
```

**After:**
```python
def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two GPS coordinates in meters using Karney's geodesic formula"""
    try:
        # Use Karney geodesic formula for consistency with failsafe monitor
        if calculate_accuracy_error_mm is not None:
            from gps_failsafe_monitor import calculate_accuracy_error_mm as calc_error
            # Use Karney method from gps_failsafe_monitor
            distance_m = calc_error(lat1, lng1, lat2, lng2) / 1000.0  # Convert mm to m
            return distance_m

        # Fallback to Haversine if Karney not available
        ...
```

**Impact:**
- ✅ Consistent distance calculation across all backend components
- ✅ More accurate geodesic distance (Karney > Haversine for precision)
- ✅ Matches GPS failsafe monitor calculation method

---

#### 2. **Mission Controller - Emit Distance to Frontend**
**File:** `Backend/NRP_ROS/Backend/integrated_mission_controller.py`
**Location:** Lines 173-210 (`emit_status()` method)

**Before:**
```python
def emit_status(self, message: str, level: str, extra_data: Optional[Dict[str, Any]] = None):
    """Emit status update via callback"""
    status_data = {
        'timestamp': datetime.now().isoformat(),
        'message': message,
        'level': level,
        'mission_state': self.mission_state.value,
        'mission_mode': self.mission_mode.value,
        'current_waypoint': self.current_waypoint_index + 1 if self.waypoints else 0,
        'total_waypoints': len(self.waypoints),
        'current_position': self.current_position,
        'pixhawk_state': self.pixhawk_state
    }

    if extra_data:
        status_data.update(extra_data)
```

**After:**
```python
def emit_status(self, message: str, level: str, extra_data: Optional[Dict[str, Any]] = None):
    """Emit status update via callback"""
    status_data = {
        'timestamp': datetime.now().isoformat(),
        'message': message,
        'level': level,
        'mission_state': self.mission_state.value,
        'mission_mode': self.mission_mode.value,
        'current_waypoint': self.current_waypoint_index + 1 if self.waypoints else 0,
        'total_waypoints': len(self.waypoints),
        'current_position': self.current_position,
        'pixhawk_state': self.pixhawk_state
    }

    # Calculate distance to next waypoint for CurrentState.distanceToNext
    if (self.waypoints and self.current_waypoint_index < len(self.waypoints) and
        self.current_position and 'lat' in self.current_position and 'lng' in self.current_position):
        try:
            waypoint = self.waypoints[self.current_waypoint_index]
            current_lat = self.current_position.get('lat', 0.0)
            current_lng = self.current_position.get('lng', 0.0)

            # Only calculate if coordinates are valid (non-zero)
            if current_lat != 0.0 and current_lng != 0.0:
                distance_m = self.calculate_distance(
                    current_lat, current_lng,
                    waypoint['lat'], waypoint['lng']
                )
                status_data['distance_to_next_m'] = distance_m
        except Exception as e:
            self.log(f"Error calculating distance to next waypoint: {e}", "warning")

    if extra_data:
        status_data.update(extra_data)
```

**Impact:**
- ✅ Mission status now includes `distance_to_next_m` field
- ✅ Frontend receives real-time distance updates
- ✅ Validates coordinates before calculation (avoids 0,0 errors)

---

#### 3. **Server - Sync Distance to Current State**
**File:** `Backend/NRP_ROS/Backend/server.py`
**Location:** Lines 1340-1342 in `handle_mission_status()`

**Before:**
```python
# Sync GPS failsafe status into current_state for rover_data emissions
if 'gps_failsafe_mode' in status_data:
    current_state.gps_failsafe_mode = status_data['gps_failsafe_mode']
if 'gps_failsafe_triggered' in status_data:
    current_state.gps_failsafe_triggered = bool(status_data.get('gps_failsafe_triggered'))
if 'gps_failsafe_servo_suppressed' in status_data:
    current_state.gps_failsafe_servo_suppressed = bool(status_data.get('gps_failsafe_servo_suppressed'))
```

**After:**
```python
# Sync GPS failsafe status into current_state for rover_data emissions
if 'gps_failsafe_mode' in status_data:
    current_state.gps_failsafe_mode = status_data['gps_failsafe_mode']
if 'gps_failsafe_triggered' in status_data:
    current_state.gps_failsafe_triggered = bool(status_data.get('gps_failsafe_triggered'))
if 'gps_failsafe_servo_suppressed' in status_data:
    current_state.gps_failsafe_servo_suppressed = bool(status_data.get('gps_failsafe_servo_suppressed'))
if 'gps_failsafe_accuracy_error_mm' in status_data:
    current_state.gps_failsafe_accuracy_error_mm = float(status_data.get('gps_failsafe_accuracy_error_mm', 0.0))

# Sync distance to next waypoint from mission controller
if 'distance_to_next_m' in status_data:
    current_state.distanceToNext = float(status_data.get('distance_to_next_m', 0.0))
```

**Impact:**
- ✅ `CurrentState.distanceToNext` now populated from mission controller
- ✅ `CurrentState.gps_failsafe_accuracy_error_mm` now populated from mission events
- ✅ Data flows to frontend via `rover_data` WebSocket emissions

---

#### 4. **Server - Remove Wrong Altitude Assignment**
**File:** `Backend/NRP_ROS/Backend/server.py`
**Location:** Line 1809-1811 in `_handle_mavros_telemetry()`

**Before:**
```python
if lat is not None and lon is not None:
    with mavros_telem_lock:
        current_state.position = Position(lat=float(lat), lng=float(lon))
        current_state.last_update = time.time()
        current_state.distanceToNext = float(alt or 0.0)  # ❌ WRONG - using altitude!
        print(f"[SERVER] Updated current_state.position: lat={current_state.position.lat:.7f}, lng={current_state.position.lng:.7f}", flush=True)
    schedule_fast_emit()
```

**After:**
```python
if lat is not None and lon is not None:
    with mavros_telem_lock:
        current_state.position = Position(lat=float(lat), lng=float(lon))
        current_state.last_update = time.time()
        # Note: distanceToNext should be populated from mission controller, not altitude
        print(f"[SERVER] Updated current_state.position: lat={current_state.position.lat:.7f}, lng={current_state.position.lng:.7f}", flush=True)
    schedule_fast_emit()
```

**Impact:**
- ✅ Removed incorrect `distanceToNext = altitude` assignment
- ✅ `distanceToNext` now only populated from mission controller (correct source)

---

### Frontend Fixes

#### 1. **Fix Incorrect Use of distanceToNext as Altitude**
**File:** `src/hooks/useRoverTelemetry.ts`
**Location:** Line 236

**Before:**
```typescript
envelope.global = {
  lat: latNum,
  lon: lngNum,
  alt_rel: typeof data.distanceToNext === 'number' ? data.distanceToNext : 0, // ❌ WRONG!
  vel: typeof velCandidate === 'number' && isFinite(velCandidate) ? velCandidate : 0,
  satellites_visible: satelliteCount,
};
```

**After:**
```typescript
envelope.global = {
  lat: latNum,
  lon: lngNum,
  alt_rel: 0, // Altitude comes from data.position.altitude, not distanceToNext (which is distance to next waypoint)
  vel: typeof velCandidate === 'number' && isFinite(velCandidate) ? velCandidate : 0,
  satellites_visible: satelliteCount,
};
```

**Impact:**
- ✅ Frontend no longer uses distance as altitude
- ✅ Altitude correctly sourced from `data.position.altitude` (line 400)
- ✅ Prevents display of incorrect altitude values

---

## Data Flow After Fixes

### Distance to Next Waypoint

```
┌─────────────────────────────────────────┐
│  Mission Controller                     │
│  (integrated_mission_controller.py)    │
│                                         │
│  1. calculate_distance()                │
│     - Uses Karney geodesic formula      │
│     - Calculates rover → next waypoint  │
│                                         │
│  2. emit_status()                       │
│     - Adds 'distance_to_next_m' field   │
│     - Emitted on every status update    │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Server (server.py)                     │
│                                         │
│  handle_mission_status()                │
│  - Syncs distance_to_next_m             │
│    → current_state.distanceToNext       │
│                                         │
│  emit_rover_data_now()                  │
│  - Sends to frontend via WebSocket      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Frontend                               │
│                                         │
│  rover_data.distanceToNext (meters)     │
│  - Distance to next waypoint            │
│  - NOT altitude                         │
│                                         │
│  MissionProgressCard                    │
│  - Calculates distance independently    │
│    using Karney (client-side backup)    │
└─────────────────────────────────────────┘
```

### GPS Accuracy Error

```
┌─────────────────────────────────────────┐
│  GPS Failsafe Monitor                   │
│  (gps_failsafe_monitor.py)              │
│                                         │
│  calculate_accuracy_error_mm()          │
│  - Uses Karney geodesic formula         │
│  - Calculates target → achieved         │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Mission Controller                     │
│  (integrated_mission_controller.py)    │
│                                         │
│  waypoint_reached event:                │
│  - extra_data['accuracy_error_mm']      │
│                                         │
│  waypoint_marked event:                 │
│  - extra_data['accuracy_error_mm']      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Server (server.py)                     │
│                                         │
│  handle_mission_status()                │
│  - Syncs accuracy_error_mm              │
│    → current_state.gps_failsafe_        │
│       accuracy_error_mm                 │
│                                         │
│  Also emits waypoint events directly    │
│  to frontend with accuracy_error_mm     │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Frontend                               │
│                                         │
│  MissionReportScreen                    │
│  - Receives waypoint_reached event      │
│  - Receives waypoint_marked event       │
│  - Extracts accuracy_error_mm           │
│  - Converts to position_error_cm        │
│                                         │
│  WaypointsTable                         │
│  - Displays accuracy in Remark column   │
│  - Format: "Excellent - 25.0mm"         │
└─────────────────────────────────────────┘
```

---

## Testing Checklist

### Backend Testing
- [ ] Verify `distanceToNext` in rover_data shows distance to next waypoint (not altitude)
- [ ] Verify `gps_failsafe_accuracy_error_mm` populates during missions
- [ ] Verify `distance_to_next_m` appears in mission status emissions
- [ ] Verify distance calculations use Karney method (check logs)

### Frontend Testing
- [ ] Verify MissionProgressCard shows correct "Distance: XXX.X cm"
- [ ] Verify WaypointsTable Remark column shows "Excellent/Good/Poor - XXX.Xmm"
- [ ] Verify altitude display is NOT showing distance values
- [ ] Verify no console errors related to telemetry processing

### Integration Testing
- [ ] Run a mission and verify real-time distance updates
- [ ] Check waypoint reached events include accuracy_error_mm
- [ ] Check waypoint marked events include accuracy_error_mm
- [ ] Verify GPS failsafe triggers use correct accuracy calculations

---

## Files Modified

### Backend
1. `Backend/NRP_ROS/Backend/integrated_mission_controller.py`
   - Lines 173-210: `emit_status()` - Added distance calculation
   - Lines 1703-1739: `calculate_distance()` - Changed to Karney method

2. `Backend/NRP_ROS/Backend/server.py`
   - Lines 1334-1342: `handle_mission_status()` - Added accuracy and distance sync
   - Line 1809-1811: Removed wrong `distanceToNext = altitude` assignment

### Frontend
1. `src/hooks/useRoverTelemetry.ts`
   - Line 236: Fixed incorrect `distanceToNext` usage as altitude

---

## Rollback Instructions

If issues occur, rollback by reversing these changes:

### Backend Rollback
```bash
cd /home/flash/NRP_ROS/Backend

# Restore from backups (if created)
cp integrated_mission_controller.py.backup_distance_fix integrated_mission_controller.py
cp server.py.backup_distance_sync server.py

# Restart backend
sudo systemctl restart nrp_backend
```

### Frontend Rollback
```bash
cd /d/Final/DYX-GCS-Mobile

# Revert useRoverTelemetry.ts line 236
git diff src/hooks/useRoverTelemetry.ts
git checkout src/hooks/useRoverTelemetry.ts

# Rebuild frontend
npm run build
```

---

## Related Files (No Changes, Reference Only)

- `Backend/NRP_ROS/Backend/gps_failsafe_monitor.py` - Contains Karney implementation
- `src/components/missionreport/MissionProgressCard.tsx` - Displays distance
- `src/components/missionreport/WaypointsTable.tsx` - Displays accuracy
- `src/screens/MissionReportScreen.tsx` - Processes waypoint events
- `src/types/telemetry.ts` - Type definitions

---

## Summary

**Total Changes:**
- **Backend:** 4 fixes across 2 files
- **Frontend:** 1 fix in 1 file

**Impact:**
- ✅ Distance calculations now consistent (Karney geodesic)
- ✅ Backend data fields properly synced to frontend
- ✅ Frontend correctly interprets distance vs altitude
- ✅ Accuracy error data flows from backend to frontend
- ✅ Mission progress display more accurate

**Next Steps:**
1. Restart backend service: `sudo systemctl restart nrp_backend`
2. Rebuild frontend: `npm run build`
3. Test mission execution with real waypoints
4. Verify telemetry displays correct values
