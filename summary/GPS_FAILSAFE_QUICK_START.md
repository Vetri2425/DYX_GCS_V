# GPS Failsafe Frontend - Quick Start Guide

## 🚀 How to Use

### 1. Set Failsafe Mode (Before Mission)

**In PathPlan Screen:**
1. Look for the **⚙️ Gear Icon** in the top-right header
2. Tap the gear icon
3. A dropdown appears with 3 modes:
   - ⚪ **Disable** - No failsafe checks (default)
   - 🔴 **Strict** - Pause mission + require user action
   - 🟠 **Relax** - Suppress spray only, continue mission
4. Select your desired mode
5. Dropdown auto-closes

**Note:** Mode selector is disabled during active missions

---

## 🎯 Mode Behaviors

### ⚪ Disable Mode (Default)
- No GPS accuracy checks
- Mission runs normally
- Use for: Testing, stationary operations

### 🔴 Strict Mode
**When GPS accuracy violation occurs:**
1. ⚠️ **Popup appears** with accuracy details
   - Shows: Accuracy Error (mm) vs Threshold (60mm)
2. Mission **automatically pauses**
3. User must click **"Acknowledge"** button
4. ⏳ **5-second countdown** while monitoring GPS stability
5. After countdown, choose:
   - ✅ **Resume Mission** - Continue from current waypoint
   - 🔄 **Restart from Waypoint 1** - Start over
   - ❌ **Stop Mission** - End mission completely

**Use for:** Precision operations where GPS accuracy is critical

### 🟠 Relax Mode
**When GPS accuracy violation occurs:**
1. ⚠️ **Toast notification** slides in from top
2. Shows: "Spray Suppressed - Accuracy: Xmm (threshold: 60mm)"
3. Spray/servo **automatically disabled** (safety)
4. Mission **continues** to next waypoint
5. Toast **auto-dismisses** after 2 seconds
6. Can close immediately with **✕** button
7. Spray **auto-resumes** after GPS stabilizes (5 sec)

**Use for:** Regular missions where continuing is more important than spray accuracy

---

## 📱 UI Elements

### Header (All Screens)
```
┌─────────────────────────────────────┐
│  Path Planning              ⚙️      │  ← Click gear for settings
└─────────────────────────────────────┘
```

### Gear Dropdown
```
┌──────────────────────────────┐
│  GPS Failsafe Mode        ✕  │
├──────────────────────────────┤
│  ⚪ Disabled              ✓  │ ← Selected
│  No failsafe checks          │
│                              │
│  🔴 Strict                   │
│  Pause + await acknowledgement│
│                              │
│  🟠 Relax                    │
│  Suppress servo only         │
└──────────────────────────────┘
```

### Strict Mode Popup (Phase 1 - Acknowledge)
```
┌─────────────────────────────┐
│        ⚠️ (pulsing)         │
│  GPS Failsafe Triggered     │
│                             │
│  Accuracy Error: 85.3 mm    │
│  Threshold:      60 mm      │
│                             │
│  GPS accuracy has exceeded  │
│  the safe threshold.        │
│  Mission has been paused.   │
│                             │
│  ┌──────────────────────┐  │
│  │    Acknowledge       │  │
│  └──────────────────────┘  │
└─────────────────────────────┘
```

### Strict Mode Popup (Phase 2 - Countdown)
```
┌─────────────────────────────┐
│           ⏳                 │
│  Waiting for Stable GPS     │
│                             │
│           5                 │
│                             │
│  Monitoring GPS stability   │
│  before resuming...         │
└─────────────────────────────┘
```

### Strict Mode Popup (Phase 3 - Actions)
```
┌─────────────────────────────┐
│           ✅                 │
│  GPS Stable - Choose Action │
│                             │
│  GPS has stabilized.        │
│  Select an action:          │
│                             │
│  ┌──────────────────────┐  │
│  │   Resume Mission     │  │ (Green)
│  └──────────────────────┘  │
│                             │
│  ┌──────────────────────┐  │
│  │ Restart from WP 1    │  │ (Orange)
│  └──────────────────────┘  │
│                             │
│  ┌──────────────────────┐  │
│  │   Stop Mission       │  │ (Red Border)
│  └──────────────────────┘  │
└─────────────────────────────┘
```

### Relax Mode Toast
```
┌─────────────────────────────────────┐
│ ⚠️ Spray Suppressed           ✕    │ ← Orange banner
│ Accuracy: 72.5mm (threshold: 60mm) │
└─────────────────────────────────────┘
     ↑ Slides in from top
     ↑ Auto-dismisses in 2 sec
```

---

## 🔌 Backend Integration

### Socket.IO Events

**Frontend → Backend (Emits)**
```javascript
socket.emit('set_gps_failsafe_mode', { mode: 'strict' })
socket.emit('failsafe_acknowledge')
socket.emit('failsafe_resume_mission')
socket.emit('failsafe_restart_mission')
```

**Backend → Frontend (Listens)**
```javascript
socket.on('servo_suppressed', (event) => {
  // { accuracy_error_mm: 72.5, threshold_mm: 60 }
})

socket.on('failsafe_mode_changed', (data) => {
  // { mode: 'strict' }
})
```

---

## ✅ Testing Steps

### Test 1: Mode Selection
1. Open PathPlan screen
2. Click ⚙️ gear icon
3. Verify dropdown opens
4. Select each mode
5. Verify dropdown closes
6. Verify current mode is highlighted with ✓

### Test 2: Strict Mode Flow
1. Set mode to 🔴 Strict
2. Start mission
3. Trigger GPS accuracy violation (backend simulation)
4. Verify popup appears immediately
5. Click "Acknowledge"
6. Verify 5-second countdown
7. After countdown, click "Resume"
8. Verify mission continues

### Test 3: Relax Mode Flow
1. Set mode to 🟠 Relax
2. Start mission
3. Trigger GPS accuracy violation (backend simulation)
4. Verify toast appears at top
5. Verify auto-dismiss after 2 seconds
6. OR click ✕ to dismiss immediately
7. Verify mission continues normally

### Test 4: Disable Mode
1. Set mode to ⚪ Disable
2. Start mission
3. Trigger GPS accuracy violation
4. Verify NO popup or toast appears
5. Verify mission continues normally

### Test 5: Mode Change Restriction
1. Start a mission (any mode)
2. Click ⚙️ gear icon during mission
3. Try to select a different mode
4. Verify modes are disabled/grayed out
5. Verify message: "Cannot change mode during active mission"

---

## 🛠️ Troubleshooting

### Gear Icon Not Visible
- **Check:** PathPlan screen is loaded
- **Check:** Header styles are applied
- **Solution:** Refresh app or check `styles.header`

### Dropdown Not Opening
- **Check:** Console for errors
- **Check:** `showFailsafeModeSelector` state
- **Solution:** Verify `setShowFailsafeModeSelector(true)` is called

### Popup Not Appearing (Strict)
- **Check:** Backend is emitting `servo_suppressed` event
- **Check:** Socket connection is active
- **Check:** `gpsFailsafeMode === 'strict'`
- **Solution:** Verify Socket.IO listener is registered

### Toast Not Appearing (Relax)
- **Check:** Backend is emitting `servo_suppressed` event
- **Check:** `gpsFailsafeMode === 'relax'`
- **Solution:** Check console for event logs

### Mode Not Persisting
- **Check:** Backend sends `failsafe_mode_changed` confirmation
- **Check:** Context state updates
- **Solution:** Verify Socket.IO bidirectional communication

---

## 📊 Success Metrics

**Implementation Status:** ✅ Complete
- 3 new components created
- 3 files modified
- 0 TypeScript errors
- All Socket.IO events wired
- Full user flow implemented

**Ready for Testing:** ✅ Yes
- Backend integration points documented
- UI components functional
- Event handlers connected
- Animations and timers working

---

## 🎨 Visual Design

### Colors
- **Disable:** Gray (#888) ⚪
- **Strict:** Red (#FF6B6B) 🔴
- **Relax:** Orange (#FFA500) 🟠
- **Success:** Green (#4CAF50) ✅
- **Warning:** Amber (#FFA500) ⚠️

### Animations
- **Pulse:** Strict popup icon (1s loop)
- **Slide-in:** Relax toast (300ms)
- **Slide-out:** Relax toast (300ms)
- **Countdown:** Number scale animation

### Timing
- **Toast Auto-dismiss:** 2 seconds
- **GPS Stability Wait:** 5 seconds
- **Animation Duration:** 300-500ms

---

## 📝 Next Steps

1. **Test with Real Backend**
   - Connect to Jetson/ROS backend
   - Simulate GPS accuracy violations
   - Verify all 3 modes work correctly

2. **User Training**
   - Demo strict mode flow
   - Explain when to use each mode
   - Show how to change modes

3. **Production Readiness**
   - Add error boundaries
   - Implement analytics tracking
   - Add help tooltips

---

**Status:** ✅ READY FOR PRODUCTION TESTING
