# Rover Auto-Discovery System

## Overview

The app now automatically discovers Jetson devices on the local WiFi network. Field operators no longer need to know or manually configure IP addresses.

## How It Works

### 1. **First Launch (No Backend Configured)**

```
User opens app
  ↓
App checks AsyncStorage for saved backend URL
  ↓
No URL found → Show Discovery Screen
  ↓
Quick Scan starts automatically (10 common IPs)
  ↓
Displays found rovers with IP addresses
  ↓
User taps to select their rover
  ↓
Backend URL saved to AsyncStorage
  ↓
App connects and loads main interface
```

### 2. **Subsequent Launches**

```
User opens app
  ↓
App loads saved backend URL from AsyncStorage
  ↓
Connects directly to saved rover
  ↓
Main interface loads immediately
```

### 3. **Manual Rescan (If Needed)**

Users can trigger:
- **Quick Scan**: Tests 10 common static IPs (~5 seconds)
- **Full Scan**: Scans entire 192.168.1.1-255 range (~2-3 minutes)

## Architecture

### Files Added

1. **`src/utils/jetsonDiscovery.ts`**
   - Network scanning logic
   - Tests multiple endpoints: `/api/ping`, `/api/rtk/status`, `/`
   - Batch scanning (10 IPs at a time) to avoid network overload
   - Quick scan for common static IPs (100-105, 50-51, 10-11)

2. **`src/utils/backendStorage.ts`**
   - AsyncStorage wrapper for backend URL persistence
   - Saves: URL, IP, Port
   - Functions: `saveBackendURL()`, `getSavedBackendURL()`, `hasBackendURL()`, `clearBackendURL()`

3. **`src/screens/RoverDiscoveryScreen.tsx`**
   - Discovery UI with scan progress
   - Device list with connection indicators
   - Quick Scan and Full Scan buttons

### Files Modified

1. **`src/config.ts`**
   - Added dynamic URL support
   - New functions: `initializeBackendURL()`, `setBackendURL()`, `getBackendURL()`, `getWsURL()`
   - Old exports deprecated (but kept for compatibility)

2. **`App.tsx`**
   - Checks for backend configuration on startup
   - Shows Discovery Screen if not configured
   - Initializes backend URL from storage

3. **`src/hooks/useRoverTelemetry.ts`**
   - Updated to use dynamic backend URL getter
   - Socket.IO connection uses runtime-configured URL

## User Experience

### For Non-Technical Operators

**Before:**
```
❌ Need to know Jetson IP address
❌ Need to edit .env file or app settings
❌ Need to restart app after configuration
```

**After:**
```
✅ Open app
✅ See list of available rovers
✅ Tap to connect
✅ Start working immediately
```

### Discovery Screen UI

```
┌─────────────────────────────┐
│     🔍 Find Your Rover      │
│ Scanning network for devices│
├─────────────────────────────┤
│                             │
│  Quick scanning...          │
│  8 / 10 (80%)               │
│  [████████░░] Progress Bar  │
│                             │
├─────────────────────────────┤
│  Found 2 rover(s)           │
│                             │
│  ┌─────────────────────┐   │
│  │ 🔧 Rover 100        │ → │
│  │ 192.168.1.100:5001  │   │
│  │ Response: 45ms      │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │ 🔧 Rover 102        │ → │
│  │ 192.168.1.102:5001  │   │
│  │ Response: 67ms      │   │
│  └─────────────────────┘   │
│                             │
├─────────────────────────────┤
│ [⚡Quick Scan] [🔍Full Scan]│
└─────────────────────────────┘
```

## Network Requirements

### WiFi Setup
- Mobile device and Jetson must be on same WiFi network
- Jetson backend server must be running on port 5001 (default)
- No firewall blocking port 5001

### Supported Network Ranges
- Default: `192.168.1.x`
- Customizable in code if using different subnet

## Testing

### Test Scenarios

1. **No Rovers Available**
   - Disconnect from WiFi → Should show "No rovers found" message
   - Offer to retry with full scan

2. **Single Rover**
   - Should find and display rover
   - Tap to connect

3. **Multiple Rovers**
   - Should list all found rovers
   - Sorted by IP address
   - Shows response time for each

4. **Saved Configuration**
   - Close and reopen app
   - Should connect to last selected rover automatically

## Configuration

### Change Network Range

Edit `src/utils/jetsonDiscovery.ts`:

```typescript
// Change base network
export async function scanForJetsonDevices(
  baseIP: string = '192.168.1',  // ← Change this
  startRange: number = 1,
  endRange: number = 255,
  ...
)
```

### Change Common IPs for Quick Scan

Edit `src/utils/jetsonDiscovery.ts`:

```typescript
const commonIPs = [
  '192.168.1.100',
  '192.168.1.101',
  '192.168.1.102',
  // Add your static IPs here
];
```

### Change Port

Default port is 5001. To change, update discovery and config:

```typescript
// In jetsonDiscovery.ts
async function testJetsonConnection(
  ip: string,
  port: number = 5001  // ← Change default port
)
```

## Troubleshooting

### "No rovers found"

1. Check WiFi connection
2. Verify Jetson is powered on
3. Verify backend server is running on Jetson
4. Try Full Scan instead of Quick Scan
5. Check if Jetson is using different port

### "Connection failed after selection"

1. Jetson may have restarted
2. Network configuration changed
3. Clear saved configuration: Long-press app → Clear Data
4. Rescan for rovers

### Slow Scanning

- Quick Scan: ~5 seconds (10 IPs)
- Full Scan: ~2-3 minutes (255 IPs)
- Adjust batch size in `jetsonDiscovery.ts` for faster/slower scanning

## Future Enhancements

Possible improvements:

1. **mDNS/Bonjour Discovery**
   - Auto-discover using service broadcasting
   - Requires backend to advertise service

2. **QR Code Configuration**
   - Generate QR code on Jetson screen
   - Scan to instantly connect

3. **Bluetooth Pairing**
   - Initial pairing via Bluetooth
   - WiFi credentials exchange

4. **Manual IP Entry**
   - Fallback option for operators who know IP
   - Settings screen to manually configure

5. **Connection History**
   - Remember multiple rovers
   - Quick switch between known rovers

6. **Network Info Detection**
   - Auto-detect device's network range
   - Scan only relevant subnet

## API Compatibility

The system tries multiple endpoints to detect backend:

1. `/api/ping` - Preferred health check endpoint
2. `/api/rtk/status` - Fallback to existing endpoint
3. `/` - Root endpoint as last resort

Any response with HTTP status < 500 is considered valid.

## Performance

- **Batch Size**: 10 concurrent requests
- **Timeout**: 2 seconds per IP
- **Quick Scan**: 10 IPs × 2s = ~5-10 seconds
- **Full Scan**: 255 IPs ÷ 10 batch × 2s = ~50 seconds (optimized)

## Security Considerations

- No authentication during discovery (considers all responding devices as valid)
- In production, consider:
  - Authentication handshake during discovery
  - Device verification via shared secret
  - SSL/TLS for connections

## Summary

This auto-discovery system eliminates the need for manual IP configuration, making the app field-ready for non-technical operators. The operator simply:

1. Opens the app
2. Sees available rovers
3. Taps to connect
4. Starts working

The backend URL is saved and used automatically on subsequent launches.
