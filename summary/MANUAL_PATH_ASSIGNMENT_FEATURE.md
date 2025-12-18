# Manual Path Assignment Feature

## Overview
Added a premium feature that allows users to manually assign custom path connections between waypoints, giving precise control over mission execution order beyond sequential paths.

## Feature Description

### Auto vs Manual Path Assignment Modes

When uploading a mission file, users now have two options:

1. **Auto Mode (Default)** - Sequential path assignment
   - Waypoints are connected in the order they appear in the file
   - Traditional linear path: WP1 → WP2 → WP3 → ... → WPn
   - Best for simple missions and standard operations

2. **Manual Mode** - Custom path drawing
   - Waypoints appear on map without automatic connections
   - User clicks waypoints in desired order to create custom path
   - Perfect for complex patterns (e.g., corner-only routes, specific field patterns)
   - Example: From waypoints 1-48, connect only corners: 1 → 16 → 25 → 48 → 1

## User Workflow

### 1. Upload Mission File
- User taps "Upload" button in Mission Operations Panel
- Selects mission file (.waypoint, .csv, .json, .kml, .dxf)
- File is parsed and validated

### 2. Import Preview Dialog
- Shows mission statistics and waypoint details
- **NEW:** Path Assignment Mode selector with two options:
  - 🤖 **Auto** - Sequential order
  - ✏️ **Manual** - Draw connections
- User selects desired mode
- Validation errors/warnings displayed if any

### 3a. Auto Mode (Traditional Flow)
- User clicks "✓ Proceed"
- Waypoints are imported in sequential order
- Path is automatically connected
- Success message displayed

### 3b. Manual Mode (New Feature)
- User clicks "✓ Proceed" after selecting Manual mode
- Waypoints are imported to map **without path connections**
- Manual Path Connection Panel appears at top of map
- User clicks waypoints in desired order to create custom path

### 4. Manual Connection Interface

The Manual Path Connection Panel provides:

#### Display Elements
- **Title:** "✏️ Manual Path Connection"
- **Instructions:** "Tap waypoints in order to connect them"
- **Progress Counter:** Shows "Connected: X/Total"
- **Connection Sequence Display:** Visual list of connected waypoint IDs with arrows (e.g., #1 → #16 → #25 → #48)

#### Controls
- **↶ Undo Button:** Removes last waypoint from sequence
- **Clear All Button:** Resets all connections
- **✓ Finish Button:** Saves custom path and reorders waypoints
- **✕ Exit Button:** Exits manual mode with confirmation

#### Interactive Map
- Click any waypoint marker to add it to the path
- Waypoints highlight when clicked
- Connection sequence updates in real-time
- Already-connected waypoints show alert if clicked again

### 5. Path Creation
- User must connect at least 2 waypoints
- Waypoints are reordered based on connection sequence
- Unconnected waypoints are appended at the end
- Success confirmation displays number of connected waypoints

## Technical Implementation

### New State Variables (PathPlanScreen.tsx)
```typescript
const [pathAssignmentMode, setPathAssignmentMode] = useState<'auto' | 'manual'>('auto');
const [manualPathConnections, setManualPathConnections] = useState<number[]>([]);
const [isConnectingPath, setIsConnectingPath] = useState<boolean>(false);
```

### New Handler Functions

#### Waypoint Click Handler
```typescript
const handleWaypointClick = (id: number) => {
  if (!isConnectingPath) return;

  if (manualPathConnections.includes(id)) {
    Alert.alert('Already Connected', `Waypoint #${id} is already in your path.`);
    return;
  }

  setManualPathConnections(prev => [...prev, id]);
};
```

### Map Component Updates (PathPlanMap.tsx)

#### New Props
- `onWaypointClick?: (id: number) => void`

#### New Event Handler
```typescript
marker.on('click', function(e) {
  L.DomEvent.stopPropagation(e);
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'waypointClick',
    id: wp.id
  }));
});
```

#### WebView Message Handler
```typescript
} else if (message.type === 'waypointClick') {
  onWaypointClick?.(message.id);
}
```

### Path Reordering Logic
```typescript
// Reorder waypoints based on manual connections
const reorderedWaypoints = manualPathConnections.map(id =>
  waypoints.find(wp => wp.id === id)
).filter(Boolean) as PathPlanWaypoint[];

// Add unconnected waypoints at the end
const connectedIds = new Set(manualPathConnections);
const unconnectedWaypoints = waypoints.filter(wp => !connectedIds.has(wp.id));

const finalWaypoints = [...reorderedWaypoints, ...unconnectedWaypoints];
updateWaypoints(finalWaypoints);
```

## Use Cases

### 1. Corner-Only Field Pattern
**Scenario:** 48 waypoints covering entire field, but rover should only visit corners

**Solution:**
- Upload mission with all 48 waypoints
- Select Manual mode
- Connect only corner waypoints: 1 → 12 → 36 → 48 → 1
- Rover follows efficient corner-only path

### 2. Specific Row Selection
**Scenario:** Need to inspect only rows 2, 5, and 8 from a 10-row grid

**Solution:**
- Upload full grid mission
- Select Manual mode
- Connect waypoints only in desired rows
- Skip unnecessary rows

### 3. Custom Inspection Pattern
**Scenario:** Priority inspection of high-risk areas first

**Solution:**
- Upload all inspection points
- Select Manual mode
- Connect high-priority points first
- Connect remaining points as secondary route

### 4. Return-to-Start Loops
**Scenario:** Create closed-loop mission returning to starting point

**Solution:**
- Upload waypoints
- Select Manual mode
- Connect waypoints in loop, ending at starting waypoint
- Creates circular mission pattern

## Benefits

1. **Flexibility:** Users aren't constrained to sequential waypoint order
2. **Efficiency:** Skip unnecessary waypoints while maintaining full mission data
3. **Precision:** Exact control over rover path for complex operations
4. **Reusability:** Same waypoint file can be used with different path patterns
5. **Visual Feedback:** Real-time connection sequence display
6. **Error Prevention:** Duplicate connection detection, minimum waypoint validation

## Files Modified

### Core Changes
1. `src/screens/PathPlanScreen.tsx`
   - Added path assignment mode state variables
   - Created Manual Path Connection Panel UI
   - Implemented waypoint click handler
   - Added path reordering logic

2. `src/components/pathplan/PathPlanMap.tsx`
   - Added `onWaypointClick` prop
   - Implemented waypoint click event on markers
   - Added click message to WebView handler

### Upload Preview Modal
- Added Path Assignment Mode selector (Auto/Manual)
- Added mode-specific import logic
- Added informative tip for manual mode

## User Interface Components

### Mode Selector (in Import Preview Dialog)
```
┌─────────────────────────────────────────┐
│ Path Assignment Mode:                    │
│                                          │
│  ┌──────────┐  ┌──────────┐            │
│  │ 🤖 Auto  │  │ ✏️ Manual │            │
│  │ Sequential│  │  Draw    │            │
│  │  order   │  │connections│            │
│  └──────────┘  └──────────┘            │
│                                          │
│  💡 Tip: In manual mode, waypoints      │
│  will appear on the map without         │
│  connections. Click waypoints in order  │
│  to connect your custom path.           │
└─────────────────────────────────────────┘
```

### Manual Path Connection Panel (overlays map)
```
┌─────────────────────────────────────────┐
│ ✏️ Manual Path Connection           ✕  │
├─────────────────────────────────────────┤
│ Tap waypoints in order to connect them. │
│ Each tap adds the waypoint to your path.│
│                                          │
│ Connected: 4/48         [↶ Undo]       │
│                                          │
│ Connection Sequence:                     │
│ ┌────────────────────────────────────┐  │
│ │ #1 → #16 → #25 → #48              │  │
│ └────────────────────────────────────┘  │
│                                          │
│ [Clear All]              [✓ Finish]    │
└─────────────────────────────────────────┘
```

## Validation & Error Handling

### Validations
- ✓ Minimum 2 waypoints required for path creation
- ✓ Duplicate waypoint detection (shows alert)
- ✓ Connection sequence preserved in order of clicks
- ✓ Unconnected waypoints appended automatically

### User Alerts
- **Already Connected:** "Waypoint #X is already in your path"
- **Not Enough Waypoints:** "Connect at least 2 waypoints to create a path"
- **Exit Confirmation:** "Your current connections will be saved. Continue?"
- **Success:** "Successfully connected X waypoints in custom order"

## Future Enhancements (Potential)

1. **Visual Path Preview:** Show connecting lines as user builds path
2. **Save Path Templates:** Save custom connection patterns for reuse
3. **Path Optimization:** Suggest optimal path based on distance
4. **Multi-Path Support:** Create multiple independent paths in single mission
5. **Drag-to-Connect:** Click and drag between waypoints to connect
6. **Path Editing:** Edit existing paths without re-importing

## Conclusion

The Manual Path Assignment feature transforms mission planning from rigid sequential execution to flexible, user-defined paths. This premium capability enables advanced use cases like corner-only routes, priority-based inspection, and custom field patterns while maintaining the simplicity of Auto mode for standard operations.
