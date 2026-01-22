# RTK UI State Sync Bug Fix

## Problem
**UI showed "Connect" button even though RTK streaming was active and bytes were updating.**

### Symptoms
- ✅ Backend streaming working (bytes updating)
- ✅ Connect button clicked successfully
- ❌ UI still showed "Connect" instead of "Connected"
- ❌ Button text didn't reflect actual streaming state

### Root Cause
**State synchronization lag between button press and monitor polling**

```
User clicks Connect
    ↓
setIsNtripRunning(true) ← Immediate
    ↓
Wait 1 second for backend verification
    ↓
startMonitor() called
    ↓
Monitor polls every 250ms
    ↓
BUT: Monitor only updates bytes, not running state consistently
```

The monitor had **two problems:**

1. **Only updated `running` state to `false`:**
   ```typescript
   if (!rtk_status.running) {
     setIsNtripRunning(false);  // ← Only sets false, never syncs true
     stopMonitor();
   }
   ```

2. **Monitor started too late:**
   - Was only called AFTER 1-second verification
   - Bytes updated but running state was stale
   - Button showed "Connect" because `isStreamRunning` wasn't synced from backend

---

## Solution

### Fix 1: Always Sync Running State in Monitor

**RTKInjectionScreen.tsx (Line 52-67):**
```typescript
// BEFORE:
if (!rtk_status.running) {
  setIsNtripRunning(false);  // Only sets false
  stopMonitor();
}

// AFTER:
// Always sync running state from backend
setIsNtripRunning(Boolean(rtk_status.running));  // Sync true or false
if (!rtk_status.running) {
  stopMonitor();
}
```

**VehicleStatusCard.tsx (Line 131-142):**
Same change - monitor now **always** updates `isStreamRunning` from backend state.

### Fix 2: Start Monitor Immediately

**RTKInjectionScreen.tsx (Line 171):**
```typescript
// BEFORE:
setIsNtripRunning(true);
setActiveProfileId(profile.id);
setTimeout(async () => {
  // ... wait 1 second ...
  if (status.success && status.ntrip.running) {
    startMonitor();  // Only start AFTER verification
  }
}, 1000);

// AFTER:
setIsNtripRunning(true);
setActiveProfileId(profile.id);

// Start monitoring IMMEDIATELY
startMonitor();  // ← Now starts right away

setTimeout(async () => {
  // ... wait 1 second for verification ...
  // If verification fails, stop monitor
  if (!status.ntrip.running) {
    stopMonitor();  // Stop if backend says it failed
  }
}, 1000);
```

Same change in **VehicleStatusCard.tsx (Line 272)**.

---

## How It Works Now

### Flow with Fix

```
User clicks Connect
    ↓
1. setIsNtripRunning(true)
2. setActiveProfileId(profile.id)
3. startMonitor() ← IMMEDIATELY START POLLING
    ↓
Monitor polls every 250ms:
- Gets backend status: { running: true, total_bytes: 12345 }
- setNtripBytes(12345)
- setIsNtripRunning(true)  ← ✅ Syncs true from backend
    ↓
Re-render triggered
    ↓
Button checks: isStreamRunning && activeProfileId === profile.id
    ↓
Both true → Shows "Connected" ✅
```

### Verification Phase (After 1 second)

```
setTimeout checks status:
  if (status.ntrip.running) {
    console.log('Verified')  ← Monitor already running, bytes sync
  } else {
    stopMonitor()  ← If failed, stop polling
    setIsNtripRunning(false)
    Show error alert
  }
```

---

## State Mapping After Fix

| State | Value | Result |
|-------|-------|--------|
| `isStreamRunning` | `true` | ✅ Monitor polling |
| `activeProfileId` | `profile.id` | ✅ Profile active |
| `ntripBytes` | Updates every 250ms | ✅ Shows data flow |
| Button text | "Connected" | ✅ Correct state |

---

## Technical Details

### Monitor Update Interval
- **Polls:** Every 250ms (4 times/second)
- **Updates:** 
  - `ntripBytes` always updated from backend
  - `isNtripRunning` now **always** synced from backend state
  - Stops when backend confirms stream ended

### Timing
1. **T=0ms:** User clicks connect
2. **T=10ms:** `setIsNtripRunning(true)` sets optimistic state
3. **T=20ms:** `startMonitor()` begins polling
4. **T=270ms:** First monitor poll returns `running: true` from backend
5. **T=300ms:** `setIsNtripRunning(true)` confirms state (redundant but safe)
6. **T=500ms:** Bytes update in UI from monitor
7. **T=1000ms:** Verification check confirms stream is running

---

## Why This Works

1. **Optimistic UI:** Shows "Connected" immediately when user clicks
2. **Backend Sync:** Monitor constantly syncs actual state from backend
3. **Fallback Protection:** If backend says stream failed after 1 second, we stop polling and show error
4. **Real-time Data:** Bytes update every 250ms proving stream is active
5. **No Race Conditions:** Monitor is always running while button appears connected

---

## Changed Files

- [src/components/missionreport/RTKInjectionScreen.tsx](src/components/missionreport/RTKInjectionScreen.tsx#L52-L67) - Monitor sync fix + immediate start
- [src/components/missionreport/VehicleStatusCard.tsx](src/components/missionreport/VehicleStatusCard.tsx#L123-L145) - Monitor sync fix + immediate start

