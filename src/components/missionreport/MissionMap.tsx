import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Fontisto } from '@expo/vector-icons';
import { MAPBOX_ACCESS_TOKEN, MAPBOX_JS_URL, MAPBOX_CSS_URL, MAPBOX_STYLE_SATELLITE } from '../../config/mapboxConfig';
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
  isVisible?: boolean;     // When false, pauses Mapbox rendering to save GPU/CPU
  // Status map keyed by waypoint.sn → drives completion color on markers
  statusMap?: Record<number, { status?: string } & Record<string, any>>;
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
  statusMap,
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

  // Generate HTML with Mapbox map - ONLY ONCE on mount
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
  <link rel='stylesheet' href='${MAPBOX_CSS_URL}' />
  <script src='${MAPBOX_JS_URL}'></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }

    .mapboxgl-ctrl-attrib, .mapboxgl-ctrl-logo { display: none !important; }

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
      pointer-events: none;
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
    mapboxgl.accessToken = '${MAPBOX_ACCESS_TOKEN}';

    // Waypoints loaded AFTER WebView init via injectedJavaScript
    // This avoids blocking JS thread with JSON.stringify on 400+ waypoints during HTML generation
    const waypoints = [];
    const roverData = ${roverData};

    // Initialize map
    const centerLat = waypoints.length > 0 ? waypoints[0].lat : (roverData.hasPosition ? roverData.lat : 13.0827);
    const centerLon = waypoints.length > 0 ? waypoints[0].lon : (roverData.hasPosition ? roverData.lon : 80.2707);

    const map = new mapboxgl.Map({
      container: 'map',
      style: '${MAPBOX_STYLE_SATELLITE}',
      center: [centerLon, centerLat],
      zoom: 15,
      maxZoom: 26,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });

    let roverMarker = null;
    const waypointMarkers = [];

    // Live rover position — updated via injected JS so centerOnRover always uses current coords
    let liveRoverPos = roverData.hasPosition ? { lat: roverData.lat, lon: roverData.lon } : null;

    // WEB APP STYLE: Custom RoverMarker wrapper for Mapbox
    class RoverMarker {
      constructor(lngLat, options) {
        this._heading = options?.heading || 0;
        this._status = options?.status || 'disarmed';
        this._el = document.createElement('div');
        this._el.style.cssText = 'width:84px;height:84px;margin-left:-42px;margin-top:-42px;';
        this._el.innerHTML = options?.iconSVG || '';
        this._marker = new mapboxgl.Marker({ element: this._el, anchor: 'center' })
          .setLngLat(lngLat);
      }

      addTo(map) {
        this._marker.addTo(map);
        return this;
      }

      remove() {
        this._marker.remove();
        return this;
      }

      setLngLat(ll) {
        this._marker.setLngLat(ll);
        return this;
      }

      getLngLat() {
        return this._marker.getLngLat();
      }

      getElement() {
        return this._el;
      }

      setPopup(p) {
        this._marker.setPopup(p);
        return this;
      }

      setHeading(deg) {
        this._heading = ((deg % 360) + 360) % 360;
        const svg = this._el.querySelector('svg');
        if (svg) {
          svg.style.transform = 'rotate(' + this._heading + 'deg)';
          svg.style.transition = 'none';
        }
        return this;
      }

      setStatus(status) {
        this._status = status;
        const body = this._el.querySelector('#rover-body');
        if (body) {
          const color = status === 'armed' ? '#22c55e' : status === 'rtk' ? '#3b82f6' : '#f4d03f';
          body.setAttribute('fill', color);
        }
        return this;
      }

      getStatus() {
        return this._status;
      }
    }

    // Get waypoint element
    function getWaypointElement(wp, index) {
      let fill = '#f97316';
      if (wp.isStart) fill = '#16a34a';
      if (wp.isEnd) fill = '#dc2626';
      if (wp.isCompleted) fill = '#22c55e';

      const size = 36;
      const svgHtml = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="\${size}" height="\${size}" fill="\${fill}">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="rgba(0,0,0,0.25)" stroke-width="0.4"/>
        <text x="12" y="10.5" font-family="sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle" dy=".3em">\${index + 1}</text>
      </svg>\`;

      const el = document.createElement('div');
      el.innerHTML = svgHtml;
      el.style.cssText = \`width:\${size}px;height:\${size}px;margin-left:\${-size/2}px;pointer-events:none;\`;
      el.className = 'custom-marker';
      return el;
    }

    // PERFORMANCE: Chunked marker loading to prevent UI freeze with 100+ waypoints
    function chunkedLoadMarkers(waypoints) {
      const CHUNK_SIZE = 50;
      let currentIndex = 0;

      function loadNextChunk() {
        const endIndex = Math.min(currentIndex + CHUNK_SIZE, waypoints.length);

        for (let i = currentIndex; i < endIndex; i++) {
          const wp = waypoints[i];
          const marker = new mapboxgl.Marker({ element: getWaypointElement(wp, i), anchor: 'bottom' })
            .setLngLat([wp.lon, wp.lat])
            .addTo(map);

          waypointMarkers.push(marker);
        }

        currentIndex = endIndex;

        if (currentIndex < waypoints.length) {
          requestAnimationFrame(loadNextChunk);
        } else {
          // All markers loaded - now update mission path
          if (waypoints.length > 1) {
            const pathCoords = waypoints.map(wp => [wp.lon, wp.lat]);
            const source = map.getSource('mission-path');
            if (source) {
              source.setData({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: pathCoords }
              });
            }
          }

          console.log('[MissionMap] All markers loaded:', waypoints.length);
        }
      }

      loadNextChunk();
    }

    // Add sources and layers on map load
    map.on('load', function() {
      // Mission polyline source
      map.addSource('mission-path', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
      });

      map.addLayer({
        id: 'mission-line',
        type: 'line',
        source: 'mission-path',
        paint: {
          'line-color': '#3B82F6',
          'line-width': 3,
          'line-opacity': 0.9,
          'line-dasharray': [5, 5]
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });

      // Heading line source
      map.addSource('heading-line', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
      });

      map.addLayer({
        id: 'heading-line-layer',
        type: 'line',
        source: 'heading-line',
        paint: {
          'line-color': '#FCD34D',
          'line-width': 2
        }
      });

      // Start chunked loading
      if (waypoints.length > 0) {
        chunkedLoadMarkers(waypoints);
      }

      // Draw rover marker and heading
      if (roverData.hasPosition) {
        document.getElementById('rover-lat').textContent = \`Lat: \${roverData.lat.toFixed(7)}\`;
        document.getElementById('rover-lon').textContent = \`Lon: \${roverData.lon.toFixed(7)}\`;

        const currentZoom = map.getZoom();
        const zoomScale = Math.max(0.3, Math.min(1.2, (currentZoom - 10) / 12));
        const size = Math.round(84 * zoomScale);
        const half = Math.round(size / 2);
        const rotation = roverData.heading !== null ? roverData.heading : 0;

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
            <rect id="rover-body" x="30" y="25" width="40" height="50" rx="3" fill="#f4d03f" stroke="#d4af37" stroke-width="2"/>
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

        roverMarker = new RoverMarker([roverData.lon, roverData.lat], { iconSVG: roverIconSVG, heading: rotation });
        roverMarker.addTo(map);
        roverMarker.setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(\`<strong>Rover</strong><br>Heading: \${roverData.heading !== null ? roverData.heading.toFixed(1) + '°' : 'N/A'}<br>Lat: \${roverData.lat.toFixed(7)}<br>Lon: \${roverData.lon.toFixed(7)}\`));

        // Heading line
        if (roverData.heading !== null) {
          const distance = 0.0;
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

          map.getSource('heading-line')?.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[roverData.lon, roverData.lat], [endLon, endLat]] }
          });
        }
      }

      // Fit map to show all markers
      setTimeout(() => {
        const b = new mapboxgl.LngLatBounds();
        waypoints.forEach(wp => b.extend([wp.lon, wp.lat]));
        if (roverData.hasPosition) b.extend([roverData.lon, roverData.lat]);

        if (waypoints.length > 0 || roverData.hasPosition) {
          map.fitBounds(b, { padding: 50 });
        }
      }, 100);

      // Notify React Native that map is ready
      setTimeout(() => {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
        }
      }, 300);
    });

    // Zoom event handlers
    map.on('zoomstart', function() {
      map.getCanvas().style.pointerEvents = 'none';
    });

    map.on('zoomend', function() {
      map.getCanvas().style.pointerEvents = '';
      map.resize();
    });

    function centerOnRover() {
      if (liveRoverPos) {
        map.flyTo({ center: [liveRoverPos.lon, liveRoverPos.lat], zoom: 17 });
      }
    }

    function toggleFullscreen() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TOGGLE_FULLSCREEN' }));
    }

    function fitToMission() {
      if (waypoints.length === 0) return;
      const b = new mapboxgl.LngLatBounds();
      waypoints.forEach(wp => b.extend([wp.lon, wp.lat]));
      map.fitBounds(b, { padding: 50, animate: true });
    }

    // Track active waypoint index
    let currentActiveIndex = waypoints.findIndex(wp => wp.isActive);
    if (currentActiveIndex === -1) currentActiveIndex = -1;

    // READ-ONLY OPTIMIZATION: Fast active waypoint update via direct DOM manipulation
    window.setActiveWaypoint = function(index) {
      if (index === currentActiveIndex) return;

      if (currentActiveIndex >= 0 && currentActiveIndex < waypointMarkers.length) {
        const prevWp = waypoints[currentActiveIndex];
        const prevMarker = waypointMarkers[currentActiveIndex];
        const prevEl = prevMarker.getElement();
        if (prevEl) {
          const svg = prevEl.querySelector('svg');
          const path = prevEl.querySelector('path');
          if (svg && path) {
            const isStart = currentActiveIndex === 0;
            const isEnd = currentActiveIndex === waypoints.length - 1;
            let fill = isStart ? '#16a34a' : (isEnd ? '#dc2626' : '#f97316');
            if (prevWp && prevWp.isCompleted) fill = '#22c55e';
            svg.setAttribute('width', '36');
            svg.setAttribute('height', '36');
            path.setAttribute('fill', fill);
          }
        }
      }

      if (index >= 0 && index < waypointMarkers.length) {
        const newWp = waypoints[index];
        const newMarker = waypointMarkers[index];
        const newEl = newMarker.getElement();
        if (newEl) {
          const svg = newEl.querySelector('svg');
          const path = newEl.querySelector('path');
          if (svg && path) {
            const isStart = index === 0;
            const isEnd = index === waypoints.length - 1;
            let fill = isStart ? '#16a34a' : (isEnd ? '#dc2626' : '#f97316');
            if (newWp && newWp.isCompleted) fill = '#22c55e';
            svg.setAttribute('width', '36');
            svg.setAttribute('height', '36');
            path.setAttribute('fill', fill);
          }
        }
      }

      currentActiveIndex = index;
    };

    // Update waypoint statuses
    window.updateWaypointStatuses = function(flags) {
      if (!Array.isArray(flags)) return;
      const n = Math.min(flags.length, waypointMarkers.length);
      for (let i = 0; i < n; i++) {
        if (waypoints[i]) waypoints[i].isCompleted = !!flags[i];
        const marker = waypointMarkers[i];
        const el = marker && marker.getElement ? marker.getElement() : null;
        if (!el) continue;
        const svg = el.querySelector('svg');
        const path = el.querySelector('path');
        if (!svg || !path) continue;
        const isStart = i === 0;
        const isEnd = i === waypoints.length - 1;
        let fill = isStart ? '#16a34a' : (isEnd ? '#dc2626' : '#f97316');
        if (flags[i]) fill = '#22c55e';
        path.setAttribute('fill', fill);
        svg.setAttribute('width', '36');
        svg.setAttribute('height', '36');
      }
    };

    // Clear all waypoint markers
    window.clearAllMarkers = function() {
      try {
        for (let i = 0; i < waypointMarkers.length; i++) {
          waypointMarkers[i]?.remove();
        }
        waypointMarkers.length = 0;
        map.getSource('mission-path')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
      } catch(e) {
        console.error('[MissionMap] clearAllMarkers error:', e);
      }
    };

    // Load waypoints from React Native
    window.loadWaypointsFromReactNative = function(wpArray) {
      try {
        const newWaypoints = Array.isArray(wpArray) ? wpArray : (typeof wpArray === 'string' ? JSON.parse(wpArray) : []);
        if (!Array.isArray(newWaypoints) || newWaypoints.length === 0) return;

        window.clearAllMarkers();

        waypoints.length = 0;
        for (let i = 0; i < newWaypoints.length; i++) {
          waypoints.push(newWaypoints[i]);
        }

        currentActiveIndex = waypoints.findIndex(wp => wp.isActive);

        if (waypoints.length > 0) {
          map.setCenter([waypoints[0].lon, waypoints[0].lat]);
          map.setZoom(15);
        }

        chunkedLoadMarkers(waypoints);

        setTimeout(function() {
          map.resize();
          const b = new mapboxgl.LngLatBounds();
          waypoints.forEach(wp => b.extend([wp.lon, wp.lat]));
          if (liveRoverPos) b.extend([liveRoverPos.lon, liveRoverPos.lat]);
          if (waypoints.length > 0 || liveRoverPos) map.fitBounds(b, { padding: 50 });
        }, 200);

        console.log('[MissionMap] Loaded ' + waypoints.length + ' waypoints from React Native');
      } catch (e) {
        console.error('[MissionMap] Failed to load waypoints:', e);
      }
    };
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
            waypoints.length = 0;
          } catch(e) { console.error('[MissionMap] Clear error:', e); }
        })();
        true;
      `);
      return;
    }

    const waypointsArray = waypoints.map((wp, idx) => {
      const wpStatus = statusMap?.[wp.sn];
      const isCompleted =
        wpStatus?.status === 'completed' || wpStatus?.status === 'skipped';
      return {
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
        isCompleted,
      };
    });

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

  // Pause/resume Mapbox rendering when visibility changes
  // This stops tile loading, marker animation, and continuous redraws when hidden
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;

    if (isVisible) {
      // Resume: resize and re-enable interactions
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            if (typeof map !== 'undefined' && map) {
              map.resize();
              map.dragPan.enable();
              map.touchZoomRotate.enable();
              map.doubleClickZoom.enable();
              map.scrollZoom.enable();
            }
          } catch(e) { console.error('[MissionMap] Resume error:', e); }
        })();
        true;
      `);
    } else {
      // Pause: disable interactions, reduce redraws
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            if (typeof map !== 'undefined' && map) {
              map.dragPan.disable();
              map.touchZoomRotate.disable();
              map.doubleClickZoom.disable();
              map.scrollZoom.disable();
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

            roverMarker = new RoverMarker([${roverLon}, ${roverLat}], { iconSVG: roverIconSVG, heading: rotation });
            roverMarker.addTo(map);
            roverMarker.setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(\`<strong>Rover</strong><br>Heading: ${heading !== null ? heading.toFixed(1) + '°' : 'N/A'}<br>Lat: ${roverLat.toFixed(7)}<br>Lon: ${roverLon.toFixed(7)}\`));
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
                // Clean up Mapbox map
                if (typeof map !== 'undefined' && map) {
                  map.remove();
                  map = null;
                }
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

  // Lightweight bridge: sync completion flags into the WebView without recreating markers.
  // Sends a boolean array aligned to the current waypoints order whenever statusMap changes.
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    if (!waypoints || waypoints.length === 0) return;
    const completedFlags = waypoints.map(
      (wp) =>
        statusMap?.[wp.sn]?.status === 'completed' ||
        statusMap?.[wp.sn]?.status === 'skipped'
    );
    webViewRef.current.injectJavaScript(
      `(function() { if (window.updateWaypointStatuses) window.updateWaypointStatuses(${JSON.stringify(
        completedFlags
      )}); })(); true;`
    );
  }, [statusMap, mapReady, waypoints]);

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

    // Calculate rover status based on armed state and RTK fix type
    const status = armed ? 'armed' : (rtkFixType >= 5 ? 'rtk' : 'disarmed');

    const updateScript = `
      (function() {
        try {
          // Update rover position
          if (roverMarker) {
            roverMarker.setLngLat([${roverLon}, ${roverLat}]);
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
          ${heading !== null ? \`
          const distance = 8; // Short heading indicator
          const earthRadius = 6371000;
          const headingRad = (\${heading || 0} * Math.PI) / 180;
          const latRad = (\${roverLat} * Math.PI) / 180;
          const lonRad = (\${roverLon} * Math.PI) / 180;

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

          map.getSource('heading-line')?.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[\${roverLon}, \${roverLat}], [endLon, endLat]] }
          });
          \` : ''}
        } catch (e) {
          console.error('Map update error:', e);
        }
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(updateScript);
  }, [roverLat, roverLon, heading, armed, rtkFixType, mapReady, isVisible]);

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
              // Fix: Mapbox initializes before WebView layout finalizes.
              // resize() forces Mapbox to re-measure its container,
              // then fitBounds re-centers correctly at actual dimensions.
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(`
                  (function() {
                    try {
                      map.resize();
                      if (waypoints.length > 0) {
                        const b = new mapboxgl.LngLatBounds();
                        waypoints.forEach(wp => b.extend([wp.lon, wp.lat]));
                        if (liveRoverPos) b.extend([liveRoverPos.lon, liveRoverPos.lat]);
                        if (waypoints.length > 0 || liveRoverPos) map.fitBounds(b, { padding: 50 });
                      } else if (liveRoverPos) {
                        map.setCenter([liveRoverPos.lon, liveRoverPos.lat]);
                        map.setZoom(17);
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
