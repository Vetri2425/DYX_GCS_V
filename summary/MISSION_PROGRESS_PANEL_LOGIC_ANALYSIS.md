# Mission Progress Panel Logic Analysis - MARKED/CURRENT/NEXT

## Overview

The **Mission Progress Card** displays three key counters:
1. **Marked** - waypoints that have been marked/completed
2. **Current** - the waypoint currently being processed
3. **Next** - the upcoming waypoint to process

---

## Data Flow

### **Component Props Flow**
```
MissionReportScreen
  ↓
  markedCount (calculated from statusMap)
  currentIndex (tracks current waypoint index)
  statusMap (real-time waypoint status)
  ↓
MissionProgressCard
  ↓
  Displays: Marked / Current / Next values
```

---

## Logic Analysis

### **1. MARKED Counter Logic** ⭐

**File:** [src/screens/MissionReportScreen.tsx](src/screens/MissionReportScreen.tsx#L396-L409)

```typescript
const markedCount = useMemo(() => {
  const count = Object.values(statusMap).filter(
    status => status.status === 'completed' || status.status === 'marked'
  ).length;
  return count;
}, [statusMap]);
```

**What it does:**
- Counts waypoints where `status === 'completed'` **OR** `status === 'marked'`
- Both "completed" and "marked" count as marked waypoints
- ✅ Updates reactively when `statusMap` changes

**Example:**
```
Waypoint 1: status = 'completed' ✓ counts
Waypoint 2: status = 'marked'    ✓ counts
Waypoint 3: status = 'pending'   ✗ doesn't count
Waypoint 4: status = 'skipped'   ✗ doesn't count

Result: markedCount = 2
```

---

### **2. CURRENT Counter Logic**

**File:** [src/components/missionreport/MissionProgressCard.tsx](src/components/missionreport/MissionProgressCard.tsx#L57-L58)

```typescript
const currentWp = currentIndex !== null && currentIndex >= 0 
  ? waypoints[currentIndex] 
  : null;
```

**What it does:**
- Gets the waypoint at `currentIndex` position
- Displays that waypoint's serial number (`sn`)
- Shows "—" if no current waypoint (mission not started)

**Example:**
```
currentIndex = 0  → waypoints[0].sn = 1 (displays "1")
currentIndex = 2  → waypoints[2].sn = 3 (displays "3")
currentIndex = null → displays "—"
```

---

### **3. NEXT Counter Logic**

**File:** [src/components/missionreport/MissionProgressCard.tsx](src/components/missionreport/MissionProgressCard.tsx#L59)

```typescript
const nextIndex = (currentIndex ?? -1) + 1;
const nextWp = nextIndex < totalWaypoints ? waypoints[nextIndex] : null;
```

**What it does:**
1. Calculates `nextIndex = currentIndex + 1`
2. Gets waypoint at that index
3. Shows "—" if no next waypoint (at end of mission)

**Example:**
```
currentIndex = 0  → nextIndex = 1  → displays waypoints[1].sn = 2
currentIndex = 2  → nextIndex = 3  → displays waypoints[3].sn = 4
currentIndex = 4 (last)  → nextIndex = 5 (out of bounds) → displays "—"
currentIndex = null → nextIndex = 0 → displays waypoints[0].sn = 1
```

---

## Display Logic (Active vs Completed)

### **During Active Mission** (when `isMissionActive === true`)

```typescript
// Show normal progress counters
<Marked: purple color>  {markedCount}
<Current: cyan color>   {currentWp?.sn}
<Next: green color>     {nextWp?.sn}
```

### **After Mission Complete** (when `isMissionActive === false`)

```typescript
// Check: are ALL waypoints completed/skipped?
const isMissionCompleted = waypoints.every(wp => {
  const wpStatus = statusMap[wp.sn];
  return wpStatus && (wpStatus.status === 'completed' || wpStatus.status === 'skipped');
}) && !isMissionActive;

// If yes, show completion status:
<Marked: purple>        {markedCount}
<Current: green check>  0
<Next: green check>     0
```

---

## Potential Issues & Edge Cases

### **Issue 1: "Marked" vs "Completed" Confusion** 🤔

**Problem:** The naming is ambiguous:
- `status: 'marked'` - Waypoint was manually marked by user
- `status: 'completed'` - Waypoint was automatically completed by rover

**Both count as "marked"** but they're different concepts!

**Current code:**
```typescript
status === 'completed' || status === 'marked'  // Both treated the same
```

**Question:** Should skipped waypoints count as "marked"? Currently they don't.

---

### **Issue 2: Current/Next During Pause** 🚨

**Scenario:**
1. Mission running: Current = WP2, Next = WP3
2. User pauses mission
3. Current and Next **still show WP2 and WP3**
   - But mission is paused
   - Rover hasn't moved

**Is this correct?** Depends on UX intent:
- ✅ Shows where mission will resume from
- ❌ Misleading - rover isn't moving toward "Next"

---

### **Issue 3: Current Index Update** 🔄

**How `currentIndex` updates:**
- Backend sends `mission_status` events
- FrontEnd updates `currentIndex` based on event
- Component re-renders

**Potential problem:** If backend doesn't send status updates, UI won't update even if rover moved!

---

### **Issue 4: Mission Completion Detection** ⚠️

**Current logic:**
```typescript
const isMissionCompleted = waypoints.every(wp => {
  const wpStatus = statusMap[wp.sn];
  return wpStatus && (wpStatus.status === 'completed' || wpStatus.status === 'skipped');
}) && !isMissionActive;
```

**Problem:** What if:
- Some waypoints never received status updates?
- `statusMap` is missing entries for some waypoints?
- Waypoints were deleted mid-mission?

**Result:** `isMissionCompleted` might be false even if mission truly finished!

---

### **Issue 5: Initial State Before Mission Starts** 📍

**Before mission starts:**
```
markedCount = 0
currentIndex = null → displays "—"
nextIndex = 0 → displays waypoints[0].sn
```

**Is this confusing?**
- User hasn't started mission yet
- But it shows "Next: 1"
- User might think mission already started

---

## Data Accuracy Dependency Chain

```
statusMap (backend events)
  ↓ (updates)
markedCount (calculated)
  ↓ (passed as prop)
MissionProgressCard
  ↓ (displays)
User sees: Marked count

ISSUE: If backend doesn't send events → statusMap doesn't update → markedCount stays wrong!
```

---

## Summary Table

| Counter | Source | Logic | Issues |
|---------|--------|-------|--------|
| **Marked** | `statusMap` | Count where `status === 'completed' \|\| 'marked'` | Doesn't count skipped; depends on backend events |
| **Current** | `currentIndex` | Get `waypoints[currentIndex].sn` | Won't update if backend status events aren't received |
| **Next** | `currentIndex` | Get `waypoints[currentIndex + 1].sn` | Shows next even during pause; confusing if mission not started |

---

## Recommendations

### **1. Better Naming** 📝
Change "Marked" to:
- "Completed" (clearer)
- Or "Progress" + show completed/skipped breakdown

### **2. Handle Missing Status Updates** ✅
Add fallback to calculate current waypoint from:
- Waypoint reached events
- Rover GPS proximity to waypoints
- Time-based estimation

### **3. Mission Start Detection** 🚀
Show different UI before mission starts:
```
Before: "Not Started - Next: 1"
After:  "Current: 1, Next: 2"
```

### **4. Add Skipped to Marked Count** 📊
Consider if skipped waypoints should count as "marked":
```typescript
// Option 1: Skipped counts
status === 'completed' || status === 'marked' || status === 'skipped'

// Option 2: Show separate counts
Completed: 5
Skipped: 2
Marked: 7
```

### **5. Validate statusMap Completeness** 🔍
On mission completion, verify:
```typescript
const missingStatuses = waypoints.filter(wp => !statusMap[wp.sn]);
if (missingStatuses.length > 0) {
  console.warn("Missing status updates for waypoints:", missingStatuses);
  // Handle missing data gracefully
}
```
