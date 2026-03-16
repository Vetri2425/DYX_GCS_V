import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, PanResponder, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Fontisto } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { PathPlanWaypoint, DrawingMode } from '../../types/pathplan';
import { MapVisualizationControls, MapVisualization } from './MapVisualizationControls';

interface Props {
  waypoints: PathPlanWaypoint[];
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
  onWaypointDrag?: (id: number, coordinate: { latitude: number; longitude: number }) => void;
  onWaypointClick?: (id: number) => void;
  onAddWaypoints?: (coordinates: { latitude: number; longitude: number }[]) => void;
  onDeleteWaypoint?: (id: number) => void;
  onInsertWaypoint?: (afterId: number, coordinate: { latitude: number; longitude: number }) => void;
  onWaypointConnect?: (fromId: number, toId: number) => void;
  roverPosition?: { lat: number; lon: number };
  selectedWaypoint?: number | null;
  heading?: number | null;
  activeDrawingTool?: string | null;
  onDrawingComplete?: (points: { latitude: number; longitude: number }[]) => void;
  isDrawingMode?: boolean;
  drawSettings?: {
    startPosition: { lat: number; lng: number };
    drawingWidth: number;
    drawingHeight: number;
    waypointSpacing?: number;
  } | null;
  onToggleFullscreen?: () => void;
  isManualConnectionMode?: boolean;
  manualConnections?: number[];
  manualConnectionMode?: 'tap' | 'drag' | 'pan';
  visualization?: {
    distanceLabel: boolean;
    angleLabel: boolean;
    snapFeature: boolean;
    roverIcon: boolean;
    waypointPreview: boolean;
  };
  onVisualizationToggle?: (key: keyof {
    distanceLabel: boolean;
    angleLabel: boolean;
    snapFeature: boolean;
    roverIcon: boolean;
    waypointPreview: boolean;
  }) => void;
  measurePoints?: { lat: number; lon: number; seq: number; waypointId?: number }[];
  measureResult?: { distance: number; heading: number } | null;
  onMeasureClear?: () => void;
  onMeasureWaypointSelect?: (id: number) => void;
}

export const PathPlanMap: React.FC<Props> = ({
  waypoints,
  onMapPress,
  onWaypointDrag,
  onAddWaypoints,
  onDeleteWaypoint,
  onInsertWaypoint,
  onWaypointClick,
  onWaypointConnect,
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
  manualConnectionMode = 'tap',
  visualization = {
    distanceLabel: true,
    angleLabel: true,
    snapFeature: true,
    roverIcon: true,
    waypointPreview: true,
  },
  onVisualizationToggle,
  measurePoints = [],
  measureResult = null,
  onMeasureClear,
  onMeasureWaypointSelect,
}) => {
  const webViewRef = useRef<WebView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const lastUpdateRef = useRef<number>(0);
  const UPDATE_THROTTLE_MS = 100; // Throttle position updates to 100ms (10 Hz) to match web app

  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [tempPoints, setTempPoints] = useState<{ latitude: number; longitude: number }[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; waypointId: number } | null>(null);
  const [measureOverlayPos, setMeasureOverlayPos] = useState({ x: 10, y: 120 });
  const measurePanResponderRef = useRef<any>(null);
  const measureDragStartRef = useRef({ x: 0, y: 0 });
  
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

  // Initialize PanResponder for measure overlay dragging (created once)
  const measureOverlayPosRef = useRef(measureOverlayPos);
  measureOverlayPosRef.current = measureOverlayPos;

  useEffect(() => {
    measurePanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        measureDragStartRef.current = { x: measureOverlayPosRef.current.x, y: measureOverlayPosRef.current.y };
      },
      onPanResponderMove: (_, gestureState) => {
        const newX = Math.max(0, measureDragStartRef.current.x + gestureState.dx);
        const newY = Math.max(0, measureDragStartRef.current.y + gestureState.dy);
        setMeasureOverlayPos({ x: newX, y: newY });
      },
    });
  }, []);

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

    /* ── Control Buttons (top-right) ── */
    .custom-controls {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .control-btn {
      width: 40px;
      height: 40px;
      background: rgba(13, 42, 75, 0.92);
      border: 1px solid rgba(59, 130, 246, 0.35);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: rgba(103, 232, 249, 0.9);
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      padding: 0;
    }
    .control-btn:active {
      background: rgba(59, 130, 246, 0.25);
      border-color: rgba(59, 130, 246, 0.7);
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
    }
    .control-btn svg { width: 20px; height: 20px; }

    /* ── Zoom Controls (top-left) ── */
    .zoom-controls {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 0;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 1px solid rgba(59, 130, 246, 0.35);
    }

    .zoom-btn {
      width: 38px;
      height: 38px;
      background: rgba(13, 42, 75, 0.92);
      border: none;
      border-bottom: 1px solid rgba(59, 130, 246, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 20px;
      font-weight: 600;
      color: rgba(103, 232, 249, 0.9);
      transition: background 0.15s;
    }
    .zoom-btn:last-child { border-bottom: none; }
    .zoom-btn:active {
      background: rgba(59, 130, 246, 0.25);
    }

    /* ── Position Overlay (bottom-right) ── */
    .position-overlay {
      position: absolute;
      bottom: 12px;
      right: 12px;
      z-index: 1000;
      background: rgba(13, 42, 75, 0.94);
      padding: 0;
      border-radius: 10px;
      border: 1px solid rgba(59, 130, 246, 0.3);
      min-width: 160px;
      font-family: monospace;
      font-size: 10px;
      color: white;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      overflow: hidden;
    }
    .position-accent {
      height: 3px;
      background: linear-gradient(90deg, #3B82F6, rgba(103,232,249,0.6));
      border-radius: 10px 10px 0 0;
    }
    .position-inner {
      padding: 8px 12px 10px;
    }
    .position-title {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.2px;
      margin-bottom: 6px;
      color: rgba(103, 232, 249, 0.85);
      text-transform: uppercase;
    }
    .position-coord {
      color: rgba(229, 241, 255, 0.85);
      font-size: 11px;
      line-height: 1.5;
    }

    /* ── Waypoint pulse animation ── */
    @keyframes wp-pulse {
      0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
      70% { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
      100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
    }
    .wp-selected-pulse {
      animation: wp-pulse 1.8s ease-out infinite;
      border-radius: 50%;
    }

    /* ── Polyline glow filter ── */
    .leaflet-overlay-pane svg { filter: drop-shadow(0 0 3px rgba(249,115,22,0.4)); }
  </style>
</head>
<body>
  <div id="map"></div>
  
  <div class="custom-controls">
    <button class="control-btn" onclick="centerOnRover()" title="Center on Rover">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
    </button>
    <button class="control-btn" onclick="fitToMission()" title="Fit Mission">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="18" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="18" r="2"/><line x1="6.5" y1="16.5" x2="10.5" y2="6.5"/><line x1="13.5" y1="6.5" x2="17.5" y2="16.5"/><line x1="7" y1="18" x2="17" y2="18"/></svg>
    </button>
    <button class="control-btn" onclick="toggleFullscreen()" title="Fullscreen">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><polyline points="21 15 21 21 15 21"/><polyline points="3 9 3 3 9 3"/></svg>
    </button>
  </div>
  
  <div class="zoom-controls">
    <button class="zoom-btn" onclick="map.zoomIn()">+</button>
    <button class="zoom-btn" onclick="map.zoomOut()">−</button>
  </div>
  
  <div class="position-overlay">
    <div class="position-accent"></div>
    <div class="position-inner">
      <div class="position-title">Robot Position</div>
      <div class="position-coord" id="rover-lat">Lat: ${roverPosition.lat.toFixed(7)}</div>
      <div class="position-coord" id="rover-lon">Lon: ${roverPosition.lon.toFixed(7)}</div>
    </div>
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
    let missionGlowLine = null;
    const waypointMarkers = [];

    // TRAIL DISABLED: Single trail polyline for efficient rendering
    // window.roverTrail = null;
    
    function getWaypointIcon(wp, index) {
      let fill = '#f97316';
      if (wp.isStart) fill = '#16a34a';
      if (wp.isSelected) fill = '#3B82F6';
      
      const size = wp.isSelected ? 48 : 36;
      const shadow = 'filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));';
      const pulseClass = wp.isSelected ? 'wp-selected-pulse' : '';
      
      const svgIcon = \`
        <div class="\${pulseClass}" style="display:inline-block;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="\${size}" height="\${size}" fill="\${fill}" style="\${shadow}">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <text x="12" y="10.5" font-family="sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle" dy=".3em">\${index + 1}</text>
        </svg>
        </div>
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
      missionGlowLine = L.polyline(pathCoords, {
        color: '#f97316',
        weight: 6,
        opacity: 0.2,
      }).addTo(map);
      missionPolyline = L.polyline(pathCoords, {
        color: '#f97316',
        weight: 2.5,
        opacity: 0.9,
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
      
      // Prevent popup from opening when measure tool is active
      marker.on('popupopen', function(e) {
        if (window.isMeasureToolActive) {
          marker.closePopup();
        }
      });
      
      marker.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        // Activate ortho guide for this waypoint - mark as intentionally activated
        if (window.orthoGuideState) {
          window.orthoGuideState.lastWaypoint = { lat: wp.lat, lon: wp.lon };
          window.orthoGuideState.isIntentionallyActivated = true;  // User clicked this waypoint
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'waypointClick',
          id: wp.id
        }));
      });

      marker.on('dragstart', function(e) {
        window.dragPreviewState.isDragging = true;
        window.dragPreviewState.draggingWpIndex = index;
        // Hide main polyline during drag for cleaner visuals
        if (missionPolyline) missionPolyline.setStyle({ opacity: 0.3 });
        if (missionGlowLine) missionGlowLine.setStyle({ opacity: 0.1 });
        
        // Activate ortho guide ONLY if:
        // 1. User intentionally clicked this waypoint first, OR
        // 2. This is the last waypoint (for creating new waypoints)
        if (window.orthoGuideState) {
          const isLastWaypoint = index === waypoints.length - 1;
          const wasIntentionallyActivated = window.orthoGuideState.isIntentionallyActivated && 
                                            window.orthoGuideState.lastWaypoint && 
                                            window.orthoGuideState.lastWaypoint.lat === wp.lat &&
                                            window.orthoGuideState.lastWaypoint.lon === wp.lon;
          
          if (isLastWaypoint || wasIntentionallyActivated) {
            // For last waypoint: use previous waypoint as reference
            // For intentionally selected: use the waypoint itself as reference
            if (isLastWaypoint && index > 0) {
              const prevWp = waypoints[index - 1];
              window.orthoGuideState.lastWaypoint = { lat: prevWp.lat, lon: prevWp.lon };
            }
            // If intentionally activated, lastWaypoint is already set from click
          } else {
            // Not intentionally activated and not last waypoint - disable ortho snap
            window.orthoGuideState.isIntentionallyActivated = false;
            window.orthoGuideState.lastWaypoint = null;
          }
        }
      });

      marker.on('drag', function(e) {
        const pos = e.target.getLatLng();
        updateDragPreview(pos, index, waypoints);
        // Update ortho guide during drag - DISABLED in manual connection mode
        if (window.orthoGuideState && window.updateOrthoGuide && !window.isManualConnectionMode) {
          window.updateOrthoGuide(pos);
        }
      });

      marker.on('dragend', function(e) {
        clearDragPreview();
        // Clear ortho guide after drag and reset intentional activation flag
        if (window.orthoGuideState && window.clearOrthoGuide) {
          window.clearOrthoGuide();
          window.orthoGuideState.isIntentionallyActivated = false;
        }
        if (missionPolyline) missionPolyline.setStyle({ opacity: 1 });
        if (missionGlowLine) missionGlowLine.setStyle({ opacity: 0.2 });
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
    
    // ========== ORTHO SNAP FEATURE (IMPROVED) ==========
    window.ORTHO_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
    window.ORTHO_SNAP_THRESHOLD = 5; // degrees - snap when within 5° of target angle
    window.orthoGuideState = {
      lastWaypoint: null,
      guideLine: null,
      angleLabel: null,
      isActive: false,
      currentBearing: null,
      isIntentionallyActivated: false  // Flag: true only if user clicked a waypoint first
    };

    // ========== MAP VISUALIZATION STATE ==========
    window.mapVisualization = {
      distanceLabel: true,
      angleLabel: true,
      snapFeature: true,
      roverIcon: true,
      waypointPreview: true
    };
    
    // ========== MANUAL CONNECTION MODE STATE ==========
    window.isManualConnectionMode = false;
    
    // ========== MEASURE TOOL STATE ==========
    window.isMeasureToolActive = false;

    // ========== POINT TOOL STATE ==========
    window.isPointToolActive = false;

    window.calculateBearing = function(lat1, lon1, lat2, lon2) {
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const lat1Rad = lat1 * Math.PI / 180;
      const lat2Rad = lat2 * Math.PI / 180;
      const y = Math.sin(dLon) * Math.cos(lat2Rad);
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
      let bearing = Math.atan2(y, x) * 180 / Math.PI;
      return (bearing + 360) % 360;
    };

    window.getSnappedAngle = function(bearing) {
      for (const angle of window.ORTHO_ANGLES) {
        const diff = Math.abs(bearing - angle);
        if (diff < window.ORTHO_SNAP_THRESHOLD || diff > 360 - window.ORTHO_SNAP_THRESHOLD) {
          return angle;
        }
      }
      return null;
    };

    window.calculatePointAtBearing = function(lat, lon, bearing, distanceMeters) {
      const R = 6371000; // Earth radius in meters
      const lat1 = lat * Math.PI / 180;
      const lon1 = lon * Math.PI / 180;
      const brng = bearing * Math.PI / 180;
      const d = distanceMeters / R;

      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
      const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

      return L.latLng(lat2 * 180 / Math.PI, lon2 * 180 / Math.PI);
    };

    window.updateOrthoGuide = function(currentLatLng) {
      if (!window.orthoGuideState.lastWaypoint) return;
      
      // Check if snap feature is enabled
      if (!window.mapVisualization || !window.mapVisualization.snapFeature) {
        window.clearOrthoGuide();
        return;
      }

      const lastWp = window.orthoGuideState.lastWaypoint;
      const bearing = window.calculateBearing(lastWp.lat, lastWp.lon, currentLatLng.lat, currentLatLng.lng);
      const snappedAngle = window.getSnappedAngle(bearing);
      window.orthoGuideState.currentBearing = bearing;

      if (snappedAngle !== null) {
        // Calculate snapped position at same distance
        const dist = vincentyDistanceJS(lastWp.lat, lastWp.lon, currentLatLng.lat, currentLatLng.lng);
        const snappedLatLng = window.calculatePointAtBearing(lastWp.lat, lastWp.lon, snappedAngle, dist);

        // Update guide line - GREEN for snapped angles (always show when snap is enabled)
        if (window.orthoGuideState.guideLine) {
          window.orthoGuideState.guideLine.setLatLngs([L.latLng(lastWp.lat, lastWp.lon), snappedLatLng]);
          window.orthoGuideState.guideLine.setStyle({ color: '#10b981', weight: 3, dashArray: '8, 4', opacity: 0.9 });
        } else {
          window.orthoGuideState.guideLine = L.polyline(
            [[lastWp.lat, lastWp.lon], snappedLatLng],
            { color: '#10b981', weight: 3, dashArray: '8, 4', opacity: 0.9, zIndex: 500 }
          ).addTo(map);
        }

        // Update angle label - GREEN for snapped angles (only if angle label is enabled)
        if (window.mapVisualization && window.mapVisualization.angleLabel) {
          const midLat = (lastWp.lat + snappedLatLng.lat) / 2;
          const midLng = (lastWp.lon + snappedLatLng.lng) / 2;
          const labelHtml = '<div style="background:rgba(16,185,129,0.95);color:white;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:700;border:2px solid rgba(16,185,129,0.8);white-space:nowrap;font-family:monospace;display:inline-block;min-width:50px;text-align:center;">' + snappedAngle.toFixed(0) + '°</div>';

          if (window.orthoGuideState.angleLabel) {
            window.orthoGuideState.angleLabel.setLatLng(L.latLng(midLat, midLng));
            window.orthoGuideState.angleLabel.getElement().innerHTML = labelHtml;
            window.orthoGuideState.angleLabel.setOpacity(1);
          } else {
            window.orthoGuideState.angleLabel = L.marker(L.latLng(midLat, midLng), {
              icon: L.divIcon({ html: labelHtml, className: '', iconSize: [80, 28], iconAnchor: [40, 14] }),
              interactive: false, zIndexOffset: 2002
            }).addTo(map);
          }
        } else if (window.orthoGuideState.angleLabel) {
          // Hide angle label if disabled
          window.orthoGuideState.angleLabel.setOpacity(0);
        }

        window.orthoGuideState.isActive = true;
      } else {
        // Not snapped - show faint guide line and current bearing
        const dist = vincentyDistanceJS(lastWp.lat, lastWp.lon, currentLatLng.lat, currentLatLng.lng);
        const currentLatLngSnapped = window.calculatePointAtBearing(lastWp.lat, lastWp.lon, bearing, dist);

        // Update guide line - BLUE/FAINT for non-snapped angles (always show when snap is enabled)
        if (window.orthoGuideState.guideLine) {
          window.orthoGuideState.guideLine.setLatLngs([L.latLng(lastWp.lat, lastWp.lon), currentLatLngSnapped]);
          window.orthoGuideState.guideLine.setStyle({ color: '#3B82F6', weight: 2, dashArray: '4, 4', opacity: 0.4 });
        } else {
          window.orthoGuideState.guideLine = L.polyline(
            [[lastWp.lat, lastWp.lon], currentLatLngSnapped],
            { color: '#3B82F6', weight: 2, dashArray: '4, 4', opacity: 0.4, zIndex: 500 }
          ).addTo(map);
        }

        // Update angle label - BLUE for non-snapped angles (only if angle label is enabled)
        if (window.mapVisualization && window.mapVisualization.angleLabel) {
          const midLat = (lastWp.lat + currentLatLngSnapped.lat) / 2;
          const midLng = (lastWp.lon + currentLatLngSnapped.lng) / 2;
          const labelHtml = '<div style="background:rgba(59,130,246,0.85);color:white;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;border:1px solid rgba(59,130,246,0.6);white-space:nowrap;font-family:monospace;display:inline-block;min-width:50px;text-align:center;">' + bearing.toFixed(1) + '°</div>';

          if (window.orthoGuideState.angleLabel) {
            window.orthoGuideState.angleLabel.setLatLng(L.latLng(midLat, midLng));
            window.orthoGuideState.angleLabel.getElement().innerHTML = labelHtml;
            window.orthoGuideState.angleLabel.setOpacity(1);
          } else {
            window.orthoGuideState.angleLabel = L.marker(L.latLng(midLat, midLng), {
              icon: L.divIcon({ html: labelHtml, className: '', iconSize: [80, 28], iconAnchor: [40, 14] }),
              interactive: false, zIndexOffset: 2002
            }).addTo(map);
          }
        } else if (window.orthoGuideState.angleLabel) {
          // Hide angle label if disabled
          window.orthoGuideState.angleLabel.setOpacity(0);
        }

        window.orthoGuideState.isActive = true;
      }
    };

    window.clearOrthoGuide = function() {
      if (window.orthoGuideState.guideLine) {
        map.removeLayer(window.orthoGuideState.guideLine);
        window.orthoGuideState.guideLine = null;
      }
      if (window.orthoGuideState.angleLabel) {
        map.removeLayer(window.orthoGuideState.angleLabel);
        window.orthoGuideState.angleLabel = null;
      }
      window.orthoGuideState.isActive = false;
      window.orthoGuideState.currentBearing = null;
    };

    map.on('mousemove', function(e) {
      if (!window.orthoGuideState) return;
      
      // DISABLE ortho snap in manual connection mode, measure tool, or when point tool is NOT active
      if (window.isManualConnectionMode || window.isMeasureToolActive || !window.isPointToolActive) {
        window.clearOrthoGuide();
        return;
      }
      
      // Create mode: Show ortho snap from last waypoint to cursor
      // But only if NOT in edit mode (intentionally activated for editing)
      if (!window.orthoGuideState.isIntentionallyActivated && window.currentWaypoints && window.currentWaypoints.length > 0) {
        const lastWp = window.currentWaypoints[window.currentWaypoints.length - 1];
        window.orthoGuideState.lastWaypoint = { lat: lastWp.lat, lon: lastWp.lon };
        window.updateOrthoGuide(e.latlng);
      }
      // Edit mode: Only update if lastWaypoint was set by click
      else if (window.orthoGuideState.isIntentionallyActivated && window.orthoGuideState.lastWaypoint) {
        window.updateOrthoGuide(e.latlng);
      }
    });

    map.on('mouseleave', function() {
      if (window.orthoGuideState) {
        window.clearOrthoGuide();
      }
    });
    // ========== END ORTHO SNAP FEATURE ==========
    
    map.on('click', function(e) {
      // Clear ortho guide when creating new waypoint
      if (window.orthoGuideState) {
        window.orthoGuideState.lastWaypoint = null;
      }
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

    // Vincenty distance (WGS84 ellipsoid, ±0.5mm accuracy)
    function vincentyDistanceJS(lat1, lon1, lat2, lon2) {
      const a = 6378137.0, f = 1/298.257223563, b = a*(1-f);
      const toRad = d => d * Math.PI / 180;
      const p1 = toRad(lat1), p2 = toRad(lat2), L = toRad(lon2 - lon1);
      const U1 = Math.atan((1-f)*Math.tan(p1)), U2 = Math.atan((1-f)*Math.tan(p2));
      const sU1 = Math.sin(U1), cU1 = Math.cos(U1);
      const sU2 = Math.sin(U2), cU2 = Math.cos(U2);
      if (Math.abs(lat1-lat2)<1e-12 && Math.abs(lon1-lon2)<1e-12) return 0;
      let lam = L, lamP, sS, cS, sig, sA, c2A, c2SM, C;
      for (let i=0; i<200; i++) {
        const sL=Math.sin(lam), cL=Math.cos(lam);
        sS=Math.sqrt((cU2*sL)**2+(cU1*sU2-sU1*cU2*cL)**2);
        if (sS===0) return 0;
        cS=sU1*sU2+cU1*cU2*cL; sig=Math.atan2(sS,cS);
        sA=(cU1*cU2*sL)/sS; c2A=1-sA*sA;
        c2SM=c2A!==0?cS-(2*sU1*sU2)/c2A:0;
        C=(f/16)*c2A*(4+f*(4-3*c2A));
        lamP=lam;
        lam=L+(1-C)*f*sA*(sig+C*sS*(c2SM+C*cS*(-1+2*c2SM*c2SM)));
        if (Math.abs(lam-lamP)<1e-12) {
          const u2=c2A*(a*a-b*b)/(b*b);
          const A=1+(u2/16384)*(4096+u2*(-768+u2*(320-175*u2)));
          const B=(u2/1024)*(256+u2*(-128+u2*(74-47*u2)));
          const dS=B*sS*(c2SM+(B/4)*(cS*(-1+2*c2SM*c2SM)-(B/6)*c2SM*(-3+4*sS*sS)*(-3+4*c2SM*c2SM)));
          return b*A*(sig-dS);
        }
      }
      return haversineDistanceJS(lat1, lon1, lat2, lon2); // Fallback
    }

    function formatDistanceLabel(meters) {
      if (meters < 1000) return meters.toFixed(1) + ' m';
      return (meters / 1000).toFixed(2) + ' km';
    }

    function calculateBearing(lat1, lon1, lat2, lon2) {
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const lat1Rad = lat1 * Math.PI / 180;
      const lat2Rad = lat2 * Math.PI / 180;
      const y = Math.sin(dLon) * Math.cos(lat2Rad);
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
      let bearing = Math.atan2(y, x) * 180 / Math.PI;
      return (bearing + 360) % 360;
    }

    // ========== DRAG PREVIEW STATE ==========
    window.dragPreviewState = {
      prevLine: null,     // Polyline from prev WP to dragging WP
      nextLine: null,     // Polyline from dragging WP to next WP
      prevLabel: null,    // Distance label marker (prev -> dragging)
      nextLabel: null,    // Distance label marker (dragging -> next)
      prevAngleLabel: null, // Angle label for prev segment
      nextAngleLabel: null, // Angle label for next segment
      draggingWpIndex: -1,
      isDragging: false
    };

    function clearDragPreview() {
      const s = window.dragPreviewState;
      if (s.prevLine) { map.removeLayer(s.prevLine); s.prevLine = null; }
      if (s.nextLine) { map.removeLayer(s.nextLine); s.nextLine = null; }
      if (s.prevLabel) { map.removeLayer(s.prevLabel); s.prevLabel = null; }
      if (s.nextLabel) { map.removeLayer(s.nextLabel); s.nextLabel = null; }
      if (s.prevAngleLabel) { map.removeLayer(s.prevAngleLabel); s.prevAngleLabel = null; }
      if (s.nextAngleLabel) { map.removeLayer(s.nextAngleLabel); s.nextAngleLabel = null; }
      s.isDragging = false;
      s.draggingWpIndex = -1;
    }

    function updateDragPreview(dragLatLng, wpIndex, allWaypoints) {
      const s = window.dragPreviewState;
      const prevWp = wpIndex > 0 ? allWaypoints[wpIndex - 1] : null;
      const nextWp = wpIndex < allWaypoints.length - 1 ? allWaypoints[wpIndex + 1] : null;

      // Update or create previous segment line + label + angle
      if (prevWp) {
        const prevLatLng = L.latLng(prevWp.lat, prevWp.lon);
        if (s.prevLine) {
          s.prevLine.setLatLngs([prevLatLng, dragLatLng]);
        } else {
          s.prevLine = L.polyline([prevLatLng, dragLatLng], {
            color: '#3B82F6', weight: 3, dashArray: '6, 4', opacity: 0.9
          }).addTo(map);
        }
        const dist = vincentyDistanceJS(prevWp.lat, prevWp.lon, dragLatLng.lat, dragLatLng.lng);
        const bearing = calculateBearing(prevWp.lat, prevWp.lon, dragLatLng.lat, dragLatLng.lng);
        const midLat = (prevWp.lat + dragLatLng.lat) / 2;
        const midLng = (prevWp.lon + dragLatLng.lng) / 2;
        
        // Distance label - only show if enabled
        if (window.mapVisualization && window.mapVisualization.distanceLabel) {
          const labelHtml = '<div style="background:rgba(30,41,59,0.92);color:#67e8f9;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid rgba(103,232,249,0.4);white-space:nowrap;font-family:monospace;display:inline-block;min-width:50px;text-align:center;">' + formatDistanceLabel(dist) + '</div>';
          if (s.prevLabel) {
            s.prevLabel.setLatLng(L.latLng(midLat, midLng));
            s.prevLabel.getElement().innerHTML = labelHtml;
            s.prevLabel.setOpacity(1);
          } else {
            s.prevLabel = L.marker(L.latLng(midLat, midLng), {
              icon: L.divIcon({ html: labelHtml, className: '', iconSize: [80, 28], iconAnchor: [40, 14] }),
              interactive: false, zIndexOffset: 2000
            }).addTo(map);
          }
        } else if (s.prevLabel) {
          s.prevLabel.setOpacity(0);
        }

        // Angle label (offset perpendicular to the line for better visibility) - only show if enabled
        if (window.mapVisualization && window.mapVisualization.angleLabel) {
          const angleHtml = '<div style="background:rgba(34,197,94,0.92);color:white;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;border:1px solid rgba(34,197,94,0.6);white-space:nowrap;font-family:monospace;display:inline-block;min-width:45px;text-align:center;">' + bearing.toFixed(1) + '°</div>';
          // Calculate perpendicular offset (rotate 90 degrees) - dynamic based on distance
          const dLat = dragLatLng.lat - prevWp.lat;
          const dLng = dragLatLng.lng - prevWp.lon;
          // Increase offset for short distances to prevent label clash
          const offsetMultiplier = Math.max(0.12, Math.min(0.08, 50 / Math.max(dist, 50)));
          const perpLat = -dLng * offsetMultiplier;  // Perpendicular component (rotated 90°)
          const perpLng = dLat * offsetMultiplier;   // Perpendicular component (rotated 90°)
          const angleOffsetLat = midLat + perpLat;
          const angleOffsetLng = midLng + perpLng;
          if (s.prevAngleLabel) {
            s.prevAngleLabel.setLatLng(L.latLng(angleOffsetLat, angleOffsetLng));
            s.prevAngleLabel.getElement().innerHTML = angleHtml;
            s.prevAngleLabel.setOpacity(1);
          } else {
            s.prevAngleLabel = L.marker(L.latLng(angleOffsetLat, angleOffsetLng), {
              icon: L.divIcon({ html: angleHtml, className: '', iconSize: [75, 24], iconAnchor: [37, 12] }),
              interactive: false, zIndexOffset: 2001
            }).addTo(map);
          }
        } else if (s.prevAngleLabel) {
          s.prevAngleLabel.setOpacity(0);
        }
      }

      // Update or create next segment line + label + angle
      if (nextWp) {
        const nextLatLng = L.latLng(nextWp.lat, nextWp.lon);
        if (s.nextLine) {
          s.nextLine.setLatLngs([dragLatLng, nextLatLng]);
        } else {
          s.nextLine = L.polyline([dragLatLng, nextLatLng], {
            color: '#3B82F6', weight: 3, dashArray: '6, 4', opacity: 0.9
          }).addTo(map);
        }
        const dist = vincentyDistanceJS(dragLatLng.lat, dragLatLng.lng, nextWp.lat, nextWp.lon);
        const bearing = calculateBearing(dragLatLng.lat, dragLatLng.lng, nextWp.lat, nextWp.lon);
        const midLat = (dragLatLng.lat + nextWp.lat) / 2;
        const midLng = (dragLatLng.lng + nextWp.lon) / 2;
        
        // Distance label - only show if enabled
        if (window.mapVisualization && window.mapVisualization.distanceLabel) {
          const labelHtml = '<div style="background:rgba(30,41,59,0.92);color:#67e8f9;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid rgba(103,232,249,0.4);white-space:nowrap;font-family:monospace;display:inline-block;min-width:50px;text-align:center;">' + formatDistanceLabel(dist) + '</div>';
          if (s.nextLabel) {
            s.nextLabel.setLatLng(L.latLng(midLat, midLng));
            s.nextLabel.getElement().innerHTML = labelHtml;
            s.nextLabel.setOpacity(1);
          } else {
            s.nextLabel = L.marker(L.latLng(midLat, midLng), {
              icon: L.divIcon({ html: labelHtml, className: '', iconSize: [80, 28], iconAnchor: [40, 14] }),
              interactive: false, zIndexOffset: 2000
            }).addTo(map);
          }
        } else if (s.nextLabel) {
          s.nextLabel.setOpacity(0);
        }

        // Angle label (offset perpendicular to the line for better visibility) - only show if enabled
        if (window.mapVisualization && window.mapVisualization.angleLabel) {
          const angleHtml = '<div style="background:rgba(34,197,94,0.92);color:white;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;border:1px solid rgba(34,197,94,0.6);white-space:nowrap;font-family:monospace;display:inline-block;min-width:45px;text-align:center;">' + bearing.toFixed(1) + '°</div>';
          // Calculate perpendicular offset (rotate 90 degrees) - dynamic based on distance
          const dLat2 = nextWp.lat - dragLatLng.lat;
          const dLng2 = nextWp.lon - dragLatLng.lng;
          // Increase offset for short distances to prevent label clash
          const offsetMultiplier2 = Math.max(0.12, Math.min(0.08, 50 / Math.max(dist, 50)));
          const perpLat2 = -dLng2 * offsetMultiplier2;  // Perpendicular component (rotated 90°)
          const perpLng2 = dLat2 * offsetMultiplier2;   // Perpendicular component (rotated 90°)
          const angleOffsetLat = midLat + perpLat2;
          const angleOffsetLng = midLng + perpLng2;
          if (s.nextAngleLabel) {
            s.nextAngleLabel.setLatLng(L.latLng(angleOffsetLat, angleOffsetLng));
            s.nextAngleLabel.getElement().innerHTML = angleHtml;
            s.nextAngleLabel.setOpacity(1);
          } else {
            s.nextAngleLabel = L.marker(L.latLng(angleOffsetLat, angleOffsetLng), {
              icon: L.divIcon({ html: angleHtml, className: '', iconSize: [75, 24], iconAnchor: [37, 12] }),
              interactive: false, zIndexOffset: 2001
            }).addTo(map);
          }
        } else if (s.nextAngleLabel) {
          s.nextAngleLabel.setOpacity(0);
        }
      }
    }
    // ========== END DRAG PREVIEW STATE ==========

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

    // Create a stable key to detect actual changes including manual connections
    const waypointsKey = waypoints.map(wp => `${wp.id}-${wp.lat}-${wp.lon}`).join('|') +
      `|manualMode:${isManualConnectionMode}|manualConns:${manualConnections.join(',')}|connMode:${manualConnectionMode}|selected:${selectedWaypoint}|pointTool:${activeDrawingTool === 'line'}`;

    // Only update if waypoints actually changed OR if this is the first update after map ready
    if (waypointsKey === lastWaypointsRef.current && lastWaypointsRef.current !== '') return;
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
                const isPointToolActive = ${activeDrawingTool === 'line'};
                const manualConnections = ${manualConnectionsData};
                const connectionMode = ${JSON.stringify(manualConnectionMode)};

                // Update point tool state immediately so other handlers see it
                window.isPointToolActive = isPointToolActive;

                // Update global waypoints reference for fitToMission
                window.currentWaypoints = newWaypoints;

                // Ensure dynamic style for pointer-events exists
                if (!document.getElementById('drag-mode-style')) {
                    const style = document.createElement('style');
                    style.id = 'drag-mode-style';
                    // We removed pointer-events: none so markers can receive clicks again
                    style.innerHTML = '.drag-mode-active { cursor: crosshair !important; }';
                    document.head.appendChild(style);
                }

                // Manual connection mode drag state
                console.log('[MapDrag] Initializing drag state - isManualMode:', isManualMode, 'connectionMode:', connectionMode);
                
                if (!window.dragConnectionState) {
                    console.log('[MapDrag] Creating new dragConnectionState');
                    window.dragConnectionState = {
                        isDragging: false,
                        startWaypointId: null,
                        startLatLng: null,
                        tempLine: null,
                        tempIndicator: null,
                        waypoints: [],
                        connections: [],
                        localConnections: [],
                        isManualMode: false,
                        connectionMode: 'tap'
                    };
                } else {
                    console.log('[MapDrag] dragConnectionState already exists');
                }
                
                window.dragConnectionState.waypoints = newWaypoints;
                window.dragConnectionState.connections = manualConnections;
                if (!window.dragConnectionState.isDragging) {
                    window.dragConnectionState.localConnections = [...manualConnections];
                }
                window.dragConnectionState.isManualMode = isManualMode;
                window.dragConnectionState.connectionMode = connectionMode;
                
                console.log('[MapDrag] State updated - waypoints:', newWaypoints.length, 'connections:', manualConnections.length, 'localConnections:', window.dragConnectionState.localConnections.length);

                if (!window.dragListenersAdded) {
                    console.log('[MapDrag] Adding drag event listeners for the first time');
                    window.dragListenersAdded = true;
                    
                    const startDrag = function(latlng, containerPoint) {
                        console.log('[MapDrag] startDrag called - latlng:', latlng, 'containerPoint:', containerPoint);
                        const state = window.dragConnectionState;
                        console.log('[MapDrag] State check - isManualMode:', state.isManualMode, 'connectionMode:', state.connectionMode);
                        
                        if (!state.isManualMode || state.connectionMode !== 'drag') {
                            console.log('[MapDrag] Not in drag mode, returning');
                            return;
                        }
                        
                        console.log('[MapDrag] Waypoints count:', state.waypoints?.length);
                        if (state.waypoints && state.waypoints.length > 0) {
                            let closest = null;
                            let minD = 40; // Touch radius snap distance - increased to 40px
                            console.log('[MapDrag] Searching for closest waypoint within 40px');
                            
                            for (const wp of state.waypoints) {
                                const wpPoint = map.latLngToContainerPoint(L.latLng(wp.lat, wp.lon));
                                const d = containerPoint.distanceTo(wpPoint);
                                console.log('[MapDrag] Waypoint', wp.id, 'distance:', d.toFixed(2) + 'px');
                                if (d < minD) {
                                    minD = d;
                                    closest = wp;
                                }
                            }
                            
                            console.log('[MapDrag] Closest waypoint:', closest?.id, 'at distance:', minD.toFixed(2) + 'px');
                            
                            if (closest) {
                                state.isDragging = true;
                                state.startWaypointId = closest.id;
                                state.startLatLng = L.latLng(closest.lat, closest.lon);
                                console.log('[MapDrag] Started dragging from waypoint:', closest.id);
                                console.log('[MapDrag] Current localConnections:', state.localConnections);

                                // Mirror connectedWaypointsRef from Canvas mode — update locally
                                // so updateDragVisuals sees it immediately without React roundtrip
                                if (!state.localConnections.includes(closest.id)) {
                                    state.localConnections.push(closest.id);
                                    console.log('[MapDrag] Added waypoint', closest.id, 'to localConnections');
                                } else {
                                    console.log('[MapDrag] Waypoint', closest.id, 'already in localConnections');
                                }

                                // In drag mode, tapping a node should select it like in Canvas Mode
                                // Sending 'waypointConnect' fromId=toId handles this on the React Native side
                                console.log('[MapDrag] Sending waypointConnect message:', closest.id, '->', closest.id);
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'waypointConnect',
                                    fromId: closest.id,
                                    toId: closest.id
                                }));
                            } else {
                                console.log('[MapDrag] No waypoint found within snap distance');
                            }
                        }
                    };

                    const updateDragVisuals = function(e) {
                        console.log('[MapDrag] updateDragVisuals called - isDragging:', window.dragConnectionState.isDragging);
                        
                        if (window.dragConnectionState.isDragging && window.dragConnectionState.startLatLng) {
                            const latlng = e.latlng;
                            const currentPoint = map.latLngToContainerPoint(latlng);
                            const startPoint = map.latLngToContainerPoint(window.dragConnectionState.startLatLng);
                            const dragDistance = currentPoint.distanceTo(startPoint);
                            
                            console.log('[MapDrag] Drag distance from start:', dragDistance.toFixed(2) + 'px');
                            console.log('[MapDrag] Current position:', latlng);
                            console.log('[MapDrag] Start waypoint:', window.dragConnectionState.startWaypointId);
                            
                            // Only activate snap logic if dragged more than 10px from start
                            if (dragDistance > 10) {
                                console.log('[MapDrag] Drag distance > 10px, checking for nearby waypoints');
                                
                                if (window.dragConnectionState.waypoints && window.dragConnectionState.waypoints.length > 0) {
                                    // Use localConnections (sync, like connectedWaypointsRef in Canvas)
                                    // NOT connections (stale — only updates after React re-render roundtrip)
                                    const conns = window.dragConnectionState.localConnections;
                                    console.log('[MapDrag] Current localConnections:', conns);

                                    for (const wp of window.dragConnectionState.waypoints) {
                                        if (wp.id === window.dragConnectionState.startWaypointId) {
                                            console.log('[MapDrag] Skipping start waypoint:', wp.id);
                                            continue;
                                        }
                                        if (conns.includes(wp.id)) {
                                            console.log('[MapDrag] Skipping already connected waypoint:', wp.id);
                                            continue;
                                        }
                                        const wpPoint = map.latLngToContainerPoint(L.latLng(wp.lat, wp.lon));
                                        const distToWp = currentPoint.distanceTo(wpPoint);
                                        console.log('[MapDrag] Distance to waypoint', wp.id + ':', distToWp.toFixed(2) + 'px');
                                        
                                        if (distToWp < 40) {
                                            console.log('[MapDrag] WAYPOINT CAPTURED! Connecting', window.dragConnectionState.startWaypointId, '->', wp.id);
                                            
                                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                                type: 'waypointConnect',
                                                fromId: window.dragConnectionState.startWaypointId,
                                                toId: wp.id
                                            }));

                                            // Push to localConnections immediately so next touchmove
                                            // iteration sees this waypoint as already connected
                                            window.dragConnectionState.localConnections.push(wp.id);
                                            window.dragConnectionState.startWaypointId = wp.id;
                                            window.dragConnectionState.startLatLng = L.latLng(wp.lat, wp.lon);
                                            
                                            console.log('[MapDrag] Updated start to waypoint:', wp.id);
                                            console.log('[MapDrag] Updated localConnections:', window.dragConnectionState.localConnections);

                                            if (window.dragConnectionState.tempLine) {
                                                map.removeLayer(window.dragConnectionState.tempLine);
                                                window.dragConnectionState.tempLine = null;
                                                console.log('[MapDrag] Cleared temp line after capture');
                                            }
                                            return;
                                        }
                                    }
                                    console.log('[MapDrag] No waypoints within 50px capture range');
                                }
                            } else {
                                console.log('[MapDrag] Drag distance <= 10px, not checking for waypoints yet');
                            }

                            // Update preview line
                            console.log('[MapDrag] Updating preview line');
                            if (window.dragConnectionState.tempLine) {
                                window.dragConnectionState.tempLine.setLatLngs([window.dragConnectionState.startLatLng, latlng]);
                            } else {
                                console.log('[MapDrag] Creating new temp line');
                                window.dragConnectionState.tempLine = L.polyline([window.dragConnectionState.startLatLng, latlng], {
                                    color: '#60A5FA',
                                    weight: 4,
                                    dashArray: '8, 4',
                                    opacity: 0.8
                                }).addTo(map);
                            }
                            
                            // Update finger indicator
                            if (window.dragConnectionState.tempIndicator) {
                                window.dragConnectionState.tempIndicator.setLatLng(latlng);
                            } else {
                                console.log('[MapDrag] Creating new temp indicator');
                                window.dragConnectionState.tempIndicator = L.circleMarker(latlng, {
                                    radius: 12,
                                    fillColor: '#60A5FA',
                                    fillOpacity: 0.5,
                                    color: 'transparent'
                                }).addTo(map);
                            }
                        } else {
                            console.log('[MapDrag] Not dragging or no start point');
                        }
                    };
                    
                    const clearDragVisuals = function() {
                        console.log('[MapDrag] clearDragVisuals called');
                        console.log('[MapDrag] Final localConnections:', window.dragConnectionState.localConnections);
                        
                        if (window.dragConnectionState.tempLine) {
                            map.removeLayer(window.dragConnectionState.tempLine);
                            window.dragConnectionState.tempLine = null;
                            console.log('[MapDrag] Removed temp line');
                        }
                        if (window.dragConnectionState.tempIndicator) {
                            map.removeLayer(window.dragConnectionState.tempIndicator);
                            window.dragConnectionState.tempIndicator = null;
                            console.log('[MapDrag] Removed temp indicator');
                        }
                        window.dragConnectionState.isDragging = false;
                        window.dragConnectionState.startWaypointId = null;
                        console.log('[MapDrag] Drag ended - isDragging set to false');
                    };

                    // Desktop: Leaflet map events (mousemove/mousedown/mouseup work reliably)
                    map.on('mousemove', updateDragVisuals);
                    map.on('mousedown', function(e) {
                        console.log('[MapDrag] Desktop mousedown event');
                        startDrag(e.latlng, map.latLngToContainerPoint(e.latlng));
                    });
                    map.on('mouseup', function() {
                        console.log('[MapDrag] Desktop mouseup event');
                        setTimeout(clearDragVisuals, 800);
                    });

                    // Mobile: Direct DOM event listeners on the container.
                    // Leaflet does NOT fire touchstart/touchmove/touchend as map events,
                    // so map.on('touchmove') never fires — this was why drag mode
                    // only worked as tap (startDrag ran from synthetic mousedown,
                    // but updateDragVisuals never ran during continuous finger movement).
                    var container = map.getContainer();

                    container.addEventListener('touchstart', function(e) {
                        console.log('[MapDrag] Mobile touchstart event - touches:', e.touches.length);
                        if (e.touches && e.touches[0]) {
                            var touch = e.touches[0];
                            var rect = container.getBoundingClientRect();
                            var point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
                            console.log('[MapDrag] Touch point:', point);
                            startDrag(map.containerPointToLatLng(point), point);
                        }
                    }, { passive: true });

                    container.addEventListener('touchmove', function(e) {
                        var state = window.dragConnectionState;
                        console.log('[MapDrag] Mobile touchmove event - isDragging:', state?.isDragging);
                        
                        if (!state || !state.isDragging) {
                            console.log('[MapDrag] touchmove ignored - not dragging');
                            return;
                        }

                        // Prevent map scroll/pan while drag-connecting
                        e.preventDefault();
                        console.log('[MapDrag] touchmove preventDefault called');

                        if (e.touches && e.touches[0]) {
                            var touch = e.touches[0];
                            var rect = container.getBoundingClientRect();
                            var point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
                            var latlng = map.containerPointToLatLng(point);
                            console.log('[MapDrag] touchmove position:', latlng);
                            updateDragVisuals({ latlng: latlng });
                        }
                    }, { passive: false });

                    container.addEventListener('touchend', function() {
                        console.log('[MapDrag] Mobile touchend event');
                        setTimeout(clearDragVisuals, 800);
                    });
                    
                    console.log('[MapDrag] ✅ All drag event listeners registered successfully');
                    console.log('[MapDrag] - Desktop: mousemove, mousedown, mouseup');
                    console.log('[MapDrag] - Mobile: touchstart, touchmove, touchend on container');
                }

                // Control map dragging based on mode
                if (isManualMode && connectionMode === 'drag') {
                    map.dragging.disable();
                    console.log('[MapDrag] Map dragging DISABLED for drag connection mode');
                    console.log('[MapDrag] Touch events should now be handled by custom listeners');
                } else {
                    map.dragging.enable();
                    console.log('[MapDrag] Map dragging ENABLED for', connectionMode, 'mode');
                }

                // Clear existing waypoint markers
                waypointMarkers.forEach(marker => map.removeLayer(marker));
                waypointMarkers.length = 0;

                // Remove existing polyline
                if (missionPolyline) {
                    map.removeLayer(missionPolyline);
                    missionPolyline = null;
                }
                if (missionGlowLine) {
                    map.removeLayer(missionGlowLine);
                    missionGlowLine = null;
                }

                // Add polyline based on mode
                if (isManualMode && manualConnections.length > 1) {
                    const connectedWaypoints = manualConnections.map(id =>
                        newWaypoints.find(wp => wp.id === id)
                    ).filter(wp => wp !== undefined);

                    if (connectedWaypoints.length > 1) {
                        const pathCoords = connectedWaypoints.map(wp => [wp.lat, wp.lon]);
                        missionGlowLine = L.polyline(pathCoords, {
                            color: '#4ADE80',
                            weight: 7,
                            opacity: 0.2,
                            dashArray: '5, 10',
                        }).addTo(map);
                        missionPolyline = L.polyline(pathCoords, {
                            color: '#4ADE80',
                            weight: 3,
                            opacity: 0.9,
                            dashArray: '5, 10',
                        }).addTo(map);
                    }
                } else if (isManualMode && manualConnections.length === 1) {
                    // Show single connected waypoint (no line yet)
                } else if (!isManualMode && newWaypoints.length > 1) {
                    const pathCoords = newWaypoints.map(wp => [wp.lat, wp.lon]);
                    missionGlowLine = L.polyline(pathCoords, {
                        color: '#f97316',
                        weight: 6,
                        opacity: 0.2,
                    }).addTo(map);
                    missionPolyline = L.polyline(pathCoords, {
                        color: '#f97316',
                        weight: 2.5,
                        opacity: 0.9,
                    }).addTo(map);
                }

                // Add new waypoint markers
                newWaypoints.forEach((wp, index) => {
                    const isConnected = isManualMode && manualConnections.includes(wp.id);
                    const connectionIndex = manualConnections.indexOf(wp.id);
                    
                    let markerIcon;
                    if (isManualMode && isConnected) {
                        markerIcon = L.divIcon({
                            html: \`<div style="position: relative;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="#4ADE80"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><text x="12" y="10.5" font-family="sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle" dy=".3em">\${wp.id}</text></svg><div style="position: absolute; top: -12px; right: -12px; background: #22c55e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: bold; border: 2px solid white; z-index: 1000;">\${connectionIndex + 1}</div></div>\`,
                            className: 'custom-marker' + (connectionMode === 'drag' ? ' drag-mode-active' : ''),
                            iconSize: [48, 48],
                            iconAnchor: [24, 48],
                        });
                    } else {
                        const baseIcon = getWaypointIcon(wp, index);
                        if (connectionMode === 'drag') {
                             baseIcon.options.className += ' drag-mode-active';
                        }
                        markerIcon = baseIcon;
                    }
                    
                    const marker = L.marker([wp.lat, wp.lon], {
                        icon: markerIcon,
                        draggable: !isManualMode && isPointToolActive,
                    }).addTo(map);

                    if (!isManualMode || connectionMode === 'pan') {
                        marker.bindPopup(\`
                            <strong>WP \${wp.id}</strong><br>
                            Row: \${wp.row || '-'}<br>
                            Block: \${wp.block || '-'}<br>
                            Pile: \${wp.pile || '-'}<br>
                            Alt: \${wp.alt}m
                        \`);
                    }

                    // Click handling - only for tap mode in manual connection, or normal mode
                    if (connectionMode === 'tap' || !isManualMode) {
                        marker.on('click', function(e) {
                            L.DomEvent.stopPropagation(e);
                            // Activate ortho guide for this waypoint - mark as intentionally activated
                            if (window.orthoGuideState) {
                                window.orthoGuideState.lastWaypoint = { lat: wp.lat, lon: wp.lon };
                                window.orthoGuideState.isIntentionallyActivated = true;  // User clicked this waypoint
                            }
                            if (isManualMode && connectionMode === 'tap') {
                                // Manual connection tap
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'waypointClick',
                                    id: wp.id
                                }));
                            } else {
                                console.log('Waypoint clicked', wp.id, 'mode:', connectionMode);
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'waypointClick',
                                    id: wp.id
                                }));
                                
                                const rect = map.getContainer().getBoundingClientRect();
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'waypointContextMenu',
                                    waypointId: wp.id,
                                    x: e.originalEvent.clientX - rect.left,
                                    y: e.originalEvent.clientY - rect.top
                                }));
                            }
                        });
                    }

                    if (!isManualMode || connectionMode === 'pan') {
                         marker.on('contextmenu', function(e) {
                             L.DomEvent.preventDefault(e);
                             L.DomEvent.stopPropagation(e);
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
                    }
                    if (!isManualMode) {
                        marker.on('dragstart', function(e) {
                            window.dragPreviewState.isDragging = true;
                            window.dragPreviewState.draggingWpIndex = index;
                            if (missionPolyline) missionPolyline.setStyle({ opacity: 0.3 });
                            if (missionGlowLine) missionGlowLine.setStyle({ opacity: 0.1 });
                            
                            // Activate ortho guide ONLY if:
                            // 1. User intentionally clicked this waypoint first, OR
                            // 2. This is the last waypoint (for creating new waypoints)
                            if (window.orthoGuideState) {
                                const isLastWaypoint = index === newWaypoints.length - 1;
                                const wasIntentionallyActivated = window.orthoGuideState.isIntentionallyActivated && 
                                                                  window.orthoGuideState.lastWaypoint && 
                                                                  window.orthoGuideState.lastWaypoint.lat === wp.lat &&
                                                                  window.orthoGuideState.lastWaypoint.lon === wp.lon;
                                
                                if (isLastWaypoint || wasIntentionallyActivated) {
                                  // For last waypoint: use previous waypoint as reference
                                  // For intentionally selected: use the waypoint itself as reference
                                  if (isLastWaypoint && index > 0) {
                                    const prevWp = newWaypoints[index - 1];
                                    window.orthoGuideState.lastWaypoint = { lat: prevWp.lat, lon: prevWp.lon };
                                  }
                                  // If intentionally activated, lastWaypoint is already set from click
                                } else {
                                  // Not intentionally activated and not last waypoint - disable ortho snap
                                  window.orthoGuideState.isIntentionallyActivated = false;
                                  window.orthoGuideState.lastWaypoint = null;
                                }
                            }
                        });

                        marker.on('drag', function(e) {
                            const pos = e.target.getLatLng();
                            updateDragPreview(pos, index, newWaypoints);
                            // Update ortho guide during drag
                            if (window.orthoGuideState && window.updateOrthoGuide) {
                                window.updateOrthoGuide(pos);
                            }
                        });

                        marker.on('dragend', function(e) {
                            clearDragPreview();
                            // Clear ortho guide after drag and reset intentional activation flag
                            if (window.orthoGuideState && window.clearOrthoGuide) {
                                window.clearOrthoGuide();
                                window.orthoGuideState.isIntentionallyActivated = false;
                            }
                            if (missionPolyline) missionPolyline.setStyle({ opacity: 1 });
                            if (missionGlowLine) missionGlowLine.setStyle({ opacity: 0.2 });
                            const newPos = e.target.getLatLng();
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'waypointDrag',
                                id: wp.id,
                                lat: newPos.lat,
                                lng: newPos.lng
                            }));
                        });
                    }

                    waypointMarkers.push(marker);
                });

                // Clear temporary line if mode switched
                if (connectionMode !== 'drag') {
                    if (window.dragConnectionState && window.dragConnectionState.tempLine) {
                        map.removeLayer(window.dragConnectionState.tempLine);
                        window.dragConnectionState.tempLine = null;
                        window.dragConnectionState.isDragging = false;
                    }
                    if (window.dragConnectionState && window.dragConnectionState.tempIndicator) {
                        map.removeLayer(window.dragConnectionState.tempIndicator);
                        window.dragConnectionState.tempIndicator = null;
                    }
                }

                // console.log('[PathPlanMap] Waypoints updated:', newWaypoints.length);
            })();
            true;
        `;

    webViewRef.current.injectJavaScript(updateWaypointsScript);
  }, [waypoints, selectedWaypoint, mapReady, isManualConnectionMode, manualConnections, manualConnectionMode, activeDrawingTool]);

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
      console.log('[PathPlanMap] ✦ Updating rover position:', {
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

  // Handle map visualization toggle changes
  useEffect(() => {
    if (!mapReady || !webViewRef.current || !visualization) return;

    const updateVisualizationScript = `
      window.mapVisualization = {
        distanceLabel: ${visualization.distanceLabel},
        angleLabel: ${visualization.angleLabel},
        snapFeature: ${visualization.snapFeature},
        roverIcon: ${visualization.roverIcon},
        waypointPreview: ${visualization.waypointPreview}
      };
      
      // Update manual connection mode flag
      window.isManualConnectionMode = ${isManualConnectionMode};

      // Toggle snap feature - clear guide lines if disabled OR in manual connection mode
      if (window.orthoGuideState) {
        if (!window.mapVisualization.snapFeature || window.isManualConnectionMode) {
          if (window.clearOrthoGuide) {
            window.clearOrthoGuide();
          }
        }
      }

      // Toggle rover icon visibility
      if (typeof roverMarker !== 'undefined' && roverMarker) {
        roverMarker.setOpacity(window.mapVisualization.roverIcon ? 1 : 0);
      }

      // Toggle waypoint markers visibility
      if (typeof waypointMarkers !== 'undefined' && waypointMarkers && waypointMarkers.length > 0) {
        waypointMarkers.forEach(marker => {
          marker.setOpacity(window.mapVisualization.waypointPreview ? 1 : 0);
        });
      }

      // Toggle distance and angle labels by controlling drag preview visibility
      if (typeof window.dragPreviewState !== 'undefined') {
        window.dragPreviewState.showDistanceLabel = window.mapVisualization.distanceLabel;
        window.dragPreviewState.showAngleLabel = window.mapVisualization.angleLabel;
      }

      true;
    `;

    webViewRef.current.injectJavaScript(updateVisualizationScript);
  }, [visualization, mapReady, isManualConnectionMode]);

  // Update measure tool active state and point tool state
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    const isMeasureActive = activeDrawingTool === 'measure';
    const isPointToolActive = activeDrawingTool === 'line';
    const script = `
      window.isMeasureToolActive = ${isMeasureActive};
      window.isPointToolActive = ${isPointToolActive};
      true;
    `;
    webViewRef.current.injectJavaScript(script);
  }, [activeDrawingTool, mapReady]);

  // Inject measure ring-markers + connecting line into Leaflet, and open popup on selected waypoints
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    const pts = JSON.stringify(measurePoints);
    const selectedIds = JSON.stringify(measurePoints.map(p => p.waypointId).filter(Boolean));
    const script = `
      (function() {
        if (!window.measureMarkers) window.measureMarkers = [];
        if (!window.measureLine) window.measureLine = null;
        window.measureMarkers.forEach(function(m) { map.removeLayer(m); });
        window.measureMarkers = [];
        if (window.measureLine) { map.removeLayer(window.measureLine); window.measureLine = null; }

        var points = ${pts};
        if (!points || points.length === 0) return;

        // Draw amber ring overlay on top of selected existing waypoint markers
        points.forEach(function(pt, idx) {
          var icon = L.divIcon({
            className: '',
            html: '<div style="border:3px solid #f59e0b;border-radius:50%;width:30px;height:30px;box-shadow:0 0 8px rgba(245,158,11,0.8);background:rgba(245,158,11,0.15);"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          var marker = L.marker([pt.lat, pt.lon], { icon: icon, zIndexOffset: 2000, interactive: false }).addTo(map);
          window.measureMarkers.push(marker);
        });

        if (points.length === 2) {
          window.measureLine = L.polyline([[points[0].lat, points[0].lon],[points[1].lat, points[1].lon]], {
            color: '#f59e0b', weight: 2, dashArray: '6,4', opacity: 0.9
          }).addTo(map);
        }
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(script);
  }, [measurePoints, mapReady]);

  // Load measure overlay position from storage on mount
  useEffect(() => {
    const loadMeasurePosition = async () => {
      try {
        const saved = await AsyncStorage.getItem('measureOverlayPos');
        if (saved) {
          setMeasureOverlayPos(JSON.parse(saved));
        }
      } catch (e) {
        // Ignore errors, use default position
      }
    };
    loadMeasurePosition();
  }, []);

  // Save measure overlay position to storage whenever it changes
  useEffect(() => {
    const saveMeasurePosition = async () => {
      try {
        await AsyncStorage.setItem('measureOverlayPos', JSON.stringify(measureOverlayPos));
      } catch (e) {
        // Ignore errors
      }
    };
    saveMeasurePosition();
  }, [measureOverlayPos]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML }}
        style={{ flex: 1, backgroundColor: '#0D2A4B' }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'mapReady') {
              setMapReady(true);
            } else if (message.type === 'mapClick') {
              onMapPress?.({ latitude: message.lat, longitude: message.lng });
              setContextMenu(null); // Close context menu on map click
            } else if (message.type === 'waypointClick') {
              if (activeDrawingTool === 'measure') {
                onMeasureWaypointSelect?.(message.id);
              } else {
                onWaypointClick?.(message.id);
              }
              setContextMenu(null);
            } else if (message.type === 'waypointConnect') {
              onWaypointConnect?.(message.fromId, message.toId);
            } else if (message.type === 'waypointDrag') {
              onWaypointDrag?.(message.id, { latitude: message.lat, longitude: message.lng });
            } else if (message.type === 'waypointContextMenu') {
              // Suppress context menu entirely in measure mode
              if (activeDrawingTool === 'measure') return;
              // Only show context menu in pan mode or when not in manual connection mode
              if (!isManualConnectionMode || manualConnectionMode === 'pan') {
                setContextMenu({ x: message.x, y: message.y, waypointId: message.id });
              }
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

      {/* Compass with heading */}
      <View style={styles.compassOverlay}>
        {/* Heading indicator arrow (red triangle pointing rover direction) */}
        <View style={[
          styles.headingArrow,
          { transform: [{ rotate: `${heading ?? 0}deg` }] }
        ]} />
        {/* Compass icon rotates opposite to heading so N stays north */}
        <View style={{ transform: [{ rotate: `${-(heading ?? 0)}deg` }] }}>
          <Fontisto name="compass" color="#67e8f9" size={20} />
        </View>
        {/* N label fixed at top */}
        <Text style={styles.compassN}>N</Text>
      </View>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <View
          style={{
            position: 'absolute',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'rgba(13, 42, 75, 0.96)',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: 'rgba(59, 130, 246, 0.3)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 8,
            zIndex: 2000,
            minWidth: 180,
            overflow: 'hidden',
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
                borderBottomColor: 'rgba(59, 130, 246, 0.15)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>
                Delete Waypoint
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
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '600' }}>
                Insert Waypoint After
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Map Visualization Controls */}
      {visualization && onVisualizationToggle && (
        <MapVisualizationControls
          visualization={visualization}
          onToggle={onVisualizationToggle}
        />
      )}

      {/* Measure Tool Overlay */}
      {measurePoints.length > 0 && (
        <View 
          style={[styles.measureOverlay, { left: measureOverlayPos.x, top: measureOverlayPos.y }]}
          {...measurePanResponderRef.current?.panHandlers}
        >
          <View style={styles.measureHeader}>
            <Text style={styles.measureTitle}>⬡ MEASURE</Text>
            <TouchableOpacity onPress={onMeasureClear} style={styles.measureClearBtn}>
              <Text style={styles.measureClearText}>✕</Text>
            </TouchableOpacity>
          </View>
          {measurePoints.map((pt, idx) => (
            <View key={idx} style={styles.measureRow}>
              <Text style={styles.measureSeq}>
                {pt.waypointId != null ? `WP${pt.waypointId}` : `M${pt.seq}`}
              </Text>
              <Text style={styles.measureCoord}>
                {pt.lat.toFixed(6)},{'\n'}{pt.lon.toFixed(6)}
              </Text>
            </View>
          ))}
          {measurePoints.length < 2 && (
            <Text style={styles.measureHint}>Tap an existing waypoint</Text>
          )}
          {measureResult && (
            <View style={styles.measureResultBlock}>
              <View style={styles.measureResultRow}>
                <Text style={styles.measureResultLabel}>Distance</Text>
                <Text style={styles.measureResultValue}>
                  {measureResult.distance >= 1000
                    ? `${(measureResult.distance / 1000).toFixed(3)} km`
                    : `${measureResult.distance.toFixed(2)} m`}
                </Text>
              </View>
              <View style={styles.measureResultRow}>
                <Text style={styles.measureResultLabel}>Heading</Text>
                <Text style={styles.measureResultValue}>{measureResult.heading.toFixed(1)}°</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D2A4B',
  },
  compassOverlay: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(13, 42, 75, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
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
  measureOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(13, 42, 75, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    padding: 0,
    minWidth: 190,
    zIndex: 1000,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  measureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.15)',
  },
  measureTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  measureClearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderRadius: 4,
  },
  measureClearText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '700',
  },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
    paddingHorizontal: 12,
  },
  measureSeq: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
    width: 36,
    fontFamily: 'monospace',
  },
  measureCoord: {
    fontSize: 10,
    color: 'rgba(229, 241, 255, 0.7)',
    fontFamily: 'monospace',
  },
  measureHint: {
    fontSize: 10,
    color: 'rgba(103,232,249,0.7)',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingBottom: 8,
    fontStyle: 'italic',
  },
  measureResultBlock: {
    marginTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,158,11,0.2)',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  measureResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  measureResultLabel: {
    fontSize: 10,
    color: 'rgba(229, 241, 255, 0.6)',
    fontFamily: 'monospace',
  },
  measureResultValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
    fontFamily: 'monospace',
  },
});
