# Mission Status Button Bug Analysis

## Problem Summary
During mission execution, the START/STOP button in MissionControlCard incorrectly changes from "STOP" back to "START" even though the mission is still running. This happens because the backend sends `status="active"` instead of `mission_state="running"`.

## Root Cause
The backend's `get_rover_data()` function in `Backend/Backend/server.py` does **NOT** include the mission controller status in the telemetry payload.

### Current Code Structure:
```python
def get_rover_data():
    """Return complete rover data structure with all required fields."""
    data = current_state.to_dict()

    # Add network telemetry
    data['network'] = network_monitor.get_network_data()

    # Add manual control status
    data['manual_control'] = manual_control_handler.get_status()

    # ❌ MISSING: Mission controller status is NOT included here!

    return data
```

### Frontend Expectation:
The frontend's `MissionControlCard.tsx` (line 94) expects:
```typescript
const backendMissionStatus = telemetry?.mission?.status?.toString().toLowerCase() || 'idle';
const isBackendRunning = backendMissionStatus === 'running';
```

### The Disconnect:
1. **Backend** sends mission status via separate WebSocket events (`mission_status`)
2. **Frontend** tries to read mission status from `telemetry.mission.status` (which comes from `rover_data`)
3. Since `rover_data` doesn't include mission status, `telemetry.mission.status` is undefined or stale
4. The button state sync logic sees no status and resets to "START"

## Log Evidence
From your logs:
```
LOG  [MissionControlCard] 🔴 Backend status="active" (not running) but local state is true - syncing to START button
LOG  [MISSION_STATUS] Backend event: {"event_type": "waypoint_reached", "mission_state": "running"}
```

The mission state is "running" in the backend events, but the telemetry.mission.status field is showing "active" or undefined.

## Solution

Add mission controller status to `get_rover_data()` in `Backend/Backend/server.py`:

```python
def get_rover_data():
    """Return complete rover data structure with all required fields."""
    # ... existing code ...

    data = current_state.to_dict()

    # Add network telemetry
    try:
        network_data = network_monitor.get_network_data()
        data['network'] = network_data
    except Exception as e:
        # ... error handling ...

    # Add manual control status
    if manual_control_handler:
        data['manual_control'] = manual_control_handler.get_status()
    else:
        data['manual_control'] = {'active': False}

    # ✅ ADD THIS: Include mission controller status
    global mission_controller
    if mission_controller:
        try:
            mission_status = mission_controller.get_status()
            # Extract key fields for telemetry
            data['mission'] = {
                'status': mission_status.get('mission_state', 'idle').upper(),  # 'IDLE', 'RUNNING', 'PAUSED', etc.
                'current_wp': mission_status.get('current_waypoint', 0),
                'total_wp': mission_status.get('total_waypoints', 0),
                'progress_pct': (mission_status.get('current_waypoint', 0) / max(1, mission_status.get('total_waypoints', 1))) * 100.0
            }
        except Exception as e:
            print(f"[WARN] Failed to get mission status: {e}", flush=True)
            data['mission'] = {'status': 'IDLE', 'current_wp': 0, 'total_wp': 0, 'progress_pct': 0.0}
    else:
        data['mission'] = {'status': 'IDLE', 'current_wp': 0, 'total_wp': 0, 'progress_pct': 0.0}

    return data
```

## Expected Result
After this fix:
- `telemetry.mission.status` will correctly show "RUNNING" when mission is active
- `telemetry.mission.status` will show "PAUSED" when paused
- `telemetry.mission.status` will show "IDLE" when not running
- The START/STOP button will remain in the correct state throughout mission execution

## Files to Modify
- **Backend/Backend/server.py** - Line ~1605 in `get_rover_data()` function

## Testing
1. Load a mission with waypoints
2. Start the mission
3. Watch the button - it should stay as "STOP" throughout execution
4. Check logs - should no longer see "syncing to START button" during active mission
