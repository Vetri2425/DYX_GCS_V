import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Fontisto } from '@expo/vector-icons';
import { LEAFLET_JS, LEAFLET_CSS } from '../../assets/leafletBundle';
import type { Waypoint } from './types';

interface Props {
  roverLat?: number;
  roverLon?: number;
  waypoints?: Waypoint[];
  heading?: number | null;
  activeWaypointIndex?: number | null;
  // TRAIL DISABLED: trailPoints prop commented out
  // trailPoints?: Array<{ latitude: number; longitude: number; opacity?: number; timestamp?: number }>;
  armed?: boolean;        // For dynamic color: armed = green
  rtkFixType?: number;    // For dynamic color: RTK (5,6) = blue
  onToggleFullscreen?: () => void;
  isVisible?: boolean;     // When false, pauses Leaflet rendering to save GPU/CPU
}

const MissionMapBase: React.FC<Props> = ({
  roverLat = 0.0,
  roverLon = 0.0,
  waypoints = [],
  heading = null,
  activeWaypointIndex = null,
  // TRAIL DISABLED: trailPoints prop commented out
  // trailPoints = [],
  armed = false,
  rtkFixType = 0,
  onToggleFullscreen,
  isVisible = true,
}) => {
  const webViewRef = useRef<WebView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapInitializedRef = useRef(false);

  // Ref so waypoints injection reads latest active index without re-triggering a full reload
  const activeWaypointIndexRef = useRef(activeWaypointIndex);
  useEffect(() => { activeWaypointIndexRef.current = activeWaypointIndex; }, [activeWaypointIndex]);

  // Store initial rover data for one-time HTML generation
  const initialRoverData = useRef({
    lat: roverLat,
    lon: roverLon,
    heading: heading,
    hasPosition: Number.isFinite(roverLat) && Number.isFinite(roverLon),
  });

  // Generate HTML with Leaflet map - ONLY ONCE on mount
  // WAYPOINTS DEFERRED: HTML shell has empty waypoints; data injected after WebView loads.
  // This avoids blocking the JS thread with JSON.stringify on 400+ waypoints during render.
  const mapHTML = useMemo(() => {
    console.log('[MissionMap] Generating map HTML shell (waypoints deferred to injectedJavaScript)');

    const roverData = JSON.stringify(initialRoverData.current);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>${LEAFLET_CSS}</style>
  <script>${LEAFLET_JS}</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    
    .leaflet-control-zoom { display: none; }
    
    .custom-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .control-btn {
      width: 36px;
      height: 36px;
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid rgba(103, 232, 249, 0.3);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      color: white;
    }
    
    .zoom-controls {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .zoom-btn {
      width: 32px;
      height: 32px;
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid rgba(103, 232, 249, 0.3);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 18px;
      font-weight: bold;
      color: white;
    }
    
    .position-overlay {
      position: absolute;
      bottom: 10px;
      right: 10px;
      z-index: 1000;
      background: rgba(30, 41, 59, 0.95);
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(103, 232, 249, 0.3);
      min-width: 140px;
      font-family: monospace;
      font-size: 10px;
      color: white;
    }
    
    .position-title {
      font-size: 10px;
      font-weight: 600;
      margin-bottom: 4px;
      color: rgba(103, 232, 249, 1);
    }
    
    .position-coord {
      color: rgba(148, 163, 184, 1);
    }

    /* ── Marker GPU acceleration ── */
    .custom-marker {
      will-change: transform;
      transform: translateZ(0);
      backface-visibility: hidden;
      pointer-events: none;  /* READ-ONLY: No interactions needed */
    }
    
    /* READ-ONLY OPTIMIZATION: Freeze marker pane for maximum performance */
    .leaflet-marker-pane {
      will-change: transform;
      transform: translateZ(0);
      backface-visibility: hidden;
    }
    
    /* Optimize polyline rendering */
    .leaflet-overlay-pane {
      will-change: transform;
      transform: translateZ(0);
    }

  </style>
</head>
<body>
  <div id="map"></div>

  <div class="custom-controls">
    <button class="control-btn" onclick="centerOnRover()">✦</button>
    <button class="control-btn" onclick="fitToMission()">🗺️</button>
    <button class="control-btn" onclick="toggleFullscreen()">⛶</button>
  </div>

  <div class="zoom-controls">
    <button class="zoom-btn" onclick="map.zoomIn()">+</button>
    <button class="zoom-btn" onclick="map.zoomOut()">−</button>
  </div>

  <div class="position-overlay">
    <div class="position-title">Robot Position</div>
    <div class="position-coord" id="rover-lat">Lat: 0.0000000</div>
    <div class="position-coord" id="rover-lon">Lon: 0.0000000</div>
  </div>


  <script>
    // Waypoints loaded AFTER WebView init via injectedJavaScript
    // This avoids blocking JS thread with JSON.stringify during HTML generation
    // Waypoints are injected as a global variable, then loaded into the map
    const waypoints = [];
    const roverData = ${roverData};

    // Initialize map
    const centerLat = waypoints.length > 0 ? waypoints[0].lat : (roverData.hasPosition ? roverData.lat : 13.0827);
    const centerLon = waypoints.length > 0 ? waypoints[0].lon : (roverData.hasPosition ? roverData.lon : 80.2707);
    
    const map = L.map('map', {
      center: [centerLat, centerLon],
      zoom: 15,
      maxZoom: 26,
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: false,        // Disable zoom animation
      markerZoomAnimation: false,  // Disable marker animation during zoom
      updateWhenZooming: false,    // CRITICAL: Don't update layers during zoom
      updateWhenIdle: true,        // Only update after zoom completes
      preferCanvas: false,         // Keep SVG for better quality
      fadeAnimation: false,        // Disable fade animations
      zoomSnap: 1,                 // Snap to integer zoom levels for faster rendering
      zoomDelta: 1,                // Zoom by 1 level at a time
      trackResize: true,           // Track container resize
      boxZoom: true,               // Enable box zoom
      doubleClickZoom: true,       // Enable double click zoom
      dragging: true,              // Enable dragging
      tap: true,                   // Enable tap for mobile
      touchZoom: true,             // Enable touch zoom
      scrollWheelZoom: true,       // Enable scroll wheel zoom
      wheelPxPerZoomLevel: 60,     // Smooth scroll zoom
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: 26,
    }).addTo(map);

    let roverMarker = null;
    let headingLine = null;
    let missionPolyline = null;
    const waypointMarkers = [];

    // Live rover position — updated via injected JS so centerOnRover always uses current coords
    let liveRoverPos = roverData.hasPosition ? { lat: roverData.lat, lon: roverData.lon } : null;

    // TRAIL DISABLED: Single trail polyline commented out
    // window.roverTrail = null;

    // WEB APP STYLE: Custom RoverMarker class for fast rotation updates
    class RoverMarker extends L.Marker {
      constructor(latlng, options) {
        super(latlng, options);
        this._heading = options?.heading || 0;
        this._status = options?.status || 'disarmed';
      }

      setHeading(deg) {
        this._heading = ((deg % 360) + 360) % 360;

        // Fast path: Direct DOM rotation without recreating icon
        const markerEl = this.getElement();
        if (markerEl) {
          const svg = markerEl.querySelector('svg');
          if (svg) {
            svg.style.transform = 'rotate(' + this._heading + 'deg)';
            svg.style.willChange = 'transform';
            svg.style.transition = 'none'; // Instant update
            return this;
          }
        }

        // Fallback: Icon not in DOM yet, will be updated on next render
        return this;
      }

      setStatus(status) {
        this._status = status;
        // Update icon color based on status
        const markerEl = this.getElement();
        if (markerEl) {
          const bodyRect = markerEl.querySelector('#rover-body');
          if (bodyRect) {
            const color = status === 'armed' ? '#22c55e' :
                         status === 'rtk' ? '#3b82f6' : '#f4d03f';
            bodyRect.setAttribute('fill', color);
          }
        }
        return this;
      }

      getStatus() {
        return this._status;
      }
    }

    // Get marker icon based on waypoint type
    // READ-ONLY OPTIMIZATION: Static markers with no interactivity
    function getWaypointIcon(wp, index) {
      let fill = '#f97316';
      if (wp.isStart) fill = '#16a34a';
      if (wp.isEnd) fill = '#dc2626';
      if (wp.isActive) fill = '#22c55e';
      
      const size = wp.isActive ? 48 : 36;
      
      // PERFORMANCE: Minimal SVG, no filters, no animations
      const svgIcon = \`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="\${size}" height="\${size}" fill="\${fill}">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="rgba(0,0,0,0.25)" stroke-width="0.4"/>
          <text x="12" y="10.5" font-family="sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle" dy=".3em">\${index + 1}</text>
        </svg>
      \`;
      
      return L.divIcon({
        html: svgIcon,
        className: 'custom-marker',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
      });
    }
    
    // PERFORMANCE: Chunked marker loading to prevent UI freeze with 100+ waypoints
    // Optimized chunk size and timing for fastest initial render
    function chunkedLoadMarkers(waypoints) {
      const CHUNK_SIZE = 50;  // Larger chunks (50) for faster loading, still smooth
      let currentIndex = 0;
      
      function loadNextChunk() {
        const endIndex = Math.min(currentIndex + CHUNK_SIZE, waypoints.length);
        
        // Load this chunk
        for (let i = currentIndex; i < endIndex; i++) {
          const wp = waypoints[i];
          const marker = L.marker([wp.lat, wp.lon], {
            icon: getWaypointIcon(wp, i),
            interactive: false,           // READ-ONLY: No interactions
            bubblingMouseEvents: false,   // No event propagation
          }).addTo(map);
          
          waypointMarkers.push(marker);
        }
        
        currentIndex = endIndex;
        
        // If more markers to load, schedule next chunk immediately
        if (currentIndex < waypoints.length) {
          // Use requestAnimationFrame for smoother loading
          requestAnimationFrame(loadNextChunk);
        } else {
          // All markers loaded - now draw mission path
          if (waypoints.length > 1) {
            const pathCoords = waypoints.map(wp => [wp.lat, wp.lon]);
            missionPolyline = L.polyline(pathCoords, {
              color: '#3B82F6',
              weight: 3,
              dashArray: '5, 5',
              interactive: false,  // READ-ONLY: No interaction needed
            }).addTo(map);
          }
          
          // Notify that loading is complete
          console.log('[MissionMap] All markers loaded:', waypoints.length);
        }
      }
      
      loadNextChunk();
    }
    
    // Start chunked loading
    if (waypoints.length > 0) {
      chunkedLoadMarkers(waypoints);
    }
    
    // Draw mission path will be added after markers are loaded (see chunkedLoadMarkers)

    // Draw rover marker and heading
    if (roverData.hasPosition) {
      // Update position display
      document.getElementById('rover-lat').textContent = \`Lat: \${roverData.lat.toFixed(7)}\`;
      document.getElementById('rover-lon').textContent = \`Lon: \${roverData.lon.toFixed(7)}\`;

      // SVG-based rover icon with proper design (no transition for instant updates)
      const currentZoom = map.getZoom();
      const zoomScale = Math.max(0.3, Math.min(1.2, (currentZoom - 10) / 12));
      const size = Math.round(84 * zoomScale);
      const half = Math.round(size / 2);
      const rotation = roverData.heading !== null ? roverData.heading : 0;

      const roverIconSVG = \`
        <svg width="\${size}" height="\${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(\${rotation}deg); will-change: transform;">
          <!-- Wheels (4 corners) -->
          <g id="wheels">
            <!-- Front Left Wheel -->
            <rect x="15" y="15" width="12" height="20" rx="2" fill="#2d2d2d" stroke="#000" stroke-width="1"/>
            <rect x="17" y="17" width="8" height="16" rx="1" fill="#4a4a4a"/>
            <!-- Front Right Wheel -->
            <rect x="73" y="15" width="12" height="20" rx="2" fill="#2d2d2d" stroke="#000" stroke-width="1"/>
            <rect x="75" y="17" width="8" height="16" rx="1" fill="#4a4a4a"/>
            <!-- Rear Left Wheel -->
            <rect x="15" y="65" width="12" height="20" rx="2" fill="#2d2d2d" stroke="#000" stroke-width="1"/>
            <rect x="17" y="67" width="8" height="16" rx="1" fill="#4a4a4a"/>
            <!-- Rear Right Wheel -->
            <rect x="73" y="65" width="12" height="20" rx="2" fill="#2d2d2d" stroke="#000" stroke-width="1"/>
            <rect x="75" y="67" width="8" height="16" rx="1" fill="#4a4a4a"/>
          </g>
          <!-- Rover Body (Dynamic color based on status) -->
          <rect id="rover-body" x="30" y="25" width="40" height="50" rx="3" fill="#f4d03f" stroke="#d4af37" stroke-width="2"/>
          <!-- Front Panel (Darker Yellow) -->
          <rect x="32" y="27" width="36" height="15" rx="2" fill="#e8b923"/>
          <!-- Eyes/Sensors (Black rectangles) -->
          <rect x="37" y="37" width="10" height="6" rx="1" fill="#5a5a5a"/>
          <rect x="53" y="37" width="10" height="6" rx="1" fill="#5a5a5a"/>
          <!-- Center Sensor Bar (Gray) -->
          <rect x="35" y="50" width="30" height="4" rx="1" fill="#7a7a7a"/>
          <!-- Solar Panels / Details (Lighter Yellow) -->
          <rect x="33" y="60" width="15" height="10" rx="1" fill="#f9e79f" stroke="#d4af37" stroke-width="1"/>
          <rect x="52" y="60" width="15" height="10" rx="1" fill="#f9e79f" stroke="#d4af37" stroke-width="1"/>
          <!-- Heading Arrow (Red) pointing upward -->
          <g id="heading-arrow">
            <line x1="50" y1="25" x2="50" y2="5" stroke="#e74c3c" stroke-width="4" stroke-linecap="round"/>
            <polygon points="50,0 43,10 57,10" fill="#e74c3c"/>
          </g>
        </svg>
      \`;

      const roverIcon = L.divIcon({
        html: roverIconSVG,
        className: 'bg-transparent border-0',
        iconSize: [size, size],
        iconAnchor: [half, half],
      });

      // Use custom RoverMarker class for fast rotation updates
      roverMarker = new RoverMarker([roverData.lat, roverData.lon], {
        icon: roverIcon,
        zIndexOffset: 1000,
        heading: rotation,
        status: 'disarmed', // Will be updated dynamically
      }).addTo(map);
      
      roverMarker.bindPopup(\`<strong>Rover</strong><br>Heading: \${roverData.heading !== null ? roverData.heading.toFixed(1) + '°' : 'N/A'}<br>Lat: \${roverData.lat.toFixed(7)}<br>Lon: \${roverData.lon.toFixed(7)}\`);

      // Heading line (short arrow - 8 meters)
      if (roverData.heading !== null) {
        const distance = 0.0; // meters - SHORT heading indicator
        const earthRadius = 6371000;
        const headingRad = (roverData.heading * Math.PI) / 180;
        const latRad = (roverData.lat * Math.PI) / 180;
        const lonRad = (roverData.lon * Math.PI) / 180;
        
        const newLatRad = Math.asin(
          Math.sin(latRad) * Math.cos(distance / earthRadius) +
          Math.cos(latRad) * Math.sin(distance / earthRadius) * Math.cos(headingRad)
        );
        
        const newLonRad = lonRad + Math.atan2(
          Math.sin(headingRad) * Math.sin(distance / earthRadius) * Math.cos(latRad),
          Math.cos(distance / earthRadius) - Math.sin(latRad) * Math.sin(newLatRad)
        );
        
        const endLat = (newLatRad * 180) / Math.PI;
        const endLon = (newLonRad * 180) / Math.PI;
        
        headingLine = L.polyline([
          [roverData.lat, roverData.lon],
          [endLat, endLon]
        ], {
          color: '#FCD34D',
          weight: 2,
        }).addTo(map);
      }
    }
    
    // Fit map to show all markers
    setTimeout(() => {
      const bounds = [];
      waypoints.forEach(wp => bounds.push([wp.lat, wp.lon]));
      if (roverData.hasPosition) bounds.push([roverData.lat, roverData.lon]);
      
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, 100);
    
    function centerOnRover() {
      if (liveRoverPos) {
        map.setView([liveRoverPos.lat, liveRoverPos.lon], 17, { animate: true });
      }
    }

    function toggleFullscreen() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TOGGLE_FULLSCREEN' }));
    }

    function fitToMission() {
      const bounds = [];
      waypoints.forEach(wp => bounds.push([wp.lat, wp.lon]));
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }

    // PERFORMANCE: Freeze marker pane during zoom to prevent re-renders
    map.on('zoomstart', function() {
      const markerPane = map.getPane('markerPane');
      if (markerPane) {
        markerPane.style.willChange = 'transform';
        markerPane.style.pointerEvents = 'none';
      }
    });
    
    map.on('zoomend', function() {
      const markerPane = map.getPane('markerPane');
      if (markerPane) {
        markerPane.style.pointerEvents = '';
      }
    });

    // Track active waypoint index for highlight updates
    let currentActiveIndex = waypoints.findIndex(wp => wp.isActive);
    if (currentActiveIndex === -1) currentActiveIndex = -1;

    // READ-ONLY OPTIMIZATION: Fast active waypoint update via direct DOM manipulation
    // Instead of recreating icons with setIcon(), we directly update the SVG fill color and size
    window.setActiveWaypoint = function(index) {
      if (index === currentActiveIndex) return;

      // Deactivate previous marker - direct DOM update
      if (currentActiveIndex >= 0 && currentActiveIndex < waypointMarkers.length) {
        const prevMarker = waypointMarkers[currentActiveIndex];
        const prevEl = prevMarker.getElement();
        if (prevEl) {
          const svg = prevEl.querySelector('svg');
          const path = prevEl.querySelector('path');
          if (svg && path) {
            // Reset to normal size and color
            const isStart = currentActiveIndex === 0;
            const isEnd = currentActiveIndex === waypoints.length - 1;
            const fill = isStart ? '#16a34a' : (isEnd ? '#dc2626' : '#f97316');
            svg.setAttribute('width', '36');
            svg.setAttribute('height', '36');
            path.setAttribute('fill', fill);
          }
        }
      }

      // Activate new marker - direct DOM update
      if (index >= 0 && index < waypointMarkers.length) {
        const newMarker = waypointMarkers[index];
        const newEl = newMarker.getElement();
        if (newEl) {
          const svg = newEl.querySelector('svg');
          const path = newEl.querySelector('path');
          if (svg && path) {
            // Set to active size and color
            svg.setAttribute('width', '48');
            svg.setAttribute('height', '48');
            path.setAttribute('fill', '#22c55e');
          }
        }
      }

      currentActiveIndex = index;
    };

    // Clear all waypoint markers and polyline from the map
    window.clearAllMarkers = function() {
      try {
        // Remove all waypoint markers
        for (let i = 0; i < waypointMarkers.length; i++) {
          if (waypointMarkers[i] && map.hasLayer(waypointMarkers[i])) {
            map.removeLayer(waypointMarkers[i]);
          }
        }
        waypointMarkers.length = 0;

        // Remove mission polyline
        if (missionPolyline) {
          map.removeLayer(missionPolyline);
          missionPolyline = null;
        }
      } catch(e) {
        console.error('[MissionMap] clearAllMarkers error:', e);
      }
    };

    // Receive waypoints from React Native after WebView loads
    // Called via injectedJavaScript whenever waypoints change
    window.loadWaypointsFromReactNative = function(wpArray) {
      try {
        // wpArray is already an array (injected as global), not a JSON string
        const newWaypoints = Array.isArray(wpArray) ? wpArray : (typeof wpArray === 'string' ? JSON.parse(wpArray) : []);
        if (!Array.isArray(newWaypoints) || newWaypoints.length === 0) return;

        // Clear existing markers before loading new ones
        window.clearAllMarkers();

        // Update global waypoints array
        waypoints.length = 0;
        for (let i = 0; i < newWaypoints.length; i++) {
          waypoints.push(newWaypoints[i]);
        }

        // Track active waypoint index
        currentActiveIndex = waypoints.findIndex(wp => wp.isActive);

        // Center map on first waypoint or rover
        if (waypoints.length > 0) {
          map.setView([waypoints[0].lat, waypoints[0].lon], 15);
        }

        // Load markers in chunks
        chunkedLoadMarkers(waypoints);

        // Re-fit bounds after a short delay
        setTimeout(function() {
          map.invalidateSize();
          const b = [];
          waypoints.forEach(wp => b.push([wp.lat, wp.lon]));
          if (liveRoverPos) b.push([liveRoverPos.lat, liveRoverPos.lon]);
          if (b.length > 0) map.fitBounds(b, { padding: [50, 50] });
        }, 200);

        console.log('[MissionMap] Loaded ' + waypoints.length + ' waypoints from React Native');
      } catch (e) {
        console.error('[MissionMap] Failed to load waypoints:', e);
      }
    };

    // Notify React Native that map is ready
    setTimeout(() => {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
      }
    }, 500);
  </script>
</body>
</html>
    `;
  }, []); // Empty dependencies - HTML generated ONLY ONCE on mount, NEVER regenerated

  // Memoize source prop to avoid new object reference every render
  const mapSource = useMemo(() => ({ html: mapHTML }), [mapHTML]);

  // Inject waypoints after WebView loads AND when waypoints change
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;

    // Empty waypoints — clear the map
    if (!waypoints || waypoints.length === 0) {
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            if (window.clearAllMarkers) window.clearAllMarkers();
            if (missionPolyline) { map.removeLayer(missionPolyline); missionPolyline = null; }
            waypoints.length = 0;
          } catch(e) { console.error('[MissionMap] Clear error:', e); }
        })();
        true;
      `);
      return;
    }

    const waypointsArray = waypoints.map((wp, idx) => ({
      id: wp.sn,
      uniqueId: `wp-${idx}-${wp.sn}`,
      lat: wp.lat,
      lon: wp.lon,
      block: wp.block,
      row: wp.row,
      pile: wp.pile,
      isActive: idx === activeWaypointIndexRef.current,
      isStart: idx === 0,
      isEnd: idx === waypoints.length - 1,
    }));

    webViewRef.current.injectJavaScript(`
      (function() {
        window.__waypointsData = ${JSON.stringify(waypointsArray)};
        if (window.loadWaypointsFromReactNative) {
          window.loadWaypointsFromReactNative(window.__waypointsData);
        }
        delete window.__waypointsData;
      })();
      true;
    `);
    console.log(`[MissionMap] Injected ${waypoints.length} waypoints`);
  }, [mapReady, waypoints]); // activeWaypointIndex handled by the dedicated setActiveWaypoint effect below

  // Pause/resume Leaflet rendering when visibility changes
  // This stops tile loading, marker animation, and continuous redraws when hidden
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;

    if (isVisible) {
      // Resume: invalidate size and re-enable interactions
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            if (typeof map !== 'undefined' && map) {
              map.invalidateSize();
              map.dragging.enable();
              map.touchZoom.enable();
              map.doubleClickZoom.enable();
              map.scrollWheelZoom.enable();
            }
          } catch(e) { console.error('[MissionMap] Resume error:', e); }
        })();
        true;
      `);
    } else {
      // Pause: stop tile loading, disable interactions, reduce redraws
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            if (typeof map !== 'undefined' && map) {
              map.dragging.disable();
              map.touchZoom.disable();
              map.doubleClickZoom.disable();
              map.scrollWheelZoom.disable();
            }
          } catch(e) { console.error('[MissionMap] Pause error:', e); }
        })();
        true;
      `);
    }
  }, [isVisible, mapReady]);

  // Initialize rover marker once when map is ready
  useEffect(() => {
    if (!mapReady || !webViewRef.current || mapInitializedRef.current) return;
    if (!Number.isFinite(roverLat) || !Number.isFinite(roverLon)) return;

    console.log('[MissionMap] Initializing rover marker');
    mapInitializedRef.current = true;

    const initScript = `
      (function() {
        try {
          if (!roverMarker && ${Number.isFinite(roverLat)} && ${Number.isFinite(roverLon)}) {
            const size = 84;
            const half = 42;
            const rotation = ${heading || 0};

            const roverIconSVG = \`
              <svg width="\${size}" height="\${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(\${rotation}deg); will-change: transform;">
                <g id="wheels">
                  <rect x="15" y="15" width="12" height="20" rx="2" fill="#2d2d2d" stroke="#000" stroke-width="1"/>
                  <rect x="17" y="17" width="8" height="16" rx="1" fill="#4a4a4a"/>
                  <rect x="73" y="15" width="12" height="20" rx="2" fill="#2d2d2d" stroke="#000" stroke-width="1"/>
                  <rect x="75" y="17" width="8" height="16" rx="1" fill="#4a4a4a"/>
                  <rect x="15" y="65" width="12" height="20" rx="2" fill="#2d2d2d" stroke="#000" stroke-width="1"/>
                  <rect x="17" y="67" width="8" height="16" rx="1" fill="#4a4a4a"/>
                  <rect x="73" y="65" width="12" height="20" rx="2" fill="#2d2d2d" stroke="#000" stroke-width="1"/>
                  <rect x="75" y="67" width="8" height="16" rx="1" fill="#4a4a4a"/>
                </g>
                <rect x="30" y="25" width="40" height="50" rx="3" fill="#f4d03f" stroke="#d4af37" stroke-width="2"/>
                <rect x="32" y="27" width="36" height="15" rx="2" fill="#e8b923"/>
                <rect x="37" y="37" width="10" height="6" rx="1" fill="#5a5a5a"/>
                <rect x="53" y="37" width="10" height="6" rx="1" fill="#5a5a5a"/>
                <rect x="35" y="50" width="30" height="4" rx="1" fill="#7a7a7a"/>
                <rect x="33" y="60" width="15" height="10" rx="1" fill="#f9e79f" stroke="#d4af37" stroke-width="1"/>
                <rect x="52" y="60" width="15" height="10" rx="1" fill="#f9e79f" stroke="#d4af37" stroke-width="1"/>
                <g id="heading-arrow">
                  <line x1="50" y1="25" x2="50" y2="5" stroke="#e74c3c" stroke-width="4" stroke-linecap="round"/>
                  <polygon points="50,0 43,10 57,10" fill="#e74c3c"/>
                </g>
              </svg>
            \`;

            const roverIcon = L.divIcon({
              html: roverIconSVG,
              className: 'bg-transparent border-0',
              iconSize: [size, size],
              iconAnchor: [half, half],
            });

            roverMarker = L.marker([${roverLat}, ${roverLon}], {
              icon: roverIcon,
              zIndexOffset: 1000,
            }).addTo(map);

            roverMarker.bindPopup(\`<strong>Rover</strong><br>Heading: ${heading !== null ? heading.toFixed(1) + '°' : 'N/A'}<br>Lat: ${roverLat.toFixed(7)}<br>Lon: ${roverLon.toFixed(7)}\`);
          }
        } catch (e) {
          console.error('Rover marker init error:', e);
        }
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(initScript);
  }, [mapReady, roverLat, roverLon, heading]);

  // Cleanup WebView on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (webViewRef.current) {
        try {
          webViewRef.current.injectJavaScript(`
            (function() {
              try {
                // Clean up Leaflet map
                if (typeof map !== 'undefined' && map) {
                  map.remove();
                  map = null;
                }
                // TRAIL DISABLED: Clear trail (all segments) commented out
                // if (window.trailSegments) {
                //   window.trailSegments.forEach(segment => {
                //     if (map.hasLayer(segment)) {
                //       map.removeLayer(segment);
                //     }
                //   });
                //   window.trailSegments = [];
                // }
                // if (window.trailStartMarker) {
                //   if (map.hasLayer(window.trailStartMarker)) {
                //     map.removeLayer(window.trailStartMarker);
                //   }
                //   window.trailStartMarker = null;
                // }
                // Clear markers
                if (waypointMarkers) {
                  waypointMarkers.length = 0;
                }
                console.log('[MissionMap] WebView cleaned up');
              } catch (e) {
                console.error('[MissionMap] Cleanup error:', e);
              }
            })();
            true;
          `);
        } catch (e) {
          console.error('[MissionMap] WebView cleanup injection failed:', e);
        }
      }
    };
  }, []);

  // Update active waypoint highlight when index changes
  useEffect(() => {
    if (!mapReady || !webViewRef.current || activeWaypointIndex === undefined || activeWaypointIndex === null) return;
    webViewRef.current.injectJavaScript(
      `(function() { if (window.setActiveWaypoint) window.setActiveWaypoint(${activeWaypointIndex}); })(); true;`
    );
  }, [activeWaypointIndex, mapReady]);

  // Update rover position, heading, and trail via JavaScript injection
  // Skip updates when not visible to save JS thread and GPU
  useEffect(() => {
    if (!isVisible) return; // Don't inject JS when tab is hidden
    if (!mapReady || !webViewRef.current || !mapInitializedRef.current) {
      if (Math.random() < 0.05) { // Log 5% of skipped updates for debugging
        console.log('[MissionMap] Skipping rover update - mapReady:', mapReady, 'webViewRef:', !!webViewRef.current, 'mapInit:', mapInitializedRef.current);
      }
      return;
    }
    if (!Number.isFinite(roverLat) || !Number.isFinite(roverLon)) {
      if (Math.random() < 0.05) {
        console.log('[MissionMap] Skipping rover update - invalid position:', roverLat, roverLon);
      }
      return;
    }

    // Debug log to verify updates are being processed (10% sample rate to avoid spam)
    // if (Math.random() < 0.1) {
    //   console.log('[MissionMap] ✦ Updating rover position:', {
    //     lat: roverLat.toFixed(7),
    //     lon: roverLon.toFixed(7),
    //     heading: heading !== null ? heading.toFixed(1) + '°' : 'N/A',
    //     status: armed ? 'ARMED' : (rtkFixType >= 5 ? 'RTK' : 'DISARMED')
    //   });
    // }

    // TRAIL DISABLED: trailPoints processing commented out
    // const trailSegments = trailPoints.map(point => ({
    //   lat: point.latitude,
    //   lon: point.longitude,
    //   opacity: point.opacity || 1.0
    // }));
    // const trailData = JSON.stringify(trailSegments);
    // Track if trail actually changed (for performance optimization)
    // const trailChanged = trailSegments.length !== lastTrailLengthRef.current;
    // if (trailChanged) {
    //   console.log(`[MissionMap] Trail updated: ${lastTrailLengthRef.current} -> ${trailSegments.length} points`);
    // }
    // lastTrailLengthRef.current = trailSegments.length;

    // Calculate rover status based on armed state and RTK fix type
    const status = armed ? 'armed' : (rtkFixType >= 5 ? 'rtk' : 'disarmed');

    const updateScript = `
      (function() {
        try {
          // Update rover position
          if (roverMarker) {
            roverMarker.setLatLng([${roverLat}, ${roverLon}]);
            liveRoverPos = { lat: ${roverLat}, lon: ${roverLon} };

            // Update position display
            document.getElementById('rover-lat').textContent = 'Lat: ${roverLat.toFixed(7)}';
            document.getElementById('rover-lon').textContent = 'Lon: ${roverLon.toFixed(7)}';

            // WEB APP STYLE: Fast rotation using RoverMarker class method
            if (${heading !== null}) {
              roverMarker.setHeading(${heading || 0});
            }

            // WEB APP STYLE: Dynamic status colors (armed=green, RTK=blue, disarmed=yellow)
            roverMarker.setStatus('${status}');

          }

          // Update heading line
          if (headingLine) {
            map.removeLayer(headingLine);
            headingLine = null;
          }

          ${heading !== null ? `
          const distance = 8; // Short heading indicator
          const earthRadius = 6371000;
          const headingRad = (${heading || 0} * Math.PI) / 180;
          const latRad = (${roverLat} * Math.PI) / 180;
          const lonRad = (${roverLon} * Math.PI) / 180;

          const newLatRad = Math.asin(
            Math.sin(latRad) * Math.cos(distance / earthRadius) +
            Math.cos(latRad) * Math.sin(distance / earthRadius) * Math.cos(headingRad)
          );

          const newLonRad = lonRad + Math.atan2(
            Math.sin(headingRad) * Math.sin(distance / earthRadius) * Math.cos(latRad),
            Math.cos(distance / earthRadius) - Math.sin(latRad) * Math.sin(newLatRad)
          );

          const endLat = (newLatRad * 180) / Math.PI;
          const endLon = (newLonRad * 180) / Math.PI;

          headingLine = L.polyline([
            [${roverLat}, ${roverLon}],
            [endLat, endLon]
          ], {
            color: '#FCD34D',
            weight: 2,
          }).addTo(map);
          ` : ''}

          // TRAIL DISABLED: Trail update logic commented out
          // const trailSegments = ${/*trailData*/'[]'};
          // if (!window.trailSegments) {
          //   window.trailSegments = [];
          //   window.trailPointsCount = 0;
          // }
          // const currentPointsCount = trailSegments.length;
          // const previousPointsCount = window.trailPointsCount || 0;
          // if (currentPointsCount < previousPointsCount) {
          //   window.trailSegments.forEach(segment => {
          //     if (map.hasLayer(segment)) {
          //       map.removeLayer(segment);
          //     }
          //   });
          //   window.trailSegments = [];
          //   window.trailPointsCount = 0;
          // }
          // if (currentPointsCount > 1) {
          //   const segmentsNeeded = currentPointsCount - 1;
          //   const segmentsExisting = window.trailSegments.length;
          //   for (let i = segmentsExisting; i < segmentsNeeded; i++) {
          //     const start = trailSegments[i];
          //     const end = trailSegments[i + 1];
          //     const segmentOpacity = (start.opacity + end.opacity) / 2;
          //     const segment = L.polyline([
          //       [start.lat, start.lon],
          //       [end.lat, end.lon]
          //     ], {
          //       color: '#0ea5e9',
          //       weight: 3,
          //       opacity: Math.max(0.2, segmentOpacity),
          //     }).addTo(map);
          //     window.trailSegments.push(segment);
          //   }
          //   window.trailSegments.forEach((segment, idx) => {
          //     if (idx < trailSegments.length - 1) {
          //       const start = trailSegments[idx];
          //       const end = trailSegments[idx + 1];
          //       const segmentOpacity = (start.opacity + end.opacity) / 2;
          //       segment.setStyle({ opacity: Math.max(0.2, segmentOpacity) });
          //     }
          //   });
          // } else if (currentPointsCount === 1 && window.trailSegments.length === 0) {
          //   if (window.trailStartMarker) {
          //     map.removeLayer(window.trailStartMarker);
          //   }
          //   window.trailStartMarker = L.circleMarker([trailSegments[0].lat, trailSegments[0].lon], {
          //     color: '#0ea5e9',
          //     fillColor: '#0ea5e9',
          //     fillOpacity: trailSegments[0].opacity,
          //     radius: 3,
          //     weight: 2
          //   }).addTo(map);
          // }
          // window.trailPointsCount = currentPointsCount;
        } catch (e) {
          console.error('Map update error:', e);
        }
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(updateScript);
    // TRAIL DISABLED: trailPoints removed from dependencies
  }, [roverLat, roverLon, heading, armed, rtkFixType, /* trailPoints, */ mapReady, isVisible]);

  return (
    <View style={styles.mapContainer}>
      <WebView
        ref={webViewRef}
        source={mapSource}
        style={{ flex: 1, borderRadius: 12, backgroundColor: '#1e293b' }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'mapReady') {
              setMapReady(true);
              // Fix: Leaflet initializes before WebView layout finalizes.
              // invalidateSize() forces Leaflet to re-measure its container,
              // then fitBounds re-centers correctly at actual dimensions.
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(`
                  (function() {
                    try {
                      map.invalidateSize();
                      if (waypoints.length > 0) {
                        const b = [];
                        waypoints.forEach(wp => b.push([wp.lat, wp.lon]));
                        if (liveRoverPos) b.push([liveRoverPos.lat, liveRoverPos.lon]);
                        if (b.length > 0) map.fitBounds(b, { padding: [50, 50] });
                      } else if (liveRoverPos) {
                        map.setView([liveRoverPos.lat, liveRoverPos.lon], 17);
                      }
                    } catch(e) {}
                  })();
                  true;
                `);
              }, 300);
            } else if (message.type === 'TOGGLE_FULLSCREEN') {
              onToggleFullscreen?.();
            }
          } catch (error) {
            console.error('WebView message error:', error);
          }
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}  // PERFORMANCE: Don't show loading indicator, faster init
        scalesPageToFit={false}
        androidLayerType="hardware"  // ANDROID: Force hardware acceleration
        cacheEnabled={true}  // PERFORMANCE: Enable caching
        cacheMode="LOAD_DEFAULT"  // Use cache when available
      />

      {/* Compass with heading */}
      <View style={styles.compassOverlay}>
        <View style={[
          styles.headingArrow,
          { transform: [{ rotate: `${heading ?? 0}deg` }] }
        ]} />
        <View style={{ transform: [{ rotate: `${-(heading ?? 0)}deg` }] }}>
          <Fontisto name="compass" color="#67e8f9" size={20} />
        </View>
        <Text style={styles.compassN}>N</Text>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  compassOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderWidth: 2,
    borderColor: 'rgba(103, 232, 249, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  headingArrow: {
    position: 'absolute',
    top: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ef4444',
    zIndex: 1,
  },
  compassN: {
    position: 'absolute',
    top: -1,
    fontSize: 8,
    fontWeight: '900',
    color: '#67e8f9',
    zIndex: 2,
  },
});

export const MissionMap = React.memo(MissionMapBase);