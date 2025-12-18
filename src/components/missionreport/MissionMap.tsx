import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
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
}

export const MissionMap: React.FC<Props> = ({
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
}) => {
  const webViewRef = useRef<WebView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const lastUpdateRef = useRef<number>(0);
  const UPDATE_THROTTLE_MS = 100; // Throttle position updates to 100ms (10 Hz) to match web app
  const mapInitializedRef = useRef(false);
  // TRAIL DISABLED: lastTrailLengthRef commented out
  // const lastTrailLengthRef = useRef<number>(0); // Track trail length for incremental updates

  // Stable mission key to detect actual waypoint changes (not just ref changes)
  // Use index to avoid duplicate key issues when sn values are duplicated
  const missionKey = useMemo(
    () => waypoints.map((wp, idx) => `${idx}-${wp.sn}-${wp.lat.toFixed(7)}-${wp.lon.toFixed(7)}`).join('|'),
    [waypoints]
  );

  // Store initial rover data for one-time HTML generation
  const initialRoverData = useRef({
    lat: roverLat,
    lon: roverLon,
    heading: heading,
    hasPosition: Number.isFinite(roverLat) && Number.isFinite(roverLon),
  });

  // Generate HTML with Leaflet map - ONLY ONCE on mount
  const mapHTML = useMemo(() => {
    console.log('[MissionMap] Generating map HTML (ONE-TIME ONLY)');
    const waypointsJSON = JSON.stringify(waypoints.map((wp, idx) => ({
      id: wp.sn,
      uniqueId: `wp-${idx}-${wp.sn}`, // Unique key combining index and sn
      lat: wp.lat,
      lon: wp.lon,
      block: wp.block,
      row: wp.row,
      pile: wp.pile,
      isActive: idx === activeWaypointIndex,
      isStart: idx === 0,
      isEnd: idx === waypoints.length - 1,
    })));

    const roverData = JSON.stringify(initialRoverData.current);

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

    .compass-container {
      position: absolute;
      bottom: 10px;
      left: 10px;
      z-index: 1000;
      width: 30px;
      height: 30px;
      background: rgba(30, 41, 59, 0.95);
      border-radius: 50%;
      border: 2px solid rgba(103, 232, 249, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }

    .compass-arrow {
      position: absolute;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 15px solid #ef4444;
      transform-origin: center 12px;
      transition: transform 150ms linear;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
    }

    .compass-label {
      position: absolute;
      font-size: 11px;
      font-weight: 700;
      color: rgba(103, 232, 249, 1);
      top: 4px;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <div class="custom-controls">
    <button class="control-btn" onclick="centerOnRover()">📍</button>
    <button class="control-btn" onclick="fitToMission()">🗺️</button>
    <button class="control-btn" onclick="toggleFullscreen()">⛶</button>
  </div>

  <div class="zoom-controls">
    <button class="zoom-btn" onclick="map.zoomIn()">+</button>
    <button class="zoom-btn" onclick="map.zoomOut()">−</button>
  </div>

  <div class="position-overlay">
    <div class="position-title">Rover Position</div>
    <div class="position-coord" id="rover-lat">Lat: 0.0000000</div>
    <div class="position-coord" id="rover-lon">Lon: 0.0000000</div>
  </div>

  <div class="compass-container">
    <div class="compass-label">N</div>
    <div class="compass-arrow" id="compass-arrow"></div>
  </div>

  <script>
    const waypoints = ${waypointsJSON};
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
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19,
      maxZoom: 26,
    }).addTo(map);

    let roverMarker = null;
    let headingLine = null;
    let missionPolyline = null;
    const waypointMarkers = [];

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
    function getWaypointIcon(wp, index) {
      let fill = '#f97316';
      if (wp.isStart) fill = '#16a34a';
      if (wp.isEnd) fill = '#dc2626';
      if (wp.isActive) fill = '#22c55e';
      
      const size = wp.isActive ? 32 : 24;
      
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
    
    // Draw mission path
    if (waypoints.length > 1) {
      const pathCoords = waypoints.map(wp => [wp.lat, wp.lon]);
      missionPolyline = L.polyline(pathCoords, {
        color: '#3B82F6',
        weight: 3,
        dashArray: '5, 5',
      }).addTo(map);
    }
    
    // Draw waypoint markers
    waypoints.forEach((wp, index) => {
      const marker = L.marker([wp.lat, wp.lon], {
        icon: getWaypointIcon(wp, index),
      }).addTo(map);
      
      marker.bindPopup(\`
        <strong>Waypoint \${wp.id}</strong><br>
        Row: \${wp.row || '-'}<br>
        Block: \${wp.block || '-'}<br>
        Pile: \${wp.pile || '-'}
      \`);
      
      waypointMarkers.push(marker);
    });

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

      // Update compass arrow
      if (roverData.heading !== null) {
        const compassArrow = document.getElementById('compass-arrow');
        if (compassArrow) {
          compassArrow.style.transform = \`rotate(\${roverData.heading}deg)\`;
        }
      }

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
      if (roverData.hasPosition) {
        map.setView([roverData.lat, roverData.lon], 17, { animate: true });
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
      waypoints.forEach(wp => bounds.push([wp.lat, wp.lon]));
      if (roverData.hasPosition) bounds.push([roverData.lat, roverData.lon]);
      
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
      }
    }
    
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

  // Update rover position, heading, and trail via JavaScript injection
  useEffect(() => {
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
    if (Math.random() < 0.1) {
      console.log('[MissionMap] 📍 Updating rover position:', {
        lat: roverLat.toFixed(7),
        lon: roverLon.toFixed(7),
        heading: heading !== null ? heading.toFixed(1) + '°' : 'N/A',
        status: armed ? 'ARMED' : (rtkFixType >= 5 ? 'RTK' : 'DISARMED')
      });
    }

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

            // Update position display
            document.getElementById('rover-lat').textContent = 'Lat: ${roverLat.toFixed(7)}';
            document.getElementById('rover-lon').textContent = 'Lon: ${roverLon.toFixed(7)}';

            // WEB APP STYLE: Fast rotation using RoverMarker class method
            if (${heading !== null}) {
              roverMarker.setHeading(${heading || 0});
            }

            // WEB APP STYLE: Dynamic status colors (armed=green, RTK=blue, disarmed=yellow)
            roverMarker.setStatus('${status}');

            // Update compass arrow
            ${heading !== null ? `
            const compassArrow = document.getElementById('compass-arrow');
            if (compassArrow) {
              compassArrow.style.transform = 'rotate(${heading || 0}deg)';
            }
            ` : ''}
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
  }, [roverLat, roverLon, heading, armed, rtkFixType, /* trailPoints, */ mapReady]);

  return (
    <View style={styles.mapContainer}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML }}
        style={{ flex: 1, borderRadius: 12, backgroundColor: '#1e293b' }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'mapReady') {
              setMapReady(true);
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
});