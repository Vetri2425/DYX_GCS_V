# Component Readiness System - Complete Guide

## 🎯 Overview

The Component Readiness System is a comprehensive crash-prevention framework inspired by game loading screens (Free Fire, PUBG). It tracks initialization status of all critical components and prevents user actions until the system is fully ready.

## ✨ Key Features

### 1. **Global Readiness Tracking**
- Tracks initialization state of every critical component
- Real-time status updates displayed to users
- Prevents crashes from premature user actions

### 2. **Loading Screen with Live Status**
- Full-screen overlay showing component initialization progress
- Live status indicators (✅ Ready, ⏳ Loading, ❌ Error, 🔄 Reconnecting)
- Progress bars and percentage indicators
- Categorized by system type (Network, Telemetry, Mission, Map, UI)

### 3. **Action Guards**
- Automatically prevents button clicks during initialization
- Shows user-friendly alerts when actions are blocked
- Protects critical operations like mission start/stop

### 4. **App State Handling**
- Automatically re-initializes when app returns from background
- Prevents crashes when user switches apps during operations
- Handles foreground/background transitions gracefully

### 5. **Automatic Re-initialization**
- Detects when app comes back from background
- Resets all components to initializing state
- Ensures fresh start after app resume

## 📁 File Structure

```
src/
├── context/
│   └── ComponentReadinessContext.tsx    # Global state management
├── hooks/
│   └── useComponentReadiness.ts         # Reusable hooks
└── components/
    └── shared/
        └── SystemReadinessOverlay.tsx   # Loading screen UI
```

## 🔧 Implementation Guide

### 1. Wrap Your App with Provider

```tsx
// App.tsx
import { ComponentReadinessProvider } from './src/context/ComponentReadinessContext';
import { SystemReadinessOverlay } from './src/components/shared/SystemReadinessOverlay';

export default function App() {
  return (
    <ComponentReadinessProvider minLoadingTime={1500}>
      <SystemReadinessOverlay appName="DYX-GCS" showDetails={true} />
      <YourApp />
    </ComponentReadinessProvider>
  );
}
```

### 2. Track Component Lifecycle

```tsx
import { useComponentLifecycle } from '../hooks/useComponentReadiness';

function MyComponent() {
  const { setReady, setError, setProgress } = useComponentLifecycle(
    'my-component-id',
    'My Component Name',
    'ui', // category: network, telemetry, navigation, mission, map, ui
    true  // critical: if true, app won't proceed until ready
  );

  useEffect(() => {
    async function init() {
      setProgress(20, 'Loading data...');
      await loadData();
      
      setProgress(60, 'Processing...');
      await process();
      
      setReady('Component ready');
    }
    init().catch(err => setError(err.message));
  }, []);

  return <View>...</View>;
}
```

### 3. Track Screen Readiness

```tsx
import { useScreenReadiness } from '../hooks/useComponentReadiness';

function MissionReportScreen() {
  const { isReady } = useScreenReadiness(
    'mission-report',
    'Mission Report Screen',
    async (setProgress) => {
      setProgress(25, 'Loading waypoints...');
      await loadWaypoints();
      
      setProgress(50, 'Initializing map...');
      await initMap();
      
      setProgress(75, 'Connecting telemetry...');
      await connectTelemetry();
    },
    true // critical
  );

  if (!isReady) return <LoadingIndicator />;
  return <ScreenContent />;
}
```

### 4. Track Connection Status

```tsx
import { useConnectionReadiness } from '../hooks/useComponentReadiness';

function TelemetryService() {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // Automatically tracks connection status
  useConnectionReadiness(
    'websocket',
    'WebSocket Connection',
    connected,
    reconnecting,
    true // critical
  );

  // Your connection logic...
}
```

### 5. Protect User Actions

```tsx
import { useActionGuard } from '../hooks/useComponentReadiness';

function MissionControl() {
  const { isReady, preventAction } = useActionGuard('mission-control');

  const handleStartMission = preventAction(
    async () => {
      // This won't execute if system isn't ready
      await startMission();
    },
    'Cannot start mission while system is initializing'
  );

  return (
    <Button 
      onPress={handleStartMission}
      disabled={!isReady} // Disable button visually
      title="Start Mission"
    />
  );
}
```

## 📊 System Categories

Components are organized into categories for better visualization:

- **🌐 Network**: WebSocket, HTTP connections
- **📡 Telemetry**: Real-time data streaming
- **🧭 Navigation**: React Navigation setup
- **🎯 Mission**: Mission loading and management
- **🗺️ Map**: Map rendering components
- **🎨 UI**: General UI components

## 🎮 How It Works (Like Game Loading)

### Phase 1: App Launch
1. User opens app
2. Loading screen appears with system status
3. Each component registers and begins initialization
4. Progress bars update in real-time
5. Status indicators show ✅/⏳/❌ for each system

### Phase 2: Initialization
```
🌐 Network                     ✅ Connected
📡 Telemetry                   ⏳ Connecting... 60%
🧭 Navigation                  ✅ Ready
🎯 Mission System              ⏳ Loading waypoints... 40%
🗺️ Map Rendering              ⏳ Initializing... 20%
🎨 User Interface              ✅ Ready

Overall Progress: 65%
```

### Phase 3: Ready
- All critical components show ✅
- Loading screen fades out
- App becomes interactive
- All buttons enabled

### Phase 4: Background/Foreground Handling
1. User switches to another app
2. System detects app going to background
3. When user returns:
   - Loading screen appears again
   - All components re-initialize
   - Status updates shown live
   - App becomes ready when all systems operational

## 🛡️ Crash Prevention Scenarios

### Scenario 1: Premature Mission Start
**Before:**
- User loads mission
- Immediately clicks "Start Mission"
- Map not ready yet → CRASH

**After:**
- User loads mission
- "Start Mission" button disabled with message
- Loading overlay shows "Map Rendering... 40%"
- Button enables only when all systems ready
- User clicks "Start Mission" safely

### Scenario 2: App Switch During Operation
**Before:**
- Mission is loading
- User switches to another app
- Returns to app
- Data is stale → CRASH

**After:**
- Mission is loading
- User switches to another app
- System detects background transition
- On return: Shows "Re-initializing..."
- Reloads all components fresh
- User sees clear status before proceeding

### Scenario 3: Network Reconnection
**Before:**
- WiFi drops
- Reconnects in background
- User clicks button
- Telemetry not ready → CRASH

**After:**
- WiFi drops
- Status shows "🔄 Reconnecting..."
- User sees clear status
- Buttons remain disabled
- When reconnected: "✅ Connected"
- Buttons enable automatically

## 🔍 Debugging

### Enable Detailed Logging
All component lifecycle events are logged:

```
[ComponentReadiness] 📝 Registering: WebSocket Connection (websocket) [CRITICAL]
[ComponentReadiness] ⏳ WebSocket Connection: initializing (0%)
[ComponentReadiness] ✅ WebSocket Connection: ready - Connected
[ComponentReadiness] 🎉 All systems ready!
```

### Check Current Status
```tsx
import { useComponentReadiness } from '../context/ComponentReadinessContext';

function DebugPanel() {
  const { components, overallProgress, isAppReady } = useComponentReadiness();
  
  return (
    <View>
      <Text>Overall Progress: {overallProgress}%</Text>
      <Text>App Ready: {isAppReady ? 'YES' : 'NO'}</Text>
      {Object.values(components).map(c => (
        <Text key={c.id}>
          {c.name}: {c.status} ({c.progress}%)
        </Text>
      ))}
    </View>
  );
}
```

## 📈 Best Practices

### 1. Mark Critical Components
Only mark components as critical if app cannot function without them:
```tsx
useComponentLifecycle('websocket', 'WebSocket', 'network', true);  // ✅ Critical
useComponentLifecycle('analytics', 'Analytics', 'ui', false);      // ❌ Not critical
```

### 2. Provide Progress Updates
Break initialization into steps with progress updates:
```tsx
const init = async (setProgress) => {
  setProgress(0, 'Starting...');
  await step1();
  
  setProgress(33, 'Loading data...');
  await step2();
  
  setProgress(66, 'Processing...');
  await step3();
  
  // setReady called automatically at 100%
};
```

### 3. Handle Errors Gracefully
```tsx
try {
  await riskyOperation();
  setReady('Operation complete');
} catch (error) {
  setError(error.message);
  // System shows ❌ Error status
  // User can retry or app can auto-retry
}
```

### 4. Clean Up on Unmount
The hooks automatically unregister components on unmount, but ensure async operations are cancelled:
```tsx
useEffect(() => {
  let mounted = true;
  
  async function init() {
    await longOperation();
    if (mounted) setReady();
  }
  
  init();
  
  return () => {
    mounted = false;
  };
}, []);
```

## 🎨 Customization

### Custom Loading Screen
```tsx
<SystemReadinessOverlay 
  appName="My App"
  showDetails={true}  // Show component list
/>
```

### Custom Minimum Loading Time
Prevent flashing on fast connections:
```tsx
<ComponentReadinessProvider minLoadingTime={2000}>
  <App />
</ComponentReadinessProvider>
```

### Custom Category Icons
Edit `SystemReadinessOverlay.tsx`:
```tsx
function getCategoryIcon(category: SystemCategory): string {
  switch (category) {
    case 'network': return '🌐';
    // Add your custom icons
  }
}
```

## 🚀 Advanced Usage

### Manual Re-initialization
```tsx
const { triggerReinitialization } = useComponentReadiness();

// Force all components to re-initialize
triggerReinitialization();
```

### Check Specific Component
```tsx
const { getComponentStatus } = useComponentReadiness();

const wsStatus = getComponentStatus('websocket');
if (wsStatus?.status === 'error') {
  // Handle WebSocket error
}
```

### Category-based Checks
```tsx
const { isCategoryReady } = useComponentReadiness();

if (isCategoryReady('network')) {
  // All network components ready
}
```

## 📱 App State Handling

The system automatically handles these app states:

- **active**: App in foreground, normal operation
- **background**: App in background, pauses operations
- **inactive**: Brief transition state

When app returns to foreground after being in background:
1. `isResuming` flag set to `true` for 2 seconds
2. All components reset to `initializing`
3. Each component re-runs its initialization
4. Loading screen shown during re-initialization
5. User sees live progress updates
6. App becomes interactive when ready

## ⚡ Performance

- **Lightweight**: Minimal overhead, uses React context efficiently
- **Optimized**: Throttled updates prevent excessive re-renders
- **Scalable**: Handles dozens of components without performance impact
- **Memory Safe**: Proper cleanup on unmount prevents leaks

## 🐛 Troubleshooting

### Loading Screen Never Disappears
- Check all critical components call `setReady()`
- Look for components stuck in `initializing` state
- Check console for errors

### Buttons Still Disabled After Loading
- Verify `useActionGuard` component ID matches registered component
- Check `isSystemReady()` returns true
- Ensure no errors in any critical component

### App Crashes After Background
- Make sure all async operations check `mounted` flag
- Verify WebSocket reconnects properly
- Check logs for re-initialization errors

## 📝 Summary

The Component Readiness System provides:

✅ **Crash Prevention**: No more premature user actions  
✅ **Better UX**: Clear loading status like modern games  
✅ **App State Safety**: Handles background/foreground transitions  
✅ **Error Handling**: Graceful degradation and error display  
✅ **Easy Integration**: Simple hooks for any component  
✅ **Real-time Feedback**: Live status updates for users  

This system ensures your app is always in a valid state before allowing user interaction, dramatically reducing crashes and improving user experience.
