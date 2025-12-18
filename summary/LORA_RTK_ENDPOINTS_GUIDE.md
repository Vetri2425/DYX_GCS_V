# LoRa RTK Streaming Endpoints & Architecture

## Overview
LoRa RTK streaming uses **Socket.IO events** (not HTTP REST endpoints) to communicate with the backend. This is different from NTRIP which uses HTTP REST calls.

---

## Socket.IO Events

### 1. Start LoRa RTK Stream
**Event Name:** `start_lora_rtk_stream`

```typescript
// Frontend emits:
socketRef.current.emit('start_lora_rtk_stream', {})

// Backend should listen and respond with:
// Event: lora_rtk_status
// Data: {
//   status: 'connecting' | 'connected' | 'streaming' | 'error' | 'disconnected',
//   message: string,
//   started_at?: ISO timestamp,
//   messages_received?: number,
//   bytes_received?: number,
//   error_count?: number
// }
```

**Location in Code:** [src/hooks/useRoverTelemetry.ts#L1074](src/hooks/useRoverTelemetry.ts#L1074)

---

### 2. Stop LoRa RTK Stream
**Event Name:** `stop_lora_rtk_stream`

```typescript
// Frontend emits:
socketRef.current.emit('stop_lora_rtk_stream', {})

// Backend should respond with:
// Event: lora_rtk_status
// Data: {
//   status: 'disconnected',
//   message: string
// }
```

**Location in Code:** [src/hooks/useRoverTelemetry.ts#L1081](src/hooks/useRoverTelemetry.ts#L1081)

---

### 3. Get LoRa RTK Status
**Event Name:** `get_lora_rtk_status`

```typescript
// Frontend emits (on-demand status check):
socketRef.current.emit('get_lora_rtk_status', {})

// Backend should respond with:
// Event: lora_rtk_status
// Data: {
//   status: 'status_update',
//   is_connected: boolean,
//   is_running: boolean,
//   messages_received: number,
//   bytes_received: number,
//   error_count: number,
//   connection_time?: ISO timestamp,
//   uptime_seconds?: number,
//   source_active: boolean
// }
```

**Location in Code:** [src/hooks/useRoverTelemetry.ts#L1088](src/hooks/useRoverTelemetry.ts#L1088)

---

### 4. LoRa RTK Status Updates (Backend → Frontend)
**Event Name:** `lora_rtk_status`

```typescript
// Frontend listener (registered in connectSocket):
socket.on('lora_rtk_status', handleLoraRTKStatus.current)

// Payload structure:
interface LoraRTKStatus {
  status?: 'connecting' | 'connected' | 'streaming' | 'error' | 'disconnected' | 'status_update',
  message?: string,
  started_at?: string,
  messages_received?: number,
  bytes_received?: number,
  error_count?: number,
  is_connected?: boolean,
  is_running?: boolean,
  connection_time?: string,
  uptime_seconds?: number,
  source_active?: boolean
}
```

**Location in Code:** 
- Type definition: [src/types/rtk.ts](src/types/rtk.ts)
- Handler registration: [src/hooks/useRoverTelemetry.ts#L855](src/hooks/useRoverTelemetry.ts#L855)
- Handler logic: [src/hooks/useRoverTelemetry.ts#L754](src/hooks/useRoverTelemetry.ts#L754)

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (RTKInjectionScreen.tsx)                            │
│                                                              │
│  User clicks "Start Stream" (LoRa tab)                      │
│         ↓                                                     │
│  handleStartLora() called                                    │
│         ↓                                                     │
│  Stop NTRIP if running (mutual exclusivity)                 │
│         ↓                                                     │
│  services.startLoraRTKStream() called                       │
└────────────────────────────────────────────────────────────┬┘
                                                              │
                                         Socket.IO Connection │
                                                              │
                     ┌────────────────────────────────────────▼┐
                     │ Backend                                 │
                     │                                         │
                     │ Listen: 'start_lora_rtk_stream'        │
                     │        ↓                                │
                     │ Detect USB LoRa device                 │
                     │        ↓                                │
                     │ Open serial connection                  │
                     │        ↓                                │
                     │ Emit: 'lora_rtk_status' (connecting)   │
                     │        ↓                                │
                     │ Connect to device                       │
                     │        ↓                                │
                     │ Emit: 'lora_rtk_status' (connected)    │
                     │        ↓                                │
                     │ Read RTCM corrections                   │
                     │        ↓                                │
                     │ Inject to MAVLink/ArduPilot             │
                     │        ↓                                │
                     │ Emit: 'lora_rtk_status' (streaming)    │
                     │ + counters (messages, bytes, errors)    │
                     └────────────────────────────────────────┬┘
                                                              │
                                         Socket.IO Connection │
                                                              │
┌─────────────────────────────────────────────────────────────┘
│ Frontend (RTKInjectionScreen.tsx)
│
│  onLoraRTKStatus listener receives updates
│         ↓
│  Update UI state:
│  - loraStatus (status, message)
│  - loraConnected (boolean)
│  - loraRunning (boolean)
│  - counters (messages, bytes, errors)
│         ↓
│  Re-render with live stats
└──────────────────────────────────────────────────────────────┘
```

---

## Service Methods (Frontend)

All exposed in `RoverServices` interface:

```typescript
// In useRoverTelemetry.ts services object:

startLoraRTKStream: async () => {
  socketRef.current.emit('start_lora_rtk_stream', {});
  return { success: true, message: 'LoRa RTK start requested' };
}

stopLoraRTKStream: async () => {
  socketRef.current.emit('stop_lora_rtk_stream', {});
  return { success: true, message: 'LoRa RTK stop requested' };
}

getLoraRTKStatus: async () => {
  socketRef.current.emit('get_lora_rtk_status', {});
  return { success: true, message: 'LoRa RTK status requested' };
}

onLoraRTKStatus: (callback) => {
  // Subscribe to lora_rtk_status events
  loraStatusCallbackRef.current.push(callback);
  return () => { /* unsubscribe */ };
}
```

**Location in Code:** [src/hooks/useRoverTelemetry.ts#L1070-L1095](src/hooks/useRoverTelemetry.ts#L1070-L1095)

---

## Component Integration

### RTKInjectionScreen Usage
**File:** [src/components/missionreport/RTKInjectionScreen.tsx](src/components/missionreport/RTKInjectionScreen.tsx)

```typescript
// Initialize listeners (when screen opens)
useEffect(() => {
  const unsubscribe = services.onLoraRTKStatus((payload) => {
    setLoraStatus((prev) => ({ ...prev, ...payload }));
    setLoraConnected(Boolean(payload.is_connected));
    setLoraRunning(Boolean(payload.is_running));
  });
  
  services.getLoraRTKStatus?.();
  return unsubscribe;
}, [services, visible]);

// Start button handler
const handleStartLora = async () => {
  const response = await services.startLoraRTKStream();
  if (!response.success) {
    setError(response.message);
    return;
  }
  services.getLoraRTKStatus?.();
};

// Stop button handler
const handleStopLora = async () => {
  const response = await services.stopLoraRTKStream();
  if (!response.success) {
    setError(response.message);
    return;
  }
  setLoraRunning(false);
  services.getLoraRTKStatus?.();
};
```

---

## Backend Requirements Checklist

- [ ] Listen for `start_lora_rtk_stream` Socket.IO event
- [ ] Auto-detect USB LoRa device (CH340, 1a86:7523 or similar)
- [ ] Open serial connection at configured baud rate (115200 default)
- [ ] Emit `lora_rtk_status` with status='connecting'
- [ ] Establish connection, emit status='connected'
- [ ] Read binary RTCM corrections from USB
- [ ] Inject RTCM to MAVLink using existing `bridge.send_rtcm()` method
- [ ] Emit `lora_rtk_status` with status='streaming' + counters (messages_received, bytes_received, error_count)
- [ ] Listen for `stop_lora_rtk_stream` event and close connection
- [ ] Emit `lora_rtk_status` with status='disconnected'
- [ ] Listen for `get_lora_rtk_status` and respond with current stats
- [ ] Update `network.lora_connected` flag on telemetry when connected
- [ ] Handle mutual exclusivity: auto-stop NTRIP if LoRa starts (or vice versa)

---

## Testing Endpoints

To test LoRa stream manually via Socket.IO client:

```javascript
// In browser console or Node.js Socket.IO client:
socket = io('http://192.168.1.24:5001');

// Start stream
socket.emit('start_lora_rtk_stream', {});

// Listen for status
socket.on('lora_rtk_status', (data) => {
  console.log('LoRa RTK Status:', data);
});

// Get status on demand
socket.emit('get_lora_rtk_status', {});

// Stop stream
socket.emit('stop_lora_rtk_stream', {});
```

---

## Summary

| Aspect | Detail |
|--------|--------|
| **Protocol** | Socket.IO (not HTTP REST) |
| **Start Event** | `start_lora_rtk_stream` |
| **Stop Event** | `stop_lora_rtk_stream` |
| **Status Event** | `get_lora_rtk_status` |
| **Response Event** | `lora_rtk_status` |
| **Device Auto-Detection** | USB (expects CH340 or similar) |
| **Baud Rate** | 115200 (configurable) |
| **Data Format** | Binary RTCM via serial |
| **Injection Method** | Existing `bridge.send_rtcm()` |
| **Network Flag** | `telemetry.network.lora_connected` |
| **Mutual Exclusivity** | Only one (NTRIP or LoRa) can stream at a time |

---

## Files Modified/Created

1. [src/types/rtk.ts](src/types/rtk.ts) - LoRa RTK status types
2. [src/hooks/useRoverTelemetry.ts](src/hooks/useRoverTelemetry.ts) - Socket listener & services
3. [src/components/missionreport/RTKInjectionScreen.tsx](src/components/missionreport/RTKInjectionScreen.tsx) - UI overlay
4. [src/components/missionreport/VehicleStatusCard.tsx](src/components/missionreport/VehicleStatusCard.tsx) - GPS/RTK button callback
5. [src/screens/MissionReportScreen.tsx](src/screens/MissionReportScreen.tsx) - Overlay integration
