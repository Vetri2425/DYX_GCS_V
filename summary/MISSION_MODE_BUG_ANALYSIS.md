# Mission Mode Bug Analysis - Manual Mode Resets to AUTO on Start

## Problem Description
When user clicks the MANUAL button and then starts a mission, the mode suddenly changes to AUTO, but switching back to MANUAL works correctly.

---

## Root Cause Analysis

### **This is a UI LOGIC MISTAKE (Not a Backend Problem)**

#### Issue Location:
**File:** [src/screens/MissionReportScreen.tsx](src/screens/MissionReportScreen.tsx#L776-L777)

#### The Bug:
```tsx
// Line 774-777 in executeStartMission()
// Clear previous mission data to start fresh
clearCurrentMissionData();

// Set mode to AUTO first (best-effort) ❌ BUG HERE
await services.setMode('AUTO');
setMode('AUTO');  // ❌ This ALWAYS sets mode to AUTO, overwriting user's MANUAL choice

// Call explicit start endpoint
const response = await services.startMission();
```

---

## Why This Happens

### Flow When User Clicks START:
1. **User selects MANUAL** → Mode UI shows MANUAL button highlighted
   - `mode` state = 'MANUAL'
   - Backend has been set to MANUAL via `services.setMode('MANUAL')`

2. **User clicks START** → Calls `executeStartMission()`
   - Line 776: `await services.setMode('AUTO')` → Backend set to AUTO
   - Line 777: `setMode('AUTO')` → Local state forced to AUTO
   - ❌ **User's MANUAL mode choice is discarded**

3. **Mission starts in AUTO mode** → User sees mode switched to AUTO

4. **User manually switches back to MANUAL** → Works because:
   - `handleModeToggle('MANUAL')` is called
   - Backend: `services.setMode('MANUAL')` ✓
   - UI: `onSetMode('MANUAL')` ✓
   - Now mode reflects the toggle

---

## Why the Hardcoded AUTO Mode?

The code comment says **"Set mode to AUTO first (best-effort)"** but provides no context about why this hardcoded mode switch was added.

**Possible reasons:**
1. **Legacy code** - Assumption that missions always start in AUTO
2. **Incomplete refactoring** - When manual mode was added, this wasn't updated
3. **Misunderstanding** - Thought backend required AUTO to start a mission

---

## The Fix

**Option 1: Remove the hardcoded AUTO mode (RECOMMENDED)**
```tsx
// Current (BROKEN):
await services.setMode('AUTO');
setMode('AUTO');

// Fixed:
// Remove these lines entirely - use the mode the user already selected
```

**Option 2: Respect the current mode**
```tsx
const currentMode = mode === 'MANUAL' ? 'MANUAL' : 'AUTO';
await services.setMode(currentMode);
setMode(currentMode);
```

**Option 3: Allow user to choose mode in confirmation dialog**
```tsx
// Ask user: "Start in AUTO or MANUAL mode?"
// Then use their choice instead of forcing AUTO
```

---

## Why Switching Back to MANUAL Works

After the mission starts in AUTO, when user clicks MANUAL button:

```tsx
// In MissionControlCard.tsx handleModeToggle()
const response = await services.setMode('MANUAL');  // ✓ Backend switches
if (response.success) {
  onSetMode('MANUAL');  // ✓ UI state updates
}
```

This works because:
- User is **explicitly calling** the mode toggle handler
- The handler properly updates both backend AND UI state
- No hardcoded mode override happens

---

## Impact Classification

| Aspect | Status |
|--------|--------|
| **Type** | UI Logic Bug |
| **Severity** | Medium (mission still works, but wrong mode) |
| **Scope** | Only affects mission start |
| **User Impact** | User has to manually re-select MANUAL mode after starting |
| **Backend Impact** | None (backend responds correctly) |
| **Data Loss** | None |

---

## Summary

**Root Cause:** Line 776-777 in `executeStartMission()` hardcodes the mode to AUTO, ignoring the user's MANUAL selection.

**Fix:** Remove or conditionally handle the `setMode('AUTO')` call to respect the user's current mode choice.

**Workaround:** Users can manually switch back to MANUAL after mission starts.
