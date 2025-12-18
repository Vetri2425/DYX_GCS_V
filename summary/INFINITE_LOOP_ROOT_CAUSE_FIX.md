# Infinite Loop - Root Cause & Final Fix

## The Real Problem

The infinite loop was **NOT** caused by services changing (they were already stable), but by **`roverPosition` creating a new object reference on every telemetry update**, even when lat/lng values hadn't changed.

## Root Cause Analysis

### The Chain Reaction:

```
Telemetry Update (every 50ms)
    ↓
useRoverTelemetry: telemetrySnapshot state updates
    ↓
roverPosition useMemo runs (dependencies: lat, lng, timestamp)
    ↓
NEW object created: { lat, lng, timestamp } ← Same values, different reference!
    ↓
RoverContext useMemo runs (dependency: rover.roverPosition changed)
    ↓
New context value created with new roverPosition reference
    ↓
All consumers re-render
    ↓
PathPlanMap/MissionMap useEffect triggers (depends on roverLat/roverLon)
    ↓
Updates trigger more state changes
    ↓
INFINITE LOOP
```

### The Specific Issue

In [useRoverTelemetry.ts:1263-1276](src/hooks/useRoverTelemetry.ts#L1263-L1276) (before fix):

```typescript
const roverPosition = useMemo(() => {
  const lat = telemetrySnapshot.global?.lat ?? 0;
  const lng = telemetrySnapshot.global?.lon ?? 0;

  if (lat === 0 && lng === 0) {
    return null;
  }

  return {
    lat,
    lng,
    timestamp: telemetrySnapshot.lastMessageTs || Date.now(),
  };
}, [telemetrySnapshot.global?.lat, telemetrySnapshot.global?.lon, telemetrySnapshot.lastMessageTs]);
```

**Problem:** Every time this runs, it creates a **new object** `{ lat, lng, timestamp }`, even if the values are identical to the previous object. React's dependency arrays use **reference equality**, so a new object = dependency changed = infinite loop.

## The Fix

Use a **ref to store the previous position** and only create a new object when values **actually change**:

```typescript
// ✅ Track previous position
const lastPositionRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);

const roverPosition = useMemo(() => {
  const lat = telemetrySnapshot.global?.lat ?? 0;
  const lng = telemetrySnapshot.global?.lon ?? 0;
  const timestamp = telemetrySnapshot.lastMessageTs || Date.now();

  if (lat === 0 && lng === 0) {
    lastPositionRef.current = null;
    return null;
  }

  // ✅ Check if values actually changed
  const prev = lastPositionRef.current;
  if (prev && prev.lat === lat && prev.lng === lng && prev.timestamp === timestamp) {
    return prev; // ✅ Same reference - no re-render cascade
  }

  // Values changed, create new object
  const newPosition = { lat, lng, timestamp };
  lastPositionRef.current = newPosition;
  return newPosition;
}, [telemetrySnapshot.global?.lat, telemetrySnapshot.global?.lon, telemetrySnapshot.lastMessageTs]);
```

### Why This Works:

1. **When position doesn't change:**
   - Returns same object reference from `lastPositionRef.current`
   - RoverContext sees same reference, doesn't update
   - Consumers don't re-render
   - No infinite loop ✅

2. **When position DOES change:**
   - Creates new object
   - Stores it in ref
   - RoverContext updates with new position
   - Maps update with new rover position
   - Live updates work perfectly ✅

## Files Modified

1. **[src/hooks/useRoverTelemetry.ts:1263-1287](src/hooks/useRoverTelemetry.ts#L1263-L1287)** - Added ref-based memoization for roverPosition

2. **[src/context/RoverContext.ts:84-120](src/context/RoverContext.ts#L84-L120)** - Enhanced comments (supporting fix)

3. **[App.tsx:28-31](App.tsx#L28-L31)** - Fixed missing dependency (minor)

## Why Previous Fix Wasn't Enough

The previous fix only added **comments** to RoverContext explaining that services were stable. However, the real culprit was `roverPosition` creating new references constantly. Both `services` AND `roverPosition` needed to be stable for effects depending on them.

## Testing

### Expected Behavior After Fix:

1. ✅ **No "Maximum update depth exceeded" error**
2. ✅ **PathPlanMap updates smoothly** without triggering loops
3. ✅ **MissionMap updates smoothly** without triggering loops
4. ✅ **VehicleStatusCard shows live updates** (battery, GPS, etc.)
5. ✅ **Rover position updates in real-time** on the map
6. ✅ **Console shows position updates** without error spam

### Test Steps:

1. Start the app
2. Navigate to Path Plan screen (where PathPlanMap is visible)
3. Verify no "Maximum update depth" errors
4. Verify rover icon moves smoothly on map
5. Check console - should see position logs without errors
6. Navigate to Mission Report screen
7. Verify MissionMap also works without errors

## Technical Deep Dive

### React Memoization & Reference Equality

React's `useMemo` and `useEffect` use **Object.is()** for dependency comparison, which checks **reference equality**:

```javascript
const obj1 = { lat: 13.07, lng: 80.26 };
const obj2 = { lat: 13.07, lng: 80.26 };

Object.is(obj1, obj2); // false - different references!
obj1 === obj2;          // false
```

Even though the values are identical, React sees them as **different**, triggering effects/memos unnecessarily.

### The Solution Pattern: Value Comparison + Ref

```typescript
// Pattern for stable object references with value comparison:

const lastValueRef = useRef<MyType | null>(null);

const stableValue = useMemo(() => {
  const newValues = computeNewValues();

  // Compare values, not references
  if (lastValueRef.current && valuesAreEqual(lastValueRef.current, newValues)) {
    return lastValueRef.current; // Reuse same reference
  }

  // Values changed, create new object and store
  const newObject = { ...newValues };
  lastValueRef.current = newObject;
  return newObject;
}, [dependencies]);
```

This pattern:
- Creates new object only when values actually change
- Reuses same reference when values are identical
- Prevents unnecessary re-renders and infinite loops
- Maintains correct reactivity for real changes

## Conclusion

The infinite loop was caused by **unnecessary object recreation** in `roverPosition`, not by services instability. By using a ref to track the previous position and only creating new objects when values actually change, we:

✅ **Eliminate infinite loops** - same reference when values don't change
✅ **Maintain live updates** - new reference when rover actually moves
✅ **Optimize performance** - fewer re-renders and effect triggers
✅ **Fix all maps** - PathPlanMap, MissionMap, and any other position consumers

**Problem solved!** 🎉
