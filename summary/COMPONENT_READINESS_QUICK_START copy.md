# Component Readiness System - Quick Start Guide

## 🚀 Quick Integration

### Step 1: Add to Any Component (30 seconds)

```tsx
import { useComponentLifecycle } from '../hooks/useComponentReadiness';

function MyComponent() {
  const { setReady, setProgress } = useComponentLifecycle(
    'my-component',     // Unique ID
    'My Component',     // Display name
    'ui',               // Category (network/telemetry/navigation/mission/map/ui)
    true                // Critical? (true = app waits for this)
  );

  useEffect(() => {
    async function init() {
      setProgress(50, 'Loading...');
      await loadData();
      setReady('Ready!');
    }
    init();
  }, []);

  return <View>...</View>;
}
```

### Step 2: Protect Buttons (20 seconds)

```tsx
import { useActionGuard } from '../hooks/useComponentReadiness';

function MissionControl() {
  const { isReady, preventAction } = useActionGuard('mission-control');

  const handleStart = preventAction(async () => {
    await startMission();
  }, 'System is initializing...');

  return (
    <Button 
      onPress={handleStart}
      disabled={!isReady}
    />
  );
}
```

### Step 3: Track Screen (25 seconds)

```tsx
import { useScreenReadiness } from '../hooks/useComponentReadiness';

function MyScreen() {
  const { isReady } = useScreenReadiness(
    'my-screen',
    'My Screen',
    async (setProgress) => {
      setProgress(30, 'Loading...');
      await loadData();
    },
    true // critical
  );

  if (!isReady) return <LoadingView />;
  return <ScreenContent />;
}
```

## 📋 Common Patterns

### Pattern 1: Track WebSocket Connection

```tsx
useConnectionReadiness(
  'websocket',
  'WebSocket',
  isConnected,
  isReconnecting,
  true // critical
);
```

### Pattern 2: Multi-Step Initialization

```tsx
const { setProgress, setReady, setError } = useComponentLifecycle(...);

useEffect(() => {
  async function init() {
    try {
      setProgress(20, 'Step 1...');
      await step1();
      
      setProgress(50, 'Step 2...');
      await step2();
      
      setProgress(80, 'Step 3...');
      await step3();
      
      setReady();
    } catch (error) {
      setError(error.message);
    }
  }
  init();
}, []);
```

### Pattern 3: Conditional Critical Status

```tsx
// Mark as critical only if required feature
const isCritical = isFeatureEnabled('mission-control');
useComponentLifecycle('feature', 'Feature', 'ui', isCritical);
```

## 🎯 Categories

- **network**: WebSocket, HTTP, API connections
- **telemetry**: Real-time data streams
- **navigation**: React Navigation setup
- **mission**: Mission operations
- **map**: Map rendering
- **ui**: General UI components

## ⚡ Tips

1. **Only mark truly critical components** - App waits for these
2. **Provide progress updates** - Better UX
3. **Handle errors** - Use `setError()` 
4. **Clean up async** - Check `mounted` flag
5. **Use action guards** - Prevent premature clicks

## 🐛 Debug

Check logs for component lifecycle:
```
[ComponentReadiness] 📝 Registering: My Component
[ComponentReadiness] ⏳ My Component: initializing (50%)
[ComponentReadiness] ✅ My Component: ready
[ComponentReadiness] 🎉 All systems ready!
```

## 📱 What Users See

### During Loading:
```
DYX-GCS
Ground Control Station

━━━━━━━━━━━━━━━━━━━━━━━━━━━ 65%

Loading Mission System...

🌐 Network                    ✅ Connected
📡 Telemetry                  ⏳ Connecting... 60%
🎯 Mission System             ⏳ Loading... 40%
🗺️ Map Rendering             ✅ Ready

Please wait while we initialize all systems...
```

### After Background Return:
```
Re-initializing...

🌐 Network                    🔄 Reconnecting...
📡 Telemetry                  ⏳ Connecting...
```

## 🎮 Game-Like Experience

Just like Free Fire or PUBG:
- ✅ Live component status
- ✅ Real-time progress bars
- ✅ Clear messaging
- ✅ No premature actions
- ✅ Safe app switching

## 📖 Full Documentation

See [COMPONENT_READINESS_SYSTEM.md](./COMPONENT_READINESS_SYSTEM.md) for complete guide.

## ✨ Already Integrated

These components already use the system:
- ✅ App navigation
- ✅ WebSocket telemetry
- ✅ Mission Report Screen
- ✅ Mission Control buttons

Add your components following the patterns above!
