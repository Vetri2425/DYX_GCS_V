# Mission Control Panel - Backend Wiring Audit

**Date:** December 1, 2025  
**Status:** 🔴 **INCOMPLETE - Backend Calls Not Integrated**

---

## Executive Summary

The **Mission Report Tab** and **Mission Control Panel** are **NOT properly wired to the backend**. While the UI components are fully implemented and the backend API endpoints are defined in the config, the actual API calls are missing from the mission control handlers.

### Key Issues Found:
1. ❌ `MissionReportScreen` has TODO comments - no backend API calls implemented
2. ❌ `MissionControlCard` has handler methods but no service integration
3. ✅ Backend services are defined in `useRoverTelemetry` hook
4. ✅ Config and endpoints exist in `src/config.ts`
5. ❌ Handlers in screens don't call the services from RoverContext

---

## Architecture Overview

### Component Hierarchy
```
TabNavigator
  └── MissionReportScreen
        ├── VehicleStatusCard (left panel)
        ├── MissionMap (center)
        ├── SystemStatusPanel (right panel)
        │   └── MissionControlCard (buttons)
        └── WaypointsTable (bottom)
```

### Data Flow
```
MissionReportScreen
  ├── Consumes: useRover() hook
  │   ├── telemetry (live data)
  │   ├── services (backend API)
  │   └── connectionState
  └── NOT using services for mission control!
```

---

## Current Implementation Status

### 1. **Backend Configuration** ✅ COMPLETE
**File:** `src/config.ts`

```typescript
export const BACKEND_URL = 'http://192.168.1.31:5001';
export const API_ENDPOINTS = {
  MISSION_UPLOAD: '/api/mission/upload',
  MISSION_DOWNLOAD: '/api/mission/download',
  MISSION_CLEAR: '/api/mission/clear',
  MISSION_PAUSE: '/api/mission/pause',
  MISSION_RESUME: '/api/mission/resume',
  MISSION_SET_CURRENT: '/api/mission/set_current',
  // ... more endpoints
};
```

**Status:** ✅ All endpoints defined correctly

---

### 2. **Backend Services** ✅ COMPLETE
**File:** `src/hooks/useRoverTelemetry.ts`

The hook exports a `RoverServices` interface with these methods:

```typescript
export interface RoverServices {
  // Mission control
  pauseMission: () => Promise<ServiceResponse>;
  resumeMission: () => Promise<ServiceResponse>;
  uploadMission: (waypoints: Waypoint[]) => Promise<ServiceResponse>;
  downloadMission: () => Promise<ServiceResponse & { waypoints?: Waypoint[] }>;
  clearMission: () => Promise<ServiceResponse>;
  setCurrentWaypoint: (wpSeq: number) => Promise<ServiceResponse>;
  
  // Vehicle control
  armVehicle: () => Promise<ServiceResponse>;
  disarmVehicle: () => Promise<ServiceResponse>;
  setMode: (mode: string) => Promise<ServiceResponse>;
  
  // Other
  injectRTK: (ntripUrl: string) => Promise<ServiceResponse>;
  stopRTK: () => Promise<ServiceResponse>;
  getRTKStatus: () => Promise<ServiceResponse>;
  controlServo: (servoId: number, angle: number) => Promise<ServiceResponse>;
}
```

**Status:** ✅ All service methods implemented and ready to use

---

### 3. **Mission Control Card** ⚠️ PARTIALLY COMPLETE
**File:** `src/components/missionreport/MissionControlCard.tsx`

**What's Done:**
- ✅ UI buttons (START, STOP, PAUSE, RESUME, NEXT, SKIP)
- ✅ Mode toggle (AUTO/MANUAL)
- ✅ Local state management (loading states)
- ✅ Confirmation dialogs
- ✅ Props defined to accept handlers

**What's Missing:**
- ❌ No actual backend API calls in handler methods
- ❌ Handlers accept props but don't integrate with `useRover().services`

**Code Example - Current Implementation:**
```typescript
const handleStart = async () => {
  setIsStarting(true);
  try {
    if (onStart) {
      await onStart();  // ❌ Calls parent handler, not backend API
      setIsRunning(true);
    }
  } catch (error) {
    console.error('[MissionControlCard] Start Error:', error);
    Alert.alert('Error', 'Failed to start mission');
  } finally {
    setIsStarting(false);
  }
};
```

---

### 4. **Mission Report Screen** ❌ NOT IMPLEMENTED
**File:** `src/screens/MissionReportScreen.tsx`

**What's Done:**
- ✅ UI layout and styling
- ✅ Props passed to MissionControlCard
- ✅ Handler functions defined

**What's Missing:**
- ❌ **TODO comments throughout** - No backend integration
- ❌ Handlers don't call `useRover().services`
- ❌ No mission event subscription implementation

**Critical TODO Items:**
```typescript
// Line 70 - handleStart
const handleStart = async () => {
  try {
    // TODO: Call backend API to start mission  ❌
    console.log('[MissionReportScreen] Start mission');
    if (currentIndex === null) setCurrentIndex(0);
    Alert.alert('Success', 'Mission started successfully!');
  }
};

// Line 81 - handlePause
const handlePause = async () => {
  try {
    // TODO: Call backend API to pause mission  ❌
    console.log('[MissionReportScreen] Pause mission');
    Alert.alert('Success', 'Mission paused');
  }
};

// Line 91 - handleResume
const handleResume = async () => {
  try {
    // TODO: Call backend API to resume mission  ❌
    console.log('[MissionReportScreen] Resume mission');
    Alert.alert('Success', 'Mission resumed');
  }
};

// Line 101 - handleStop
const handleStop = async () => {
  try {
    // TODO: Call backend API to stop mission  ❌
    console.log('[MissionReportScreen] Stop mission');
    Alert.alert('Success', 'Mission stopped successfully!');
  }
};

// Line 111 - handleNext
const handleNext = async () => {
  try {
    // TODO: Call backend API to move to next waypoint  ❌
    console.log('[MissionReportScreen] Next waypoint');
    setCurrentIndex(prev => (prev === null ? 0 : Math.min(prev + 1, waypoints.length - 1)));
    Alert.alert('Success', 'Moved to next waypoint');
  }
};

// Line 202 - useEffect for mission events
useEffect(() => {
  // TODO: Subscribe to mission events from WebSocket or polling  ❌
  // This would update statusMap in real-time like the web application
}, []);

// Line 227 - useEffect for mission mode
useEffect(() => {
  const fetchMissionMode = async () => {
    try {
      // TODO: Fetch from backend API  ❌
      // const response = await fetch(`${BACKEND_URL}/api/mission/mode`);
    } catch (error) {
      console.debug('[MissionReportScreen] Could not fetch mission mode:', error);
    }
  };
}, []);
```

---

### 5. **System Status Panel** ⚠️ PARTIALLY COMPLETE
**File:** `src/components/missionreport/SystemStatusPanel.tsx`

**What's Done:**
- ✅ Displays system status (network, LoRa, RC, battery)
- ✅ Uses telemetry from `useRover()`
- ✅ Passes handlers to MissionControlCard

**What's Missing:**
- ❌ Handlers are stubs - don't call backend services

```typescript
const handleStart = async () => {
  onStart();  // ❌ Just calls parent's onStart, no API
};

const handleStop = async () => {
  console.log('Stop mission');  // ❌ No actual implementation
};

const handleResume = () => {
  console.log('Resume mission');  // ❌ No actual implementation
};
```

---

## Required Implementation

### Step 1: Get Services in MissionReportScreen
```typescript
import { useRover } from '../context/RoverContext';

export default function MissionReportScreen() {
  const { telemetry, roverPosition, services } = useRover();  // ✅ Add services
  // ...
}
```

### Step 2: Connect Handlers to Backend Services

**Example - handleStart:**
```typescript
const handleStart = async () => {
  try {
    // Set mode to AUTO first
    await services.setMode('AUTO');
    
    // Note: Backend doesn't have explicit "start mission" - 
    // Use setCurrentWaypoint to activate first waypoint
    const response = await services.setCurrentWaypoint(1);
    
    if (response.success) {
      if (currentIndex === null) setCurrentIndex(0);
      Alert.alert('Success', 'Mission started successfully!');
    } else {
      Alert.alert('Error', response.message || 'Failed to start mission');
    }
  } catch (error) {
    console.error('[MissionReportScreen] Start Error:', error);
    Alert.alert('Error', 'Failed to start mission');
  }
};
```

**Example - handlePause:**
```typescript
const handlePause = async () => {
  try {
    const response = await services.pauseMission();
    if (response.success) {
      Alert.alert('Success', 'Mission paused');
    } else {
      Alert.alert('Error', response.message || 'Failed to pause mission');
    }
  } catch (error) {
    console.error('[MissionReportScreen] Pause Error:', error);
    Alert.alert('Error', 'Failed to pause mission');
  }
};
```

**Example - handleResume:**
```typescript
const handleResume = async () => {
  try {
    const response = await services.resumeMission();
    if (response.success) {
      Alert.alert('Success', 'Mission resumed');
    } else {
      Alert.alert('Error', response.message || 'Failed to resume mission');
    }
  } catch (error) {
    console.error('[MissionReportScreen] Resume Error:', error);
    Alert.alert('Error', 'Failed to resume mission');
  }
};
```

**Example - handleStop:**
```typescript
const handleStop = async () => {
  try {
    // Backend may not have explicit "stop" - use clear or pause
    const response = await services.pauseMission();
    if (response.success) {
      setCurrentIndex(null);
      Alert.alert('Success', 'Mission stopped successfully!');
    } else {
      Alert.alert('Error', response.message || 'Failed to stop mission');
    }
  } catch (error) {
    console.error('[MissionReportScreen] Stop Error:', error);
    Alert.alert('Error', 'Failed to stop mission');
  }
};
```

**Example - handleNext:**
```typescript
const handleNext = async () => {
  try {
    const nextIndex = (currentIndex ?? -1) + 1;
    if (nextIndex < waypoints.length) {
      // Backend uses 1-based indexing
      const response = await services.setCurrentWaypoint(nextIndex + 1);
      
      if (response.success) {
        setCurrentIndex(nextIndex);
        Alert.alert('Success', 'Moved to next waypoint');
      } else {
        Alert.alert('Error', response.message || 'Failed to move to next waypoint');
      }
    }
  } catch (error) {
    console.error('[MissionReportScreen] Next Error:', error);
    Alert.alert('Error', 'Failed to move to next waypoint');
  }
};
```

### Step 3: Subscribe to Mission Events

```typescript
useEffect(() => {
  // Subscribe to mission events
  const unsubscribe = onMissionEvent((event) => {
    console.log('[MissionReportScreen] Mission Event:', event);
    
    // Update waypoint status based on events
    if (event.type === 'waypoint_reached') {
      setStatusMap(prev => ({
        ...prev,
        [event.waypoint_id]: {
          status: 'reached',
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
    }
    
    if (event.type === 'waypoint_marked') {
      setStatusMap(prev => ({
        ...prev,
        [event.waypoint_id]: {
          status: 'completed',
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
    }
  });

  return () => unsubscribe();
}, [onMissionEvent]);
```

---

## Connection Verification Checklist

### ✅ What's Working
- [x] Backend URL configured: `http://192.168.1.31:5001`
- [x] API endpoints defined in `config.ts`
- [x] Socket.IO connection established via `useRoverTelemetry` hook
- [x] Telemetry data streaming from backend
- [x] RoverContext provider wrapping app
- [x] Services object ready to use

### ❌ What Needs to be Done
- [ ] Connect `handleStart` to `services.setCurrentWaypoint()`
- [ ] Connect `handlePause` to `services.pauseMission()`
- [ ] Connect `handleResume` to `services.resumeMission()`
- [ ] Connect `handleStop` to `services.pauseMission()` or `services.clearMission()`
- [ ] Connect `handleNext` to `services.setCurrentWaypoint()`
- [ ] Connect `handleSkip` to mission skip endpoint (may need to add)
- [ ] Subscribe to mission events via `onMissionEvent()`
- [ ] Implement mode toggle calling `services.setMode()`
- [ ] Update waypoint status map when events received

---

## Recommended Implementation Order

1. **First:** Update `MissionReportScreen` handlers to call services
2. **Second:** Update `SystemStatusPanel` to pass proper handlers
3. **Third:** Subscribe to mission events in `useEffect`
4. **Fourth:** Implement mode toggle backend integration
5. **Fifth:** Add status map updates for real-time UI feedback

---

## Backend API Endpoints Available

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mission/upload` | POST | Upload waypoint list |
| `/api/mission/download` | GET | Fetch current mission |
| `/api/mission/clear` | POST | Clear all waypoints |
| `/api/mission/pause` | POST | Pause mission execution |
| `/api/mission/resume` | POST | Resume paused mission |
| `/api/mission/set_current` | POST | Jump to specific waypoint |
| `/api/set_mode` | POST | Change vehicle mode (AUTO/MANUAL) |
| `/api/arm` | POST | Arm/disarm vehicle |
| `/api/servo/control` | POST | Control servo angles |

---

## Testing Recommendations

Once implemented, test with:
1. Backend running at `http://192.168.1.31:5001`
2. Click "START" button - should call setCurrentWaypoint API
3. Check browser console for API responses
4. Verify mission status updates in real-time
5. Test PAUSE/RESUME cycle
6. Test waypoint progression

---

## Files to Modify

1. `src/screens/MissionReportScreen.tsx` - **CRITICAL**
   - Add `services` from `useRover()`
   - Implement all handler methods
   - Add mission event subscription

2. `src/components/missionreport/SystemStatusPanel.tsx` - **Important**
   - Pass proper async handlers to MissionControlCard
   - Implement `handleStop` and `handleResume`

3. (Optional) `src/components/missionreport/MissionControlCard.tsx` - **Enhancement**
   - Add direct service integration option
   - Or keep as dumb component (current approach is fine)

---

## Summary

The **Mission Control Panel is architecturally sound** but **missing actual backend integration**. The infrastructure is 100% in place:
- Config ✅
- Services ✅
- Socket.IO ✅
- Endpoints ✅

Only the **handler implementations are missing** from `MissionReportScreen`. This is a straightforward implementation task.

**Estimated fix time:** 30-45 minutes for full implementation + testing
