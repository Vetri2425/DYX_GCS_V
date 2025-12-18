# Mission Progress Behavior at End of Mission - Analysis

## Overview
This document analyzes how mission progress is calculated, displayed, and behaves when a mission reaches completion in the DYX-GCS-Mobile application.

---

## Progress Calculation Architecture

### 1. **Telemetry-Based Progress** (useRoverTelemetry.ts)

**Location**: [src/hooks/useRoverTelemetry.ts](src/hooks/useRoverTelemetry.ts#L285-L310)

```typescript
// Mission progress from telemetry data
const activeIndex = typeof data.activeWaypointIndex === 'number' && data.activeWaypointIndex >= 0
  ? data.activeWaypointIndex
  : null;
const completedCount = Array.isArray(data.completedWaypointIds)
  ? data.completedWaypointIds.length
  : 0;
const currentWp = activeIndex != null ? activeIndex + 1 : 0;
const inferredTotal = Math.max(
  currentWp,
  completedCount,
  typeof data.current_waypoint_id === 'number' ? data.current_waypoint_id : 0,
);

if (activeIndex != null || completedCount > 0) {
  const total = inferredTotal || (currentWp > 0 ? currentWp : completedCount);
  const progress = total > 0 ? (currentWp / total) * 100 : 0;
  envelope.mission = {
    total_wp: total,
    current_wp: currentWp,
    status: currentWp > 0 ? 'ACTIVE' : 'IDLE',
    progress_pct: progress,
  };
}
```

**Progress Formula**:
```
progress_pct = (current_wp / total_wp) * 100
```

**Issue Identified**: When the last waypoint is reached (e.g., waypoint 10/10), the progress shows 100%, but `current_wp = 10` and `total_wp = 10`, so the calculation is correct. However, the system needs to handle the transition from "active at last waypoint" to "completed".

### 2. **Mission Status Socket Updates** (useRoverTelemetry.ts)

**Location**: [src/hooks/useRoverTelemetry.ts](src/hooks/useRoverTelemetry.ts#L800-L815)

```typescript
socket.on(SOCKET_EVENTS.MISSION_STATUS, (data: any) => {
  setTelemetrySnapshot((prev) => ({
    ...prev,
    mission: {
      total_wp: data.total_waypoints || prev.mission.total_wp,
      current_wp: data.current_waypoint || prev.mission.current_wp,
      status: data.mission_state || data.mission_mode || prev.mission.status,
      progress_pct:
        data.total_waypoints > 0
          ? Math.round((data.current_waypoint / data.total_waypoints) * 100)
          : prev.mission.progress_pct,
    },
    lastMessageTs: Date.now(),
  }));
});
```

**Key Observation**: The progress percentage is recalculated on every mission status update from the backend.

---

## UI Display Components

### 3. **Mission Progress Card** (MissionProgressCard.tsx)

**Location**: [src/components/missionreport/MissionProgressCard.tsx](src/components/missionreport/MissionProgressCard.tsx#L1-L320)

**Progress Display Logic**:

```typescript
const totalWaypoints = waypoints.length;
const markedCount = providedMarkedCount ?? 0;

// Check if mission is completed
const isMissionCompleted = waypoints.length > 0 && waypoints.every(wp => {
  const wpStatus = statusMap[wp.sn];
  return wpStatus && (wpStatus.status === 'completed' || wpStatus.status === 'skipped');
}) && !isMissionActive;

const completedCount = waypoints.filter(wp => {
  const wpStatus = statusMap[wp.sn];
  return wpStatus && wpStatus.status === 'completed';
}).length;

const skippedCount = waypoints.filter(wp => {
  const wpStatus = statusMap[wp.sn];
  return wpStatus && wpStatus.status === 'skipped';
}).length;
```

**End of Mission Display**:
When `isMissionCompleted = true`, the card shows:
- **Marked**: Total marked waypoints
- **Current**: ✅ "Done" (with green check)
- **Next**: ✅ "Done" (with green check)

**During Mission Display**:
- **Marked**: Count of marked waypoints
- **Current**: Current waypoint sn
- **Next**: Next waypoint sn (or "—" if none)

---

## Mission Completion Detection

### 4. **Completion Detection Logic** (MissionReportScreen.tsx)

**Location**: [src/screens/MissionReportScreen.tsx](src/screens/MissionReportScreen.tsx#L300-L370)

**Two Mechanisms for Detecting Completion**:

#### A. **Status Map-Based Detection** (Client-side)

```typescript
useEffect(() => {
  // Derive currentIndex from statusMap (find first non-completed waypoint)
  const derivedIndex = waypoints.findIndex(wp => {
    const wpStatus = statusMap[wp.sn];
    return !wpStatus || (wpStatus.status !== 'completed' && wpStatus.status !== 'skipped');
  });

  // derivedIndex === -1 means all waypoints are completed
  const finalIndex = derivedIndex === -1 ? null : derivedIndex;

  setCurrentIndex(prev => {
    if (prev !== finalIndex) {
      // Check for mission completion
      if (finalIndex === null && prev !== null && waypoints.length > 0) {
        const allCompleted = waypoints.every(wp => {
          const wpStatus = statusMap[wp.sn];
          return wpStatus && (wpStatus.status === 'completed' || wpStatus.status === 'skipped');
        });

        if (allCompleted && !missionEndTime && isMissionActive) {
          console.log('[MissionReportScreen] 🏁 Mission completion detected - all waypoints processed!');
          
          const completionTime = new Date();
          setMissionEndTime(completionTime);
          setIsMissionActive(false); // Reset START/STOP button
          
          preserveCurrentMission();
          showNotification('success', 'Mission Completed', 'All waypoints have been processed!');
          setShowCompletionDialog(true);
        }
      }
      return finalIndex;
    }
    return prev;
  });
}, [statusMap, waypoints, missionStartTime, missionEndTime, isMissionActive]);
```

**Trigger**: When `statusMap` updates and all waypoints are marked as `completed` or `skipped`.

#### B. **Backend Mission Event** (Server-side)

**Location**: [src/screens/MissionReportScreen.tsx](src/screens/MissionReportScreen.tsx#L1115-L1175)

```typescript
// Handle mission completed event - including mission_state: completed
if (eventType === 'mission_completed' ||
    event.event_type === 'mission_completed' ||
    event.mission_state === 'completed' ||
    (event.data && event.data.event_type === 'mission_completed') ||
    (event.data && event.data.mission_state === 'completed')) {
  
  console.log('[MissionReportScreen] 🏁 Mission completed event received from backend');

  // Set mission start time if not set (fallback)
  if (!missionStartTime) {
    if (event.completion_time && event.mission_duration) {
      const completionDate = new Date(event.completion_time);
      const startDate = new Date(completionDate.getTime() - (event.mission_duration * 1000));
      setMissionStartTime(startDate);
    } else {
      setMissionStartTime(new Date(Date.now() - 60000)); // Fallback: 1 minute ago
    }
  }

  // Set mission end time
  if (!missionEndTime) {
    const completionTime = event.completion_time ? new Date(event.completion_time) : new Date();
    setMissionEndTime(completionTime);
  }

  // Mark mission as inactive
  setIsMissionActive(false);
  
  // Preserve mission data for export
  preserveCurrentMission();

  // Show completion notification
  showNotification('success', 'Mission Completed', 'All waypoints have been processed!');
  
  // Show completion dialog after 1 second
  setTimeout(() => {
    setShowCompletionDialog(true);
  }, 1000);
}
```

**Trigger**: Backend sends `mission_completed` event via WebSocket.

---

## Mission Progress at Final Waypoint

### Scenario: Mission with 10 waypoints

**Waypoint 9 → Waypoint 10 Transition**:

1. **At Waypoint 9**:
   - `current_wp = 9`
   - `total_wp = 10`
   - `progress_pct = (9/10) * 100 = 90%`
   - Display: "9/10" in progress card

2. **Reaching Waypoint 10**:
   - Backend emits `waypoint_reached` event for waypoint 10
   - `current_wp = 10`
   - `total_wp = 10`
   - `progress_pct = (10/10) * 100 = 100%`
   - Display: "10/10" in progress card
   - Status: Still `ACTIVE`

3. **Completing Waypoint 10**:
   - Backend emits `waypoint_marked` or `waypoint_completed` event
   - `statusMap[10]` updated to `{status: 'completed', marked: true}`
   - Client detects all waypoints completed
   - `currentIndex` becomes `null` (no next waypoint)
   - Progress card switches to completion view

4. **Mission Completion**:
   - Backend emits `mission_completed` event
   - OR client detects all waypoints in `statusMap` are completed
   - `isMissionActive = false`
   - `missionEndTime` set
   - Completion dialog shown
   - Progress card shows "Done" for Current and Next

---

## Potential Issues at End of Mission

### Issue 1: **Progress Stuck at 90% Instead of 100%**

**Symptoms**:
- Mission shows "9/10" but never "10/10"
- Progress stuck at 90% even after completing all waypoints

**Possible Causes**:
1. Backend not sending `waypoint_reached` event for last waypoint
2. Last waypoint index calculation is off-by-one (0-based vs 1-based)
3. Mission completion event arrives before last waypoint status update

**Fix Verification Needed**:
```typescript
// Check if last waypoint event is received
console.log('[MISSION_EVENT] waypoint_reached: wpId=', event.waypoint_id);

// Check if progress calculation handles last waypoint
const progress = total > 0 ? (currentWp / total) * 100 : 0;
// When currentWp = 10 and total = 10, progress should be 100%
```

### Issue 2: **Race Condition Between Client and Server Completion**

**Symptoms**:
- Completion dialog shows twice
- Mission state flickers between active and completed

**Root Cause**:
Both client-side (`statusMap` detection) and server-side (`mission_completed` event) trigger completion independently.

**Current Mitigation**:
```typescript
// Only trigger if not already completed
if (allCompleted && !missionEndTime && isMissionActive) {
  setMissionEndTime(completionTime);
  setIsMissionActive(false);
  // ...
}
```

### Issue 3: **Progress Calculation with Skipped Waypoints**

**Current Behavior**:
- Progress based on `current_wp / total_wp`
- Skipped waypoints count toward completion
- Progress can jump (e.g., 70% → 100% when skipping multiple waypoints)

**Expected Behavior**:
- Progress should reflect actual mission advancement
- Skipped waypoints should be counted as "processed" for completion but may need special handling in progress display

---

## Recommendations

### 1. **Add Explicit 100% Progress State**

```typescript
// In useRoverTelemetry.ts - Mission status handler
socket.on(SOCKET_EVENTS.MISSION_STATUS, (data: any) => {
  const isLastWaypoint = data.current_waypoint >= data.total_waypoints;
  const allComplete = data.mission_state === 'completed' || 
                     data.mission_mode === 'completed';
  
  setTelemetrySnapshot((prev) => ({
    ...prev,
    mission: {
      total_wp: data.total_waypoints || prev.mission.total_wp,
      current_wp: data.current_waypoint || prev.mission.current_wp,
      status: data.mission_state || data.mission_mode || prev.mission.status,
      progress_pct: allComplete || isLastWaypoint
        ? 100
        : data.total_waypoints > 0
          ? Math.round((data.current_waypoint / data.total_waypoints) * 100)
          : prev.mission.progress_pct,
    },
    lastMessageTs: Date.now(),
  }));
});
```

### 2. **Ensure Last Waypoint Progress Update**

```typescript
// In MissionReportScreen.tsx - waypoint_reached handler
if (eventType === 'waypoint_reached' || event.event_type === 'waypoint_reached') {
  const wpId = event.waypoint_id ?? event.id;
  const isLastWaypoint = wpId === waypoints.length;
  
  setStatusMap(prev => ({
    ...prev,
    [wpId]: {
      ...prev[wpId],
      reached: true,
      status: 'reached',
      timestamp: new Date().toLocaleTimeString(),
    },
  }));
  
  // Force progress to 100% if this is the last waypoint
  if (isLastWaypoint) {
    console.log('[MissionReportScreen] 🎯 Last waypoint reached - forcing 100% progress');
    // Could emit a custom event or update UI state here
  }
}
```

### 3. **Add Progress Validation Logging**

```typescript
// Add diagnostic logging
useEffect(() => {
  const completed = waypoints.filter(wp => {
    const wpStatus = statusMap[wp.sn];
    return wpStatus && (wpStatus.status === 'completed' || wpStatus.status === 'skipped');
  }).length;
  
  const calculatedProgress = waypoints.length > 0 
    ? Math.round((completed / waypoints.length) * 100) 
    : 0;
  
  console.log('[MissionProgress] Progress check:', {
    total: waypoints.length,
    completed,
    calculatedProgress,
    currentIndex,
    isMissionActive,
    lastWaypointStatus: waypoints.length > 0 ? statusMap[waypoints[waypoints.length - 1].sn] : null
  });
}, [statusMap, waypoints, currentIndex, isMissionActive]);
```

### 4. **Synchronize Completion Detection**

Add a flag to prevent duplicate completion triggers:

```typescript
const completionTriggeredRef = useRef(false);

// In both completion handlers (statusMap and mission_completed event)
if (allCompleted && !completionTriggeredRef.current) {
  completionTriggeredRef.current = true;
  
  setMissionEndTime(completionTime);
  setIsMissionActive(false);
  preserveCurrentMission();
  showNotification('success', 'Mission Completed', 'All waypoints have been processed!');
  setShowCompletionDialog(true);
}

// Reset on mission start
if (eventType === 'mission_started') {
  completionTriggeredRef.current = false;
}
```

---

## Testing Checklist

### End of Mission Behavior Tests

- [ ] **Test 1**: Complete all 10 waypoints normally
  - Progress shows: 10%, 20%, 30%... 90%, **100%**
  - Last waypoint shows in Current counter
  - Completion dialog appears

- [ ] **Test 2**: Complete with some skipped waypoints
  - Progress updates correctly (e.g., 10%, 20%, skip → 40%, 50%...)
  - Skipped waypoints counted as processed
  - Completion triggers when all waypoints are processed (completed or skipped)

- [ ] **Test 3**: Stop mission at waypoint 9, then restart
  - Progress resumes from waypoint 9
  - Completing waypoint 10 triggers completion

- [ ] **Test 4**: Mission with single waypoint
  - Progress: 0% → 100% (no intermediate states)
  - Completion triggers immediately after waypoint 1 completed

- [ ] **Test 5**: Backend completion event arrives before last waypoint status
  - No duplicate completion dialogs
  - Progress shows 100%
  - UI shows "Done" state

- [ ] **Test 6**: Network disconnection at waypoint 10
  - Client-side completion detection triggers
  - Mission data preserved for export
  - Reconnection doesn't cause duplicate completion

---

## Summary

**Current State**: The mission progress system has **dual completion detection** (client and server) which provides robustness but can cause race conditions. Progress calculation is mathematically correct (current_wp/total_wp * 100), but the transition from 90% → 100% → "Done" state may not always be smooth due to event timing.

**Key Finding**: The progress percentage reaches 100% when `current_wp === total_wp`, but the "completed" state requires either:
1. All waypoints in `statusMap` marked as completed/skipped (client-side), OR
2. Backend `mission_completed` event (server-side)

**Most Critical Issue**: Ensuring the **last waypoint's `waypoint_reached` and `waypoint_completed` events** are received and processed before mission completion is declared.

**Recommended Focus**: Add explicit logging and validation for the last waypoint (waypoint 10/10) to ensure it always shows 100% progress before transitioning to "Done" state.
