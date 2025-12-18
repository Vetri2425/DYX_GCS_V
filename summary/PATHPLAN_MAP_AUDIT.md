# PathPlan Map View - Feature Audit & Missing Implementations

## 📊 Current Status

### ✅ Implemented Features

1. **Map Rendering**
   - ✓ MapView with OpenStreetMap tiles
   - ✓ Map type switching (standard/hybrid/satellite)
   - ✓ Initial region centered on first waypoint or rover

2. **Waypoint Markers**
   - ✓ Waypoint markers displayed with ID numbers
   - ✓ Draggable waypoints (drag to reposition)
   - ✓ Visual distinction for start waypoint (green)
   - ✓ Regular waypoints in accent color
   - ✓ Route polyline connecting all waypoints

3. **Rover Marker**
   - ✓ Static rover marker (🚜 emoji)
   - ✓ Displayed at fixed position in map
   - ✓ Default position: Chennai (13.0827, 80.2707)

4. **Drawing Tools**
   - ✓ Line drawing mode (📏)
   - ✓ Polygon drawing mode (⬠)
   - ✓ Confirm/Cancel actions
   - ✓ Temporary markers during drawing

5. **Map Controls**
   - ✓ Map type switcher button
   - ✓ Tool buttons overlay
   - ✓ Visual feedback for active tool

---

### ❌ Missing Features

#### 1. **Rover Position Not Passed to Map**
**Location:** PathPlanScreen.tsx line ~530

**Issue:**
```tsx
// Currently NOT passing roverPosition
<PathPlanMap
  waypoints={waypoints}
  onMapPress={handleMapPress}
  onWaypointDrag={handleWaypointDrag}
  onAddWaypoints={handleAddWaypoints}
  // ❌ Missing: roverPosition prop
/>
```

**Should be:**
```tsx
<PathPlanMap
  waypoints={waypoints}
  onMapPress={handleMapPress}
  onWaypointDrag={handleWaypointDrag}
  onAddWaypoints={handleAddWaypoints}
  roverPosition={{ lat: 13.0827, lon: 80.2707, alt: 10.5 }}
/>
```

**Impact:** Rover always shows at hardcoded default position, doesn't update dynamically

---

#### 2. **Dynamic Rover Position Updates**
**Missing:**
- No real-time rover position updates from backend/telemetry
- Rover position is static and hardcoded
- No GPS/telemetry integration

**What's needed:**
```typescript
// In PathPlanScreen component state
const [roverPosition, setRoverPosition] = useState({ 
  lat: 13.0827, 
  lon: 80.2707, 
  alt: 10.5 
});

// In useEffect - listen to telemetry/backend updates
useEffect(() => {
  // Subscribe to rover position updates from backend
  const subscription = subscribeToRoverPosition((newPos) => {
    setRoverPosition(newPos);
  });
  
  return () => subscription.unsubscribe();
}, []);
```

---

#### 3. **Bearing/Heading Indicator for Rover**
**Missing:**
- Rover marker doesn't show heading/direction
- No rotation based on movement direction
- Just a static emoji

**What's needed:**
```typescript
// Calculate bearing between two points
const calculateBearing = (from: Coordinate, to: Coordinate): number => {
  const dLon = toRad(to.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - 
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  
  return Math.atan2(y, x) * 180 / Math.PI;
};

// Use bearing to rotate rover marker
<Marker
  rotation={roverBearing}
  // ... other props
>
  <RotatedRoverIcon bearing={roverBearing} />
</Marker>
```

---

#### 4. **Position History/Trail**
**Missing:**
- No visualization of rover's previous positions
- No breadcrumb trail showing rover path
- No movement history

**What's needed:**
```typescript
const [roverTrail, setRoverTrail] = useState<Coordinate[]>([]);

// Add new position to trail
useEffect(() => {
  setRoverTrail(prev => [...prev, roverPosition]);
}, [roverPosition]);

// In map
<Polyline
  coordinates={roverTrail.map(p => ({
    latitude: p.lat,
    longitude: p.lon
  }))}
  strokeColor="rgba(59, 130, 246, 0.5)"
  strokeWidth={2}
  lineDashPattern={[5, 5]}
/>
```

---

#### 5. **Distance to Waypoint Display**
**Missing:**
- No distance shown between rover and active waypoint
- No visual line from rover to next waypoint
- No distance metrics on map

**What's needed:**
```typescript
// Calculate distance to next waypoint
const nextWaypoint = waypoints[selectedWaypoint || 0];
const distanceToNext = haversineDistance(
  { lat: roverPosition.lat, lon: roverPosition.lon },
  { lat: nextWaypoint.lat, lon: nextWaypoint.lon }
);

// Draw line from rover to next waypoint
<Polyline
  coordinates={[
    { latitude: roverPosition.lat, longitude: roverPosition.lon },
    { latitude: nextWaypoint.lat, longitude: nextWaypoint.lon }
  ]}
  strokeColor="#FF6B6B"
  strokeWidth={2}
  lineDashPattern={[5, 5]}
/>

// Show distance label on marker
<Marker coordinate={roverPosition}>
  <View>
    <Text>{(distanceToNext / 1000).toFixed(2)} km</Text>
  </View>
</Marker>
```

---

#### 6. **Waypoint Status Indicators**
**Missing:**
- No indication of completed waypoints
- No active waypoint highlighting
- No waypoint status visualization

**What's needed:**
```typescript
// Change marker colors based on status
const getWaypointStyle = (wp: PathPlanWaypoint, isActive: boolean) => {
  if (isActive) return styles.activeWaypoint; // Blue/highlight
  if (wp.completed) return styles.completedWaypoint; // Gray
  return styles.normalWaypoint; // Accent color
};
```

---

#### 7. **Map Zoom/Center Controls**
**Missing:**
- No zoom in/out buttons (only map type switcher)
- No "center on rover" button
- No "center on mission" button
- No "fit all waypoints" button

**What's needed:**
```typescript
const mapRef = useRef(null);

// Center on rover
const centerOnRover = () => {
  mapRef.current?.animateToRegion({
    latitude: roverPosition.lat,
    longitude: roverPosition.lon,
    latitudeDelta: 0.001,
    longitudeDelta: 0.001,
  });
};

// Fit all waypoints
const fitAllWaypoints = () => {
  // Calculate bounds of all waypoints
  const region = calculateBoundingRegion([...waypoints, roverPosition]);
  mapRef.current?.animateToRegion(region);
};
```

---

#### 8. **Telemetry Data Display**
**Missing:**
- No altitude display for rover on map
- No speed/velocity indicator
- No GPS accuracy/signal strength
- No real-time telemetry overlay

**What's needed:**
```typescript
// Overlay with telemetry info
<View style={styles.telemetryOverlay}>
  <Text>Alt: {roverPosition.alt?.toFixed(1) || '—'} m</Text>
  <Text>Speed: {roverSpeed?.toFixed(1) || '—'} m/s</Text>
  <Text>GPS: {gpsAccuracy?.toFixed(1) || '—'} m</Text>
</View>
```

---

#### 9. **Geofence/Mission Boundary**
**Missing:**
- No visual indication of mission area
- No geofence display
- No boundary polygon for mission region

**What's needed:**
```typescript
// If mission has a defined boundary
<Polygon
  coordinates={missionBoundary.map(p => ({
    latitude: p.lat,
    longitude: p.lon
  }))}
  strokeColor={colors.accent}
  strokeWidth={2}
  fillColor="rgba(107, 114, 128, 0.1)"
/>
```

---

#### 10. **Waypoint Popups/Info Windows**
**Missing:**
- No info popup when tapping waypoint marker
- No details shown (coordinates, altitude, distance, etc.)
- No edit/delete options from map

**What's needed:**
```typescript
const [selectedMarker, setSelectedMarker] = useState<number | null>(null);

// Show info window on marker press
<Marker
  onPress={() => setSelectedMarker(wp.id)}
>
  {selectedMarker === wp.id && (
    <Callout>
      <View>
        <Text>WP {wp.id}</Text>
        <Text>Lat: {wp.lat.toFixed(6)}</Text>
        <Text>Lon: {wp.lon.toFixed(6)}</Text>
        <Text>Alt: {wp.alt.toFixed(1)}m</Text>
      </View>
    </Callout>
  )}
</Marker>
```

---

## 🎯 Priority Implementation Order

### High Priority (Critical)
1. ✅ Pass roverPosition prop to PathPlanMap
2. 🔴 Add dynamic rover position updates (backend integration)
3. 🔴 Add rover bearing/heading indicator
4. 🔴 Add active waypoint highlighting

### Medium Priority (Important)
5. 🟡 Add rover trail/history
6. 🟡 Add distance to waypoint display
7. 🟡 Add map zoom/center controls
8. 🟡 Add waypoint info popups

### Low Priority (Nice-to-have)
9. 🟢 Add telemetry overlay
10. 🟢 Add geofence/boundary display
11. 🟢 Add waypoint status indicators

---

## 📝 Implementation Summary

**Currently working:**
- Static map with waypoints
- Draggable waypoints
- Drawing tools
- Hardcoded rover at default position

**Broken/Missing:**
- Rover position not updated in real-time
- No GPS/telemetry integration
- No bearing/heading for rover
- No distance calculations
- No map controls for zoom/center
- No active waypoint indication
- No info popups

**Total Missing Features:** 10 major features
**Completion Rate:** ~40%

