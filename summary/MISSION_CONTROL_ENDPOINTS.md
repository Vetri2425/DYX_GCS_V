# Mission Control Panel - Endpoints Reference

## Overview
The Mission Report Tab in the React temp resource (`temp-react-source/src/components/report/MissionReportView.tsx`) controls the mission execution via the following endpoints. All endpoints are served from the backend server configured in `src/config.ts` (default: `http://192.168.1.101:5001`).

---

## Mission Control Endpoints (Jetson Backend)

### 1. **Load Mission to Controller**
- **Endpoint:** `POST /mission/load`
- **Component:** `MissionReportView.tsx` → `MissionControlCard.tsx`
- **Method:** `services.loadMissionToController(waypoints, servoConfig?)`
- **Purpose:** Loads waypoints into the Jetson mission controller
- **Payload:**
  ```json
  {
    "waypoints": [
      {
        "id": 1,
        "lat": 0.0,
        "lng": 0.0,
        "alt": 50,
        "command": "WAYPOINT",
        "frame": 3,
        "current": 0,
        "autocontinue": 0,
        "row": "R1",
        "block": "B1",
        "pile": "1"
      }
    ],
    "servoConfig": {}
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Mission loaded successfully"
  }
  ```
- **Keyboard Shortcut:** Not applicable (requires confirmation dialog)
- **UI Location:** "Load Mission" button triggers auto-assignment dialog

---

### 2. **Start Mission Controller**
- **Endpoint:** `POST /mission/start`
- **Component:** `MissionReportView.tsx` → `MissionControlCard.tsx`
- **Method:** `services.startMissionController()`
- **Purpose:** Initiates mission execution on the Jetson controller
- **Payload:** Empty body
- **Response:**
  ```json
  {
    "success": true,
    "message": "Mission started successfully"
  }
  ```
- **Keyboard Shortcut:** `Ctrl+S` (when rover is connected)
- **UI Location:** Green "START" button in Mission Control Card

---

### 3. **Stop Mission Controller**
- **Endpoint:** `POST /mission/stop`
- **Component:** `MissionReportView.tsx` → `MissionControlCard.tsx`
- **Method:** `services.stopMissionController()`
- **Purpose:** Stops the currently running mission
- **Payload:** Empty body
- **Response:**
  ```json
  {
    "success": true,
    "message": "Mission stopped successfully"
  }
  ```
- **Keyboard Shortcut:** `Ctrl+X` (when rover is connected)
- **UI Location:** Red "STOP" button (appears when mission is running)

---

### 4. **Pause Mission**
- **Endpoint:** `POST /mission/pause`
- **Component:** `MissionReportView.tsx` → `MissionControlCard.tsx`
- **Method:** `services.pauseMission()`
- **Purpose:** Pauses the currently running mission
- **Payload:** Empty body
- **Response:**
  ```json
  {
    "success": true,
    "message": "Mission paused"
  }
  ```
- **Keyboard Shortcut:** `Ctrl+P` (when rover is connected)
- **UI Location:** Orange "PAUSE" button

---

### 5. **Resume Mission**
- **Endpoint:** `POST /mission/resume`
- **Component:** `MissionReportView.tsx` → `MissionControlCard.tsx`
- **Method:** `services.resumeMission()`
- **Purpose:** Resumes a paused mission
- **Payload:** Empty body
- **Response:**
  ```json
  {
    "success": true,
    "message": "Mission resumed"
  }
  ```
- **Keyboard Shortcut:** `Ctrl+Shift+R` (when rover is connected)
- **UI Location:** Blue "RESUME" button (appears when mission is paused)

---

### 6. **Next Waypoint / Mark Next**
- **Endpoint:** `POST /mission/next`
- **Component:** `MissionReportView.tsx` → `MissionControlCard.tsx`
- **Method:** `services.nextWaypoint()`
- **Purpose:** Moves to the next waypoint and marks current location
- **Payload:** Empty body
- **Response:**
  ```json
  {
    "success": true,
    "message": "Moved to next waypoint"
  }
  ```
- **Keyboard Shortcut:** `Ctrl+N` (when rover is connected)
- **UI Location:** Yellow "NEXT MARK" button

---

### 7. **Skip Waypoint / Skip Mark**
- **Endpoint:** `POST /mission/skip`
- **Component:** `MissionReportView.tsx` → `MissionControlCard.tsx`
- **Method:** Direct fetch call (not wrapped in service)
- **Purpose:** Skips the current waypoint without marking it
- **Payload:**
  ```json
  {}
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Skipped to next waypoint"
  }
  ```
- **UI Location:** Cyan "SKIP MARK" button
- **Notes:** Implemented via direct fetch, not through service wrapper

---

### 8. **Restart Mission Controller**
- **Endpoint:** `POST /mission/restart`
- **Component:** `MissionReportView.tsx`
- **Method:** `services.restartMissionController()`
- **Purpose:** Restarts the mission from the beginning
- **Payload:** Empty body
- **Response:**
  ```json
  {
    "success": true,
    "message": "Mission restarted successfully"
  }
  ```
- **UI Location:** "Restart" button in Mission Control Card
- **Notes:** Clears current progress and restarts from waypoint 1

---

### 9. **Get Mission Mode (Auto/Manual)**
- **Endpoint:** `GET /api/mission/mode`
- **Component:** `MissionReportView.tsx` → `MissionControlCard.tsx`
- **Purpose:** Fetches the current mission execution mode
- **Response:**
  ```json
  {
    "mode": "auto" | "manual"
  }
  ```
- **Called on:** Component mount (useEffect)
- **Notes:** 
  - Direct fetch call (not wrapped in service)
  - Determines whether the rover operates in AUTO or MANUAL mode

---

### 10. **Set Mission Mode (Auto/Manual)**
- **Endpoint:** `POST /api/mission/mode`
- **Component:** `MissionControlCard.tsx`
- **Purpose:** Sets the mission execution mode
- **Payload:**
  ```json
  {
    "mode": "auto" | "manual"
  }
  ```
- **Response:**
  ```json
  {
    "mode": "auto" | "manual"
  }
  ```
- **UI Location:** 
  - "AUTO" button (green when active)
  - "MANUAL" button (blue when active)
- **Notes:** 
  - Direct fetch call (not wrapped in service)
  - Changes how the rover executes waypoints (autonomous vs operator-controlled)

---

## Mission Status Events (WebSocket)

### Mission Event Subscription
- **Event Type:** `mission_status`
- **Source:** Socket.IO connection
- **Callback:** `onMissionEvent(handler)` in `useRover()` hook
- **Payload Structure:**
  ```json
  {
    "type": "mission_status",
    "data": {
      "event_type": "waypoint_reached" | "waypoint_marked",
      "waypoint_id": 1,
      "current_waypoint": 1,
      "pile": "1",
      "row_no": "R1",
      "marking_status": "completed" | "skipped",
      "remark": "...",
      "timestamp": "2025-12-01T12:30:45.123Z",
      "mission_mode": "auto" | "manual"
    }
  }
  ```

- **Event Types:**
  - `waypoint_reached`: Rover has reached a waypoint
  - `waypoint_marked`: Rover has marked/sprayed at a waypoint

---

## Supporting Endpoints

### Get Mission Config
- **Endpoint:** `GET /mission/config`
- **Method:** `services.getMissionConfig()`
- **Purpose:** Retrieves current mission configuration

### Get Sprayer Config
- **Endpoint:** `GET /config/sprayer`
- **Method:** `services.getSprayerConfig()`
- **Purpose:** Retrieves sprayer configuration

### Save Sprayer Config
- **Endpoint:** `POST /config/sprayer`
- **Method:** `services.saveSprayerConfig(config)`
- **Purpose:** Saves sprayer configuration updates

---

## Component Hierarchy

```
MissionReportView (main container)
├── VehicleStatusCard (left sidebar)
├── MapView (center)
├── MissionControlCard (right sidebar - MISSION CONTROL)
│   ├── START/STOP button
│   ├── PAUSE/RESUME button
│   ├── NEXT MARK button
│   ├── SKIP MARK button
│   └── AUTO/MANUAL mode toggle
├── MissionProgress (left sidebar progress)
└── MissionWaypoints Table (bottom - displays status updates)
```

---

## Data Flow

### 1. Load Mission Flow
```
User clicks "Load Mission"
  ↓
Auto-assign dialog (if missing row/block/pile)
  ↓
Waypoint preview dialog
  ↓
services.loadMissionToController(waypoints)
  ↓
POST /mission/load
  ↓
Response: success/failure
  ↓
Toast notification
```

### 2. Start/Control Flow
```
User clicks START/PAUSE/RESUME/NEXT/SKIP
  ↓
services.xxxMissionController()
  ↓
POST /mission/{start|pause|resume|next|skip}
  ↓
Response: success/failure
  ↓
Toast notification
  ↓
WebSocket mission_status event received
  ↓
statusMap updated in state
  ↓
Table rows re-render with new status
```

### 3. Mode Toggle Flow
```
User clicks AUTO or MANUAL button
  ↓
fetch POST /api/mission/mode { mode: "auto" | "manual" }
  ↓
Response: { mode: "auto" | "manual" }
  ↓
setMode(newMode)
  ↓
UI button colors update
```

---

## Status Tracking in Mission Report Tab

The Mission Report tab tracks waypoint status using the `statusMap` state:

```typescript
type WpStatus = {
  reached?: boolean;           // Waypoint reached event
  marked?: boolean;            // Waypoint marked/sprayed
  status?: 'completed' | 'loading' | 'skipped' | 'reached' | 'marked';
  timestamp?: string;          // Time of marking
  pile?: string | number;      // Pile number
  rowNo?: string | number;     // Row number
  remark?: string;             // Remarks from spraying
};
```

### Status Display Logic
| Status | Display | Color |
|--------|---------|-------|
| `completed` | "Completed" | Green (#22c55e) |
| `marked` | "Marked" | Blue (#3b82f6) |
| `skipped` | "Skipped" | Gray (#6b7280) |
| `reached` | "Reached" | Light Green (#4ade80) |
| `loading` | "Loading" | Yellow (#facc15) |
| (pending) | "Pending" | Gray (#9ca3af) |

---

## Keyboard Shortcuts (Mission Report Tab)

| Shortcut | Action | Condition |
|----------|--------|-----------|
| `Ctrl+S` | Start Mission | Rover connected |
| `Ctrl+P` | Pause Mission | Rover connected |
| `Ctrl+Shift+R` | Resume Mission | Rover connected |
| `Ctrl+X` | Stop Mission | Rover connected |
| `Ctrl+N` | Next Waypoint | Rover connected |
| `Shift+?` | Show Shortcuts Help | Always |

---

## Backend Configuration

**Config File:** `temp-react-source/src/config.ts`

```typescript
export const BACKEND_URL = 'http://192.168.1.101:5001';
```

**To Change Backend IP:**
1. Set environment variable: `VITE_ROS_HTTP_BASE=http://YOUR_IP:5001`
2. Or modify the BACKEND_URL in `config.ts`

---

## Error Handling

All endpoints return standardized responses:

```typescript
interface ServiceResponse {
  success: boolean;
  message?: string;
}
```

**Error Handling in UI:**
- On success: Green toast notification
- On failure: Red toast notification with error message
- Connection issues: "Rover disconnected" state disables all controls

---

## Notes

1. **Service Wrapper vs Direct Fetch:**
   - Most endpoints use the `services` wrapper from `useRover()` hook
   - `/api/mission/mode` and `/api/mission/skip` use direct fetch calls
   - All calls go through `postService()` or `getService()` helper functions

2. **Socket.IO Integration:**
   - Real-time mission events come through WebSocket
   - Allows live status updates without polling
   - Mission status map updates trigger table re-renders

3. **Waypoint Sanitization:**
   - Before upload, waypoints are sanitized (negative altitudes converted to positive)
   - Invalid coordinates are filtered out
   - Auto-assign fills missing row/block/pile values

4. **Connection State:**
   - All mission control buttons are disabled when rover is not connected
   - Keyboard shortcuts are also disabled when disconnected
   - Reconnection automatically re-enables controls

---

## Related Files

- **Main Component:** `temp-react-source/src/components/report/MissionReportView.tsx`
- **Mission Control Card:** `temp-react-source/src/components/report/MissionControlCard.tsx`
- **Service Hook:** `temp-react-source/src/hooks/useRoverROS.ts`
- **Context:** `temp-react-source/src/context/RoverContext.tsx`
- **Configuration:** `temp-react-source/src/config.ts`
