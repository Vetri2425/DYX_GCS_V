# Mission Progress Panel - Live Data Update Analysis

## Overview
The mission progress panel updates live data through a **Socket.IO real-time connection** from the backend, with React state management and throttled re-renders for optimal performance.

---

## Architecture Flow

### 1. **Data Source: Backend Socket.IO Events**
- **Hook**: `useRoverTelemetry()` in `src/hooks/useRoverTelemetry.ts`
- **Connection**: Persistent Socket.IO connection to `BACKEND_URL` (configured in `src/config.ts`)
- **Event**: Listens for `telemetry` socket events containing mission data

### 2. **Data Structure**
Mission-related telemetry is part of the `TelemetryMission` object:
```typescript
interface TelemetryMission {
  total_wp: number;           // Total waypoints in mission
  current_wp: number;         // Current waypoint index (1-based)
  status: string;             // Mission status: IDLE, RUNNING, PAUSED, COMPLETED
  progress_pct: number;       // Progress percentage: 0-100
}
```

### 3. **Live Update Flow**

#### Step 1: Socket.IO Event Reception
```typescript
// In useRoverTelemetry hook
socket.on('telemetry', (data) => {
  const envelope = parseTelemetryEnvelope(data);
  if (envelope) {
    applyEnvelope(envelope);  // Apply to internal state
  }
});
```

#### Step 2: Telemetry Envelope Parsing
The `parseTelemetryEnvelope()` function extracts mission data:
```typescript
if (data.mission && typeof data.mission === 'object') {
  envelope.mission = {
    total_wp: typeof data.mission.total_wp === 'number' ? data.mission.total_wp : 0,
    current_wp: typeof data.mission.current_wp === 'number' ? data.mission.current_wp : 0,
    status: typeof data.mission.status === 'string' ? data.mission.status : 'IDLE',
    progress_pct: typeof data.mission.progress_pct === 'number' ? data.mission.progress_pct : 0,
  };
  touched = true;
}
```

#### Step 3: Apply Envelope & Throttled State Update
```typescript
const applyEnvelope = useCallback((envelope: TelemetryEnvelope) => {
  const mutable = mutableRef.current;
  const next = { ...mutable.telemetry };
  
  // Merge mission data
  if (envelope.mission) {
    next.mission = { ...next.mission, ...envelope.mission };
  }
  
  next.lastMessageTs = envelope.timestamp ?? Date.now();
  mutable.telemetry = next;

  // Throttle updates to ~30 Hz (33ms)
  const now = performance.now();
  const elapsed = now - lastDispatchRef.current;

  if (elapsed >= THROTTLE_MS) {  // THROTTLE_MS = 33
    lastDispatchRef.current = now;
    setTelemetrySnapshot(next);  // ← React re-render triggered
  } else {
    // Queue throttled update
    if (pendingDispatchRef.current) clearTimeout(pendingDispatchRef.current);
    pendingDispatchRef.current = setTimeout(() => {
      lastDispatchRef.current = performance.now();
      setTelemetrySnapshot(mutableRef.current.telemetry);
    }, THROTTLE_MS - elapsed);
  }
}, []);
```

**Key Optimization**: Updates are throttled to prevent excessive re-renders. Multiple rapid socket events are batched and dispatched at ~30 Hz.

---

## Components Using Live Mission Data

### 1. **Dashboard Screen** (`src/screens/DashboardScreen.tsx`)

**How it gets data:**
```typescript
const { telemetry } = useRover();  // From RoverContext
```

**Mission Progress Card Display:**
```tsx
{telemetry.mission.total_wp > 0 && (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>🎯 MISSION PROGRESS</Text>
    
    {/* Current Waypoint Display */}
    <View style={styles.row}>
      <Text style={styles.label}>Current Waypoint:</Text>
      <Text style={styles.value}>
        {telemetry.mission.current_wp}/{telemetry.mission.total_wp}
      </Text>
    </View>
    
    {/* Mission Status */}
    <View style={styles.row}>
      <Text style={styles.label}>Status:</Text>
      <Text style={styles.value}>{telemetry.mission.status}</Text>
    </View>
    
    {/* Progress Percentage */}
    <View style={styles.row}>
      <Text style={styles.label}>Progress:</Text>
      <Text style={styles.value}>
        {telemetry.mission.progress_pct.toFixed(1)}%
      </Text>
    </View>

    {/* Progress Bar (visual indicator) */}
    <View style={styles.progressBarContainer}>
      <View style={[
        styles.progressBar,
        { width: `${telemetry.mission.progress_pct}%` }
      ]} />
    </View>
  </View>
)}
```

**Update Frequency**: Whenever socket telemetry event arrives and throttle interval passes (~33ms = 30 Hz)

---

### 2. **Mission Report Screen** (`src/screens/MissionReportScreen.tsx`)

**How it gets data:**
```typescript
const { telemetry, roverPosition } = useRover();  // From RoverContext
```

**Mission Progress Card Component:**
```tsx
import { MissionProgressCard } from '../components/missionreport/MissionProgressCard';

<MissionProgressCard 
  waypoints={waypoints} 
  currentIndex={currentIndex}  // Derived from telemetry
/>
```

**Key Props:**
- `currentIndex`: Derived from `telemetry.mission.current_wp` (0-based indexing)
- `waypoints`: Local state array of waypoint objects

**Displays:**
- Current waypoint number: `currentIndex + 1 / totalWaypoints`
- Distance to next waypoint: Calculated using Haversine formula
- Marked waypoint count: Waypoints with status 'Marked' or 'Completed'
- Next waypoint number

---

## Real-Time Update Mechanism

### Update Trigger Chain:
```
Backend Socket Event (telemetry)
    ↓
useRoverTelemetry Hook
    ↓
parseTelemetryEnvelope() - Extract mission data
    ↓
applyEnvelope() - Merge with existing state
    ↓
Throttle Check (33ms) - Buffer rapid updates
    ↓
setTelemetrySnapshot() - React setState
    ↓
RoverContext → useRover() subscribers
    ↓
Components re-render with new mission data
    ↓
Progress % ↑ | Waypoint # ↑ | Status changes visible
```

### Performance Optimizations:
1. **Throttled Updates**: 30 Hz max (33ms intervals) prevents excessive re-renders
2. **Mutable Ref Storage**: Internal state in `mutableRef` updated immediately
3. **Lazy Re-renders**: React state only updates at throttle intervals
4. **Selective Updates**: Only fields in envelope are merged (no full object replacement)

---

## Current Implementation Status

### ✅ Working Features:
- **Live telemetry socket connection** - Connected to backend via Socket.IO
- **Mission progress percentage** - `progress_pct` displays and updates
- **Current waypoint tracking** - `current_wp` updates in real-time
- **Mission status** - Shows IDLE, RUNNING, PAUSED, COMPLETED
- **Total waypoints count** - `total_wp` displays
- **Progress bar visualization** - Visual indicator updates live
- **Throttled rendering** - ~30 Hz update frequency prevents performance issues

### ⚠️ Areas with TODO Comments:
In `MissionReportScreen.tsx`:
```typescript
// Lines 99, 107, 119, 156
const handleStart = async () => {
  try {
    // TODO: Call backend API to start mission
    console.log('[MissionReportScreen] Start mission');
```

These are mission **control** endpoints (start/pause/resume), not data display. The live update display itself is working.

---

## Data Flow Diagram

```
BACKEND (ROS/MAVProxy)
    ↓
Socket.IO Server
    ↓
emit 'telemetry' event with:
  {
    mission: {
      total_wp: 10,
      current_wp: 3,
      status: "RUNNING",
      progress_pct: 30.0
    }
  }
    ↓
useRoverTelemetry Hook
  ├─ Receives socket event
  ├─ Validates & parses envelope
  ├─ Merges with mutable state
  ├─ Throttles to 33ms
  └─ Updates React state
    ↓
RoverContext (useRover())
    ↓
Consumers:
  ├─ DashboardScreen
  │  └─ Displays: current_wp/total_wp, status, progress_pct%
  │
  └─ MissionReportScreen
     └─ Passes to MissionProgressCard
        └─ Displays: waypoint progress, distance, counters
```

---

## Socket Configuration

**File**: `src/config.ts`

Typical Socket.IO config includes:
```typescript
const SOCKET_CONFIG: ManagerOptions & SocketOptions = {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  // ... other options
};
```

---

## Testing the Live Updates

### Check in DevTools Console:
```javascript
// Monitor telemetry changes
const rover = useRover();
console.log('Mission:', rover.telemetry.mission);
// Should show updates every 33ms when socket events arrive
```

### Backend Event Format Expected:
```json
{
  "mission": {
    "total_wp": 10,
    "current_wp": 3,
    "status": "RUNNING",
    "progress_pct": 30.0
  },
  "timestamp": 1701432000000
}
```

---

## Summary

**The mission progress panel successfully updates live** through:
1. ✅ Socket.IO connection receiving telemetry events
2. ✅ Real-time parsing and state updates
3. ✅ Throttled React re-renders (30 Hz)
4. ✅ Context provider propagating to consumers
5. ✅ Components displaying progress visually and numerically

**Update Frequency**: ~30 Hz (33ms throttle) when socket events are received  
**Data Source**: Backend via Socket.IO `telemetry` events  
**Display Locations**: Dashboard & Mission Report screens
