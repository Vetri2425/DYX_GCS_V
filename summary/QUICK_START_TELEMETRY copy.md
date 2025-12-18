# Quick Start: Live Telemetry Integration

## 3-Minute Setup

### 1. Update Backend URL (if needed)

Edit `src/config.ts`:

```typescript
// Change this if your backend is on a different IP/port
export const BACKEND_URL = 'http://192.168.1.101:5001';
```

### 2. Add TelemetryScreen to Navigation

Edit `src/navigation/TabNavigator.tsx`:

```tsx
import TelemetryScreen from '../screens/TelemetryScreen';

// Add to createBottomTabNavigator:
<Tab.Screen 
  name="Telemetry" 
  component={TelemetryScreen}
  options={{
    title: 'Live Telemetry',
    tabBarIcon: ({ color }) => (
      <Icon name="radar" size={24} color={color} />
    ),
  }}
/>
```

### 3. Run the App

```bash
npm start
# or
expo start
```

### 4. Test

1. Go to Telemetry tab
2. Check for green "CONNECTED" indicator
3. Verify live data updates

---

## What's Connected?

✅ **Socket.IO** - Real-time telemetry from backend
✅ **Position** - Lat/Lon/Altitude live updates
✅ **Battery** - Live voltage, current, percentage
✅ **RTK/GPS** - Fix type, satellites, accuracy
✅ **Mission** - Current waypoint, progress
✅ **Network** - Connection type and signal strength

---

## Using Telemetry in Your Components

```tsx
import { useRover } from '../context/RoverContext';

export const MyScreen = () => {
  const { telemetry, connectionState, roverPosition, services } = useRover();

  return (
    <View>
      {/* Check connection */}
      {connectionState === 'connected' ? (
        <>
          {/* Show position */}
          <Text>Lat: {roverPosition?.lat}</Text>
          <Text>Lon: {roverPosition?.lng}</Text>
          
          {/* Show battery */}
          <Text>Battery: {telemetry.battery.percentage}%</Text>
        </>
      ) : (
        <Text>Connecting... {connectionState}</Text>
      )}
    </View>
  );
};
```

---

## Telemetry Data Available

```typescript
telemetry.state              // armed, mode, status
telemetry.global            // lat, lon, altitude, speed
telemetry.battery           // voltage, current, percentage
telemetry.rtk               // fix_type, base_linked, baseline_age
telemetry.mission           // current_wp, total_wp, progress
telemetry.network           // wifi_rssi, signal_strength
telemetry.imu_status        // IMU calibration status
telemetry.hrms, vrms        // Accuracy in meters
roverPosition               // { lat, lng, timestamp }
connectionState             // 'connected', 'disconnected', etc.
```

---

## Commands (Ready to Use)

```tsx
const { services } = useRover();

// Vehicle control
await services.armVehicle();
await services.disarmVehicle();
await services.setMode('AUTO');

// Mission
await services.uploadMission(waypoints);
await services.downloadMission();
await services.pauseMission();
await services.resumeMission();

// RTK
await services.injectRTK('ntrip://url');
await services.getRTKStatus();

// Servo
await services.controlServo(servoId, angle);
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Cannot connect to backend" | Check backend is running, update URL in config.ts |
| "No telemetry updates" | Check connection state is 'connected', check backend logs |
| "Cannot use useRover()" | Ensure App is wrapped with `<RoverProvider>` |

---

## Full Documentation

See `BACKEND_INTEGRATION_GUIDE.md` for:
- Complete architecture overview
- All telemetry fields explained
- RTK fix type reference
- Connection states
- Backend event documentation
- Detailed debugging guide
- Testing checklist

---

## Files to Know

- `src/config.ts` - Backend URL configuration
- `src/hooks/useRoverTelemetry.ts` - Core telemetry logic
- `src/context/RoverContext.tsx` - State provider
- `src/components/TelemetryDisplay.tsx` - Live telemetry UI
- `src/types/telemetry.ts` - Type definitions

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│        Backend Rover Server             │
│    (HTTP API + Socket.IO)               │
└────────────────┬────────────────────────┘
                 │ Socket.IO Events
                 │ (telemetry, rover_data)
                 │
┌────────────────▼────────────────────────┐
│      useRoverTelemetry Hook             │
│   (Socket connection + parsing)         │
└────────────────┬────────────────────────┘
                 │ Parsed Telemetry
                 │
┌────────────────▼────────────────────────┐
│        RoverContext                     │
│   (Global state management)             │
└────────────────┬────────────────────────┘
                 │ useRover() hook
                 │
┌────────────────▼────────────────────────┐
│        React Components                 │
│   (TelemetryDisplay, DashboardScreen,   │
│    PathPlanScreen, etc.)                │
└─────────────────────────────────────────┘
```

---

## Next Phase: Commands

After verifying telemetry works, implement:
1. Arm/Disarm buttons
2. Mode selection
3. Mission upload/download UI
4. RTK configuration
5. Servo controls
6. Real-time mission monitoring

---

## Success Indicators ✓

When telemetry is working:

✓ App connects to backend
✓ TelemetryScreen shows "CONNECTED" (green)
✓ Position updates every second
✓ Battery percentage changes
✓ RTK fix type updates
✓ Mission waypoint counter works
✓ Auto-reconnect works on WiFi loss
✓ No console errors

---

## Proceed to Commands Phase?

Once telemetry is verified working:

1. Create control command components
2. Add button handlers for:
   - Arm/Disarm
   - Start/Pause/Resume Mission
   - RTK injection
   - Servo control
3. Add error handling and user feedback
4. Test with actual rover

---

For detailed reference, see: `BACKEND_INTEGRATION_GUIDE.md`
