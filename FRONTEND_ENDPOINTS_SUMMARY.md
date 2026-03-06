# Frontend API Endpoints & WebSocket Events Summary

**Generated:** February 24, 2025
**Location:** `src/config.ts`

---

## 📊 Total Count Summary

| Category | Count | Status |
|----------|-------|--------|
| **REST API Endpoints** | **30** | Defined in config |
| **WebSocket Events** | **11** | Defined in config |
| **WebSocket Handlers (Implementation)** | **9** | Implemented in useRoverTelemetry |
| **Total Communication Points** | **50** | Total |

---

## 🔌 REST API Endpoints (30 Total)

### Vehicle Control (2 endpoints)
1. `ARM: '/api/arm'` - Arm/disarm vehicle
2. `SET_MODE: '/api/mission/mode'` - Set flight mode

### Mission Management (13 endpoints)
1. `MISSION_UPLOAD: '/api/mission/upload'` - Upload mission to Pixhawk
2. `MISSION_LOAD: '/api/mission/load'` - **Legacy** - Load mission (backward compat)
3. `MISSION_LOAD_CONTROLLER: '/api/mission/load_controller'` - **NEW** - Recommended
4. `MISSION_DOWNLOAD: '/api/mission/download'` - Download mission from Pixhawk
5. `MISSION_CLEAR: '/api/mission/clear'` - Clear mission
6. `MISSION_START: '/api/mission/start'` - Start mission
7. `MISSION_STOP: '/api/mission/stop'` - Stop mission
8. `MISSION_NEXT: '/api/mission/next'` - Next waypoint
9. `MISSION_SKIP: '/api/mission/skip'` - Skip waypoint
10. `MISSION_PAUSE: '/api/mission/pause'` - Pause mission
11. `MISSION_RESUME: '/api/mission/resume'` - Resume mission
12. `MISSION_SET_CURRENT: '/api/mission/set_current'` - Set current waypoint
13. `MISSION_COMMAND: '/api/mission/command'` - Send mission command

### RTK/GNSS (8 endpoints)
**New Endpoints:**
1. `RTK_NTRIP_START: '/api/rtk/ntrip_start'` - Start NTRIP stream
2. `RTK_NTRIP_STOP: '/api/rtk/ntrip_stop'` - Stop NTRIP stream
3. `RTK_LORA_START: '/api/rtk/lora_start'` - Start LoRa RTK stream
4. `RTK_LORA_STOP: '/api/rtk/lora_stop'` - Stop LoRa RTK stream
5. `RTK_STOP_ALL: '/api/rtk/stop'` - Stop all RTK streams
6. `RTK_STATUS: '/api/rtk/status'` - Get RTK status

**Legacy Endpoints (Deprecated):**
7. `RTK_INJECT: '/api/rtk/inject'` - Inject RTK data (deprecated)
8. `RTK_STOP: '/api/rtk/stop'` - Stop RTK (duplicate of RTK_STOP_ALL)

### Servo Control (1 endpoint)
1. `SERVO_CONTROL: '/api/servo/control'` - Control servo

### TTS/Voice Control (5 endpoints)
1. `TTS_STATUS: '/api/tts/status'` - Get TTS status
2. `TTS_CONTROL: '/api/tts/control'` - Enable/disable TTS
3. `TTS_TEST: '/api/tts/test'` - Test TTS voice
4. `TTS_SET_LANGUAGE: '/api/tts/language'` - Set TTS language
5. `TTS_LANGUAGES: '/api/tts/languages'` - Get available languages

### Configuration (2 endpoints)
1. `MISSION_CONFIG: '/api/mission/config'` - Mission configuration
2. `SPRAYER_CONFIG: '/api/config/sprayer'` - Sprayer configuration

---

## 🔄 WebSocket Events (11 Total)

### Telemetry Events (2)
1. `TELEMETRY: 'telemetry'` - Bridge telemetry data
2. `ROVER_DATA: 'rover_data'` - Rover data stream

### Mission Events (5)
1. `MISSION_EVENT: 'mission_event'` - Mission lifecycle events
2. `MISSION_STATUS: 'mission_status'` - Mission status updates
3. `MISSION_ERROR: 'mission_error'` - Mission errors
4. `MISSION_COMMAND_ACK: 'mission_command_ack'` - Command acknowledgments
5. `MISSION_CONTROLLER_STATUS: 'mission_controller_status'` - Controller status

### Activity Logging (2)
1. `SERVER_ACTIVITY: 'server_activity'` - Server activity events
2. `MISSION_LOGS_SNAPSHOT: 'mission_logs_snapshot'` - Log snapshots

### Connection Management (2)
1. `PING: 'ping'` - Connection ping
2. `PONG: 'pong'` - Connection pong

---

## 🎯 WebSocket Handlers Implemented (9 Total)

**File:** `src/hooks/useRoverTelemetry.ts`

### Listening (Input from Backend)
1. `telemetry` - Bridge telemetry handler (line ~955)
2. `rover_data` - Rover data handler (line ~956)
3. `lora_rtk_status` - LoRa RTK status (line ~957)
4. `mission_event` - Mission event handler (line ~960)
5. `mission_logs_snapshot` - Mission logs handler (line ~965)
6. `server_activity` - Server activity handler (line ~970)
7. `mission_status` - Mission status handler (line ~982)
8. `mission_error` - Mission error handler (line ~1020)
9. `mission_command_ack` - Command ack handler (line ~1031)
10. `mission_controller_status` - Controller status (line ~1042)
11. `mission_status_subscribed` - Subscription confirmation (line ~905) ✨ NEW
12. `obstacle_detection_changed` - Obstacle detection toggle (line ~1050) ✨ NEW
13. `obstacle_error` - Obstacle detection error (line ~1062) ✨ NEW

### Emitting (Output to Backend)
1. `ping` - Connection keepalive (line ~897)
2. `subscribe_mission_status` - Subscribe to mission updates (line ~895) ✨ NEW
3. `set_obstacle_detection` - Toggle obstacle detection (via service method)
4. `start_lora_rtk_stream` - Start LoRa (legacy Socket.IO)
5. `stop_lora_rtk_stream` - Stop LoRa (legacy Socket.IO)
6. `get_lora_rtk_status` - Request LoRa status

---

## 📈 Coverage Analysis

### REST API Endpoints
| Category | Frontend Has | Backend Has | Coverage |
|----------|-------------|-------------|----------|
| Mission Management | 13 | 14 | 93% |
| RTK/GNSS | 8 | 8 | 100% |
| Vehicle Control | 2 | 2 | 100% |
| Servo Control | 1 | 5 | 20% |
| TTS/Voice | 5 | 5 | 100% |
| Configuration | 2 | 6 | 33% |
| Activity Logging | 0 | 3 | 0% |
| System Diagnostics | 0 | 5 | 0% |
| **TOTAL** | **30** | **57** | **53%** |

### WebSocket Events
| Category | Frontend Has | Backend Has | Coverage |
|----------|-------------|-------------|----------|
| Mission Status | 5 | 14 | 36% |
| Telemetry | 2 | 5 | 40% |
| Activity | 2 | 3 | 67% |
| Connection | 2 | 2 | 100% |
| Failsafe (emitting) | 0 | 3 | 0% |
| Obstacle Detection | 2 ✨ | 2 | 100% ✨ |
| Manual Control | 0 | 2 | 0% |
| RTK Events | 1 | 4 | 25% |
| **TOTAL** | **14** | **35** | **40%** |

---

## 🆕 New in Phase 1 (Just Added)

### REST API
- `MISSION_LOAD_CONTROLLER` - New recommended mission load endpoint

### Service Methods
- `updateMissionParameters()` - Configure mission parameters
- `updateObstacleZones()` - Configure obstacle detection zones
- `setObstacleDetection()` - Toggle obstacle detection

### WebSocket
- `subscribe_mission_status` emission - Subscribe to mission updates
- `mission_status_subscribed` handler - Confirm subscription
- `obstacle_detection_changed` handler - Detection state changes
- `obstacle_error` handler - Detection errors

---

## 📋 Missing (Not Implemented in Frontend)

### High Priority Missing Endpoints
1. `POST /api/mission/restart` - Restart mission
2. `GET /api/activity` - Activity logs
3. `POST /servo/emergency_stop` - Emergency stop
4. `GET /servo/status` - Servo status

### High Priority Missing WebSocket Events
1. `get_mission_status` - Request mission status
2. `failsafe_acknowledge` - Acknowledge failsafe (partial via context)
3. `failsafe_resume_mission` - Resume after failsafe (partial via context)
4. `manual_control` - Manual control commands
5. `stop_manual_control` - Stop manual control

---

## 💡 Usage in Code

### Accessing Endpoints
```typescript
import { API_ENDPOINTS } from '../config';

// Use in fetch calls
const response = await fetch(`${baseURL}${API_ENDPOINTS.MISSION_START}`, {
  method: 'POST'
});
```

### Accessing Socket Events
```typescript
import { SOCKET_EVENTS } from '../config';

// Use in socket listeners
socket.on(SOCKET_EVENTS.MISSION_STATUS, (data) => {
  console.log('Mission status:', data);
});
```

### Using Service Methods
```typescript
import { useRover } from '../context/RoverContext';

const { services } = useRover();

// Load mission with new endpoint
await services.loadMissionToController(waypoints);

// Configure parameters (NEW)
await services.updateMissionParameters({
  mission_timeout: 1800,
  accuracy_threshold_mm: 150
});

// Toggle obstacle detection (NEW)
await services.setObstacleDetection(true);
```

---

## 📊 Endpoint Usage Statistics

**Most Used Endpoints (by code references):**
1. `MISSION_LOAD_CONTROLLER` - Path planning, mission reports
2. `MISSION_START/STOP` - Mission control
3. `RTK_NTRIP_START` - RTK injection screen
4. `ARM` - Vehicle arming controls
5. `SERVO_CONTROL` - Servo testing

**Least Used Endpoints:**
1. `SPRAYER_CONFIG` - No UI for this yet
2. `MISSION_COMMAND` - Only used for bulk skip
3. Legacy RTK endpoints - Deprecated

---

## 🔗 File References

**Endpoint Definitions:**
- `src/config.ts:107-152` - All REST endpoints
- `src/config.ts:157-176` - All Socket.IO events

**Service Implementation:**
- `src/hooks/useRoverTelemetry.ts:529-577` - Service interface
- `src/hooks/useRoverTelemetry.ts:1127-1407` - Service implementation

**Socket Handlers:**
- `src/hooks/useRoverTelemetry.ts:861-1073` - All WebSocket handlers

---

## ✨ Summary

**REST API Endpoints:** 30 defined (53% of backend's 57 endpoints)
**WebSocket Events:** 11 defined (31% of backend's 35 events)
**Service Methods:** 27 implemented (including 3 new in Phase 1)
**Socket Handlers:** 13 implemented (including 3 new in Phase 1)

**Phase 1 Additions:**
- ✅ 1 new REST endpoint constant
- ✅ 3 new service methods
- ✅ 3 new WebSocket handlers
- ✅ Full mission parameter configuration support
- ✅ Complete obstacle detection integration

**Coverage Status:** Good for core operations, gaps in diagnostics and advanced features

---

Generated: February 24, 2025
