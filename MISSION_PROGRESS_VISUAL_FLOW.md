# Mission Progress Panel - Visual Logic Flow Diagrams

## 1. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Rover Controller)                    │
│  Sends mission_status events with:                               │
│  - currentWaypoint                                               │
│  - waypoint_status (completed/marked/pending/skipped)            │
│  - completion_time                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket Events
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND (MissionReportScreen)                       │
│  Receives events and updates:                                    │
│  - currentIndex (from waypoint SN)                               │
│  - statusMap[wp.sn] = { status, timestamp, ... }                │
│  - isMissionActive (false when completed)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ useMemo calculates
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            CALCULATED VALUES (useMemo hooks)                      │
│  markedCount = count(statusMap where                             │
│                status === 'completed' || 'marked')               │
└────────────────────────────┬────────────────────────────────────┘
                             │ Passes as props
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         MissionProgressCard Component                             │
│  Input Props:                                                    │
│  - waypoints: Waypoint[]                                         │
│  - currentIndex: number | null                                   │
│  - markedCount: number                                           │
│  - statusMap: {...}                                              │
│  - isMissionActive: boolean                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │ Calculates
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         THREE COUNTERS DISPLAYED                                  │
│  ┌─────────┐  ┌──────────┐  ┌──────┐                             │
│  │ Marked  │  │ Current  │  │ Next │                             │
│  │   {n}   │  │ {wp.sn}  │  │ {wp.sn}                            │
│  └─────────┘  └──────────┘  └──────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. MARKED Counter - How It Works

```
INPUT: statusMap
  {
    1: { status: 'completed' },      ← Counted ✓
    2: { status: 'marked' },         ← Counted ✓
    3: { status: 'pending' },        ← NOT counted ✗
    4: { status: 'skipped' },        ← NOT counted ✗
    5: { status: 'reached' }         ← NOT counted ✗
  }

FILTER: status === 'completed' || status === 'marked'
           ↓
         2 items pass

OUTPUT: markedCount = 2
```

### Timeline Example:

```
Mission starts with 5 waypoints

T=0s:   Current=WP1, Marked=0
        ┌─────────────────────────────┐
        │ Marked: 0 │ Current: 1 │ Next: 2 │
        └─────────────────────────────┘

T=10s:  WP1 completed, Current=WP2, Marked=1
        ┌─────────────────────────────┐
        │ Marked: 1 │ Current: 2 │ Next: 3 │
        └─────────────────────────────┘

T=20s:  WP2 marked, Current=WP3, Marked=2
        ┌─────────────────────────────┐
        │ Marked: 2 │ Current: 3 │ Next: 4 │
        └─────────────────────────────┘

T=30s:  WP3 completed, Current=WP4, Marked=3
        ┌─────────────────────────────┐
        │ Marked: 3 │ Current: 4 │ Next: 5 │
        └─────────────────────────────┘

T=40s:  WP4 skipped, Current=WP5, Marked=3 (skipped doesn't count)
        ┌─────────────────────────────┐
        │ Marked: 3 │ Current: 5 │ Next: — │
        └─────────────────────────────┘

T=50s:  WP5 completed, Mission ends, Marked=4
        ┌──────────────────────────────┐
        │ Marked: 4 │ Current: ✓ │ Next: ✓ │
        └──────────────────────────────┘
```

---

## 3. CURRENT Counter - Index Mapping

```
waypoints array (0-indexed):
  [0] WP with sn=1
  [1] WP with sn=2
  [2] WP with sn=3
  [3] WP with sn=4
  [4] WP with sn=5

currentIndex → Displayed Value
  0          → 1 (sn of waypoints[0])
  1          → 2 (sn of waypoints[1])
  2          → 3 (sn of waypoints[2])
  3          → 4 (sn of waypoints[3])
  4          → 5 (sn of waypoints[4])
  null       → —
```

### Key Point:
```
currentIndex is ZERO-BASED (programming array index)
But displays WAYPOINT SN (1-based user-facing number)

currentIndex=0 displays as "Current: 1"  ← User sees waypoint #1
```

---

## 4. NEXT Counter - Lookahead Logic

```
CALCULATION:
  nextIndex = currentIndex + 1

Examples:

currentIndex=0
  nextIndex = 0 + 1 = 1
  waypoints[1].sn = 2
  Displays: "Next: 2" ✓

currentIndex=3
  nextIndex = 3 + 1 = 4
  waypoints[4].sn = 5
  Displays: "Next: 5" ✓

currentIndex=4 (last waypoint)
  nextIndex = 4 + 1 = 5
  waypoints[5] = undefined (out of bounds)
  Displays: "Next: —" ✓

currentIndex=null (mission not started)
  nextIndex = -1 + 1 = 0
  waypoints[0].sn = 1
  Displays: "Next: 1"
  ⚠️ Might confuse user (mission not started yet!)
```

---

## 5. Mission Completion Detection Logic

```
CONDITION:
const isMissionCompleted = 
  waypoints.every(wp => {
    const wpStatus = statusMap[wp.sn];
    return wpStatus && 
           (wpStatus.status === 'completed' || wpStatus.status === 'skipped');
  }) && 
  !isMissionActive;

REQUIRES ALL OF:
  ✓ Every waypoint has status in statusMap
  ✓ Every waypoint status is 'completed' OR 'skipped'
  ✓ isMissionActive === false

Example 1 - Mission Complete ✓
  statusMap = {
    1: { status: 'completed' },
    2: { status: 'completed' },
    3: { status: 'skipped' },
    4: { status: 'completed' },
    5: { status: 'completed' }
  }
  isMissionActive = false
  → Result: TRUE ✓

Example 2 - Still in Progress ✗
  statusMap = {
    1: { status: 'completed' },
    2: { status: 'pending' },    ← Still pending!
    3: { status: 'skipped' },
    4: { status: 'completed' },
    5: { status: 'completed' }
  }
  isMissionActive = false
  → Result: FALSE ✗

Example 3 - Missing Data ✗
  statusMap = {
    1: { status: 'completed' },
    2: { status: 'completed' },
    // Missing WP 3, 4, 5 ← No data!
  }
  isMissionActive = false
  → Result: FALSE ✗ (statusMap[wp.sn] undefined)
```

---

## 6. UI Display Modes

### Mode A: Mission Active (in progress)
```
┌─────────────────────────────────┐
│    MISSION PROGRESS             │
│  Current: 2/5                   │
├─────────────────────────────────┤
│  Distance: 45.3m                │
├─────────────────────────────────┤
│  ┌────────┬────────┬────────┐   │
│  │Marked  │Current │Next    │   │
│  │   3    │   2    │   3    │   │
│  │        │(cyan)  │(green) │   │
│  └────────┴────────┴────────┘   │
└─────────────────────────────────┘
```

### Mode B: Mission Complete
```
┌─────────────────────────────────┐
│    MISSION PROGRESS             │
│  Current: 5/5                   │
├─────────────────────────────────┤
│  Distance: —                    │
├─────────────────────────────────┤
│  ┌────────┬────────┬────────┐   │
│  │Marked  │Current │Next    │   │
│  │   5    │   ✓ 0  │   ✓ 0  │   │
│  │        │(green) │(green) │   │
│  └────────┴────────┴────────┘   │
└─────────────────────────────────┘
```

---

## 7. Dependency Chain - Data Accuracy

```
┌──────────────────────────────────────┐
│  Backend Sends mission_status Event   │
│  { wp_sn: 2, status: "completed" }   │
└────────────────────┬─────────────────┘
                     │
                     ▼
┌──────────────────────────────────────┐
│  Frontend Updates statusMap            │
│  statusMap[2] = { status: 'completed'}│
└────────────────────┬─────────────────┘
                     │
                     ▼
┌──────────────────────────────────────┐
│  markedCount useMemo Recalculates     │
│  markedCount = 3 (e.g.)              │
└────────────────────┬─────────────────┘
                     │
                     ▼
┌──────────────────────────────────────┐
│  MissionProgressCard Re-renders       │
│  Displays: Marked: 3                 │
└──────────────────────────────────────┘

PROBLEM: If backend event doesn't arrive
  → statusMap not updated
  → markedCount stays wrong
  → UI shows wrong value! 🔴
```

---

## 8. Edge Cases & Risks

```
EDGE CASE 1: Mission paused
  Status: IN PROGRESS              Current: 3, Next: 4
  But rover: STOPPED               (misleading - rover isn't moving toward "Next")
  ⚠️ UI shows "Next" but rover stationary

EDGE CASE 2: Skipped waypoint
  WP1: completed
  WP2: skipped              ← Counts as "marked"?
  WP3: completed
  Display: Marked: 2       ← Doesn't count skipped (current logic)
  ⚠️ Skipped waypoint removed from "Marked" count

EDGE CASE 3: Backend connectivity lost
  statusMap frozen at last event
  Rover actually at WP5
  UI shows: Current: 3     ← Stale data!
  ⚠️ User thinks rover at WP3 but it's actually at WP5

EDGE CASE 4: Mission not started
  currentIndex = null
  Display: Current: —, Next: 1
  ⚠️ User might think mission started (shows "Next: 1")

EDGE CASE 5: Final waypoint
  currentIndex = 4 (last)
  Display: Current: 5, Next: —
  Mission completes
  Display: Current: ✓0, Next: ✓0   ← Changes UI mode
  ✓ Correct behavior
```

---

## 9. Distance Calculation

```
ALGORITHM: Vincenty formula (geodetic)
  Input: Current WP coords, Next WP coords
  Process: 100-iteration calculation
  Output: Distance in meters ±0.5mm accuracy

Example:
  Current: (10.123456, 105.987654)
  Next:    (10.124789, 105.988765)
  Result:  Distance: 145.2m

FALLBACK: If Vincenty doesn't converge
  → Use Haversine formula
  → Less accurate but faster
  → Accuracy: ±0.5% (typical)
```

---

## Summary Table

| Component | Data Source | Logic | Accuracy | Issues |
|-----------|-------------|-------|----------|--------|
| **Marked** | statusMap | Count 'completed' + 'marked' | Depends on backend events | Doesn't include 'skipped' |
| **Current** | currentIndex | waypoints[currentIndex].sn | Real-time from backend | Stale if backend events missing |
| **Next** | currentIndex+1 | waypoints[currentIndex+1].sn | Real-time from backend | Shows "Next" even when paused |
| **Distance** | Vincenty calc | Haversine fallback | ±0.5mm to ±0.5% | None |
