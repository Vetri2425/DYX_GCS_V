# DYX-GCS-Mobile

Expo React Native mobile app for DYX ground control and autonomous rover operations. Landscape dark UI designed for field operators and real-time rover command.

## Tech Stack

- **Expo SDK 54**, React Native 0.81, React 19, TypeScript (strict mode)
- **Platform:** Android (primary), iOS, Web support
- **Build:** EAS APK profiles, Metro bundler
- **Backend:** Node.js/Socket.IO with MAVROS/ROS integration on Jetson hardware
- **State Management:** React Context (TelemetryProvider, MissionProvider, ConnectionProvider)

## Quick Start

### Prerequisites

- Node.js 18+
- Android SDK or iOS dev environment (for native builds)
- Backend server running (see backend setup)

### Install & Run

```bash
# Install dependencies
npm install

# Start Metro dev server (Expo)
npx expo start --clear

# Android dev build (requires Android SDK)
npm run android

# iOS dev build (requires macOS + Xcode)
npm run ios

# Web (local browser test only)
npm run web

# Type check
npx tsc --noEmit

# Run tests
npm test
```

## Project Structure

```
src/
  ├── index.ts                 # App entry point
  ├── App.tsx                  # Root app component
  ├── navigation/              # Navigation (TabNavigator, screens)
  ├── screens/                 # Screen components (Dashboard, Marking Plan, Mission Progress)
  ├── hooks/                   # Custom hooks (useRoverTelemetry, useMission, useConnection)
  ├── context/                 # React Context providers
  ├── services/                # RoverServices, PersistentStorage
  ├── utils/                   # Helpers (missionCalculator, waypointValidator, CAD parsing)
  ├── core/                    # Core logic (georeferencing, coordinate parsing, transforms)
  ├── theme/                   # Colors, fonts, dark UI styling
  └── config.ts                # Backend endpoints & env config
```

## Core App Flow

1. **Startup:** `GlobalCrashHandler` initializes, app renders
2. **Discovery:** `RoverDiscoveryScreen` selects backend URL, saves to AsyncStorage
3. **Providers:** 
   - `WaypointProvider`
   - `RoverProvider` (wraps Mission, Telemetry, Connection, SocketEventCoordinator)
   - `NavigationContainer`
   - `TabNavigator` (Dashboard, Marking Plan, Mission Progress)

## Main Features

- **Dashboard:** Real-time rover telemetry, status, arm/disarm, manual control
- **Marking Plan:** Waypoint import (QGC/CSV/KML/DXF), path planning, survey grid, free draw, CAD import with georeferencing
- **Mission Progress:** Live mission execution, waypoint status, skip audit, completion review, export
- **Settings:** Backend config, RTK, servo/sprayer setup, QuickTune tuning
- **Manual Control:** Joystick at 20 Hz throttled updates

## Backend Contract

### Connection

- **REST Base:** `getBackendURL()` from `src/config.ts`
- **WebSocket:** `getWsURL()` → `/socket.io/`
- **Runtime Discovery:** Rover discovery sets backend URL; hardcoded IPs are dev-only

### Socket Events

Subscribe via `useRoverTelemetry`:
- `telemetry` – position, heading, altitude, battery, RTK status
- `rover_data` – arm state, mode, GPS failsafe, servo position
- `mission_status` – waypoint progress, upload state, errors

### Key REST Endpoints

See `src/config.ts` for full list. Common:
- `/api/rover/arm`, `/api/rover/disarm`
- `/api/rover/mode` (set AUTO, LOITER, MANUAL)
- `/api/mission/upload`
- `/api/rtk/start`, `/api/servo/set`

## State & Context

**Use the right hook:**

- `useTelemetry()` – live, high-frequency rover values only (position, heading, battery)
- `useMission()` – waypoints, mission mode, upload preview, low-frequency mission UI
- `useConnection()` – socket, services, connection state, reconnect behavior
- `useRover()` – deprecated; avoid in new code unless migration is larger than the task

**Rule:** A component needing only mission or connection data should not subscribe to telemetry.

## Rover Safety

Treat these as real control surfaces:
- **Arm/Disarm**, **Mode changes** (AUTO/MANUAL), **Emergency stop**
- **Mission start/stop**, **GPS failsafe** (strict/relax/disable)
- **RTK**, **Servo/sprayer** actions

**Never fake success locally if backend/socket command fails.** Keep confirmations, disabled states, error paths, and emergency-stop behavior intact.

## Performance Guidelines

- **Telemetry throttling:** Already applied in `useRoverTelemetry`; still treat as high-frequency
- **Tab mounting:** Hidden screens must stay unmounted (no `display: none` hacks)
- **Memoization:** Memoize heavy children in PathPlan and MissionReport; pass stable callbacks
- **Refs for async:** Use refs for event handlers needing latest values without re-triggering effects
- **Cleanup:** Always clean up timers, intervals, socket listeners, AppState subscriptions on unmount
- **Map updates:** Leaflet WebView is intentionally generated once; update via injected JavaScript, not re-render

## Path Planning & Waypoints

- **Main file:** `PathPlanScreen.tsx` (large, touch carefully)
- **Hooks:** Look for existing logic under `src/hooks/pathplan/` before adding state
- **Coordinates:** UI uses `lat`/`lon`, mission code may use `lat`/`lng`; preserve conversions
- **Utils:** Use `vincentyDistance`, `recalculateWaypointDistances`, `calcBearing` from `src/utils/missionCalculator.ts`
- **Import:** `parseCoordinates(content, fileName, options)` in `src/core/parsers/`
- **CAD:** Separate flow—parse DXF, select two CAD points, enter two GPS points, compute transform, convert to waypoints
- **Validation:** Use `src/utils/waypointValidator.ts` before upload

## Testing

```bash
# Type check (always, before committing)
npx tsc --noEmit

# Unit tests
npm test

# Coverage
npm test -- --coverage
```

**Critical test areas:**
- Parser tests: `src/core/parsers/__tests__/parsers.test.ts`
- Georeferencing tests: `src/__tests__/georeference.test.ts`
- Waypoint validation, QuickTune tuning, storage helpers

## Development Notes

- **Styling:** Dark navy control-room theme from `src/theme/colors.ts`; landscape-first, field-operator oriented
- **Error handling:** Only validate at system boundaries (user input, external APIs); trust internal code
- **Comments:** Write only when WHY is non-obvious (hidden constraints, subtle invariants, workarounds)
- **No cleanup:** Don't clean up unrelated files while solving a task
- **Repo state:** Can be dirty; check `git status --short` and work around unrelated changes

## Building for Release

```bash
# Build signed APK for Android (requires EAS account and credentials)
eas build --platform android --auto-submit
```

Refer to Expo docs and `eas.json` for configuration details.

## Troubleshooting

- **Metro not starting:** `npx expo start --clear` and wait for the CLI; Metro takes 30s on first run
- **Android build fails:** Ensure Android SDK is installed; try `npm run android -- --clear-cache`
- **Backend not found:** Check `src/config.ts` and AsyncStorage persistence of backend URL
- **Stale socket events:** Reconnect by resetting discovery and selecting rover again

## Contributing

- Read `CLAUDE.md` for project conventions and safety rules
- Keep telemetry and mission state separate; use the correct hook
- Test on-device before committing control changes
- Always run `npx tsc --noEmit` before push
