# Waypoint Servo Checkbox Fix Summary

## Issues Found

1. **Stale Closure Issue**: The `handleToggleMark` callback was capturing old waypoint state
2. **Undefined Array Error**: When toggling checkbox, `missionWaypoints` could become undefined causing crash
3. **Cache Issue**: Servo config was only loaded once on mount, not reflecting backend changes

## Fixes Applied

### 1. Fixed handleToggleMark (PathPlanScreen.tsx)
```typescript
const handleToggleMark = React.useCallback((id: number, newMarkValue: boolean) => {
  setMissionWaypoints(prevWaypoints => {
    // Guard against undefined/null
    if (!prevWaypoints || !Array.isArray(prevWaypoints)) {
      console.warn('[PathPlan] Cannot toggle mark - waypoints is not an array:', prevWaypoints);
      return prevWaypoints || [];
    }
    
    return prevWaypoints.map(wp => {
      const wpId = wp.sn ?? wp.id;
      return wpId === id ? { ...wp, mark: newMarkValue } : wp;
    });
  });
}, [setMissionWaypoints]);
```

**Changes:**
- Uses functional setState to avoid stale closures
- Adds guard clause to prevent undefined array errors
- Returns empty array if waypoints is invalid

### 2. Added Servo Config Polling (PathPlanScreen.tsx)
```typescript
useEffect(() => {
  const fetchServoConfig = async () => {
    try {
      const res: any = await services.getMissionServoConfig();
      const cfg = res?.message || res?.config || res?.data || res;
      if (typeof cfg?.servo_enabled === 'boolean') {
        setGlobalServoEnabled(cfg.servo_enabled);
        console.log('[PathPlan] Servo config loaded:', cfg.servo_enabled);
      }
    } catch (err) {
      console.error('[PathPlan] Failed to fetch servo config:', err);
    }
  };

  fetchServoConfig();

  // Poll for servo config changes every 2 seconds
  const interval = setInterval(fetchServoConfig, 2000);

  return () => clearInterval(interval);
}, [services]);
```

**Changes:**
- Polls servo config every 2 seconds
- Updates `globalServoEnabled` when backend changes
- No app reload required to see servo config changes

## Result

- ✅ Checkboxes can now be toggled without errors
- ✅ Servo config changes are reflected immediately (within 2 seconds)
- ✅ No more "map is not a function" crashes
- ✅ New waypoints respect current servo config setting
