# RTK Injection Mapping State in Vehicle Status Card

## Overview
The RTK injection in the Robot Vehicle Status Card uses **React state mapping** to coordinate button logic, component state, and color coding. This creates a reactive system where UI updates automatically based on telemetry data and RTK stream status.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│         RTK INJECTION STATE MANAGEMENT FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. BUTTON PRESS (handleRTKPress)                               │
│         ↓                                                        │
│  2. OPENS MODAL (setShowRTKModal = true)                        │
│         ↓                                                        │
│  3. CHECK RTK STATUS (getRTKStatus)                             │
│         ↓                                                        │
│  4. UPDATE STATE (isStreamRunning, totalBytes)                  │
│         ↓                                                        │
│  5. START MONITOR (if running)                                  │
│         ↓                                                        │
│  6. COLOR CODING UPDATES (rtkStatusColor)                       │
│         ↓                                                        │
│  7. RE-RENDER WITH NEW STATE                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Mapping

### 1. **RTK Injection State Variables**

```typescript
// State for RTK modal and profiles
const [showRTKModal, setShowRTKModal] = useState(false);           // Modal visibility
const [modalScreen, setModalScreen] = useState<ModalScreen>('list'); // 'list' | 'editor'
const [selectedProfile, setSelectedProfile] = useState<NTRIPProfile | null>(null);
const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

// RTK streaming state
const [isStreamRunning, setIsStreamRunning] = useState(false);     // Is RTK active?
const [totalBytes, setTotalBytes] = useState(0);                  // Data received
const [isSubmitting, setIsSubmitting] = useState(false);          // Loading state

// User feedback
const [feedback, setFeedback] = useState<string | null>(null);    // Success messages
const [error, setError] = useState<string | null>(null);         // Error messages
```

---

## Button Logic Flow

### GPS/RTK Button Click Handler

**Location:** [VehicleStatusCard.tsx](src/components/missionreport/VehicleStatusCard.tsx#L437-L449)

```typescript
// The GPS/RTK row is a TouchableOpacity button
<TouchableOpacity
  key="gps-rtk"
  style={styles.statusRow}
  onPress={handleRTKPress}              // ← Button click triggers this
  activeOpacity={0.7}
>
  <Text style={styles.label}>GPS/RTK</Text>
  <View style={styles.valueRow}>
    <View style={[styles.accuracyBox, { backgroundColor: rtkStatusColor }]}>
      <Text style={styles.accuracyValue}>{status.gps}</Text>
    </View>
    <Text style={styles.gearIcon}> ⚙</Text>  {/* Gear icon shows it's clickable */}
  </View>
</TouchableOpacity>
```

### Handler Execution

```typescript
// Step 1: Button press handler
const handleRTKPress = () => {
  if (onOpenRTKInjection) {
    onOpenRTKInjection();  // External callback if provided
  } else {
    handleOpenRTKModal();  // Default: open modal
  }
};

// Step 2: Open RTK modal
const handleOpenRTKModal = () => {
  setModalScreen('list');        // Show profile list screen
  setSelectedProfile(null);       // Clear previous selection
  setShowRTKModal(true);         // Make modal visible ← TRIGGERS EFFECT
};

// Step 3: Modal open triggers useEffect
useEffect(() => {
  if (showRTKModal && services) {
    const checkStatus = async () => {
      try {
        const rtk_status = await services.getRTKStatus();  // Check backend status
        if (rtk_status.success) {
          setIsStreamRunning(rtk_status.running || false);  // Update running state
          setTotalBytes(rtk_status.total_bytes || 0);      // Update byte counter
          if (rtk_status.running) {
            startMonitor();  // Start polling if already running
          }
        }
      } catch (err) {
        console.error('Failed to get RTK status:', err);
      }
    };
    checkStatus();
  }
}, [showRTKModal, services, startMonitor]);  // ← Runs when modal opens
```

---

## State-Driven Color Coding

### RTK Status Color Mapping

**Location:** [VehicleStatusCard.tsx](src/components/missionreport/VehicleStatusCard.tsx#L68-L76)

```typescript
// Color derived from telemetry.rtk.fix_type
const rtkStatusColor = useMemo(() => {
  if (!telemetry) return colors.danger;           // ❌ RED: No telemetry
  const fixType = telemetry.rtk.fix_type;
  
  if (fixType >= 5) return colors.success;        // ✅ GREEN: RTK Float/Fixed (best)
  if (fixType >= 3) return colors.warning;        // ⚠️ ORANGE: 3D Fix (medium)
  return colors.danger;                            // ❌ RED: No Fix (worst)
}, [telemetry]);
```

**Fix Type Reference:**
- `fixType >= 5`: RTK Fixed or RTK Float - **GREEN** (centimeter accuracy)
- `fixType >= 3`: 3D Fix - **ORANGE** (meter accuracy)
- `fixType < 3`: No Fix or 2D Fix - **RED** (unreliable)

### Connection Status Color

```typescript
// Green dot appears in header when connected, red when disconnected
const connectionStatusColor = isConnected ? colors.success : colors.danger;

// Applied to status indicator
<View style={[styles.statusDot, { backgroundColor: connectionStatusColor }]} />
```

---

## RTK Stream Injection Process

### Profile Selection Flow

```typescript
// User selects an NTRIP profile from the list
const handleSelectProfile = async (profile: NTRIPProfile) => {
  if (!services) {
    Alert.alert('Error', 'RTK services not available');
    return;
  }

  setIsSubmitting(true);              // Show loading state
  setFeedback(null);                  // Clear previous messages
  setError(null);

  try {
    // Step 1: Build NTRIP URL from profile
    const ntripUrl = `rtcm://${profile.username}:${profile.password}@${profile.casterAddress}:${profile.port}/${profile.mountpoint}`;
    
    // Step 2: Send injection request to backend
    const response = await services.injectRTK(ntripUrl.trim());

    if (response.success) {
      // Step 3: Update UI states immediately
      setFeedback(response.message ?? 'RTK stream started successfully.');
      setIsStreamRunning(true);         // Mark stream as running
      setActiveProfileId(profile.id);   // Remember active profile
      
      // Step 4: Verify connection after 1 second (let backend establish)
      setTimeout(async () => {
        try {
          const status = await services.getRTKStatus();
          console.log('[RTK] Status check after start:', status);
          
          if (status.success) {
            if (status.running) {
              // Stream verified - start monitoring
              startMonitor();           // Poll every 250ms
              Alert.alert('Success', `Connected to ${profile.name}`);
            } else {
              // Backend says not running despite success response
              setError('Stream started but connection failed.');
              setIsStreamRunning(false);
              setActiveProfileId(null);
              Alert.alert('Connection Failed', '...');
            }
          }
        } catch (err) {
          // Assume it's working anyway
          startMonitor();
        }
      }, 1000);  // Wait 1 second for backend to establish
    } else {
      setError(response.message ?? 'Failed to start RTK stream.');
      Alert.alert('Connection Failed', response.message ?? '...');
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to start RTK stream.';
    setError(errorMsg);
    Alert.alert('Error', errorMsg);
  } finally {
    setIsSubmitting(false);            // Hide loading state
  }
};
```

---

## RTK Monitor (Polling)

### Continuous Status Check

**Location:** [VehicleStatusCard.tsx](src/components/missionreport/VehicleStatusCard.tsx#L119-L146)

```typescript
// Monitor ref holds the interval
const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
const lastBytesRef = useRef<number>(0);      // Track previous bytes
const lastTsRef = useRef<number>(0);         // Track timestamp for rate calculation

// Stop monitor - cleanup
const stopMonitor = useCallback(() => {
  if (monitorRef.current) {
    clearInterval(monitorRef.current);
    monitorRef.current = null;
  }
}, []);

// Start monitor - polls every 250ms
const startMonitor = useCallback(() => {
  if (monitorRef.current || !services) return;  // Don't start twice
  
  lastBytesRef.current = 0;
  lastTsRef.current = Date.now();
  
  monitorRef.current = setInterval(async () => {
    try {
      const rtk_status = await services.getRTKStatus();
      
      if (rtk_status.success) {
        const now = Date.now();
        const bytes = rtk_status.total_bytes ?? 0;
        
        // Update displayed bytes
        setTotalBytes(bytes);
        
        // Store for rate calculation
        lastBytesRef.current = bytes;
        lastTsRef.current = now;
        
        // If stream stopped, stop monitoring
        if (!rtk_status.running) {
          setIsStreamRunning(false);
          stopMonitor();  // Stop polling
        }
      }
    } catch (e) {
      console.error('RTK monitor error:', e);
    }
  }, 250);  // Poll every 250ms = 4 times per second
}, [services, stopMonitor]);
```

---

## State Dependencies & Effects

### Effect 1: Component Mount - Initial Status Check

```typescript
useEffect(() => {
  if (services) {
    const checkInitialStatus = async () => {
      try {
        const rtk_status = await services.getRTKStatus();
        if (rtk_status.success) {
          setIsStreamRunning(rtk_status.running || false);
          setTotalBytes(rtk_status.total_bytes || 0);
          if (rtk_status.running) {
            startMonitor();  // If stream already running, monitor it
          }
        }
      } catch (err) {
        console.error('Failed to get initial RTK status:', err);
      }
    };
    checkInitialStatus();
  }
}, [services, startMonitor]);  // Runs once when component mounts
```

### Effect 2: Modal Open - Refresh Status

```typescript
useEffect(() => {
  if (showRTKModal && services) {
    const checkStatus = async () => {
      try {
        const rtk_status = await services.getRTKStatus();
        if (rtk_status.success) {
          setIsStreamRunning(rtk_status.running || false);
          setTotalBytes(rtk_status.total_bytes || 0);
          if (rtk_status.running) {
            startMonitor();
          }
        }
      } catch (err) {
        console.error('Failed to get RTK status:', err);
      }
    };
    checkStatus();
  }
}, [showRTKModal, services, startMonitor]);  // Runs when modal opens
```

### Effect 3: Disconnect Protection - Auto Stop RTK

```typescript
useEffect(() => {
  if (!isConnected && isStreamRunning && services) {
    const stopStream = async () => {
      try {
        await services.stopRTK();
        setIsStreamRunning(false);
        stopMonitor();
      } catch (err) {
        console.error('Failed to stop RTK on disconnect:', err);
      }
    };
    stopStream();
  }
}, [isConnected, isStreamRunning, services, stopMonitor]);
// ↑ If rover disconnects while RTK is running, stop it automatically
```

### Effect 4: Cleanup on Unmount

```typescript
useEffect(() => {
  return () => {
    stopMonitor();  // Stop polling when component unmounts
  };
}, [stopMonitor]);
```

---

## Color Code Reference

### RGB Values Used

```typescript
colors.success    → #00FF00 or similar (Green)     ✅ RTK Fixed, >50% battery, 14+ sats
colors.warning    → #FFAA00 or similar (Orange)    ⚠️ 3D Fix, 20-50% battery, 6-13 sats  
colors.danger     → #FF0000 or similar (Red)       ❌ No Fix, <20% battery, 0-2 sats
colors.info       → #3B82F6 or similar (Blue)      ℹ️ 2-6 satellites, IMU, Mode
```

### What Each Status Color Means

| Component | Green | Orange | Red | Blue |
|-----------|-------|--------|-----|------|
| **GPS/RTK** | RTK Float/Fixed (fix_type ≥ 5) | 3D Fix (fix_type ≥ 3) | No Fix (fix_type < 3) | - |
| **Battery** | >50% | 20-50% | <20% | - |
| **Satellites** | 14+ | 6-13 | 0-2 | 2-6 (info) |
| **HRMS** | <10cm | 10cm-5m | ≥10m | - |
| **VRMS** | <10cm | 10cm-5m | ≥10m | - |
| **Connection** | Connected | - | Disconnected | - |

---

## Complete State Machine

```
┌──────────────────────────────────────────────────────────────────┐
│              RTK STATE MACHINE                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INITIAL STATE                                                   │
│  ├─ showRTKModal: false                                          │
│  ├─ isStreamRunning: false                                       │
│  ├─ activeProfileId: null                                        │
│  └─ rtkStatusColor: RED ❌                                       │
│                                                                  │
│         ↓ [User clicks GPS/RTK button]                           │
│                                                                  │
│  MODAL OPENING                                                   │
│  ├─ showRTKModal: true ← triggers useEffect                     │
│  ├─ getRTKStatus() called                                        │
│  └─ modalScreen: 'list'                                          │
│                                                                  │
│         ↓ [Status check returns]                                 │
│                                                                  │
│  IF STATUS.RUNNING === TRUE:                                     │
│  ├─ isStreamRunning: true                                        │
│  ├─ startMonitor() called (polls every 250ms)                   │
│  ├─ Streaming badge shows totalBytes                            │
│  └─ "⏹️ Stop" button appears in modal                            │
│                                                                  │
│  IF STATUS.RUNNING === FALSE:                                    │
│  ├─ isStreamRunning: false                                       │
│  ├─ Profiles list is selectable                                 │
│  └─ No "Stop" button visible                                    │
│                                                                  │
│         ↓ [User selects profile]                                 │
│                                                                  │
│  CONNECTING                                                      │
│  ├─ isSubmitting: true                                           │
│  ├─ injectRTK(url) called → sends to backend                    │
│  ├─ Buttons disabled during submit                              │
│  └─ Waiting 1 second for connection...                          │
│                                                                  │
│         ↓ [Backend confirms status]                              │
│                                                                  │
│  CONNECTED ✅                                                     │
│  ├─ isStreamRunning: true                                        │
│  ├─ activeProfileId: profile.id                                 │
│  ├─ startMonitor() running                                       │
│  ├─ rtkStatusColor: GREEN (fix_type ≥ 5) or ORANGE (fix_type ≥ 3)
│  ├─ Streaming badge visible                                     │
│  ├─ totalBytes incrementing every 250ms                         │
│  └─ "⏹️ Stop" button visible                                     │
│                                                                  │
│         ↓ [User clicks "⏹️ Stop"]                                │
│                                                                  │
│  DISCONNECTING                                                   │
│  ├─ isSubmitting: true                                           │
│  ├─ stopRTK() called                                             │
│  └─ stopMonitor() stops polling                                 │
│                                                                  │
│         ↓ [Backend stops stream]                                 │
│                                                                  │
│  DISCONNECTED                                                    │
│  ├─ isStreamRunning: false                                       │
│  ├─ activeProfileId: null                                        │
│  ├─ monitorRef.current: null                                     │
│  ├─ totalBytes: reset                                            │
│  ├─ rtkStatusColor: RED ❌                                       │
│  └─ Back to profile selection                                   │
│                                                                  │
│         ↓ [User closes modal OR disconnects rover]               │
│                                                                  │
│  CLEANUP                                                         │
│  ├─ stopMonitor() called on unmount                              │
│  ├─ showRTKModal: false                                          │
│  └─ Back to INITIAL STATE                                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Summary

### Key Mappings

1. **Button Press** → `handleRTKPress()` → Opens modal
2. **Modal Open** → `useEffect` → Checks status with `getRTKStatus()`
3. **Status Result** → Updates `isStreamRunning` state
4. **State Change** → Triggers re-render with new color
5. **Monitor Active** → Polls every 250ms to update `totalBytes` and sync state
6. **Profile Selected** → Calls `injectRTK()` → Waits 1s → Starts monitor
7. **Disconnect Detected** → Auto-stops RTK via effect
8. **Color Determination** → Based on `telemetry.rtk.fix_type`:
   - fix_type ≥ 5: **GREEN** ✅ (RTK Float/Fixed)
   - fix_type ≥ 3: **ORANGE** ⚠️ (3D Fix)
   - fix_type < 3: **RED** ❌ (No Fix)

### State Flow

```
User Interaction → State Change → RTK Status Check → 
   Monitor Start → Color Update → UI Re-render
```

The system uses **React's state and effects** to maintain synchronized state between:
- RTK backend status
- UI component display
- Button states
- Color coding
- Real-time monitoring

