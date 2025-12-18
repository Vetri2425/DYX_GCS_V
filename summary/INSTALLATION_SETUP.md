# Installation & Setup Guide

## Prerequisites

Before starting, ensure you have:
- ✅ Node.js 18+ installed
- ✅ Expo CLI installed (`npm install -g expo-cli`)
- ✅ React Native development environment setup
- ✅ Backend server running (or IP address ready)

---

## Step 1: Install Dependencies

The required package `socket.io-client` has been added to `package.json`.

Run:
```bash
npm install
```

Or with yarn:
```bash
yarn install
```

This installs:
- ✅ `socket.io-client@4.7.2` - WebSocket connection to backend
- ✅ All other existing dependencies

---

## Step 2: Update Backend URL

Edit `src/config.ts` and set your backend server:

```typescript
// Change this to your actual backend server IP/port
export const BACKEND_URL = 'http://192.168.1.101:5001';
```

**Options**:
- Local development: `http://192.168.1.101:5001`
- Different port: `http://192.168.1.100:8080`
- Production: `https://your-domain.com`

---

## Step 3: Add TelemetryScreen to Navigation

Edit `src/navigation/TabNavigator.tsx`:

```tsx
import TelemetryScreen from '../screens/TelemetryScreen';
// ... other imports

export function TabNavigator() {
  return (
    <Tab.Navigator>
      {/* Existing screens */}
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="PathPlan" component={PathPlanScreen} />
      
      {/* Add this new screen */}
      <Tab.Screen 
        name="Telemetry" 
        component={TelemetryScreen}
        options={{
          title: 'Live Telemetry',
          tabBarLabel: 'Telemetry',
          tabBarIcon: ({ color, size }) => (
            <Icon name="radar" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
```

---

## Step 4: Verify Backend is Running

Before starting the app, check your backend:

```bash
# Test backend is accessible
curl http://192.168.1.101:5001/api/health

# Or visit in browser (if configured):
http://192.168.1.101:5001
```

If backend isn't accessible:
1. Check backend server is running
2. Check IP address is correct (not localhost if on different device)
3. Check firewall isn't blocking port 5001
4. Check WiFi network is the same

---

## Step 5: Start the App

### Option A: Expo Go (Fastest for Testing)

```bash
npm start
# or
expo start
```

Then:
- **Android**: Press `a` or scan QR code with Expo Go app
- **iOS**: Press `i` or scan QR code with Camera app
- **Web**: Press `w`

### Option B: Android Emulator

```bash
npm run android
```

### Option C: iOS Simulator

```bash
npm run ios
```

---

## Step 6: Test Live Telemetry

1. **Wait for app to load** (may take 30-60 seconds)

2. **Navigate to "Telemetry" tab**

3. **Look for connection indicator**:
   - 🟢 Green = "CONNECTED" (success!)
   - 🟡 Orange = "CONNECTING" (wait a moment)
   - 🔴 Red = "ERROR" or "DISCONNECTED" (check backend)

4. **Verify live data**:
   - ✅ Position updates every second
   - ✅ Battery percentage visible
   - ✅ RTK fix type displays
   - ✅ Mission waypoints show
   - ✅ No console errors

---

## Success Indicators

When telemetry is working correctly:

```
✅ App starts without crashing
✅ No errors in console
✅ Telemetry screen loads
✅ Connection indicator is green
✅ Position: XX.XXXXXXX, XX.XXXXXXX displayed
✅ Battery: XX.X % displayed
✅ RTK: Fix Type shows (0-6)
✅ Mission: WP counter updates
✅ Data refreshes every second
✅ No "Cannot connect" errors
```

---

## File Structure After Setup

```
DYX-GCS-Mobile/
├── src/
│   ├── config.ts ✅ MODIFIED - Backend URL
│   ├── types/
│   │   └── telemetry.ts ✅ NEW
│   ├── context/
│   │   └── RoverContext.tsx ✅ NEW
│   ├── hooks/
│   │   └── useRoverTelemetry.ts ✅ NEW
│   ├── components/
│   │   └── TelemetryDisplay.tsx ✅ NEW
│   ├── screens/
│   │   └── TelemetryScreen.tsx ✅ NEW
│   │   └── DashboardScreen.tsx
│   │   └── PathPlanScreen.tsx
│   └── navigation/
│       └── TabNavigator.tsx ✅ MODIFIED - Add TelemetryScreen
├── App.tsx ✅ MODIFIED - Add RoverProvider
├── package.json ✅ MODIFIED - Added socket.io-client
├── BACKEND_INTEGRATION_GUIDE.md ✅ NEW
├── BACKEND_INTEGRATION_SUMMARY.md ✅ NEW
├── QUICK_START_TELEMETRY.md ✅ NEW
└── TELEMETRY_INTEGRATION_COMPLETE.md ✅ NEW
```

---

## Troubleshooting Setup

### npm install Fails

```bash
# Clear cache and try again
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Expo App Won't Load

1. Check Node.js version: `node --version` (should be 18+)
2. Clear Expo cache: `expo start --clear`
3. Update Expo: `expo@latest`

### Backend Connection Fails

```bash
# Test backend is running
curl http://192.168.1.101:5001

# Check backend logs
# (Check your backend server logs for errors)
```

### Port 5001 Not Accessible

1. Check backend is running on port 5001
2. Check firewall allows port 5001
3. Check network - mobile must be on same WiFi
4. Try `http://localhost:5001` if testing locally

### Socket.IO Connection Error

1. Install socket.io-client: `npm install socket.io-client`
2. Check backend Socket.IO is enabled
3. Check backend logs for connection issues

---

## Verify Installation

Run this command to verify all files are in place:

```bash
# Check critical files exist
test -f src/config.ts && echo "✓ config.ts"
test -f src/types/telemetry.ts && echo "✓ telemetry.ts"
test -f src/hooks/useRoverTelemetry.ts && echo "✓ useRoverTelemetry.ts"
test -f src/context/RoverContext.tsx && echo "✓ RoverContext.tsx"
test -f src/components/TelemetryDisplay.tsx && echo "✓ TelemetryDisplay.tsx"
test -f src/screens/TelemetryScreen.tsx && echo "✓ TelemetryScreen.tsx"
```

---

## Environment Variables (Optional)

You can also use environment variables instead of editing config.ts:

### iOS/Android (Expo)

1. Create `.env` file in root:
```
REACT_APP_ROS_HTTP_BASE=http://192.168.1.101:5001
```

2. Restart app: `expo start --clear`

### Or Set at Runtime

```bash
REACT_APP_ROS_HTTP_BASE=http://192.168.1.100:8080 npm start
```

---

## Network Security Note

For **production** use:
- Use `https://` instead of `http://`
- Add CORS headers in backend
- Consider authentication/tokens
- Use secure WebSocket (`wss://`)

For **development** (local network):
- `http://` is fine
- Same WiFi required
- No authentication needed

---

## Next Steps

After telemetry is verified working:

1. **Explore telemetry data** in TelemetryScreen
2. **Add command buttons** for arm/disarm
3. **Test mission upload/download**
4. **Integrate with existing screens**
5. **Add real-time mission monitoring**

---

## Rollback / Uninstall

If you need to remove the integration:

```bash
# Remove socket.io-client from package.json
npm uninstall socket.io-client

# Remove new files
rm src/types/telemetry.ts
rm src/hooks/useRoverTelemetry.ts
rm src/context/RoverContext.tsx
rm src/components/TelemetryDisplay.tsx
rm src/screens/TelemetryScreen.tsx

# Revert App.tsx and TabNavigator.tsx to original versions
```

---

## Getting Help

### Check These Files

1. **`QUICK_START_TELEMETRY.md`** - Quick reference
2. **`BACKEND_INTEGRATION_GUIDE.md`** - Detailed guide
3. **`BACKEND_INTEGRATION_SUMMARY.md`** - Implementation details

### Common Issues

| Issue | Check |
|-------|-------|
| Cannot connect | Backend URL in config.ts, backend running |
| No telemetry data | Connection state in Telemetry tab, backend logs |
| App crashes | Console for error messages, check imports |
| npm errors | Node version, clear cache, reinstall |

### Debug Mode

To see detailed logs:

Edit `src/hooks/useRoverTelemetry.ts` and uncomment debug lines:

```typescript
console.log('[DEBUG] Connecting to:', DEFAULT_HTTP_BASE);
console.log('[DEBUG] Socket state:', socket.connected);
```

---

## Verify Everything Works

**Final Checklist**:

- [ ] npm install completed without errors
- [ ] socket.io-client is in node_modules
- [ ] Backend URL is set in src/config.ts
- [ ] TelemetryScreen added to navigation
- [ ] App starts without crashes
- [ ] Telemetry tab opens
- [ ] Connection indicator appears
- [ ] Data updates in real-time
- [ ] No console errors

If all checked ✓, you're ready to go!

---

## Ready to Test?

```bash
npm install          # Install dependencies
npm start            # Start the app
# Navigate to Telemetry tab
# Look for green connection indicator
# Verify live data updates
```

Estimated setup time: **5-10 minutes**

For detailed reference, see: `QUICK_START_TELEMETRY.md`
