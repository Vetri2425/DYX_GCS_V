# Waypoint Servo Checkbox Issue - Root Cause Analysis

## Problem
Users are unable to uncheck the servo checkbox for waypoints in the DraggableWaypointsTable.

## Files Involved
1. `src/components/pathplan/DraggableWaypointsTable.tsx` - The table component with checkboxes
2. `src/screens/PathPlanScreen.tsx` - Parent component managing waypoint state

## Current Implementation

### Checkbox Logic (DraggableWaypointsTable.tsx)
```typescript
// Display logic
checked={item.mark !== undefined ? item.mark : globalServoEnabled}

// Toggle logic
onChange={(e) => {
    e.stopPropagation();
    const currentValue = item.mark !== undefined ? item.mark : globalServoEnabled;
    onToggleMark?.(item.id, !currentValue);
}}
```

### State Update Logic (PathPlanScreen.tsx - Line 548)
```typescript
const handleToggleMark = React.useCallback((id: number, mark: boolean) => {
  updateWaypoints(
    waypoints.map(wp => wp.id === id ? { ...wp, mark } : wp)
  );
}, [waypoints, updateWaypoints]);
```

## Root Cause Analysis

The issue is likely caused by **stale closure** in the `handleToggleMark` callback:

1. `handleToggleMark` has `waypoints` in its dependency array
2. Every time waypoints change, a new callback is created
3. The `onToggleMark` prop passed to DraggableWaypointsTable may reference an old version
4. When the checkbox is clicked, it may be using stale waypoint data

## Additional Issue: Data Flow

Looking at PathPlanScreen.tsx lines 115-127:
```typescript
const waypoints = React.useMemo(() =>
  (missionWaypoints as any[]).map((wp, idx) => ({
    id: wp.sn ?? wp.id ?? idx + 1,
    lat: wp.lat,
    lon: wp.lng ?? wp.lon,
    alt: wp.alt ?? 0,
    row: wp.row ?? '',
    block: wp.block ?? '',
    pile: wp.pile ?? String(idx + 1),
    distance: wp.distance ?? 0,
    mark: typeof wp.mark === 'boolean' ? wp.mark : undefined,
  })),
  [missionWaypoints]
);
```

The waypoints are derived from `missionWaypoints` context. When `handleToggleMark` calls `updateWaypoints`, it updates the context, which then flows back through this useMemo.

## Solution

The fix requires updating the `handleToggleMark` callback to avoid stale closures:

```typescript
const handleToggleMark = React.useCallback((id: number, newMarkValue: boolean) => {
  setMissionWaypoints(prevWaypoints => 
    prevWaypoints.map(wp => 
      (wp.sn ?? wp.id) === id ? { ...wp, mark: newMarkValue } : wp
    )
  );
}, [setMissionWaypoints]);
```

This uses the functional update form of setState, which always receives the latest state, avoiding stale closure issues.
