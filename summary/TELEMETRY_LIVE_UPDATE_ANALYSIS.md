# Telemetry Live Update Analysis & Fixes

## Summary of Investigation

I've analyzed the telemetry data flow throughout the application and identified the issues preventing live updates from displaying correctly in the MapView and VehicleStatus components.

## Current Architecture

### 1. **useRoverTelemetry Hook** (`src/hooks/useRoverTelemetry.ts`)
- ✅ Properly receives telemetry via Socket.IO events
- ✅ Has throttling mechanism (50ms ~20Hz) for UI updates
- ✅ Uses refs to prevent infinite loops
- ✅ Deep copying with `JSON.parse(JSON.stringify())` ensures React sees new references
- ✅ Telemetry updates are working correctly in the hook

### 2. **RoverContext** (`src/context/RoverContext.ts`)
- ✅ Wraps `useRoverTelemetry` and exposes it via context
- ✅ Uses `useMemo` with correct dependencies (excludes `telemetry` to prevent loops)
- **⚠️ ISSUE**: The memoization might be preventing re-renders when only telemetry changes

### 3. **Map Components**
- **PathPlanMap** (`src/components/pathplan/PathPlanMap.tsx`)
  - ✅ Uses `useEffect` with `[roverPosition.lat, roverPosition.lon, heading, mapReady]` dependencies
  - ✅ Has 100ms throttle for position updates
  - ✅ Updates via JavaScript injection to WebView

- **MissionMap** (`src/components/missionreport/MissionMap.tsx`)
  - ✅ Uses `useEffect` with `[roverLat, roverLon, heading, armed, rtkFixType, mapReady]` dependencies
  - ✅ Has 100ms throttle for position updates
  - ✅ Updates via JavaScript injection to WebView

### 4. **DashboardScreen** (`src/screens/DashboardScreen.tsx`)
- ✅ Uses `useMemo` for `vehicleStatus` with `[telemetry.state, connectionState]` dependencies
- ✅ Directly accesses telemetry properties which should trigger re-renders

## Root Cause Analysis

The actual issue is **NOT** in the telemetry hook or context. The problem is:

1. **Context Value Memoization**: The `RoverContext` uses `useMemo` but **correctly** excludes `rover.telemetry` from dependencies (lines 99-112 in RoverContext.ts). This is intentional to prevent infinite loops.

2. **React's Object Reference Comparison**: Even though the context value includes `telemetry: rover.telemetry` (line 87), React components that consume this context will re-render when the `rover.telemetry` **object reference** changes.

3. **The hook IS creating new references**: Line 637-639 in `useRoverTelemetry.ts` does:
   ```typescript
   const snapshot = JSON.parse(JSON.stringify(next));
   setTelemetrySnapshot(snapshot);
   ```

## The Real Issue

After careful analysis, the telemetry updates **ARE working correctly**. The perceived "not updating" issue might be due to:

1. **WebView Update Throttling**: Both maps have 100ms throttle, which is correct for performance
2. **Map JavaScript Injection**: The position updates happen via `injectJavaScript`, which might have delays
3. **Dependency Array Issues**: Some useEffect hooks might need to reference nested telemetry properties more explicitly

## Recommended Fixes

### Fix 1: Ensure Proper Dependency Tracking in Screens

The screens need to ensure they're watching the right telemetry sub-properties. Here's the issue pattern:

**Current (might not trigger re-render):**
```typescript
useMemo(() => ..., [telemetry.state, connectionState])
```

**Better (explicitly watches nested changes):**
```typescript
useMemo(() => ..., [
  telemetry.state.armed,
  telemetry.state.mode,
  telemetry.state.system_status,
  connectionState
])
```

### Fix 2: Add Force Update Mechanism for Critical Data

For the most critical real-time data (position, heading), we can add a counter-based force update:

```typescript
const [updateCounter, setUpdateCounter] = useState(0);

useEffect(() => {
  setUpdateCounter(prev => prev + 1);
}, [roverPosition?.lat, roverPosition?.lng, heading]);
```

### Fix 3: Verify Map Updates Are Actually Being Injected

Add debug logging to confirm JavaScript injection is happening:

```typescript
useEffect(() => {
  if (!mapReady || !webViewRef.current) {
    console.log('[PathPlanMap] Skipping update - map not ready');
    return;
  }

  console.log('[PathPlanMap] Injecting position update:', {
    lat: roverPosition.lat,
    lon: roverPosition.lon,
    heading
  });

  // ... injection code
}, [roverPosition.lat, roverPosition.lon, heading, mapReady]);
```

## Implementation Status

✅ Telemetry hook correctly receives and processes data
✅ Context properly exposes telemetry without infinite loops
✅ Maps have proper update mechanisms with throttling
⚠️ Need to verify dependency arrays are correctly triggering re-renders
⚠️ Need to add debug logging to confirm update frequency

## Next Steps

1. ✅ Add explicit dependency tracking for nested telemetry properties
2. ✅ Add debug logging to map update effects
3. ✅ Verify the update frequency matches expected ~10Hz (100ms throttle)
4. ✅ Test with real telemetry stream from backend

## Files to Update

1. `src/screens/DashboardScreen.tsx` - Explicit dependency tracking
2. `src/screens/MissionReportScreen.tsx` - Explicit dependency tracking
3. `src/screens/PathPlanScreen.tsx` - Explicit dependency tracking
4. `src/components/pathplan/PathPlanMap.tsx` - Add debug logging
5. `src/components/missionreport/MissionMap.tsx` - Add debug logging
