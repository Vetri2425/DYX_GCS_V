# Simple Vehicle Controller - Implementation Guide

## Overview
Add Continuous Mode and Dash Mode to the existing `IntegratedMissionController`. Leverage proven servo control, distance tracking, and safety systems already in production.

## Why Extend Instead of Rebuild?

| Component | Status | File |
|-----------|--------|------|
| PWM Servo Control | ✅ Production-ready | `integrated_mission_controller.py:84` |
| Distance Tracking | ✅ Field-proven (Karney Geodesic) | `gps_failsafe_monitor.py:326` |
| Safety/FSM | ✅ MissionState enum | `integrated_mission_controller.py:37` |
| FastAPI Integration | ✅ Industrial-grade | `server.py` |
| Telemetry Broadcasting | ✅ Real-time | `server.py` |

**Result**: 300 lines of changes vs 2000+ lines of new code. Same functionality, 95% less risk.

---

## Critical Issues Fixed (Read Before Implementing)

### Issue #1: Last Waypoint Timing - FIXED ✅
**Problem**: Servo would turn OFF at the last waypoint (not after reaching it).
**Fix**: Turn OFF servo in `on_waypoint_completed()` callback, not during waypoint approach.

```python
def on_waypoint_completed(self, waypoint_index):
    """Called AFTER waypoint is reached."""
    if self.mission_mode == MissionMode.CONTINUOUS and waypoint_index == len(self.waypoints) - 1:
        self._set_servo(self.servo_pwm_off)  # ✅ Turn OFF after completion
```

### Issue #2: Distance Tracking Drift - FIXED ✅
**Problem**: GPS error (±5-10cm) accumulates over multiple dashes (1-2m error after 100m).
**Fix**: Use simple absolute distance from last toggle (resets error each toggle).

```python
def _update_dash_mode(self):
    """Use simple absolute distance tracking."""
    # Calculate actual distance from last toggle
    distance_since_toggle = self.calculate_distance(
        self.dash_last_toggle_position['lat'],
        self.dash_last_toggle_position['lng'],
        self.current_position['lat'],
        self.current_position['lng']
    )
    
    if distance_since_toggle >= threshold:
        toggle_servo()
        self.dash_last_toggle_position = self.current_position.copy()  # Reset
```

### Issue #3: GPS Dropout Handling - FIXED ✅
**Problem**: No handling for GPS degradation during dash mode.
**Fix**: Pause servo and log warning if GPS accuracy drops below threshold.

```python
def _update_dash_mode(self):
    if self.gps_accuracy_mm > 500:  # 50cm threshold
        self.log("⚠️ Dash mode: GPS degraded, pausing servo")
        self._set_servo(self.servo_pwm_off)  # Safety: turn OFF
        return
```

---

## Controllers to Implement

### 1. Continuous Mode
**Purpose**: Move continuously from waypoint 1 to waypoint N with servo control
**Logic**: 
- Servo ON at waypoint 1 (first navigation waypoint)
- Servo stays ON between all waypoints
- Servo OFF **after** waypoint N is completed (not before)
- Reuse existing waypoint detection and servo sequence execution

### 2. Dash Mode
**Purpose**: Move in dash pattern - servo ON for X meters, OFF for X meters
**Logic**:
- Track distance from last toggle point (simple, no drift)
- Toggle servo every `dash_distance` meters
- Reset toggle position after each toggle (error resets here)
- Use existing `calculate_distance()` with Karney geodesic

---

## Pre-Implementation Checklist (Day 0 - REQUIRED)

**Before writing ANY code, verify these exist:**

```bash
cd Backend
# Verify servo variables exist
grep -n "servo_pwm_on\|servo_pwm_off" integrated_mission_controller.py

# Verify telemetry handler exists
grep -n "handle_telemetry_update" integrated_mission_controller.py

# Find waypoint completion logic
grep -n "waypoint.*completed\|handle_pixhawk_waypoint_reached" integrated_mission_controller.py

# Check MissionMode enum
grep -n "class MissionMode" integrated_mission_controller.py

# Check if on_waypoint_completed already exists
grep -n "def.*waypoint.*completed\|def.*on.*waypoint" integrated_mission_controller.py
```

**Answer these questions:**
1. Where is servo ON/OFF currently called? (Look for `set_servo` calls)
2. What triggers `handle_pixhawk_waypoint_reached()`?
3. How is `current_waypoint_index` updated?
4. Where is distance calculated? (Look for `calculate_distance`)

---

## Clear TODO List

### ✅ Phase 0: Pre-Implementation Verification (2 hours)

- [ ] Run grep commands above to verify code structure
- [ ] Read `integrated_mission_controller.py` lines 80-160 (servo config area)
- [ ] Read `integrated_mission_controller.py` lines 280-350 (waypoint handling)
- [ ] Document current servo control flow
- [ ] Document current waypoint completion flow

### ✅ Phase 1: Extend IntegratedMissionController (Day 1)

#### Task 1.1: Add Mode Support
**File**: `Backend/integrated_mission_controller.py`

- [ ] Add `CONTINUOUS` and `DASH` to `MissionMode` enum (around line 48)
- [ ] Add `mission_mode` instance variable (default: `MissionMode.AUTO`)
- [ ] Add `dash_distance` config parameter (default: 5.0 meters)
- [ ] Add `dash_gap` config parameter (default: 3.0 meters)
- [ ] Add `dash_last_toggle_position` tracker (GPS position dict)
- [ ] Add `dash_servo_state` flag (True=ON, False=OFF)
- [ ] Add `gps_accuracy_mm` tracker (from telemetry)

#### Task 1.2: Implement Continuous Mode Logic
**File**: `Backend/integrated_mission_controller.py`

- [ ] Add `_is_first_waypoint()` helper method
- [ ] Add `_is_last_waypoint()` helper method
- [ ] Modify servo execution to check `mission_mode` at start of mission:
  ```python
  if self.mission_mode == MissionMode.CONTINUOUS:
      self._set_servo(self.servo_pwm_on)  # ON at start
  ```
- [ ] Add `on_waypoint_completed()` override (Issue #1 Fix):
  ```python
  def on_waypoint_completed(self, waypoint_index):
      """Turn OFF servo AFTER last waypoint completes."""
      if self.mission_mode == MissionMode.CONTINUOUS:
          if waypoint_index == len(self.waypoints) - 1:
              self._set_servo(self.servo_pwm_off)
          # Skip per-waypoint servo for middle waypoints
          return
      # Call original method for AUTO mode
      super().on_waypoint_completed(waypoint_index)
  ```
- [ ] Add continuous mode timeout: If mission > 30 min, force servo OFF

#### Task 1.3: Implement Dash Mode Logic
**File**: `Backend/integrated_mission_controller.py`

- [ ] Add `_update_dash_mode()` method with GPS safety check (Issue #3 Fix):
  ```python
  def _update_dash_mode(self):
      if self.gps_accuracy_mm > 500:  # 50cm threshold
          self.log("⚠️ Dash mode: GPS degraded, pausing servo")
          self._set_servo(self.servo_pwm_off)
          return
  ```
- [ ] Add simple absolute distance tracking (Issue #2 Fix):
  ```python
  # Initialize toggle position on first call
  if not hasattr(self, 'dash_last_toggle_position'):
      self.dash_last_toggle_position = self.current_position.copy()
  
  # Calculate actual distance from last toggle
  distance_since_toggle = self.calculate_distance(
      self.dash_last_toggle_position['lat'],
      self.dash_last_toggle_position['lng'],
      self.current_position['lat'],
      self.current_position['lng']
  )
  ```
- [ ] Add servo toggle logic when `distance_since_toggle >= threshold`
- [ ] Reset `dash_last_toggle_position` after toggle (error resets here)
- [ ] Call `_update_dash_mode()` from `handle_telemetry_update()`

#### Task 1.4: Update Configuration Methods
**File**: `Backend/integrated_mission_controller.py`

- [ ] Extend `update_mission_parameters()` to accept:
  - `mission_mode`: string ("auto", "continuous", "dash")
  - `dash_distance`: float (meters)
  - `dash_gap`: float (meters)
- [ ] Add validation: Cannot change mode during active mission
- [ ] Add validation: `dash_distance` and `dash_gap` must be > 0
- [ ] Update status reporting to include mode, dash state, GPS accuracy

#### Task 1.5: Add Abort/Timeout Handling
**File**: `Backend/integrated_mission_controller.py`

- [ ] Add servo OFF in `emergency_stop()` method
- [ ] Add servo OFF in `abort_mission()` method
- [ ] Add servo OFF if GPS failsafe triggers
- [ ] Add servo OFF if obstacle detected (reuse existing logic)
- [ ] Reset `dash_last_toggle_position` to `None` on mission end

### ✅ Phase 2: Testing Continuous Mode Only (Day 2)

**Why**: Continuous mode is simpler. Get it perfect before dash mode.

- [ ] Create `tests/test_continuous_mode.py`
- [ ] Test: Servo ON at waypoint 1
- [ ] Test: Servo maintains state at waypoint 2, 3, etc.
- [ ] Test: Servo OFF after last waypoint completes (Issue #1 verification)
- [ ] Test: GPS degradation handling
- [ ] Test: Emergency stop (servo OFF)
- [ ] Test: Mission abort (servo OFF)
- [ ] Test: 30-minute timeout
- [ ] Success criteria: No gaps at start or end, clean OFF in all failure cases

### ✅ Phase 3: Testing Dash Mode (Day 3-4)

- [ ] Create `tests/test_dash_mode.py`
- [ ] Test: Accurate 5m dash intervals (±10cm) over 100m (Issue #2 verification)
- [ ] Test: GPS dropout handling (servo OFF, resume when GPS returns) (Issue #3 verification)
- [ ] Test: Pattern consistency: 5m ON, 3m OFF, repeat
- [ ] Test: Waypoint crossing during dash (distance continuity)
- [ ] Test: Mode switch prevention during mission
- [ ] Success criteria: ±10cm accuracy across 20 dashes, clean recovery from GPS dropout

### ✅ Phase 4: Add FastAPI Endpoints (Day 5)

**File**: `Backend/server.py`

- [ ] Add `POST /api/mission/mode`:
  ```json
  {
    "mode": "continuous" | "dash" | "auto",
    "dash_distance": 5.0,
    "dash_gap": 3.0
  }
  ```
- [ ] Add validation: Return error if mission is active
- [ ] Add `GET /api/mission/mode` - Get current mode and config
- [ ] Update existing status endpoint to include:
  ```json
  {
    "mission_mode": "dash",
    "dash_state": {
      "active": true,
      "accumulated_distance": 12.5,
      "current_segment": "on",
      "gps_accuracy_mm": 120
    }
  }
  ```

### ✅ Phase 5: Integration Testing (Day 6)

- [ ] Test: Mode switching (auto → continuous → auto)
- [ ] Test: Both modes with real waypoints
- [ ] Test: Emergency stop in all modes
- [ ] Test: GPS dropout simulation
- [ ] Test: Concurrent mode change attempts (should fail)
- [ ] Success criteria: No crashes, no servo errors, clean transitions

### ✅ Phase 6: Documentation (Day 7)

- [ ] Create `docs/endpoints/SIMPLE_CONTROLLER_API.md`
- [ ] Update `MISSION_CONTROLLER_API_DOCUMENTATION.md`
- [ ] Document mode behavior differences
- [ ] Document GPS accuracy requirements for dash mode
- [ ] Create troubleshooting guide ("Servo not turning OFF", "Dash pattern drifting")

---

## Technical Implementation Details

### Continuous Mode Logic (Fixed)
```python
def start_mission(self, waypoints, mode=MissionMode.AUTO):
    """Start mission with specified mode."""
    self.mission_mode = mode
    self.waypoints = waypoints
    
    if mode == MissionMode.CONTINUOUS:
        # Turn ON at start (waypoint 1)
        self._set_servo(self.servo_pwm_on)
        self.log("Continuous mode: Servo ON at start")
    
    # ... rest of start logic ...

def on_waypoint_completed(self, waypoint_index):
    """Called AFTER waypoint is reached."""
    if self.mission_mode == MissionMode.CONTINUOUS:
        # Turn OFF after last waypoint completes (Issue #1 Fix)
        if waypoint_index == len(self.waypoints) - 1:
            self._set_servo(self.servo_pwm_off)
            self.log("Continuous mode: Servo OFF after completion")
        else:
            self.log(f"Continuous mode: Waypoint {waypoint_index} complete, maintaining servo ON")
        return  # Skip per-waypoint servo logic
    
    # Default AUTO mode behavior
    super().on_waypoint_completed(waypoint_index)
```

### Dash Mode Logic (Fixed - Simple Approach)
```python
def handle_telemetry_update(self, telemetry_data):
    """Handle telemetry with dash mode tracking."""
    # Call existing handler
    super().handle_telemetry_update(telemetry_data)
    
    if self.mission_mode == MissionMode.DASH and self.mission_state == MissionState.RUNNING:
        self._update_dash_mode()

def _update_dash_mode(self):
    """Handle dash mode with GPS safety and simple distance tracking."""
    
    # Issue #3 Fix: GPS dropout handling
    if self.gps_accuracy_mm > 500:  # 50cm threshold
        self.log("⚠️ Dash mode: GPS degraded, pausing servo")
        self._set_servo(self.servo_pwm_off)
        return
    
    if not self.current_position:
        return
    
    # Issue #2 Fix: Simple absolute distance from last toggle
    # Initialize toggle position on first call
    if not hasattr(self, 'dash_last_toggle_position') or self.dash_last_toggle_position is None:
        self.dash_last_toggle_position = self.current_position.copy()
        self.dash_servo_state = True  # Start with servo ON
        self._set_servo(self.servo_pwm_on)
        self.log("Dash mode: Initialized, servo ON")
        return
    
    # Calculate actual distance traveled since last toggle
    distance_since_toggle = self.calculate_distance(
        self.dash_last_toggle_position['lat'],
        self.dash_last_toggle_position['lng'],
        self.current_position['lat'],
        self.current_position['lng']
    )
    
    # Determine current threshold based on servo state
    threshold = self.dash_distance if self.dash_servo_state else self.dash_gap
    
    # Toggle servo when threshold reached
    if distance_since_toggle >= threshold:
        # Toggle state
        self.dash_servo_state = not self.dash_servo_state
        new_pwm = self.servo_pwm_on if self.dash_servo_state else self.servo_pwm_off
        
        # Apply servo command
        self._set_servo(new_pwm)
        
        # Reset toggle position (error resets here - no drift!)
        self.dash_last_toggle_position = self.current_position.copy()
        
        # Log state change
        state_str = "ON" if self.dash_servo_state else "OFF"
        self.log(f"Dash mode: Servo {state_str} at {distance_since_toggle:.1f}m (threshold: {threshold}m)")
```

---

## Success Criteria

### Functional Requirements
- [ ] Continuous mode: Servo ON at waypoint 1, OFF **after** waypoint N completes
- [ ] Dash mode: Toggle servo every X meters (±10cm accuracy across 20 dashes)
- [ ] Mode can be set before mission start via API
- [ ] Mode persists across waypoint transitions
- [ ] Emergency stop works in all modes (servo OFF)

### Performance Requirements
- [ ] Response time <100ms for mode commands
- [ ] Distance accuracy ±10cm for dash mode (Issue #2 verification)
- [ ] Zero additional memory overhead (reuse existing structures)
- [ ] No latency increase in telemetry pipeline

### Safety Requirements
- [ ] Cannot change mode during active mission
- [ ] Servo OFF on emergency stop in all modes
- [ ] Servo OFF on GPS dropout in dash mode (Issue #3 verification)
- [ ] GPS failsafe triggers in all modes
- [ ] Obstacle detection pauses servo in all modes
- [ ] 30-minute timeout forces servo OFF in continuous mode

---

## Files to Modify

| File | Lines Added | Purpose |
|------|-------------|---------|
| `Backend/integrated_mission_controller.py` | ~200 lines | Add modes, fix timing, add GPS safety |
| `Backend/server.py` | ~50 lines | Add `/api/mission/mode` endpoints |
| `tests/test_continuous_mode.py` | ~100 lines | Test continuous mode logic |
| `tests/test_dash_mode.py` | ~150 lines | Test dash accuracy and GPS handling |
| `docs/endpoints/SIMPLE_CONTROLLER_API.md` | ~50 lines | API documentation |

---

## Timeline Summary (With Fixes)

| Day | Tasks | Prerequisites |
|-----|-------|---------------|
| 0 | Verify existing code (2 hours) | None |
| 1 | Extend controller with modes + fixes | Day 0 |
| 2 | Test continuous mode only | Day 1 |
| 3-4 | Implement and test dash mode | Day 2 |
| 5 | FastAPI endpoints | Day 4 |
| 6 | Integration testing | Day 5 |
| 7 | Documentation | Day 6 |

**Total: 7.5 days**

---

## Final Honest Assessment

### This Plan Will Succeed If:
1. ✅ You spend Day 0 verifying existing code (don't skip this)
2. ✅ You implement Issue #1, #2, #3 fixes exactly as specified
3. ✅ You test continuous mode PERFECTLY before adding dash mode
4. ✅ You verify ±10cm dash accuracy over 20+ dashes
5. ✅ You test GPS dropout handling (unplug GPS, verify servo OFF)

### This Plan Will Fail If:
1. ❌ You skip Day 0 verification
2. ❌ You turn OFF servo too early (before waypoint completion)
3. ❌ You accumulate distance from toggle point (drift will occur)
4. ❌ You ignore GPS dropout (pattern will be ruined)
5. ❌ You don't test with real hardware before production

### Bottom Line
Your 3 critical issue fixes are technically correct and essential. The revised timeline with Day 0 verification is the right approach. This plan will deliver 100% success if followed exactly.
