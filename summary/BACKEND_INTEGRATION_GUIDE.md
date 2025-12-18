# React Native Backend Integration Guide

## Overview

This guide explains how the React Native mobile app integrates with the backend rover server for live telemetry and control commands.

---

## Architecture

```
Backend (Node.js/Python Server)
    ↓ Socket.IO (Real-time)
    ↓ HTTP API (Commands)
    ↓
React Native App
    ├── useRoverTelemetry Hook
    │   ├── Socket.IO Connection
    │   ├── Telemetry Streaming
    │   └── Service Methods
    ├── RoverContext (State Provider)
    │   └── Shares data across app
    └── Components
        ├── TelemetryDisplay (Live view)
        ├── DashboardScreen
        ├── PathPlanScreen
        └── MissionReportScreen
```

---

## File Structure

```
src/
├── config.ts                           # Backend URL & Socket config
├── types/
│   └── telemetry.ts                   # Type definitions
├── context/
│   └── RoverContext.tsx               # State management provider
├── hooks/
│   └── useRoverTelemetry.ts          # Main telemetry hook
├── components/
│   └── TelemetryDisplay.tsx           # Live telemetry UI
├── screens/
│   └── TelemetryScreen.tsx            # Test screen
└── navigation/
    └── TabNavigator.tsx               # Add TelemetryScreen to tabs
```

---

## Configuration

### 1. Backend URL Setup

Edit `src/config.ts` to set your backend server:

```typescript
// Default: http://192.168.1.101:5001
export const BACKEND_URL = 'http://192.168.1.101:5001';
```

Or set via environment variable:
```bash
REACT_APP_ROS_HTTP_BASE=http://192.168.1.100:5001
```

### 2. Socket.IO Configuration

The hook automatically configures Socket.IO with:
- **Transports**: WebSocket (primary) + Polling (fallback)
- **Reconnection**: Automatic with exponential backoff
- **Timeout**: 20 seconds
- **Max attempts**: Infinite (keeps trying)

---

## Live Telemetry Integration

### Step 1: Wrap App with Provider

In `App.tsx`:

```typescript
import { RoverProvider } from './src/context/RoverContext';

export default function App() {
  return (
    <RoverProvider>
      <TabNavigator />
    </RoverProvider>
  );
}
```

### Step 2: Use Telemetry Hook

In any component:

```typescript
import { useRover } from '../context/RoverContext';

export const MyComponent = () => {
  const { telemetry, connectionState, roverPosition } = useRover();

  return (
    <View>
      <Text>Position: {roverPosition?.lat}, {roverPosition?.lng}</Text>
      <Text>Battery: {telemetry.battery.percentage}%</Text>
      <Text>Status: {connectionState}</Text>
    </View>
  );
};
```

### Step 3: Real-Time Updates

The hook automatically:
- ✅ Connects to backend on mount
- ✅ Listens to `telemetry` and `rover_data` events
- ✅ Updates state at ~30 Hz (throttled)
- ✅ Handles reconnection on failure
- ✅ Cleans up on unmount

---

## Telemetry Data Structure

```typescript
interface RoverTelemetry {
  // Vehicle state
  state: {
    armed: boolean;           // Armed or disarmed
    mode: string;             // Flight mode (UNKNOWN, AUTO, GUIDED, etc.)
    system_status: string;    // System status (STANDBY, ACTIVE, etc.)
    heartbeat_ts: number;     // Last heartbeat timestamp
  };

  // Position & altitude
  global: {
    lat: number;              // Latitude (-90 to 90)
    lon: number;              // Longitude (-180 to 180)
    alt_rel: number;          // Relative altitude in meters
    vel: number;              // Ground speed in m/s
    satellites_visible: number; // Number of GPS satellites
  };

  // Battery
  battery: {
    voltage: number;          // Voltage in Volts
    current: number;          // Current in Amps
    percentage: number;       // Battery percentage (0-100)
  };

  // RTK/GPS
  rtk: {
    fix_type: number;         // 0-6 (see table below)
    baseline_age: number;     // Age in milliseconds
    base_linked: boolean;     // RTK base connected
  };

  // Mission
  mission: {
    total_wp: number;         // Total waypoints
    current_wp: number;       // Current waypoint index
    status: string;           // IDLE, ACTIVE, etc.
    progress_pct: number;     // Progress 0-100
  };

  // IMU & Accuracy
  hrms: number;               // Horizontal RMS error in meters
  vrms: number;               // Vertical RMS error in meters
  imu_status: string;         // IMU calibration status
  attitude?: {
    yaw_deg: number;          // Heading in degrees
  };

  // Network
  network: {
    connection_type: string;  // wifi, lora, etc.
    wifi_signal_strength: number;
    wifi_rssi: number;        // Signal strength in dBm
    wifi_connected: boolean;
    lora_connected: boolean;
  };

  lastMessageTs: number | null; // Timestamp of last update
}
```

### RTK Fix Types

| Value | Status | Meaning |
|-------|--------|---------|
| 0 | No GPS | No GPS signal detected |
| 1 | No Fix | GPS detected but no fix |
| 2 | 2D Fix | 2D fix (requires 4 satellites minimum) |
| 3 | 3D Fix | 3D fix (requires 5 satellites minimum) |
| 4 | DGPS | Differential GPS fix |
| 5 | RTK Float | RTK float solution (centimeter accuracy) |
| 6 | RTK Fixed | RTK fixed solution (best accuracy) |

---

## Connection States

```typescript
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';
```

| State | Meaning | Recovery |
|-------|---------|----------|
| `connecting` | Attempting to connect | Wait for connection |
| `connected` | Connected and receiving data | N/A |
| `disconnected` | Connection lost | Auto-reconnect |
| `error` | Connection error | Auto-reconnect with backoff |

---

## Backend Events

The app listens to these Socket.IO events from the backend:

### Telemetry Events

```
EVENT: telemetry
PAYLOAD: {
  state: { armed, mode, system_status, heartbeat_ts },
  position: { lat, lng },
  battery: { voltage, current, percentage },
  rtk: { fix_type, baseline_age, base_linked },
  ...
}

EVENT: rover_data
PAYLOAD: Same as telemetry (alternative format)
```

### Mission Events

```
EVENT: mission_event
PAYLOAD: {
  timestamp: string | number,
  message: string,
  lat: number | null,
  lng: number | null,
  waypointId: number | null,
  status: string | null
}

EVENT: mission_status
PAYLOAD: {
  total_waypoints: number,
  current_waypoint: number,
  mission_state: string,
  ...
}

EVENT: mission_error
PAYLOAD: {
  error: string
}
```

---

## Service Commands (Next Phase)

Once telemetry is working, add these commands:

```typescript
const { services } = useRover();

// Vehicle control
await services.armVehicle();
await services.disarmVehicle();
await services.setMode('AUTO');

// Mission control
await services.uploadMission(waypoints);
await services.downloadMission();
await services.pauseMission();
await services.resumeMission();

// RTK
await services.injectRTK('ntrip://caster.url');
await services.getRTKStatus();

// Servo
await services.controlServo(10, 90); // servo 10, angle 90°
```

---

## Testing Checklist

- [ ] Backend server is running (check `http://192.168.1.101:5001`)
- [ ] Backend URL is correct in `src/config.ts`
- [ ] TelemetryScreen displays and updates live data
- [ ] Connection status shows "CONNECTED" (green)
- [ ] Position updates in real-time
- [ ] Battery percentage changes
- [ ] RTK status updates
- [ ] Reconnect works after network loss
- [ ] App doesn't crash on disconnect/reconnect

---

## Debugging

### Check Connection

```typescript
import { useRover } from './src/context/RoverContext';

const DebugComponent = () => {
  const { connectionState, telemetry } = useRover();
  
  console.log('Connection State:', connectionState);
  console.log('Last Message:', new Date(telemetry.lastMessageTs || 0));
};
```

### Monitor Events

```typescript
const { onMissionEvent } = useRover();

useEffect(() => {
  const unsubscribe = onMissionEvent((event) => {
    console.log('[Mission Event]', event);
  });
  return unsubscribe;
}, []);
```

### Enable Debug Logging

The hook logs important events with prefixes:
- `[TELEMETRY]` - Data updates
- `[SOCKET]` - Connection events
- `[RTK]` - RTK-specific data
- `[MISSION_STATUS]` - Mission updates

---

## Common Issues

### "useRover must be used within a RoverProvider"
**Solution**: Ensure App is wrapped with `<RoverProvider>`:
```typescript
<RoverProvider>
  <App />
</RoverProvider>
```

### "Cannot connect to backend"
**Check**:
1. Backend server is running
2. Backend URL is correct in `src/config.ts`
3. Same network/WiFi on mobile and backend
4. No firewall blocking port 5001

### "Telemetry not updating"
**Check**:
1. Connection state is "connected"
2. Backend is sending telemetry events
3. Look for `[TELEMETRY]` logs in console

### "Frequent reconnections"
**Check**:
1. Network stability
2. Backend server health
3. Check backend logs for errors

---

## Next Steps

1. ✅ Telemetry streaming - DONE
2. ⏳ Add command services (arm, mission upload, etc.)
3. ⏳ Build mission planning UI
4. ⏳ Add path plan visualization
5. ⏳ Mission execution and monitoring

---

## Reference

- **Web App**: `temp-react-source/src/hooks/useRoverROS.ts`
- **Backend Config**: `temp-react-source/.env`
- **API Endpoints**: `src/config.ts` - `API_ENDPOINTS`
- **Socket Events**: `src/config.ts` - `SOCKET_EVENTS`
