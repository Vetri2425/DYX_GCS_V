
# Frontend-Backend Communication Analysis

## Key Files for Understanding REST API & WebSocket Communication

### 1. **Configuration & Endpoints** ([`src/config.ts`](src/config.ts))
- **Lines 107-165**: [`API_ENDPOINTS`](src/config.ts:107) - All REST API endpoint paths
  - Mission control: `/api/mission/*`
  - RTK operations: `/api/rtk/*`
  - Vehicle control: `/api/arm`, `/api/mission/mode`
  - Activity logs: `/api/activity/*`
  - TTS control: `/api/tts/*`
  - Servo control: `/api/servo/*`

- **Lines 170-189**: [`SOCKET_EVENTS`](src/config.ts:170) - WebSocket event names
  - `telemetry` - Real-time rover data
  - `rover_data` - Alternative telemetry stream
  - `mission_event`, `mission_status`, `mission_error` - Mission updates
  - `server_activity` - Activity logs
  - `lora_rtk_status` - LoRa RTK status updates

- **Lines 19-29**: Dynamic backend URL configuration with fallback support

### Quantitative Analysis of Communication Channels

Based on analysis of `src/config.ts`:

#### REST API Endpoints
**Total: 40 endpoint constants** defined in `API_ENDPOINTS` object (lines 107-165)

**Breakdown by category:**
- Vehicle control: 2 endpoints
- Mission management: 17 endpoints
- RTK (Real-Time Kinematics): 7 endpoints (4 new + 3 legacy)
- Servo control: 3 endpoints
- Activity logging: 3 endpoints
- System monitoring: 2 endpoints
- TTS (Text-to-Speech): 5 endpoints
- Configuration: 2 endpoints

**Note:** Some constants map to the same path (e.g., `RTK_STOP_ALL` and `RTK_STOP` both point to `/api/rtk/stop`).

#### Socket.IO Events
**Total: 11 event names** defined in `SOCKET_EVENTS` object (lines 170-189)

**Event list:**
1. `TELEMETRY` - Server → Client
2. `ROVER_DATA` - Server → Client
3. `MISSION_EVENT` - Server → Client
4. `MISSION_STATUS` - Server → Client
5. `MISSION_ERROR` - Server → Client
6. `MISSION_COMMAND_ACK` - Server → Client (acknowledgement)
7. `MISSION_CONTROLLER_STATUS` - Server → Client
8. `SERVER_ACTIVITY` - Server → Client
9. `MISSION_LOGS_SNAPSHOT` - Server → Client
10. `PING` - Bidirectional (heartbeat)
11. `PONG` - Bidirectional (heartbeat response)

#### Direction Analysis

**REST API (40 endpoints):** All are **input** - client sends HTTP requests to server

**Socket.IO Events (11 events):**
- **9 primarily server-to-client** (data streaming, status updates)
- **2 bidirectional** (`PING`/`PONG` for connection maintenance)

**Total input channels:** 40 REST endpoints + 2 bidirectional socket events = **42**

**Total output channels:** 9 socket events + 2 bidirectional = **11**

The architecture follows a typical request-response pattern for control commands (REST) with real-time data pushed from server to client via WebSocket.

### 2. **Core Communication Hook** ([`src/hooks/useRoverTelemetry.ts`](src/hooks/useRoverTelemetry.ts))

#### WebSocket Connection (Lines 1027-1150)
- **Line 1048**: Socket.IO connection initialization with [`SOCKET_CONFIG`](src/config.ts:88)
- **Lines 1051-1064**: Connection event handlers (`connect`, `pong`)
- **Lines 1061-1062**: Mission status subscription on connect
- **Lines 1075-1100**: Error handling (`connect_error`, `disconnect`)
- **Lines 1102-1150**: Event listeners for telemetry streams

#### REST API Service Methods (Lines 1200-1700)
- **Lines 1400-1450**: Mission control APIs
  - [`uploadMission()`](src/hooks/useRoverTelemetry.ts:1400) - POST to `/api/mission/upload`
  - [`loadMissionToController()`](src/hooks/useRoverTelemetry.ts:1410) - POST to `/api/mission/load_controller`
  - [`startMission()`](src/hooks/useRoverTelemetry.ts:1420) - POST to `/api/mission/start`
  - [`pauseMission()`](src/hooks/useRoverTelemetry.ts:1430) - POST to `/api/mission/pause`
  - [`stopMission()`](src/hooks/useRoverTelemetry.ts:1440) - POST to `/api/mission/stop`

- **Lines 1517-1575**: RTK control APIs
  - [`startNTRIPStream()`](src/hooks/useRoverTelemetry.ts:1517) - POST to `/api/rtk/ntrip_start`
  - [`stopNTRIPStream()`](src/hooks/useRoverTelemetry.ts:1529) - POST to `/api/rtk/ntrip_stop`
  - [`startLoRaStream()`](src/hooks/useRoverTelemetry.ts:1541) - POST to `/api/rtk/lora_start`
  - [`getRTKStatus()`](src/hooks/useRoverTelemetry.ts:1514) - GET from `/api/rtk/status`

- **Lines 1578-1600**: Legacy LoRa Socket.IO methods
  - Emits `start_lora_rtk_stream` event
  - Listens for `lora_rtk_status` events

#### Telemetry Data Parsing (Lines 180-520)
- **Lines 195-209**: Vehicle state parsing (armed, mode, system_status)
- **Lines 212-242**: GPS position parsing (lat, lon, satellites)
- **Lines 244-252**: Battery data parsing
- **Lines 269-296**: RTK status parsing (fix_type, baseline_age)
- **Lines 298-350**: Mission progress parsing (waypoints, status)
- **Lines 500-519**: GPS failsafe data parsing

### 3. **Context Provider** ([`src/context/RoverContext.ts`](src/context/RoverContext.ts))
- **Lines 54-55**: Wraps [`useRoverTelemetry`](src/hooks/useRoverTelemetry.ts) hook
- **Lines 79-84**: Syncs GPS failsafe status from telemetry
- **Lines 137-147**: WebSocket event emission for failsafe control
  - `set_gps_failsafe_mode` event
  - `failsafe_acknowledge` event

### 4. **Type Definitions**

#### Telemetry Types ([`src/types/telemetry.ts`](src/types/telemetry.ts))
- **Lines 7-12**: [`TelemetryState`](src/types/telemetry.ts:7) - Vehicle state
- **Lines 14-21**: [`TelemetryGlobal`](src/types/telemetry.ts:14) - GPS position
- **Lines 31-35**: [`TelemetryRtk`](src/types/telemetry.ts:31) - RTK status
- **Lines 38-43**: [`TelemetryMission`](src/types/telemetry.ts:38) - Mission progress
- **Lines 64-85**: [`RoverTelemetry`](src/types/telemetry.ts:64) - Complete telemetry structure
- **Lines 147-150**: [`GpsFailsafeStatus`](src/types/telemetry.ts:147) - GPS failsafe data

#### RTK Types ([`src/types/rtk.ts`](src/types/rtk.ts))
- **Lines 1-22**: [`LoraRTKStatus`](src/types/rtk.ts:1) - LoRa status structure
- **Lines 34-42**: [`NTRIPStartParams`](src/types/rtk.ts:34) - NTRIP connection parameters
- **Lines 75-86**: [`RTKStatusResponse`](src/types/rtk.ts:75) - Unified RTK status

### 5. **Component Usage Examples**

#### Mission Control ([`src/components/missionreport/MissionControlCard.tsx`](src/components/missionreport/MissionControlCard.tsx))
- **Line 41**: Access services via [`useRover()`](src/context/RoverContext.ts:54) hook
- **Lines 88-100**: Sync UI state with backend telemetry
- **Lines 200-300**: Mission control button handlers calling REST APIs

#### RTK Injection ([`src/components/missionreport/RTKInjectionScreen.tsx`](src/components/missionreport/RTKInjectionScreen.tsx))
- **Lines 52-70**: Polling RTK status via [`getRTKStatus()`](src/hooks/useRoverTelemetry.ts:1514)
- **Lines 96-110**: Subscribe to LoRa status via [`onLoraRTKStatus()`](src/hooks/useRoverTelemetry.ts:592)
- **Lines 150-200**: Start/stop NTRIP streams via REST APIs

#### Vehicle Status ([`src/components/missionreport/VehicleStatusCard.tsx`](src/components/missionreport/VehicleStatusCard.tsx))
- **Lines 14-18**: Service interface definition
- **Lines 253-298**: Profile-based RTK connection with status verification
- **Lines 200-223**: Auto-stop RTK on disconnect

### 6. **Persistent Storage** ([`src/services/PersistentStorage.ts`](src/services/PersistentStorage.ts))
- **Lines 82-93**: Save waypoints to AsyncStorage
- **Lines 98-110**: Load waypoints from AsyncStorage
- **Lines 239-252**: Save skip audit records
- Mission data persists across app restarts

## Communication Flow

### REST API Pattern
```typescript
// 1. Import services from context
const { services } = useRover();

// 2. Call service method
const response = await services.startMission();

// 3. Handle response
if (response.success) {
  // Success handling
}
```

### WebSocket Pattern
```typescript
// 1. Socket auto-connects via useRoverTelemetry
// 2. Subscribe to events in hook
socket.on('telemetry', (data) => {
  // Parse and update state
});

// 3. Emit events
socket.emit('set_gps_failsafe_mode', { mode: 'strict' });

// 4. Access telemetry via context
const { telemetry } = useRover();
```

## Key Integration Points

1. **Dynamic Backend URL**: [`getBackendURL()`](src/config.ts:60) allows runtime configuration
2. **Socket.IO Config**: [`SOCKET_CONFIG`](src/config.ts:88) uses polling-first for mobile reliability
3. **Telemetry Throttling**: 50ms throttle (~20Hz) for smooth updates
4. **Auto-reconnection**: Exponential backoff with max 8s delay
5. **State Persistence**: AsyncStorage for crash recovery
6. **Type Safety**: Full TypeScript definitions for all API responses

## Development Tips

- All REST endpoints defined in [`API_ENDPOINTS`](src/config.ts:107)
- All WebSocket events in [`SOCKET_EVENTS`](src/config.ts:170)
- Service methods in [`RoverServices`](src/hooks/useRoverTelemetry.ts:529) interface
- Telemetry structure in [`RoverTelemetry`](src/types/telemetry.ts:64) type
- Use [`useRover()`](src/context/RoverContext.ts) hook to access services and telemetry
