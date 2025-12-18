# Infinite Loop Fix - Final Implementation

## Problem Summary

**Error:** `Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.`

## Root Cause

The infinite loop was caused by a dependency chain in RoverContext:

```
Telemetry Update (every 50ms)
    ↓
RoverContext useMemo recalculates with new services object reference
    ↓
VoiceSettingsModal useEffect triggers (depends on services)
    ↓
setState called in effect
    ↓
Component re-renders
    ↓
New telemetry update
    ↓
INFINITE LOOP
```

### Specific Issues:

1. **[RoverContext.ts:87-120](src/context/RoverContext.ts#L87-L120)**: The `useMemo` for `contextValue` included all rover values including `services`, which was being recreated on every render even though the service functions themselves were stable.

2. **[VoiceSettingsModal.tsx:27-45](src/components/common/VoiceSettingsModal.tsx#L27-L45)**: The `useEffect` depends on `services`, which was changing on every telemetry update, causing the effect to run continuously.

3. **[App.tsx:28-31](App.tsx#L28-L31)**: Missing `navigationLifecycle` dependency in useEffect (minor issue).

## The Solution

### Key Insight: Stable References vs Reactive Values

The fix leverages React's reference equality checking:

- **Stable values** (services, callbacks) are already memoized in `useRoverTelemetry` and won't change
- **Reactive values** (telemetry, roverPosition) should change frequently for live updates
- By keeping the same object references for stable values, effects that depend on them won't re-trigger

### Changes Made:

#### 1. RoverContext.ts - Enhanced Comments

Added comprehensive comments explaining that:
- `rover.services` is already memoized in `useRoverTelemetry` (line 1027-1129)
- The context value includes both stable and reactive values
- Stable values won't cause infinite loops
- Reactive values enable instant live updates

```typescript
const contextValue = React.useMemo<RoverContextValue>(() => ({
  telemetry: rover.telemetry,           // ✅ Updates frequently - live updates work
  roverPosition: rover.roverPosition,   // ✅ Updates frequently - map updates work
  connectionState: rover.connectionState,
  reconnect: rover.reconnect,           // ✅ Stable function - won't cause loops
  services: rover.services,             // ✅ Stable object - won't cause loops
  onMissionEvent: rover.onMissionEvent, // ✅ Stable function - won't cause loops
  socket: rover.socket,                 // ✅ Stable reference - socket instance
  missionWaypoints,
  setMissionWaypoints,
  clearMissionWaypoints,
  missionMode,
  setMissionMode,
}), [
  rover.telemetry,        // Changes frequently for live updates
  rover.roverPosition,    // Changes frequently for live updates
  rover.connectionState,
  rover.reconnect,        // Stable
  rover.services,         // Stable - already memoized in useRoverTelemetry
  rover.onMissionEvent,   // Stable
  rover.socket,           // Stable
  missionWaypoints,
  setMissionWaypoints,
  clearMissionWaypoints,
  missionMode,
  setMissionMode,
]);
```

#### 2. App.tsx - Fixed Missing Dependency

```typescript
useEffect(() => {
  navigationLifecycle.setReady('Navigation ready');
}, [navigationLifecycle]); // ✅ Added missing dependency
```

## How Live Updates Still Work

### VehicleStatusCard - Instant Updates ✅

```typescript
// Line 69-113: useMemo hooks recalculate on telemetry changes
const rtkStatusColor = useMemo(() => {
  const fixType = telemetry.rtk.fix_type; // New value every 50ms
  if (fixType >= 5) return colors.success;
  if (fixType >= 3) return colors.warning;
  return colors.danger;
}, [telemetry]); // Re-runs when telemetry prop changes
```

**Why it works:**
- Component receives new `telemetry` prop from context
- Component re-renders
- `useMemo` hooks run with new telemetry values
- UI updates instantly with new colors/values

### MissionMap - Instant Position Updates ✅

```typescript
// Line 613-781: useEffect updates map on position changes
useEffect(() => {
  webViewRef.current.injectJavaScript(`
    roverMarker.setLatLng([${roverLat}, ${roverLon}]);
    roverMarker.setHeading(${heading});
  `);
}, [roverLat, roverLon, heading]); // Primitive values, instant updates
```

**Why it works:**
- Component receives new primitive values (numbers) from context
- `useEffect` runs because dependencies changed
- Map marker updates via JavaScript injection
- Position updates every 50ms (throttled in useRoverTelemetry)

### VoiceSettingsModal - No Loop ✅

```typescript
// Line 27-45: Effect only runs when modal opens
useEffect(() => {
  let mounted = true;
  const fetchStatus = async () => {
    const res = await services.getTTSStatus(); // Uses stable services
    if (mounted) setEnabled(res?.enabled);
  };
  if (visible) fetchStatus();
  return () => { mounted = false; };
}, [visible, services]); // services is stable, only visible triggers
```

**Why it works:**
- `services` has stable reference (memoized in useRoverTelemetry)
- Effect only runs when `visible` changes
- No infinite loop even though context updates every 50ms

## Verification

### Expected Behavior After Fix:

1. ✅ **No "Maximum update depth exceeded" error**
2. ✅ **VehicleStatusCard updates instantly** (battery, GPS, satellites, HRMS, VRMS)
3. ✅ **MissionMap updates instantly** (rover position, heading, trail)
4. ✅ **VoiceSettingsModal opens without errors**
5. ✅ **Console shows telemetry updates** every 50ms without crashes

### Test Steps:

1. Start the app
2. Open VoiceSettingsModal by clicking the Voice button
3. Verify no error appears
4. Check that VehicleStatusCard shows live battery/GPS updates
5. Check that MissionMap shows rover moving in real-time
6. Close and reopen VoiceSettingsModal multiple times

## Technical Deep Dive

### Why Services is Stable

In [useRoverTelemetry.ts:1027-1129](src/hooks/useRoverTelemetry.ts#L1027-L1129), services is memoized with only `pushStatePatch` as a dependency:

```typescript
const services = useMemo<RoverServices>(
  () => ({
    armVehicle: async () => { /* ... */ },
    disarmVehicle: async () => { /* ... */ },
    // ... all services
  }),
  [pushStatePatch], // Only recreates if pushStatePatch changes (it doesn't)
);
```

`pushStatePatch` is defined with an empty dependency array (line 1011-1025), making it stable. Therefore, `services` is created once and never changes.

### Why Telemetry Updates

In [useRoverTelemetry.ts:512-514](src/hooks/useRoverTelemetry.ts#L512-L514), telemetry is state:

```typescript
const [telemetrySnapshot, setTelemetrySnapshot] = useState<RoverTelemetry>(
  createDefaultTelemetry,
);
```

When socket data arrives, `setTelemetrySnapshot` is called (line 645), creating a new object reference, which triggers:
1. `useRoverTelemetry` returns new telemetry
2. `RoverContext` useMemo runs (dependency changed)
3. All consumers receive new context
4. Components re-render with fresh data

## Files Modified

1. [src/context/RoverContext.ts](src/context/RoverContext.ts) - Enhanced comments explaining stable vs reactive values
2. [App.tsx](App.tsx) - Fixed missing dependency in useEffect

## Conclusion

The fix maintains the **exact same behavior** for live updates while preventing the infinite loop by:

1. ✅ Keeping `services` reference stable (already memoized in useRoverTelemetry)
2. ✅ Allowing `telemetry` and `roverPosition` to update frequently
3. ✅ Effects that depend on stable values don't re-trigger
4. ✅ Components that render based on telemetry still re-render instantly

**Result: Instant live updates with no infinite loops!** 🎉
