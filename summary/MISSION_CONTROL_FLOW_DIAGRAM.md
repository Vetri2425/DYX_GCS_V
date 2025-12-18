# Mission Control Panel - Visual Control Flow

## Mission Report Tab Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MISSION REPORT VIEW (MissionReportView.tsx)          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Vehicle Status      │  │   MAP VIEW       │  │  Mission Control │  │
│  │  (VehicleStatusCard) │  │  (Live Position) │  │  (MissionControl │  │
│  │                      │  │                  │  │   Card)          │  │
│  │ • Connection         │  │ • Rover Position │  │                  │  │
│  │ • Battery            │  │ • Heading        │  │ ┌──────────────┐ │  │
│  │ • Mode               │  │ • Active WP      │  │ │   CONTROLS   │ │  │
│  │ • RTK Status         │  │ • Waypoint Path  │  │ ├──────────────┤ │  │
│  │                      │  │                  │  │ │ START/STOP   │ │  │
│  │ ┌──────────────────┐ │  │                  │  │ │ PAUSE/RESUME │ │  │
│  │ │ Mission Progress │ │  │                  │  │ │ NEXT MARK    │ │  │
│  │ │ • Current WP     │ │  │                  │  │ │ SKIP MARK    │ │  │
│  │ │ • Total WP       │ │  │                  │  │ │              │ │  │
│  │ │ • Marked Count   │ │  │                  │  │ │ AUTO / MANUAL│ │  │
│  │ └──────────────────┘ │  │                  │  │ └──────────────┘ │  │
│  └──────────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              MISSION WAYPOINTS TABLE (Read-Only)                    │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ S/N │ BLOCK │ ROW │ PILE │ LAT      │ LON      │ ALT   │ STATUS    │ │
│  ├─────┼───────┼─────┼──────┼──────────┼──────────┼───────┼───────────┤ │
│  │  1  │  B1   │ R1  │  1   │ 37.123456│-123.4567│ 50.00 │ Completed │ │
│  │  2  │  B1   │ R2  │  2   │ 37.123457│-123.4566│ 50.00 │ Marked    │ │
│  │  3  │  B1   │ R3  │  3   │ 37.123458│-123.4565│ 50.00 │ Reached   │ │
│  │  4  │  B1   │ R4  │  4   │ 37.123459│-123.4564│ 50.00 │ Pending   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Control Flow Diagram

### 1. Load Mission Flow
```
┌─────────────────────────────────────────────────────────────────────────┐
│ User Action: Click "Load Mission" or Shortcut                            │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ MissionReportView.handleLoadMission()                                    │
│ • Check for missing row/block/pile fields                                │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                    ┌─────┴─────┐
                    ▼           ▼
        ┌──────────────────┐  ┌──────────────────┐
        │ Missing Fields?  │  │ All Fields OK?   │
        └──────┬───────────┘  └────────┬─────────┘
               │ YES                    │ NO
               ▼                        │
    ┌──────────────────────┐           │
    │ Auto-Assign Dialog   │           │
    │ • Suggest R1, B1, 1  │           │
    │ • User can accept/   │           │
    │   skip               │           │
    └──────┬─────────────┬─┘           │
           │ AUTO-ASSIGN │ SKIP        │
           │             │             │
           ▼             │             │
    ┌───────────────┐    │             │
    │ onAutoAssign()│    │             │
    │ setMode/      │    │             │
    │ updateWaypts  │    │             │
    └──────┬────────┘    │             │
           │             │             │
           └─────┬───────┴─────────────┘
                 ▼
    ┌──────────────────────────────────┐
    │ Show Waypoint Preview Dialog      │
    │ • Display WP list                 │
    │ • Confirm count                   │
    │ • User reviews & confirms         │
    └──────┬───────────────────────────┘
           │ UPLOAD MISSION
           ▼
    ┌──────────────────────────────────┐
    │ handleConfirmUpload()             │
    │ Call services.loadMissionToController()
    └──────┬───────────────────────────┘
           ▼
    ┌──────────────────────────────────┐
    │ POST /mission/load               │
    │ Payload: { waypoints, servoConfig}
    └──────┬───────────────────────────┘
           ▼
    ┌──────────────────────────────────┐
    │ Response: { success: true/false } │
    │ • Success: Toast "Loaded"        │
    │ • Failure: Toast error message   │
    └──────────────────────────────────┘
```

### 2. Mission Execution Flow
```
┌──────────────────────────────────────────────────────────────────────┐
│ Mission Control Button Pressed                                        │
│ (START / PAUSE / RESUME / NEXT / SKIP)                               │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┬──────────┐
        │              │              │              │          │
        ▼              ▼              ▼              ▼          ▼
   ┌────────┐  ┌────────────┐  ┌───────────┐  ┌──────┐  ┌──────┐
   │ START  │  │   PAUSE    │  │  RESUME   │  │ NEXT │  │ SKIP │
   └────┬───┘  └────┬───────┘  └─────┬─────┘  └──┬───┘  └──┬───┘
        │            │              │            │         │
        │ Keyboard   │              │            │         │
        │ Shortcut   │              │            │         │
        │ Ctrl+S     │              │            │         │
        │            │ Ctrl+P       │ Ctrl+Shift │ Ctrl+N  │ Direct
        │            │              │ +R         │         │ fetch
        ▼            ▼              ▼            ▼         ▼
    services.      services.      services.    services.  Direct
    startMission   pauseMission   resumeMission nextWayp   fetch
    Controller()   ()             oint()         ()        POST/
                                                           mission/
                                                           skip
        │            │              │            │         │
        └────────────┴──────────────┴────────────┴─────────┘
                     │
                     ▼
    ┌─────────────────────────────────────────────┐
    │ postService('/mission/{cmd}')               │
    │ or Direct fetch POST /api/mission/...       │
    └────────────┬────────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────────┐
    │ Send HTTP POST Request to Backend           │
    │ {BACKEND_URL}/mission/{start|pause|...}    │
    └────────────┬────────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────────┐
    │ Jetson Backend Processes Request            │
    │ • Updates mission state                     │
    │ • Sends commands to rover                   │
    │ • Emits mission_status event                │
    └────────────┬────────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────────┐
    │ Response: { success: true, message: "..." } │
    └────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
    SUCCESS           FAILURE
    ├─ Toast OK       ├─ Toast error
    ├─ Update UI      ├─ Keep UI state
    └─ Wait for       └─ Suggest retry
      WebSocket
      event
```

### 3. Mission Status Update Flow
```
┌────────────────────────────────────────────────────────────────────┐
│ Jetson Backend (via WebSocket Socket.IO)                           │
│ Emits mission_status Event                                         │
│ { waypoint_reached | waypoint_marked }                             │
└─────────────────────┬──────────────────────────────────────────────┘
                      │
                      ▼
    ┌─────────────────────────────────────────┐
    │ Socket.IO Message: mission_status       │
    │ Payload:                                │
    │ {                                       │
    │   event_type: "waypoint_reached",       │
    │   waypoint_id: 3,                       │
    │   timestamp: "2025-12-01T...",          │
    │   pile: "3",                            │
    │   row_no: "R3",                         │
    │   remark: "Sprayed successfully"        │
    │ }                                       │
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │ onMissionEvent Callback Handler         │
    │ (MissionReportView.useEffect)           │
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │ Update statusMap[waypointId]            │
    │ • Set reached: true                     │
    │ • Set marked: true                      │
    │ • Set status: 'completed'               │
    │ • Store timestamp                       │
    │ • Store pile & rowNo                    │
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │ Re-render Mission Waypoints Table       │
    │ • Table row for WP #3 updates           │
    │ • Status displays "Completed" (green)   │
    │ • Timestamp shows marking time          │
    │ • MissionProgress updates marked count  │
    └─────────────────────────────────────────┘
```

### 4. Mission Mode Toggle Flow
```
┌─────────────────────────────────────────────────────────────────────┐
│ User Clicks "AUTO" or "MANUAL" Button                               │
└────────────────┬──────────────────────────────────────────────────┘
                 │
        ┌────────┴──────────┐
        ▼                   ▼
   ┌─────────┐          ┌──────────┐
   │  AUTO   │          │  MANUAL  │
   └────┬────┘          └────┬─────┘
        │ setMode('auto')    │ setMode('manual')
        │                    │
        └────────┬───────────┘
                 ▼
    ┌─────────────────────────────────────────┐
    │ fetch POST /api/mission/mode            │
    │ Body: { mode: "auto" | "manual" }       │
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │ Backend Updates Mission Mode            │
    │ • Switches execution model              │
    │ • Emits mode_changed event              │
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │ Response: { mode: "auto" | "manual" }   │
    │ • Success: Button highlights new mode   │
    │ • Failure: Revert to previous mode      │
    │ • Toast notification shows result       │
    └─────────────────────────────────────────┘
```

## Endpoint Summary Matrix

```
┌─────────────────────┬──────────────────┬────────────────┬──────────────┐
│ Endpoint            │ HTTP Method      │ Keyboard       │ UI Component │
│                     │                  │ Shortcut       │              │
├─────────────────────┼──────────────────┼────────────────┼──────────────┤
│ /mission/load       │ POST             │ None           │ Load Dialog  │
│ /mission/start      │ POST             │ Ctrl+S         │ START Button │
│ /mission/stop       │ POST             │ Ctrl+X         │ STOP Button  │
│ /mission/pause      │ POST             │ Ctrl+P         │ PAUSE Button │
│ /mission/resume     │ POST             │ Ctrl+Shift+R   │ RESUME Btn   │
│ /mission/next       │ POST             │ Ctrl+N         │ NEXT Button  │
│ /mission/skip       │ POST             │ None           │ SKIP Button  │
│ /mission/restart    │ POST             │ None           │ Restart Btn  │
│ /api/mission/mode   │ GET/POST         │ None           │ Mode Toggle  │
├─────────────────────┼──────────────────┼────────────────┼──────────────┤
│ WebSocket Events    │ Socket.IO        │ -              │ Status Table │
│ mission_status      │ (Real-time)      │                │              │
└─────────────────────┴──────────────────┴────────────────┴──────────────┘
```

## Data Transformation Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│ Raw Mission Waypoint Data (from Plan Tab)                           │
│ Waypoint[] {                                                        │
│   id, lat, lng, alt, command, frame, current, autocontinue,        │
│   row?, block?, pile?                                              │
│ }                                                                   │
└────────────┬────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Auto-Assign Missing Fields (if needed)                              │
│ • row: "R1", "R2", ...  (if missing)                               │
│ • block: "B1" (default)                                            │
│ • pile: "1", "2", ...   (if missing)                               │
└────────────┬────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Sanitize Before Upload                                              │
│ • Remove autocontinue field                                         │
│ • Convert negative altitudes to positive                            │
│ • Validate coordinates                                              │
└────────────┬────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ POST /mission/load                                                  │
│ {                                                                   │
│   "waypoints": [ ... ],                                             │
│   "servoConfig": {}                                                 │
│ }                                                                   │
└────────────┬────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Jetson Backend Loads to Controller                                  │
│ • Stores in mission buffer                                          │
│ • Ready for execution                                               │
└────────────┬────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Mission Execution Status Tracking                                   │
│ statusMap: { [waypointId]: WpStatus }                              │
│ {                                                                   │
│   1: { reached: true, status: "completed", timestamp: "..." },    │
│   2: { reached: true, marked: true, status: "marked", ... },      │
│   3: { reached: false, status: "pending" }                         │
│ }                                                                   │
└────────────┬────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Display in Mission Report Table                                     │
│ S/N │ BLOCK │ ROW │ PILE │ LAT      │ LNG      │ ALT   │ STATUS     │
│ 1   │ B1    │ R1  │ 1    │ 37.12345 │ -123.456 │ 50.00 │ Completed  │
│ 2   │ B1    │ R2  │ 2    │ 37.12346 │ -123.457 │ 50.00 │ Marked     │
│ 3   │ B1    │ R3  │ 3    │ 37.12347 │ -123.458 │ 50.00 │ Pending    │
└─────────────────────────────────────────────────────────────────────┘
```

## Connection State Dependency

```
┌────────────────────────────────────────────────────────────────────┐
│ Connection State from useRover() Hook                              │
└────────────────────┬───────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   CONNECTING   CONNECTED    DISCONNECTED/ERROR
       │            │             │
       │            │             │
   ┌───┴───┐    ┌───┴───┐     ┌──┴───┐
   │ Wait  │    │ Enable│     │Disable
   │ for   │    │ all   │     │all
   │ conn. │    │ ctls  │     │ctls
   │       │    │       │     │
   │ Dims  │    │ Green │     │Gray
   │ buttons   │ buttons   │ buttons
   └───────┘    └───────┘     └──────┘
                   │
          Keyboard shortcuts
          also enabled/disabled
          based on connection
```

---

*Last Updated: December 2025*
*For Mission Control Panel in Mission Report Tab*
