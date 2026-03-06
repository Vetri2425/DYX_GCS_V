# ROSLIBPY_TO_RCLPY_TELEMETRY_MIGRATION_TASKS.md

## Migration Tasks for 18 Telemetry Subscriptions

**Target**: Migrate 18 telemetry subscriptions from roslibpy to rclpy in `mavros_bridge.py`
**Audience**: Backend developer with intermediate Python/ROS2 knowledge
**Pattern**: For each topic, replace 4 components: (1) variable declaration, (2) topic creation, (3) subscription call, (4) handler signature

---

## BATCH 1: CRITICAL TOPICS (3 subscriptions)
Migrate these first as they are essential for vehicle operation.

### 1. Migrate `/mavros/state` (State)

**Status**: Pending
**Priority**: HIGH

**Current roslibpy Implementation**:
```python
# Line 96: Variable declaration
self._state_topic: Optional[roslibpy.Topic] = None

# Line 775: Topic creation
self._state_topic = roslibpy.Topic(self._ros, "/mavros/state", "mavros_msgs/State")

# Line 807: Subscription
self._state_topic.subscribe(self._handle_state)

# Line 833-858: Handler signature (takes Dict[str, Any])
def _handle_state(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Line 96: Replace variable declaration
self._rclpy_state_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method (after line 656): Create subscription
self._rclpy_state_sub = self._rclpy_node.create_subscription(
    mavros_msgs.msg.State,
    "/mavros/state",
    self._handle_state,
    10
)

# Line 807: Remove roslibpy subscription call
# DELETE: self._state_topic.subscribe(self._handle_state)

# Line 833: Replace handler signature
def _handle_state(self, msg: mavros_msgs.msg.State) -> None:
    # Update all message accesses from dict.get() to direct attribute access
    # Examples:
    # message.get("connected") -> msg.connected
    # message.get("mode") -> msg.mode
    # message.get("armed") -> msg.armed
```

**Required Imports** (ensure present at top):
```python
from mavros_msgs.msg import State
```

**Handler Changes**:
Replace all `message.get("field")` with `msg.field` in `_handle_state()` body.

---

### 2. Migrate `/mavros/global_position/global_corrected` (NavSat)

**Status**: Pending
**Priority**: HIGH

**Current roslibpy Implementation**:
```python
# Line 97: Variable declaration
self._navsat_topic: Optional[roslibpy.Topic] = None

# Line 782: Topic creation
self._navsat_topic = roslibpy.Topic(self._ros, "/mavros/global_position/global_corrected", "sensor_msgs/NavSatFix")

# Line 808: Subscription
self._navsat_topic.subscribe(self._handle_navsat)

# Line 899-946: Handler signature
def _handle_navsat(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Line 97: Replace variable declaration
self._rclpy_navsat_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_navsat_sub = self._rclpy_node.create_subscription(
    sensor_msgs.msg.NavSatFix,
    "/mavros/global_position/global_corrected",
    self._handle_navsat,
    10
)

# Line 808: Remove roslibpy subscription call
# DELETE: self._navsat_topic.subscribe(self._handle_navsat)

# Line 899: Replace handler signature
def _handle_navsat(self, msg: sensor_msgs.msg.NavSatFix) -> None:
```

**Required Imports**:
```python
from sensor_msgs.msg import NavSatFix
```

**Handler Changes**:
- `message.get("latitude")` → `msg.latitude`
- `message.get("longitude")` → `msg.longitude`
- `message.get("altitude")` → `msg.altitude`
- `message.get("position_covariance", [])` → `msg.position_covariance`

---

### 3. Migrate `/mavros/gpsstatus/gps1/raw` (GPSRAW)

**Status**: Pending
**Priority**: HIGH

**Current roslibpy Implementation**:
```python
# Line 98 (variable missing, add in cleanup)
# self._gps_raw_topic: Optional[roslibpy.Topic] = None

# Line 783: Topic creation
self._gps_raw_topic = roslibpy.Topic(self._ros, "/mavros/gpsstatus/gps1/raw", "mavros_msgs/GPSRAW")

# Line 809: Subscription
self._gps_raw_topic.subscribe(self._handle_gps_raw)

# Line 861-897: Handler signature
def _handle_gps_raw(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Line 98: Add variable declaration
self._rclpy_gps_raw_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_gps_raw_sub = self._rclpy_node.create_subscription(
    mavros_msgs.msg.GPSRAW,
    "/mavros/gpsstatus/gps1/raw",
    self._handle_gps_raw,
    10
)

# Line 809: Remove roslibpy subscription call
# DELETE: self._gps_raw_topic.subscribe(self._handle_gps_raw)

# Line 861: Replace handler signature
def _handle_gps_raw(self, msg: mavros_msgs.msg.GPSRAW) -> None:
```

**Required Imports**:
```python
from mavros_msgs.msg import GPSRAW
```

**Handler Changes**:
- `message.get("fix_type", 0)` → `msg.fix_type`
- `message.get("satellites_visible", 0)` → `msg.satellites_visible`

---

## BATCH 2: NAVIGATION TOPICS (2 subscriptions)

### 4. Migrate `/mavros/gps_rtk/rtk_baseline` (RTKBaseline)

**Status**: Pending
**Priority**: MEDIUM

**Current roslibpy Implementation**:
```python
# Line 101: Variable declaration
self._rtk_baseline_topic: Optional[roslibpy.Topic] = None

# Line 785: Topic creation
self._rtk_baseline_topic = roslibpy.Topic(self._ros, "/mavros/gps_rtk/rtk_baseline", "mavros_msgs/RTKBaseline")

# Line 810: Subscription
self._rtk_baseline_topic.subscribe(self._handle_rtk_baseline)

# Line 949-989: Handler signature
def _handle_rtk_baseline(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Line 101: Replace variable declaration
self._rclpy_rtk_baseline_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_rtk_baseline_sub = self._rclpy_node.create_subscription(
    mavros_msgs.msg.RTKBaseline,
    "/mavros/gps_rtk/rtk_baseline",
    self._handle_rtk_baseline,
    10
)

# Line 810: Remove roslibpy subscription call
# DELETE: self._rtk_baseline_topic.subscribe(self._handle_rtk_baseline)

# Line 949: Replace handler signature
def _handle_rtk_baseline(self, msg: mavros_msgs.msg.RTKBaseline) -> None:
```

**Required Imports**:
```python
from mavros_msgs.msg import RTKBaseline
```

**Handler Changes**:
- `message.get("baseline_a_mm", 0)` → `msg.baseline_a_mm`
- `message.get("baseline_b_mm", 0)` → `msg.baseline_b_mm`
- `message.get("baseline_c_mm", 0)` → `msg.baseline_c_mm`
- Similar for all other fields: accuracy, iar_num_hypotheses, tow, rtk_receiver_id, rtk_health, rtk_rate, nsats

---

### 5. Migrate `/mavros/global_position/compass_hdg` (Float64 Heading)

**Status**: Pending
**Priority**: MEDIUM

**Current roslibpy Implementation**:
```python
# Line 102: Variable declaration
self._heading_topic: Optional[roslibpy.Topic] = None

# Line 786: Topic creation
self._heading_topic = roslibpy.Topic(self._ros, "/mavros/global_position/compass_hdg", "std_msgs/Float64")

# Line 811: Subscription
self._heading_topic.subscribe(self._handle_heading)

# Line 991-995: Handler signature
def _handle_heading(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Line 102: Replace variable declaration
self._rclpy_heading_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_heading_sub = self._rclpy_node.create_subscription(
    std_msgs.msg.Float64,
    "/mavros/global_position/compass_hdg",
    self._handle_heading,
    10
)

# Line 811: Remove roslibpy subscription call
# DELETE: self._heading_topic.subscribe(self._handle_heading)

# Line 991: Replace handler signature
def _handle_heading(self, msg: std_msgs.msg.Float64) -> None:
```

**Required Imports**:
```python
from std_msgs.msg import Float64
```

**Handler Changes**:
- `message.get("data", 0.0)` → `msg.data`

---

## BATCH 3: SENSOR TOPICS (3 subscriptions)

### 6. Migrate `/mavros/estimator_status` (EstimatorStatus)

**Status**: Pending
**Priority**: MEDIUM

**Current roslibpy Implementation**:
```python
# Line 100: Variable declaration
self._estimator_topic: Optional[roslibpy.Topic] = None

# Line 788: Topic creation
self._estimator_topic = roslibpy.Topic(self._ros, "/mavros/estimator_status", "mavros_msgs/EstimatorStatus")

# Line 814: Subscription (wrapped in try/except)
try:
    self._estimator_topic.subscribe(self._handle_estimator_status)
except Exception:
    pass

# Line 1024-1055: Handler signature
def _handle_estimator_status(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Line 100: Replace variable declaration
self._rclpy_estimator_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
try:
    self._rclpy_estimator_sub = self._rclpy_node.create_subscription(
        mavros_msgs.msg.EstimatorStatus,
        "/mavros/estimator_status",
        self._handle_estimator_status,
        10
    )
except Exception as e:
    print(f"[MAVROS_BRIDGE] Failed to create estimator subscription: {e}", flush=True)

# Line 814-817: Remove roslibpy subscription call
# DELETE: try/except block for estimator subscription

# Line 1024: Replace handler signature
def _handle_estimator_status(self, msg: mavros_msgs.msg.EstimatorStatus) -> None:
```

**Required Imports**:
```python
from mavros_msgs.msg import EstimatorStatus
```

**Handler Changes**:
Update dict access patterns for:
- `'aligned' in message` → `hasattr(msg, 'aligned')`
- `message.get('aligned')` → `msg.aligned`
- `message.get('attitude_aligned')` → `msg.attitude_aligned`
- Similar for all other dict operations in handler

---

### 7. Migrate `/mavros/imu/data` (Imu)

**Status**: Pending
**Priority**: MEDIUM

**Current roslibpy Implementation**:
```python
# Line 100: Variable declaration
self._imu_topic: Optional[roslibpy.Topic] = None

# Line 789: Topic creation
self._imu_topic = roslibpy.Topic(self._ros, "/mavros/imu/data", "sensor_msgs/Imu")

# Line 819: Subscription (wrapped in try/except)
try:
    self._imu_topic.subscribe(self._handle_imu_data)
except Exception:
    pass

# Line 1057-1079: Handler signature
def _handle_imu_data(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Line 100: Replace variable declaration
self._rclpy_imu_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
try:
    self._rclpy_imu_sub = self._rclpy_node.create_subscription(
        sensor_msgs.msg.Imu,
        "/mavros/imu/data",
        self._handle_imu_data,
        10
    )
except Exception as e:
    print(f"[MAVROS_BRIDGE] Failed to create IMU subscription: {e}", flush=True)

# Line 819-821: Remove roslibpy subscription call
# DELETE: try/except block for IMU subscription

# Line 1057: Replace handler signature
def _handle_imu_data(self, msg: sensor_msgs.msg.Imu) -> None:
```

**Required Imports**:
```python
from sensor_msgs.msg import Imu
```

**Handler Changes**:
- `message.get('orientation')` → `msg.orientation`
- `message.get('angular_velocity')` → `msg.angular_velocity`
- `message.get('linear_acceleration')` → `msg.linear_acceleration`

Note: msg.orientation, msg.angular_velocity, msg.linear_acceleration are already objects (Quaternion, Vector3), so handler can simplify dict nesting.

---

### 8. Migrate `/mavros/global_position/raw/gps_vel` (Velocity)

**Status**: Pending
**Priority**: MEDIUM

**Current roslibpy Implementation**:
```python
# Line 790: Topic creation (no variable declaration found - add in cleanup)
self._velocity_topic = roslibpy.Topic(self._ros, "/mavros/global_position/raw/gps_vel", "geometry_msgs/TwistStamped")

# Line 822: Subscription
self._velocity_topic.subscribe(self._handle_velocity)

# Line 1088-1094: Handler signature
def _handle_velocity(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Find variable declaration section (after line 108): Add
self._rclpy_velocity_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_velocity_sub = self._rclpy_node.create_subscription(
    geometry_msgs.msg.TwistStamped,
    "/mavros/global_position/raw/gps_vel",
    self._handle_velocity,
    10
)

# Line 822: Remove roslibpy subscription call
# DELETE: self._velocity_topic.subscribe(self._handle_velocity)

# Line 1088: Replace handler signature
def _handle_velocity(self, msg: geometry_msgs.msg.TwistStamped) -> None:
```

**Required Imports**:
```python
from geometry_msgs.msg import TwistStamped
```

**Handler Changes**:
- `message.get("twist", {})` → `msg.twist`
- `twist.get("linear", {})` → `msg.twist.linear`
- `linear.get("x", 0.0)` → `msg.twist.linear.x`
- `linear.get("y", 0.0)` → `msg.twist.linear.y`

---

## BATCH 4: MONITORING TOPICS (4 subscriptions)

### 9. Migrate `/mavros/battery` (BatteryState)

**Status**: Pending
**Priority**: LOW

**Current roslibpy Implementation**:
```python
# Line 103: Variable declaration
self._battery_topic: Optional[roslibpy.Topic] = None

# Line 793: Topic creation
self._battery_topic = roslibpy.Topic(self._ros, "/mavros/battery", "sensor_msgs/BatteryState")

# Line 823: Subscription
self._battery_topic.subscribe(self._handle_battery)

# Line 997-1022: Handler signature
def _handle_battery(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Line 103: Replace variable declaration
self._rclpy_battery_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_battery_sub = self._rclpy_node.create_subscription(
    sensor_msgs.msg.BatteryState,
    "/mavros/battery",
    self._handle_battery,
    10
)

# Line 823: Remove roslibpy subscription call
# DELETE: self._battery_topic.subscribe(self._handle_battery)

# Line 997: Replace handler signature
def _handle_battery(self, msg: sensor_msgs.msg.BatteryState) -> None:
```

**Required Imports**:
```python
from sensor_msgs.msg import BatteryState
```

**Handler Changes**:
- `message.get("percentage", None)` → `msg.percentage`
- `message.get("voltage", None)` → `msg.voltage`
- `message.get("current", None)` → `msg.current`

---

### 10. Migrate `/mavros/sys_status` (SysStatus)

**Status**: Pending
**Priority**: LOW

**Current roslibpy Implementation**:
```python
# Line 794: Topic creation
self._sys_status_topic = roslibpy.Topic(self._ros, "/mavros/sys_status", "mavros_msgs/SysStatus")

# Line 824: Subscription
self._sys_status_topic.subscribe(self._handle_sys_status)

# Line 1081-1086: Handler signature
def _handle_sys_status(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Find variable declaration section: Add
self._rclpy_sys_status_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_sys_status_sub = self._rclpy_node.create_subscription(
    mavros_msgs.msg.SysStatus,
    "/mavros/sys_status",
    self._handle_sys_status,
    10
)

# Line 824: Remove roslibpy subscription call
# DELETE: self._sys_status_topic.subscribe(self._handle_sys_status)

# Line 1081: Replace handler signature
def _handle_sys_status(self, msg: mavros_msgs.msg.SysStatus) -> None:
```

**Required Imports**:
```python
from mavros_msgs.msg import SysStatus
```

**Handler Changes**:
- `message.get("load", 0.0)` → `msg.load`
- `message.get("drop_rate_comm", 0.0)` → `msg.drop_rate_comm`

---

### 11. Migrate `/mavros/rc/in` (RCIn)

**Status**: Pending
**Priority**: LOW

**Current roslibpy Implementation**:
```python
# Line 797: Topic creation
self._rc_topic = roslibpy.Topic(self._ros, "/mavros/rc/in", "mavros_msgs/RCIn")

# Line 825: Subscription
self._rc_topic.subscribe(self._handle_rc)

# Line 1096-1101: Handler signature
def _handle_rc(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Find variable declaration section: Add
self._rclpy_rc_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_rc_sub = self._rclpy_node.create_subscription(
    mavros_msgs.msg.RCIn,
    "/mavros/rc/in",
    self._handle_rc,
    10
)

# Line 825: Remove roslibpy subscription call
# DELETE: self._rc_topic.subscribe(self._handle_rc)

# Line 1096: Replace handler signature
def _handle_rc(self, msg: mavros_msgs.msg.RCIn) -> None:
```

**Required Imports**:
```python
from mavros_msgs.msg import RCIn
```

**Handler Changes**:
- `message.get("channels", [])` → `msg.channels`

---

### 12. Migrate `/mavros/radio_status` (RadioStatus)

**Status**: Pending
**Priority**: LOW

**Current roslibpy Implementation**:
```python
# Line 798: Topic creation
self._signal_topic = roslibpy.Topic(self._ros, "/mavros/radio_status", "mavros_msgs/RadioStatus")

# Line 826: Subscription
self._signal_topic.subscribe(self._handle_signal)

# Line 1103-1118: Handler signature
def _handle_signal(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Find variable declaration section: Add
self._rclpy_signal_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_signal_sub = self._rclpy_node.create_subscription(
    mavros_msgs.msg.RadioStatus,
    "/mavros/radio_status",
    self._handle_signal,
    10
)

# Line 826: Remove roslibpy subscription call
# DELETE: self._signal_topic.subscribe(self._handle_signal)

# Line 1103: Replace handler signature
def _handle_signal(self, msg: mavros_msgs.msg.RadioStatus) -> None:
```

**Required Imports**:
```python
from mavros_msgs.msg import RadioStatus
```

**Handler Changes**:
- `message.get("rssi", 0)` → `msg.rssi`

---

## BATCH 5: MISSION & OUTPUT TOPICS (2 subscriptions)

### 13. Migrate `/mavros/mission/waypoints` (WaypointList)

**Status**: Pending
**Priority**: MEDIUM

**Current roslibpy Implementation**:
```python
# Line 104: Variable declaration
self._mission_topic: Optional[roslibpy.Topic] = None

# Line 801: Topic creation
self._mission_topic = roslibpy.Topic(self._ros, "/mavros/mission/waypoints", "mavros_msgs/WaypointList")

# Line 827: Subscription
self._mission_topic.subscribe(self._handle_waypoint_list)

# Line 1120-1137: Handler signature
def _handle_waypoint_list(self, message: Dict[str, Any]) -> None:
```

**Target rclpy Implementation**:
```python
# Line 104: Replace variable declaration
self._rclpy_mission_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_mission_sub = self._rclpy_node.create_subscription(
    mavros_msgs.msg.WaypointList,
    "/mavros/mission/waypoints",
    self._handle_waypoint_list,
    10
)

# Line 827: Remove roslibpy subscription call
# DELETE: self._mission_topic.subscribe(self._handle_waypoint_list)

# Line 1120: Replace handler signature
def _handle_waypoint_list(self, msg: mavros_msgs.msg.WaypointList) -> None:
```

**Required Imports**:
```python
from mavros_msgs.msg import WaypointList
```

**Handler Changes**:
- `message.get("waypoints", [])` → `msg.waypoints` (this will be a list of Waypoint objects)
- `message.get("current_seq")` → `msg.current_seq`

Note: msg.waypoints is already a list of Waypoint message objects, not dicts. The handler may need adjustment to handle Waypoint objects directly.

---

### 14. Migrate `/mavros/rc/out` (Servo/PWM Output)

**Status**: Pending
**Priority**: MEDIUM

**Current roslibpy Implementation**:
```python
# Line 804: Topic creation
self._rc_out_topic = roslibpy.Topic(self._ros, "/mavros/rc/out", "mavros_msgs/RCOut")

# Line 829: Subscription
self._rc_out_topic.subscribe(self._handle_servo_output)

# Handler: _handle_servo_output (not shown in current output, likely follows same pattern)
```

**Target rclpy Implementation**:
```python
# Find variable declaration section: Add
self._rclpy_rc_out_sub: Optional[rclpy.subscription.Subscription] = None

# In _init_rclpy() method: Create subscription
self._rclpy_rc_out_sub = self._rclpy_node.create_subscription(
    mavros_msgs.msg.RCOut,
    "/mavros/rc/out",
    self._handle_servo_output,
    10
)

# Line 829: Remove roslibpy subscription call
# DELETE: self._rc_out_topic.subscribe(self._handle_servo_output)

# Find handler definition: Replace signature
def _handle_servo_output(self, msg: mavros_msgs.msg.RCOut) -> None:
```

**Required Imports**:
```python
from mavros_msgs.msg import RCOut
```

**Handler Changes**:
Locate handler and replace all dict get operations with direct attribute access.

---

## BATCH 6: ALREADY MIGRATED (1 subscription)

### 15. `/mavros/mission/reached` (WaypointReached) - ALREADY RCLPY

**Status**: COMPLETED
**Priority**: N/A

**Current Implementation**:
```python
# Line 105: Variable declaration
self._rclpy_mission_reached_sub: Optional[rclpy.subscription.Subscription] = None

# Line 644-645: Already created in _init_rclpy()
self._rclpy_mission_reached_sub = self._rclpy_node.create_subscription(
    WaypointReached, "/mavros/mission/reached", self._handle_waypoint_reached_rclpy, 10)

# Line 1150-1158: Handler already has correct signature
def _handle_waypoint_reached_rclpy(self, msg: WaypointReached) -> None:
```

**Action Required**: None - this topic is already migrated to rclpy.

---

## BATCH 7: PUBLISHING TOPICLES (3 topics to document)

### 16. `/mavros/setpoint_raw/global` (GlobalPositionTarget Publisher)

**Status**: N/A (Publisher, not subscription)
**Priority**: N/A

**Current Implementation**: Uses roslibpy publisher in `send_global_position_target()` method (lines 318-334).
This is a **publisher**, not a subscription. Migration out of scope for this task list.

---

### 17. `/mavros/rc/override` (OverrideRCIn Publisher)

**Status**: N/A (Publisher, not subscription)
**Priority**: N/A

**Current Implementation**: Uses roslibpy publisher in `send_rc_override()` and `clear_rc_override()` methods (lines 577-605).
This is a **publisher**, not a subscription. Migration out of scope for this task list.

---

### 18. `/mavros/gps_rtk/send_rtcm` (RTCM Publisher)

**Status**: N/A (Publisher, not subscription)
**Priority**: N/A

**Current Implementation**: Uses roslibpy publisher in `send_rtcm()` method (lines 607-618).
This is a **publisher**, not a subscription. Migration out of scope for this task list.

---

## CLEANUP TASKS (After Migration)

### Cleanup 1: Remove Unnecessary roslibpy Variable Declarations

**Status**: Pending
**Priority**: LOW

Remove old roslibpy topic variable declarations from `__init__`:
```python
# DELETE these lines (96-108):
self._state_topic: Optional[roslibpy.Topic] = None
self._navsat_topic: Optional[roslibpy.Topic] = None
self._gps_fix_topic: Optional[roslibpy.Topic] = None  # if exists
self._estimator_topic: Optional[roslibpy.Topic] = None
self._imu_topic: Optional[roslibpy.Topic] = None
self._rtk_baseline_topic: Optional[roslibpy.Topic] = None
self._heading_topic: Optional[roslibpy.Topic] = None
self._battery_topic: Optional[roslibpy.Topic] = None
self._mission_topic: Optional[roslibpy.Topic] = None
self._rc_out_topic: Optional[roslibpy.Topic] = None
self._rc_override_topic: Optional[roslibpy.Topic] = None
# Also add if missing:
# self._velocity_topic, self._sys_status_topic, self._rc_topic, self._signal_topic
```

---

### Cleanup 2: Add Cleanup to `_shutdown_rclpy()`

**Status**: Pending
**Priority**: HIGH

**Current** (lines 686-696):
```python
def _shutdown_rclpy(self) -> None:
    """Shutdown the rclpy node cleanly."""
    try:
        if self._rclpy_node is not None:
            if self._rclpy_mission_reached_sub is not None:
                self._rclpy_node.destroy_subscription(self._rclpy_mission_reached_sub)
            self._rclpy_node.destroy_node()
            self._rclpy_node = None
        self._rclpy_ready = False
    except Exception:
        pass
```

**Target** (add cleanup for all migrated subscriptions):
```python
def _shutdown_rclpy(self) -> None:
    """Shutdown the rclpy node cleanly."""
    try:
        if self._rclpy_node is not None:
            # Destroy all subscriptions
            for sub in [
                self._rclpy_mission_reached_sub,
                self._rclpy_state_sub,
                self._rclpy_navsat_sub,
                self._rclpy_gps_raw_sub,
                self._rclpy_rtk_baseline_sub,
                self._rclpy_heading_sub,
                self._rclpy_estimator_sub,
                self._rclpy_imu_sub,
                self._rclpy_velocity_sub,
                self._rclpy_battery_sub,
                self._rclpy_sys_status_sub,
                self._rclpy_rc_sub,
                self._rclpy_signal_sub,
                self._rclpy_mission_sub,
                self._rclpy_rc_out_sub,
            ]:
                if sub is not None:
                    self._rclpy_node.destroy_subscription(sub)
            self._rclpy_node.destroy_node()
            self._rclpy_node = None
        self._rclpy_ready = False
    except Exception:
        pass
```

---

### Cleanup 3: Remove roslibpy Topic Creations from `_setup_subscriptions()`

**Status**: Pending
**Priority**: LOW

Remove all roslibpy Topic() instantiation lines from `_setup_subscriptions()` (lines 772-809).

---

### Cleanup 4: Add All Message Imports to File Header

**Status**: Pending
**Priority**: HIGH

Ensure all required message imports are present at top of file (around line 34). Add any missing:
```python
from mavros_msgs.msg import (
    Waypoint,
    WaypointReached,
    WaypointList,
    State,
    GPSRAW,
    RTKBaseline,
    EstimatorStatus,
    SysStatus,
    RCIn,
    RCOut,
    RadioStatus,
)
from sensor_msgs.msg import (
    BatteryState,
    Imu,
    NavSatFix,
)
from std_msgs.msg import Float64
from geometry_msgs.msg import TwistStamped
```

---

## TESTING PROCEDURES

### Test 1: Verify Each Migrated Subscription

For each migrated topic:
1. Start vehicle and MAVROS
2. Verify topic is publishing: `ros2 topic list | grep /mavros/state` (replace with topic name)
3. Check subscription is receiving data: `ros2 topic echo /mavros/state --once`
4. Verify handler is called (add debug print to handler)
5. Verify telemetry is broadcast to callbacks (check telemetry output)

### Test 2: Regression Testing

1. Run existing test suite: `cd tests && python -m pytest`
2. Verify all vehicle operations still work:
   - Connect/disconnect
   - Arm/disarm
   - Mode changes
   - Waypoint operations
   - All telemetry streams

### Test 3: Performance Testing

Compare rclpy vs roslibpy:
1. Measure subscription latency (time from publish to handler callback)
2. Measure telemetry update rate
3. Verify rclpy is indeed faster for critical topics

---

## MIGRATION ORDER SUMMARY

1. **BATCH 1 (Critical)**: Tasks 1-3 (state, navsat, gps_raw)
2. **BATCH 2 (Navigation)**: Tasks 4-5 (rtk_baseline, heading)
3. **BATCH 3 (Sensors)**: Tasks 6-8 (estimator, imu, velocity)
4. **BATCH 4 (Monitoring)**: Tasks 9-12 (battery, sys_status, rc, signal)
5. **BATCH 5 (Mission)**: Tasks 13-14 (waypoints, rc_out)
6. **CLEANUP**: Cleanup tasks 1-4
7. **TESTING**: Test procedures above

---

## NOTES

- Task 15 is already completed (WaypointReached via rclpy)
- Tasks 16-18 are publishers, not subscriptions - out of scope for this migration
- All handler signatures must change from `Dict[str, Any]` to appropriate message type
- All `message.get("field")` must change to `msg.field` or `msg.field_name`
- The `_init_rclpy()` method should contain ALL rclpy subscription creations
- The `_shutdown_rclpy()` method must cleanup ALL subscriptions
- Keep try/except around optional subscriptions (estimator, imu) to avoid failures on systems that don't publish them

