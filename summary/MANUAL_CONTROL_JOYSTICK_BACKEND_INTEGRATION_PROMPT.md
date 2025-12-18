# Manual Control with Joystick - Backend Integration Prompt

## Overview
This document provides a comprehensive backend integration specification for the **Manual Control with Joystick** feature in the Path Plan Screen. The mobile frontend implements dual joystick controls for tank-style rover operation with Socket.IO real-time communication.

---

## Current Frontend Implementation

### Architecture

**Component:** `src/components/pathplan/ManualControlPanel.tsx`

#### Key Features:
- **Dual Joystick Interface**: Independent left/right throttle controls using vertical gesture input
- **Multi-touch Support**: Simultaneous touch tracking for both joysticks with unique touch IDs
- **Tank-style Control**: Direct mapping of throttle values to rover motor channels (73, 74)
- **Real-time Communication**: Socket.IO events emitted at 20Hz (50ms throttle)
- **Emergency Stop**: Immediate halt with HOLD mode activation
- **Visual Feedback**: Animated joystick knobs with throttle percentage indicators

---

## Frontend Data Flow

### 1. Touch Input Processing

#### Touch Start (`handleTouchStart`)
```tsx
Input: Touch event with pageX, pageY, identifier
Process:
  - Determine if touch is within left/right joystick boundaries
  - Assign unique touch ID to each joystick
  - Record starting Y position
Output: leftTouchId, rightTouchId assigned
```

#### Touch Move (`handleTouchMove`)
```tsx
Input: Touch event with updated pageY position
Process:
  - Calculate vertical displacement from start position
  - Clamp movement to max range (70% of joystick radius)
  - Normalize to -1.0 to 1.0 range
  - Apply deadzone (10% threshold)
  - Update throttle ref values
  - Trigger socket emission (throttled at 20Hz)
Output: leftThrottle, rightThrottle (normalized -1 to 1)
```

#### Touch End (`handleTouchEnd`)
```tsx
Input: Touch release event
Process:
  - Identify which joystick was released
  - Reset throttle to 0
  - Animate knob return to center (spring animation)
  - Send final zero command
Output: Joysticks centered, throttles at 0
```

### 2. Throttle Conversion & Emission

#### Throttle Normalization
```
Raw gesture input → Vertical pixel displacement
                 ↓
Clamped to ±maxMovement (70% of joystick height)
                 ↓
Normalized: -clampedY / maxMovement ∈ [-1.0, 1.0]
                 ↓
Deadzone applied: if |value| < 0.1 → 0
                 ↓
Final normalized throttle: leftThrottle, rightThrottle ∈ [-1.0, 1.0]
```

#### PWM Calculation
```javascript
PWM = 1500 + (throttle * 500)

Range mapping:
- Throttle -1.0 (full reverse) → PWM 1000
- Throttle  0.0 (stop)        → PWM 1500
- Throttle +1.0 (full forward) → PWM 2000

Channels: 73 (left motor), 74 (right motor)
```

#### Socket.IO Payload Structure
```typescript
{
  left_throttle: number,      // -1.0 to 1.0
  right_throttle: number,     // -1.0 to 1.0
  left_pwm: number,           // 1000-2000
  right_pwm: number,          // 1000-2000
  channels: [73, 74],         // Motor channel IDs
  timestamp: string,          // ISO format
}

Example:
{
  "left_throttle": 0.75,
  "right_throttle": 0.5,
  "left_pwm": 1875,
  "right_pwm": 1750,
  "channels": [73, 74],
  "timestamp": "2025-12-16T14:30:45.123Z"
}
```

---

## Backend Integration Requirements

### 1. Socket.IO Event Handler Setup

#### Event Name: `manual_control`

**Handler Signature:**
```python
@socketio.on('manual_control')
def handle_manual_control(data):
    """
    Receives manual control commands from GCS frontend.
    
    Args:
        data (dict): Payload with throttle values and PWM commands
    
    Returns:
        None (emit acknowledgment via 'status' event if desired)
    """
```

### 2. Data Validation & Sanitization

**Required Validations:**
```python
def validate_manual_control(payload):
    """
    Validate incoming manual control payload.
    
    Checks:
    - left_throttle: float, range [-1.0, 1.0]
    - right_throttle: float, range [-1.0, 1.0]
    - left_pwm: int, range [1000, 2000]
    - right_pwm: int, range [1000, 2000]
    - channels: list of 2 integers (should be [73, 74])
    - timestamp: valid ISO format datetime
    
    Returns:
        (is_valid: bool, error_message: str or None)
    """
```

### 3. Motor Command Routing

#### Command Processing Flow
```
Socket Payload
    ↓
Validation check
    ↓
Rate limiting (max 20Hz = 50ms interval)
    ↓
Extract left_pwm & right_pwm
    ↓
MAVLink Command: DO_SET_SERVO
    ├─ Servo #73: left_pwm
    └─ Servo #74: right_pwm
    ↓
Transmit to flight controller
    ↓
Log command & response
```

#### MAVLink Integration

**Command Type:** `DO_SET_SERVO` (MAV_CMD_DO_SET_SERVO = 183)

**Servo Configuration:**
```
Servo 73: Left motor channel
  - PWM range: 1000-2000 ms
  - 1000 = full reverse
  - 1500 = stop
  - 2000 = full forward

Servo 74: Right motor channel
  - PWM range: 1000-2000 ms
  - Same mapping as Servo 73
```

**ROS2 Service Call Example:**
```python
# Pseudocode for ROS2 integration
def send_servo_command(left_pwm, right_pwm):
    """Send PWM commands to rovers via ROS2."""
    
    # Service 1: Left motor
    request_left = CommandLong.Request()
    request_left.command = 183  # DO_SET_SERVO
    request_left.param1 = 73    # Servo number
    request_left.param2 = left_pwm
    request_left.param3 = 0  # Duration (0 = indefinite)
    
    left_future = ros2_client.call_async(request_left)
    
    # Service 2: Right motor
    request_right = CommandLong.Request()
    request_right.command = 183  # DO_SET_SERVO
    request_right.param1 = 74    # Servo number
    request_right.param2 = right_pwm
    request_right.param3 = 0
    
    right_future = ros2_client.call_async(request_right)
    
    return left_future, right_future
```

### 4. State Management

#### Track Active Manual Control Sessions
```python
class ManualControlState:
    """Maintain state of active manual control session."""
    
    def __init__(self):
        self.is_active = False
        self.start_time = None
        self.last_command_time = None
        self.total_commands_sent = 0
        self.last_left_throttle = 0.0
        self.last_right_throttle = 0.0
        self.emergency_stopped = False
    
    def update_command(self, left_throttle, right_throttle):
        """Update throttle values and command count."""
        self.last_command_time = datetime.now()
        self.last_left_throttle = left_throttle
        self.last_right_throttle = right_throttle
        self.total_commands_sent += 1
```

### 5. Safety Features

#### Emergency Stop Handler
```python
@socketio.on('emergency_stop')
def handle_emergency_stop():
    """
    Immediate emergency stop - sets both throttles to 0.
    
    Actions:
    1. Send PWM 1500 (stop) to both motors
    2. Switch rover to HOLD mode
    3. Clear manual control state
    4. Notify frontend with confirmation
    """
    # Send zero throttle command
    send_servo_command(1500, 1500)
    
    # Switch mode to HOLD
    switch_rover_mode('HOLD')
    
    # Broadcast stop event
    socketio.emit('manual_control_stopped', {
        'reason': 'emergency_stop',
        'timestamp': datetime.now().isoformat()
    })
```

#### Watchdog / Timeout Protection
```python
MANUAL_CONTROL_TIMEOUT = 5.0  # seconds

def check_manual_control_timeout():
    """
    If no command received for 5 seconds while in manual mode,
    automatically issue emergency stop.
    """
    if not manual_state.is_active:
        return
    
    elapsed = (datetime.now() - manual_state.last_command_time).total_seconds()
    
    if elapsed > MANUAL_CONTROL_TIMEOUT:
        print(f"[MANUAL CONTROL] Timeout after {elapsed}s - Emergency stop")
        send_servo_command(1500, 1500)
        switch_rover_mode('HOLD')
```

### 6. Rate Limiting

**Implementation:**
```python
from time import time

EMIT_INTERVAL = 0.05  # 50ms = 20Hz

def rate_limited_manual_control(payload):
    """Only process commands at maximum 20Hz."""
    
    current_time = time()
    
    if current_time - manual_state.last_command_time < EMIT_INTERVAL:
        return  # Ignore command (too soon)
    
    # Process command
    handle_manual_control(payload)
```

### 7. Telemetry Feedback

#### Status Broadcast to Frontend
```python
@socketio.on('connect')
def on_client_connect():
    """Send current manual control state when client connects."""
    emit('manual_control_status', {
        'is_active': manual_state.is_active,
        'rover_mode': current_rover_mode,
        'battery_voltage': telemetry.battery.voltage,
        'signal_strength': telemetry.signal_strength,
        'timestamp': datetime.now().isoformat()
    })

@socketio.on('manual_control')
def on_manual_control(data):
    """Acknowledge receipt and send telemetry update."""
    
    # Process command...
    
    # Send acknowledgment with current telemetry
    emit('manual_control_ack', {
        'command_received': True,
        'left_pwm': data['left_pwm'],
        'right_pwm': data['right_pwm'],
        'rover_status': {
            'mode': telemetry.state.mode,
            'speed': telemetry.speed,
            'heading': telemetry.heading,
            'battery': telemetry.battery.voltage
        },
        'timestamp': datetime.now().isoformat()
    })
```

---

## Error Handling & Logging

### Logging Strategy

```python
import logging

logger = logging.getLogger('manual_control')

# Command receipt
logger.info(f"[MANUAL_CONTROL] Received: left={left_pwm}, right={right_pwm}")

# Validation failures
logger.warning(f"[MANUAL_CONTROL] Invalid payload: {error_message}")

# ROS2 failures
logger.error(f"[MANUAL_CONTROL] Failed to send servo command: {exception}")

# Timeout events
logger.critical(f"[MANUAL_CONTROL] Timeout - Emergency stop triggered")
```

### Error Response Payloads

```python
# Validation error
emit('manual_control_error', {
    'code': 'INVALID_PAYLOAD',
    'message': 'left_throttle out of range',
    'received': payload,
    'timestamp': datetime.now().isoformat()
})

# Connection error
emit('manual_control_error', {
    'code': 'ROVER_DISCONNECTED',
    'message': 'Cannot send command - rover not responding',
    'timestamp': datetime.now().isoformat()
})
```

---

## Integration Checklist

### Phase 1: Basic Implementation ✓
- [ ] Create Socket.IO handler for `manual_control` event
- [ ] Implement payload validation function
- [ ] Add MAVLink servo command routing
- [ ] Test PWM value range (1000-2000)
- [ ] Verify motor response on hardware

### Phase 2: Safety & State Management ✓
- [ ] Implement emergency stop handler
- [ ] Add watchdog timeout (5s)
- [ ] Create manual control state tracker
- [ ] Add rate limiting (20Hz max)
- [ ] Test emergency scenarios

### Phase 3: Feedback & Monitoring ✓
- [ ] Implement status broadcast on connect
- [ ] Add acknowledgment messages
- [ ] Create comprehensive logging
- [ ] Monitor latency/command delivery
- [ ] Add telemetry in feedback

### Phase 4: Testing & Validation ✓
- [ ] Unit test payload validation
- [ ] Integration test with actual rover
- [ ] Load test (sustained 20Hz commands)
- [ ] Failure mode testing
- [ ] Network latency testing

---

## Performance Considerations

### Bandwidth
- **Uplink:** 50-60 bytes/message × 20 Hz = ~960 bytes/sec
- **Downlink:** 150-200 bytes/ack × 20 Hz = ~3-4 KB/sec
- **Total:** ~5 KB/sec (minimal for WiFi/4G)

### Latency Requirements
- **Target:** < 200ms command-to-motor
- **Acceptable:** < 500ms
- **Critical:** Monitor and log all command times

### Safety Defaults
- **Default Mode on Disconnect:** HOLD
- **Default Throttle on Timeout:** 0 (stop)
- **Command Timeout:** 5 seconds
- **Max Emit Rate:** 20 Hz (50ms minimum between commands)

---

## Example Backend Implementation (Python/Flask-SocketIO)

```python
# Flask-SocketIO handler
from flask_socketio import emit, socketio
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class ManualControlManager:
    def __init__(self):
        self.is_active = False
        self.last_command_time = None
        self.timeout_threshold = 5.0
        
    def handle_manual_control(self, payload):
        """Main handler for manual control commands."""
        
        # 1. Validate payload
        is_valid, error = self.validate_payload(payload)
        if not is_valid:
            logger.warning(f"Invalid payload: {error}")
            emit('manual_control_error', {'message': error})
            return
        
        # 2. Rate limit check
        if not self.should_process_command():
            logger.debug("Rate limit exceeded")
            return
        
        # 3. Extract values
        left_pwm = payload['left_pwm']
        right_pwm = payload['right_pwm']
        
        # 4. Send to rover
        try:
            self.send_servo_commands(left_pwm, right_pwm)
            self.last_command_time = datetime.now()
            
            # 5. Acknowledge
            emit('manual_control_ack', {
                'success': True,
                'left_pwm': left_pwm,
                'right_pwm': right_pwm
            })
            
            logger.info(f"Manual control: L={left_pwm}, R={right_pwm}")
            
        except Exception as e:
            logger.error(f"Failed to send command: {e}")
            emit('manual_control_error', {'message': str(e)})
    
    def validate_payload(self, payload):
        """Validate incoming payload."""
        required_keys = ['left_throttle', 'right_throttle', 'left_pwm', 'right_pwm']
        
        for key in required_keys:
            if key not in payload:
                return False, f"Missing key: {key}"
        
        if not (-1.0 <= payload['left_throttle'] <= 1.0):
            return False, "left_throttle out of range"
        
        if not (-1.0 <= payload['right_throttle'] <= 1.0):
            return False, "right_throttle out of range"
        
        if not (1000 <= payload['left_pwm'] <= 2000):
            return False, "left_pwm out of range"
        
        if not (1000 <= payload['right_pwm'] <= 2000):
            return False, "right_pwm out of range"
        
        return True, None
    
    def should_process_command(self):
        """Check rate limiting."""
        if self.last_command_time is None:
            return True
        
        elapsed = (datetime.now() - self.last_command_time).total_seconds()
        return elapsed >= 0.05  # 50ms = 20Hz
    
    def send_servo_commands(self, left_pwm, right_pwm):
        """Send PWM commands to rover (ROS2 integration)."""
        # Implementation depends on your ROS2 setup
        pass

# Register handler
manager = ManualControlManager()

@socketio.on('manual_control')
def on_manual_control(data):
    manager.handle_manual_control(data)

@socketio.on('emergency_stop')
def on_emergency_stop():
    logger.critical("Emergency stop triggered")
    manager.send_servo_commands(1500, 1500)  # Stop both motors
    emit('emergency_stop_ack', {'status': 'stopped'})
```

---

## Frontend-Backend Communication Flow Diagram

```
Frontend (Mobile GCS)              Backend (ROS2/Flight Controller)
    │
    ├─ Manual Control Activated
    │  └─ Emit: 'activate_manual_mode'
    │                                    ▼
    │                            Set rover to MANUAL mode
    │◄───────────────────────────── Emit: 'mode_changed'
    │
    ├─ User moves left joystick (75% forward)
    │  └─ Emit: 'manual_control' {
    │      left_throttle: 0.75,
    │      left_pwm: 1875,
    │      right_throttle: 0,
    │      right_pwm: 1500,
    │      ...
    │    }
    │                                    ▼
    │                            Validate & process
    │                            Send to flight controller:
    │                            - Servo 73: PWM 1875
    │                            - Servo 74: PWM 1500
    │◄───────────────────────────── Emit: 'manual_control_ack'
    │
    ├─ User moves right joystick (50% forward)
    │  └─ Emit: 'manual_control' (throttle update)
    │                                    ▼
    │                            Update servo commands
    │◄───────────────────────────── Emit: 'telemetry_update'
    │
    ├─ User releases joysticks
    │  └─ Emit: 'manual_control' {left: 0, right: 0}
    │                                    ▼
    │                            Send stop command
    │◄───────────────────────────── Emit: 'manual_control_ack'
    │
    └─ User taps Emergency Stop
       └─ Emit: 'emergency_stop'
                                        ▼
                                Send immediate stop
                                Switch to HOLD mode
                        ◄────────── Emit: 'emergency_stop_ack'
```

---

## Testing Scenarios

### 1. Normal Operation
```
✓ Connect to backend
✓ Activate manual mode
✓ Send throttle command (left forward 75%)
✓ Verify rover moves forward-left
✓ Release joystick
✓ Verify rover stops
```

### 2. Emergency Stop
```
✓ Activate manual mode
✓ Send forward command
✓ Trigger emergency stop
✓ Verify immediate stop
✓ Verify mode switches to HOLD
✓ Verify frontend receives confirmation
```

### 3. Timeout Protection
```
✓ Activate manual mode
✓ Send command
✓ Wait 6 seconds without new command
✓ Verify automatic emergency stop
✓ Verify rover stopped
✓ Check logs for timeout event
```

### 4. Rate Limiting
```
✓ Send commands faster than 20Hz
✓ Verify backend only processes every 50ms
✓ Check no queue buildup
✓ Verify responsiveness maintained
```

---

## Deployment Notes

1. **Socket.IO Configuration**
   - Enable `transports: ['websocket', 'polling']` for fallback
   - Set appropriate CORS origins
   - Configure room management if multi-rover support

2. **Error Recovery**
   - Implement reconnection logic (exponential backoff)
   - Clear manual control state on disconnect
   - Auto-send stop command on connection loss

3. **Monitoring**
   - Log all manual control sessions (start/stop times)
   - Monitor command latency histogram
   - Alert on timeout events
   - Track emergency stop triggers

4. **Security Considerations**
   - Authenticate socket connections
   - Validate user authorization for manual control
   - Rate limit per user/device
   - Log all commands for audit trail

---

## References

- **Frontend Component:** [ManualControlPanel.tsx](src/components/pathplan/ManualControlPanel.tsx)
- **MAVLink Protocol:** http://mavlink.io/en/messages/common.html#DO_SET_SERVO
- **Socket.IO Documentation:** https://socket.io/docs/v4/
- **ROS2 Integration:** Standard MAVLink/ROS2 bridge patterns

---

**Version:** 1.0  
**Last Updated:** December 16, 2025  
**Status:** Ready for Backend Implementation
