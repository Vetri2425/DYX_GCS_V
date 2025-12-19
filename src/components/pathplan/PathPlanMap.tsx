import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../theme/colors';
import { PathPlanWaypoint, DrawingMode } from '../../types/pathplan';

interface Props {
    waypoints: PathPlanWaypoint[];
    onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
    onWaypointDrag?: (id: number, coordinate: { latitude: number; longitude: number }) => void;
    onAddWaypoints?: (coordinates: { latitude: number; longitude: number }[]) => void;
    onDeleteWaypoint?: (id: number) => void;
    onInsertWaypoint?: (afterId: number, coordinate: { latitude: number; longitude: number }) => void;
    onWaypointClick?: (id: number) => void;
    roverPosition?: { lat: number; lon: number };
    selectedWaypoint?: number | null;
    heading?: number | null;
    activeDrawingTool?: string | null;
    onDrawingComplete?: (coordinates: { latitude: number; longitude: number }[]) => void;
    isDrawingMode?: boolean;
    drawSettings?: {
        drawingWidth: number;
        drawingHeight: number;
        waypointSpacing: number;
        startPosition: { lat: number; lng: number };
    } | null;
    onToggleFullscreen?: () => void;
    isManualConnectionMode?: boolean;
    manualConnections?: number[];
}

export const PathPlanMap: React.FC<Props> = ({
    waypoints,
    onMapPress,
    onWaypointDrag,
    onAddWaypoints,
    onDeleteWaypoint,
    onInsertWaypoint,
    onWaypointClick,
    roverPosition = { lat: 13.0827, lon: 80.2707 },
    selectedWaypoint = null,
    heading = null,
    activeDrawingTool = null,
    onDrawingComplete,
    isDrawingMode = false,
    drawSettings = null,
    onToggleFullscreen,
    isManualConnectionMode = false,
    manualConnections = [],
}) => {
    const webViewRef = useRef<WebView | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const lastUpdateRef = useRef<number>(0);
    const UPDATE_THROTTLE_MS = 100; // Throttle position updates to 100ms (10 Hz) to match web app

    const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
    const [tempPoints, setTempPoints] = useState<{ latitude: number; longitude: number }[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; waypointId: number } | null>(null);
    const drawingPointsRef = useRef<{ lat: number; lng: number }[]>([]);
    const mapInitializedRef = useRef(false);
    const lastWaypointsRef = useRef<string>(''); // Track waypoints changes by serialized string
    // TRAIL DISABLED: Trail state variables commented out
    // const trailPointsRef = useRef<Array<{lat: number, lon: number, timestamp: number}>>([]);
    // const lastTrailUpdateRef = useRef<number>(0);
    // const TRAIL_UPDATE_THROTTLE_MS = 100; // Update trail every 100ms (matches position updates for smooth following)
    // const MAX_TRAIL_POINTS = 200; // Maximum trail points to store
    // const MIN_TRAIL_DISTANCE_M = 1.5; // Minimum distance between trail points in meters
    // const TRAIL_FADE_START_SEC = 15; // Start fading after 15 seconds
    // const TRAIL_MAX_AGE_SEC = 60; // Remove points older than 60 seconds

    // Generate HTML ONLY ONCE on component mount - never regenerate
    const mapHTML = useMemo(() => {
        // console.log('[PathPlanMap] Generating map HTML (ONLY ONCE on mount)');

        // Empty initial waypoints - will be added via JavaScript injection
        const waypointsJSON = JSON.stringify([]);

        // Initial rover data - will be updated via JavaScript injection
        const roverData = JSON.stringify({
            lat: roverPosition.lat || 13.0827,
            lon: roverPosition.lon || 80.2707,
            heading: heading || 0,
            hasPosition: Number.isFinite(roverPosition.lat) && Number.isFinite(roverPosition.lon),
        });

        return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
  </style>
</head>
<body>
  <div id="map"></div>
  
  <div class="custom-controls">
    <button class="control-btn" onclick="centerOnRover()">🎯</button>
    <button class="control-btn" onclick="fitToMission()">📍</button>
    <button class="control-btn" onclick="toggleFullscreen()">⛶</button>
  </div>
  
  <div class="zoom-controls">
    <button class="zoom-btn" onclick="map.zoomIn()">+</button>
    <button class="zoom-btn" onclick="map.zoomOut()">−</button>
  </div>
  
  <div class="position-overlay">
    <div class="position-title">Robot Position</div>
    <div class="position-coord" id="rover-lat">Lat: ${roverPosition.lat.toFixed(7)}</div>
    <div class="position-coord" id="rover-lon">Lon: ${roverPosition.lon.toFixed(7)}</div>
  </div>

  <script>
    const waypoints = ${waypointsJSON};
    const roverData = ${roverData};
    
    const centerLat = waypoints.length > 0 ? waypoints[0].lat : (roverData.hasPosition ? roverData.lat : 13.0827);
    const centerLon = waypoints.length > 0 ? waypoints[0].lon : (roverData.hasPosition ? roverData.lon : 80.2707);
    
    const map = L.map('map', {
      center: [centerLat, centerLon],
      zoom: 17,
      maxZoom: 26,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: 26,
    }).addTo(map);
    
    let roverMarker = null;
    let missionPolyline = null;
    const waypointMarkers = [];

    // TRAIL DISABLED: Single trail polyline for efficient rendering
    // window.roverTrail = null;
    
    function getWaypointIcon(wp, index) {
      let fill = '#f97316';
      if (wp.isStart) fill = '#16a34a';
      if (wp.isSelected) fill = '#3B82F6';
      
      const size = wp.isSelected ? 32 : 24;
      
      const svgIcon = \`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="\${size}" height="\${size}" fill="\${fill}">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          <text x="12" y="10.5" font-family="sans-serif" font-size="8" font-weight="bold" fill="white" text-anchor="middle" dy=".3em">\${wp.id}</text>
        </svg>
      \`;
      
      return L.divIcon({
        html: svgIcon,
        className: 'custom-marker',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
      });
    }
    
    if (waypoints.length > 1) {
      const pathCoords = waypoints.map(wp => [wp.lat, wp.lon]);
      missionPolyline = L.polyline(pathCoords, {
        color: '#f97316',
        weight: 2,
      }).addTo(map);
    }
    
    waypoints.forEach((wp, index) => {
      const marker = L.marker([wp.lat, wp.lon], {
        icon: getWaypointIcon(wp, index),
        draggable: true,
      }).addTo(map);
      
      marker.bindPopup(\`
        <strong>WP \${wp.id}</strong><br>
        Row: \${wp.row || '-'}<br>
        Block: \${wp.block || '-'}<br>
        Pile: \${wp.pile || '-'}<br>
        Alt: \${wp.alt}m
      \`);
      
      marker.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'waypointClick',
          id: wp.id
        }));
      });

      marker.on('dragend', function(e) {
        const newPos = e.target.getLatLng();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'waypointDrag',
          id: wp.id,
          lat: newPos.lat,
          lng: newPos.lng
        }));
      });

      marker.on('contextmenu', function(e) {
        L.DomEvent.preventDefault(e);
        const mapContainer = map.getContainer();
        const rect = mapContainer.getBoundingClientRect();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'waypointContextMenu',
          id: wp.id,
          x: e.originalEvent.clientX - rect.left,
          y: e.originalEvent.clientY - rect.top,
          lat: wp.lat,
          lon: wp.lon
        }));
      });

      waypointMarkers.push(marker);
    });
    
    // console.log('[PathPlanMap] Rover data:', roverData);

    if (roverData.hasPosition) {
      // console.log('[PathPlanMap] Creating rover marker at:', roverData.lat, roverData.lon);
      const currentZoom = map.getZoom();
      const zoomScale = Math.max(0.3, Math.min(1.2, (currentZoom - 10) / 12));
      const size = Math.round(84 * zoomScale);
      const half = Math.round(size / 2);
      const rotation = roverData.heading !== null ? roverData.heading : 0;

      // SVG-based rover icon with proper design (no transition for instant updates)
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

            <!-- Back Left Wheel -->
            <rect x="15" y="65" width="12" height="20" rx="2" fill="#2d2d2d" stroke="#000" stroke-width="1"/>
            <rect x="17" y="67" width="8" height="16" rx="1" fill="#4a4a4a"/>

            <!-- Back Right Wheel -->
            <rect x="73" y="65" width="12" height="20" rx="2" fill="#2d2d2d" stroke="#000" stroke-width="1"/>
            <rect x="75" y="67" width="8" height="16" rx="1" fill="#4a4a4a"/>
          </g>

          <!-- Rover Body (Yellow) -->
          <rect x="30" y="25" width="40" height="50" rx="3" fill="#f4d03f" stroke="#d4af37" stroke-width="2"/>

          <!-- Rover Details -->
          <!-- Eyes/Sensors -->
          <rect x="37" y="37" width="10" height="6" rx="1" fill="#5a5a5a"/>
          <rect x="53" y="37" width="10" height="6" rx="1" fill="#5a5a5a"/>

          <!-- Equipment mounts (top and bottom of body) -->
          <rect x="40" y="28" width="5" height="4" fill="#8b7355"/>
          <rect x="55" y="28" width="5" height="4" fill="#8b7355"/>
          <rect x="40" y="68" width="5" height="4" fill="#8b7355"/>
          <rect x="55" y="68" width="5" height="4" fill="#8b7355"/>

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

      roverMarker = L.marker([roverData.lat, roverData.lon], {
        icon: roverIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      roverMarker.bindPopup(\`<strong>Rover</strong><br>Heading: \${roverData.heading !== null ? roverData.heading.toFixed(1) + '°' : 'N/A'}<br>Lat: \${roverData.lat.toFixed(7)}<br>Lon: \${roverData.lon.toFixed(7)}\`);
      // console.log('[PathPlanMap] Rover marker added to map');
    } else {
      // console.log('[PathPlanMap] Rover position not available - hasPosition:', roverData.hasPosition);
    }
    
    map.on('click', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapClick',
        lat: e.latlng.lat,
        lng: e.latlng.lng
      }));
    });
    
    setTimeout(() => {
      const bounds = [];
      waypoints.forEach(wp => bounds.push([wp.lat, wp.lon]));
      if (roverData.hasPosition) bounds.push([roverData.lat, roverData.lon]);
      
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, 100);
    
    // Store current waypoints array for fitToMission
    window.currentWaypoints = waypoints;

    function centerOnRover() {
      if (roverMarker) {
        const pos = roverMarker.getLatLng();
        map.setView([pos.lat, pos.lng], 18, { animate: true });
      } else if (roverData.hasPosition) {
        map.setView([roverData.lat, roverData.lon], 18, { animate: true });
      }
    }

    function toggleFullscreen() {
      // Send message to React Native to toggle fullscreen
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'TOGGLE_FULLSCREEN'
      }));
    }

    function fitToMission() {
      const bounds = [];

      // Use dynamically updated waypoints
      if (window.currentWaypoints && window.currentWaypoints.length > 0) {
        window.currentWaypoints.forEach(wp => bounds.push([wp.lat, wp.lon]));
      }

      // Add rover position to bounds
      if (roverMarker) {
        const pos = roverMarker.getLatLng();
        bounds.push([pos.lat, pos.lng]);
      } else if (roverData.hasPosition) {
        bounds.push([roverData.lat, roverData.lon]);
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
      }
    }

    // ========== DRAWING MODE ==========
    let isDrawingModeActive = false;
    let drawingPoints = [];
    let drawingPolyline = null;
    let lastDrawPoint = null;
    let drawingSpacing = 2; // meters

    function enableDrawingMode(spacing) {
      isDrawingModeActive = true;
      drawingSpacing = spacing || 2;
      drawingPoints = [];
      lastDrawPoint = null;
      map.dragging.disable();
      map.doubleClickZoom.disable();
      document.getElementById('map').style.cursor = 'crosshair';
      
      if (drawingPolyline) {
        map.removeLayer(drawingPolyline);
        drawingPolyline = null;
      }
    }

    function disableDrawingMode() {
      isDrawingModeActive = false;
      map.dragging.enable();
      map.doubleClickZoom.enable();
      document.getElementById('map').style.cursor = '';
    }

    function finishDrawing() {
      if (drawingPoints.length > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'drawingComplete',
          points: drawingPoints
        }));
      }
      
      // Clear drawing
      drawingPoints = [];
      lastDrawPoint = null;
      if (drawingPolyline) {
        map.removeLayer(drawingPolyline);
        drawingPolyline = null;
      }
      
      disableDrawingMode();
    }

    function haversineDistanceJS(lat1, lon1, lat2, lon2) {
      const R = 6371000; // Earth radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    function addDrawingPoint(lat, lng) {
      // Check spacing from last point
      if (lastDrawPoint) {
        const dist = haversineDistanceJS(lastDrawPoint.lat, lastDrawPoint.lng, lat, lng);
        if (dist < drawingSpacing) return; // Skip if too close
      }
      
      drawingPoints.push({ lat, lng });
      lastDrawPoint = { lat, lng };
      
      // Update polyline
      if (drawingPolyline) {
        drawingPolyline.addLatLng([lat, lng]);
      } else {
        drawingPolyline = L.polyline([[lat, lng]], {
          color: '#22c55e',
          weight: 3,
          opacity: 0.8
        }).addTo(map);
      }
    }

    // Touch/Mouse event handlers for drawing
    let isMouseDown = false;

    map.on('mousedown', function(e) {
      if (!isDrawingModeActive) return;
      isMouseDown = true;
      addDrawingPoint(e.latlng.lat, e.latlng.lng);
    });

    map.on('mousemove', function(e) {
      if (!isDrawingModeActive || !isMouseDown) return;
      addDrawingPoint(e.latlng.lat, e.latlng.lng);
    });

    map.on('mouseup', function(e) {
      if (!isDrawingModeActive) return;
      isMouseDown = false;
      // Add a separator for discontinuous drawing (lift finger = gap)
      if (drawingPoints.length > 0) {
        drawingPoints.push({ lat: NaN, lng: NaN }); // Separator
        lastDrawPoint = null;
      }
    });

    map.on('dblclick', function(e) {
      if (isDrawingModeActive) {
        L.DomEvent.stopPropagation(e);
        finishDrawing();
      }
    });

    // Expose functions globally
    window.enableDrawingMode = enableDrawingMode;
    window.disableDrawingMode = disableDrawingMode;
    window.finishDrawing = finishDrawing;
    // ========== END DRAWING MODE ==========
    
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

    // Initialize rover marker once when map is ready
    useEffect(() => {
        if (!mapReady || !webViewRef.current || mapInitializedRef.current) return;

        // console.log('[PathPlanMap] Initializing rover marker (one-time)');
        const hasRover = Number.isFinite(roverPosition.lat) && Number.isFinite(roverPosition.lon);

        if (hasRover) {
            const initRoverScript = `
                (function() {
                    if (!roverMarker && roverData.hasPosition) {
                        const currentZoom = map.getZoom();
                        const zoomScale = Math.max(0.3, Math.min(1.2, (currentZoom - 10) / 12));
                        const size = Math.round(84 * zoomScale);
                        const half = Math.round(size / 2);
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
                                <rect x="37" y="37" width="10" height="6" rx="1" fill="#5a5a5a"/>
                                <rect x="53" y="37" width="10" height="6" rx="1" fill="#5a5a5a"/>
                                <rect x="40" y="28" width="5" height="4" fill="#8b7355"/>
                                <rect x="55" y="28" width="5" height="4" fill="#8b7355"/>
                                <rect x="40" y="68" width="5" height="4" fill="#8b7355"/>
                                <rect x="55" y="68" width="5" height="4" fill="#8b7355"/>
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

                        roverMarker = L.marker([${roverPosition.lat}, ${roverPosition.lon}], {
                            icon: roverIcon,
                            zIndexOffset: 1000,
                        }).addTo(map);

                        roverMarker.bindPopup(\`<strong>Robot</strong><br>Heading: ${heading !== null ? heading.toFixed(1) + '°' : 'N/A'}<br>Lat: ${roverPosition.lat.toFixed(7)}<br>Lon: ${roverPosition.lon.toFixed(7)}\`);

                        // Update roverData for future updates
                        roverData.hasPosition = true;
                        roverData.lat = ${roverPosition.lat};
                        roverData.lon = ${roverPosition.lon};

                        // console.log('[PathPlanMap] Rover marker initialized');
                    }
                })();
                true;
            `;
            webViewRef.current.injectJavaScript(initRoverScript);
        }

        mapInitializedRef.current = true;
    }, [mapReady]);

    // Update waypoints via JavaScript injection - no HTML regeneration
    useEffect(() => {
        if (!mapReady || !webViewRef.current) return;

        // Create a stable key to detect actual changes
        const waypointsKey = waypoints.map(wp => `${wp.id}-${wp.lat}-${wp.lon}`).join('|');

        // Only update if waypoints actually changed
        if (waypointsKey === lastWaypointsRef.current) return;
        lastWaypointsRef.current = waypointsKey;

        // console.log('[PathPlanMap] Updating waypoints via JavaScript injection');
        const waypointsData = JSON.stringify(waypoints.map((wp, idx) => ({
            id: wp.id,
            lat: wp.lat,
            lon: wp.lon,
            alt: wp.alt,
            block: wp.block,
            row: wp.row,
            pile: wp.pile,
            isSelected: selectedWaypoint === wp.id,
            isStart: idx === 0,
        })));

        const manualConnectionsData = JSON.stringify(manualConnections);

        const updateWaypointsScript = `
            (function() {
                const newWaypoints = ${waypointsData};
                const isManualMode = ${isManualConnectionMode};
                const manualConnections = ${manualConnectionsData};

                // Update global waypoints reference for fitToMission
                window.currentWaypoints = newWaypoints;

                // Manual connection mode drag state
                if (!window.dragConnectionState) {
                    window.dragConnectionState = {
                        isDragging: false,
                        startWaypointId: null,
                        tempLine: null
                    };
                }

                // Clear existing waypoint markers
                waypointMarkers.forEach(marker => map.removeLayer(marker));
                waypointMarkers.length = 0;

                // Remove existing polyline
                if (missionPolyline) {
                    map.removeLayer(missionPolyline);
                    missionPolyline = null;
                }

                // Add polyline based on mode
                if (isManualMode && manualConnections.length > 1) {
                    // Manual mode: draw polyline only for manually connected waypoints
                    const connectedWaypoints = manualConnections.map(id =>
                        newWaypoints.find(wp => wp.id === id)
                    ).filter(wp => wp !== undefined);

                    if (connectedWaypoints.length > 1) {
                        const pathCoords = connectedWaypoints.map(wp => [wp.lat, wp.lon]);
                        missionPolyline = L.polyline(pathCoords, {
                            color: '#4ADE80',
                            weight: 3,
                            dashArray: '5, 10',
                        }).addTo(map);
                    }
                } else if (!isManualMode && newWaypoints.length > 1) {
                    // Auto mode: draw polyline for all waypoints sequentially
                    const pathCoords = newWaypoints.map(wp => [wp.lat, wp.lon]);
                    missionPolyline = L.polyline(pathCoords, {
                        color: '#f97316',
                        weight: 2,
                    }).addTo(map);
                }

                // Add new waypoint markers
                newWaypoints.forEach((wp, index) => {
                    const marker = L.marker([wp.lat, wp.lon], {
                        icon: getWaypointIcon(wp, index),
                        draggable: !isManualMode, // Disable position dragging in manual mode
                    }).addTo(map);

                    marker.bindPopup(\`
                        <strong>WP \${wp.id}</strong><br>
                        Row: \${wp.row || '-'}<br>
                        Block: \${wp.block || '-'}<br>
                        Pile: \${wp.pile || '-'}<br>
                        Alt: \${wp.alt}m
                    \`);

                    // In manual mode: implement drag-to-connect
                    if (isManualMode) {
                        marker.on('mousedown', function(e) {
                            L.DomEvent.stopPropagation(e);
                            window.dragConnectionState.isDragging = true;
                            window.dragConnectionState.startWaypointId = wp.id;
                            window.dragConnectionState.startLatLng = marker.getLatLng();
                            map.dragging.disable();
                        });

                        marker.on('mouseup', function(e) {
                            L.DomEvent.stopPropagation(e);
                            if (window.dragConnectionState.isDragging &&
                                window.dragConnectionState.startWaypointId !== null &&
                                window.dragConnectionState.startWaypointId !== wp.id) {
                                // Send connection message
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'waypointConnect',
                                    fromId: window.dragConnectionState.startWaypointId,
                                    toId: wp.id
                                }));
                            }
                            // Reset drag state
                            if (window.dragConnectionState.tempLine) {
                                map.removeLayer(window.dragConnectionState.tempLine);
                                window.dragConnectionState.tempLine = null;
                            }
                            window.dragConnectionState.isDragging = false;
                            window.dragConnectionState.startWaypointId = null;
                            map.dragging.enable();
                        });

                        marker.on('mouseover', function(e) {
                            if (window.dragConnectionState.isDragging &&
                                window.dragConnectionState.startWaypointId !== null &&
                                window.dragConnectionState.startWaypointId !== wp.id) {
                                // Draw temp line
                                if (window.dragConnectionState.tempLine) {
                                    map.removeLayer(window.dragConnectionState.tempLine);
                                }
                                window.dragConnectionState.tempLine = L.polyline([
                                    window.dragConnectionState.startLatLng,
                                    marker.getLatLng()
                                ], {
                                    color: '#4ADE80',
                                    weight: 3,
                                    dashArray: '10, 10',
                                    opacity: 0.6
                                }).addTo(map);
                            }
                        });
                    } else {
                        // Auto mode: normal click behavior
                        marker.on('click', function(e) {
                            L.DomEvent.stopPropagation(e);
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'waypointClick',
                                id: wp.id
                            }));
                        });
                    }

                    if (!isManualMode) {
                        marker.on('dragend', function(e) {
                            const newPos = e.target.getLatLng();
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'waypointDrag',
                                id: wp.id,
                                lat: newPos.lat,
                                lng: newPos.lng
                            }));
                        });
                    }

                    marker.on('contextmenu', function(e) {
                        L.DomEvent.preventDefault(e);
                        const mapContainer = map.getContainer();
                        const rect = mapContainer.getBoundingClientRect();
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'waypointContextMenu',
                            id: wp.id,
                            x: e.originalEvent.clientX - rect.left,
                            y: e.originalEvent.clientY - rect.top,
                            lat: wp.lat,
                            lon: wp.lon
                        }));
                    });

                    waypointMarkers.push(marker);
                });

                // console.log('[PathPlanMap] Waypoints updated:', newWaypoints.length);
            })();
            true;
        `;

        webViewRef.current.injectJavaScript(updateWaypointsScript);
    }, [waypoints, selectedWaypoint, mapReady, isManualConnectionMode, manualConnections]);

    // TRAIL DISABLED: Update rover position without trail
    useEffect(() => {
        if (!mapReady || !webViewRef.current) {
            if (Math.random() < 0.05) { // Log 5% of skipped updates for debugging
                console.log('[PathPlanMap] Skipping rover update - mapReady:', mapReady, 'webViewRef:', !!webViewRef.current);
            }
            return;
        }

        const now = performance.now();
        if (now - lastUpdateRef.current < UPDATE_THROTTLE_MS) return;
        lastUpdateRef.current = now;

        // Debug log to verify updates are being processed (10% sample rate to avoid spam)
        if (Math.random() < 0.1) {
            console.log('[PathPlanMap] 📍 Updating rover position:', {
                lat: roverPosition.lat.toFixed(7),
                lon: roverPosition.lon.toFixed(7),
                heading: heading !== null ? heading.toFixed(1) + '°' : 'N/A'
            });
        }

        // TRAIL DISABLED: All trail calculation and management code commented out
        // const shouldAddTrailPoint = (() => {
        //     if (trailPointsRef.current.length === 0) return true;
        //     const lastPoint = trailPointsRef.current[trailPointsRef.current.length - 1];
        //     const timeSinceLastPoint = now - lastTrailUpdateRef.current;
        //     if (timeSinceLastPoint < TRAIL_UPDATE_THROTTLE_MS) return false;
        //     const R = 6371000;
        //     const lat1 = lastPoint.lat * Math.PI / 180;
        //     const lat2 = roverPosition.lat * Math.PI / 180;
        //     const deltaLat = (roverPosition.lat - lastPoint.lat) * Math.PI / 180;
        //     const deltaLon = (roverPosition.lon - lastPoint.lon) * Math.PI / 180;
        //     const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
        //              Math.cos(lat1) * Math.cos(lat2) *
        //              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        //     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        //     const distance = R * c;
        //     return distance >= MIN_TRAIL_DISTANCE_M;
        // })();
        // if (shouldAddTrailPoint) {
        //     trailPointsRef.current.push({
        //         lat: roverPosition.lat,
        //         lon: roverPosition.lon,
        //         timestamp: now
        //     });
        //     lastTrailUpdateRef.current = now;
        // }
        // const maxAgeMs = TRAIL_MAX_AGE_SEC * 1000;
        // trailPointsRef.current = trailPointsRef.current.filter(p => (now - p.timestamp) < maxAgeMs);
        // if (trailPointsRef.current.length > MAX_TRAIL_POINTS) {
        //     trailPointsRef.current = trailPointsRef.current.slice(-MAX_TRAIL_POINTS);
        // }
        // const trailSegments = trailPointsRef.current.map((p, idx) => {
        //     const ageSeconds = (now - p.timestamp) / 1000;
        //     let opacity = 1.0;
        //     if (ageSeconds > TRAIL_FADE_START_SEC) {
        //         const fadeProgress = (ageSeconds - TRAIL_FADE_START_SEC) / (TRAIL_MAX_AGE_SEC - TRAIL_FADE_START_SEC);
        //         opacity = Math.max(0.1, 1.0 - fadeProgress);
        //     }
        //     return { lat: p.lat, lon: p.lon, opacity: opacity };
        // });
        // const trailWithCurrentPosition = [
        //     ...trailSegments,
        //     { lat: roverPosition.lat, lon: roverPosition.lon, opacity: 1.0 }
        // ];
        // const trailData = JSON.stringify(trailWithCurrentPosition);

        const updateScript = `
            if (roverMarker && roverData.hasPosition) {
                // Update position instantly without animation
                roverMarker.setLatLng([${roverPosition.lat}, ${roverPosition.lon}]);
                document.getElementById('rover-lat').textContent = 'Lat: ${roverPosition.lat.toFixed(7)}';
                document.getElementById('rover-lon').textContent = 'Lon: ${roverPosition.lon.toFixed(7)}';

                // Update rover icon rotation instantly (handling SVG)
                const markerEl = roverMarker.getElement();
                if (markerEl && ${heading !== null}) {
                    const svg = markerEl.querySelector('svg');
                    if (svg) {
                        // Remove transition for instant rotation updates
                        svg.style.transform = 'rotate(${heading || 0}deg)';
                        svg.style.willChange = 'transform';
                        svg.style.transition = 'none'; // Instant update, no delay
                    }
                }

                // TRAIL DISABLED: Trail rendering code commented out
            }
            true;
        `;

        webViewRef.current.injectJavaScript(updateScript);
    }, [roverPosition.lat, roverPosition.lon, heading, mapReady]);

    // Enable/disable drawing mode
    useEffect(() => {
        if (!mapReady || !webViewRef.current) return;

        if (isDrawingMode && drawSettings) {
            const enableScript = `
                window.enableDrawingMode(${drawSettings.waypointSpacing});
                true;
            `;
            webViewRef.current.injectJavaScript(enableScript);
        } else {
            const disableScript = `
                if (window.disableDrawingMode) window.disableDrawingMode();
                true;
            `;
            webViewRef.current.injectJavaScript(disableScript);
        }
    }, [isDrawingMode, drawSettings, mapReady]);

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                source={{ html: mapHTML }}
                style={{ flex: 1, backgroundColor: '#1e293b' }}
                onMessage={(event) => {
                    try {
                        const message = JSON.parse(event.nativeEvent.data);
                        if (message.type === 'mapReady') {
                            setMapReady(true);
                        } else if (message.type === 'mapClick') {
                            onMapPress?.({ latitude: message.lat, longitude: message.lng });
                            setContextMenu(null); // Close context menu on map click
                        } else if (message.type === 'waypointClick') {
                            onWaypointClick?.(message.id);
                        } else if (message.type === 'waypointConnect') {
                            // Handle drag-to-connect: add toId to connections if fromId is last in sequence
                            onWaypointClick?.(message.toId);
                        } else if (message.type === 'waypointDrag') {
                            onWaypointDrag?.(message.id, { latitude: message.lat, longitude: message.lng });
                        } else if (message.type === 'waypointContextMenu') {
                            setContextMenu({ x: message.x, y: message.y, waypointId: message.id });
                        } else if (message.type === 'drawingComplete') {
                            // Convert drawing points to waypoint coordinates
                            const coords = message.points
                                .filter((p: any) => !isNaN(p.lat) && !isNaN(p.lng))
                                .map((p: any) => ({ latitude: p.lat, longitude: p.lng }));
                            if (coords.length > 0) {
                                onDrawingComplete?.(coords);
                            }
                        } else if (message.type === 'TOGGLE_FULLSCREEN') {
                            onToggleFullscreen?.();
                        }
                    } catch (error) {
                        console.error('WebView message error:', error);
                    }
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scalesPageToFit={false}
            />

            {/* Context Menu Overlay */}
            {contextMenu && (
                <View
                    style={{
                        position: 'absolute',
                        left: contextMenu.x,
                        top: contextMenu.y,
                        backgroundColor: colors.secondary,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.5,
                        shadowRadius: 4,
                        elevation: 5,
                        zIndex: 2000,
                        minWidth: 180,
                    }}
                >
                    {onDeleteWaypoint && (
                        <TouchableOpacity
                            onPress={() => {
                                onDeleteWaypoint(contextMenu.waypointId);
                                setContextMenu(null);
                            }}
                            style={{
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.border,
                            }}
                        >
                            <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '500' }}>
                                🗑️ Delete Waypoint
                            </Text>
                        </TouchableOpacity>
                    )}
                    {onInsertWaypoint && (
                        <TouchableOpacity
                            onPress={() => {
                                onInsertWaypoint(contextMenu.waypointId, {
                                    latitude: roverPosition.lat,
                                    longitude: roverPosition.lon,
                                });
                                setContextMenu(null);
                            }}
                            style={{
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                            }}
                        >
                            <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '500' }}>
                                ➕ Insert Waypoint After
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1e293b',
    },
});
