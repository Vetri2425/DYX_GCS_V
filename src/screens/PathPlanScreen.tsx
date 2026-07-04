import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, Alert, Modal, ScrollView, TouchableOpacity, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LegendList } from '@legendapp/list';
import { colors } from '../theme/colors';
import { PathPlanWaypoint } from '../types/pathplan';
import { useRover } from '../context/RoverContext';
import { PathSequenceSidebar } from '../components/pathplan/PathSequenceSidebar';
import MissionOpsPanel from '../components/pathplan/MissionOpsPanel';
import { MissionStatistics } from '../components/pathplan/MissionStatistics';
import { PathPlanMap } from '../components/pathplan/PathPlanMap';
import { DrawingToolsPanel } from '../components/pathplan/DrawingToolsPanel';
import { CircleGeneratorDialog } from '../components/pathplan/CircleGeneratorDialog';
import { SurveyGridDialog } from '../components/pathplan/SurveyGridDialog';
import { TextAnnotationDialog } from '../components/pathplan/TextAnnotationDialog';
import { CADDrawingCanvas } from '../components/pathplan/CADDrawingCanvas';
import { ManualPathConnectionCanvas } from '../components/pathplan/ManualPathConnectionCanvas';
import { ReverseWaypointsDialog } from '../components/pathplan/ReverseWaypointsDialog';
import { CornerExtensionDialog } from '../components/pathplan/CornerExtensionDialog';
import { SolarTableDialog } from '../components/pathplan/SolarTableDialog';
import { TemplateManagerDialog } from '../components/pathplan/TemplateManagerDialog';
import { detectCorners, generateCornerExtensionWaypoints, DEFAULT_EXTENSION_OPTIONS, CornerExtensionOptions } from '../utils/cornerExtension';
import { ManualMapConnection } from '../components/pathplan/ManualMapConnection';
import { ManualConnectionChoice } from '../components/pathplan/ManualConnectionChoice';
import { ManualControlPanel } from '../components/pathplan/ManualControlPanel';
import { FailsafeModeSelector } from '../components/pathplan/FailsafeModeSelector';
import { FailsafeStrictPopup } from '../components/pathplan/FailsafeStrictPopup';
import { FailsafeRelaxNotification } from '../components/pathplan/FailsafeRelaxNotification';
import { MapVisualizationControls, MapVisualization } from '../components/pathplan/MapVisualizationControls';
import { vincentyDistance, haversineDistance, recalculateWaypointDistances, calcBearing } from '../utils/missionCalculator';
import { textToWaypointPath } from '../utils/textToPath';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { downloadFileToDevice } from '../utils/downloadHelper';
import PersistentStorage from '../services/PersistentStorage';
import {
  validateWaypoints,
  hasCriticalErrors,
  getCriticalErrors,
  getWarnings,
  formatValidationErrors,
  sanitizeWaypointsForUpload,
  ValidationError,
} from '../utils/waypointValidator';
import { CADAlignmentCanvas } from '../components/pathplan/CADAlignmentCanvas';
import { useCADAlignment } from '../application/hooks/useCADAlignment';
import { GeoPoint, Point2D } from '../core/geometry/types';
import { parseCSVChunked } from '../utils/chunkedParser';
import { parseKML as coreParseKML } from '../core/parsers/kmlParser';
import { convertToPathPlanWaypoints } from '../core/parsers/adapter';
import { useWaypointHistory } from '../hooks/pathplan/useWaypointHistory';

// ─── Virtualized preview row (memoized for LegendList recycling) ────────────
const PreviewRow = memo(({ item }: { item: PathPlanWaypoint }) => (
  <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
    <Text style={{ flex: 0.4, color: colors.text, fontSize: 11 }}>{item.id}</Text>
    <Text style={{ flex: 1.8, color: colors.text, fontFamily: 'monospace', fontSize: 10 }}>{item.lat.toFixed(6)}</Text>
    <Text style={{ flex: 1.8, color: colors.text, fontFamily: 'monospace', fontSize: 10 }}>{item.lon.toFixed(6)}</Text>
    <Text style={{ flex: 0.8, color: colors.text, fontSize: 10 }}>{item.alt?.toFixed(1) || '0.0'}</Text>
    <Text style={{ flex: 0.8, color: colors.text, fontSize: 10 }}>{(item.distance || 0).toFixed(0)}</Text>
    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 9 }}>
      {item.block || '—'}/{item.row || '—'}
    </Text>
  </View>
));

// Toggle debug logging for this screen
const DEBUG_LOG = true;

interface PathPlanScreenProps {
  isVisible?: boolean;
}

export default function PathPlanScreen({ isVisible = true }: PathPlanScreenProps) {
  const {
    telemetry,
    roverPosition,
    missionWaypoints,
    setMissionWaypoints,
    missionMode,
    gpsFailsafeMode,
    setGpsFailsafeMode,
    gpsFailsafeStatus,
    onFailsafeAcknowledge,
    onFailsafeResume,
    onFailsafeRestart,
    services,
    socket,
    showUploadPreview,
    setShowUploadPreview,
    showManualConnectionCanvas,
    setShowManualConnectionCanvas,
  } = useRover();

  const [globalServoEnabled, setGlobalServoEnabled] = useState(true);

  // Component mounted flag to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Guard to prevent re-entrant upload handling causing recursive state updates
  const isUploadingRef = useRef(false);
  // Track ongoing async operations for proper cleanup
  const pendingOperationsRef = useRef<Set<Promise<any>>>(new Set());
  // Ref to track export operations
  const exportInProgressRef = useRef(false);
  // Cleanup timers
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Cleanup helper for timers
  const addTimer = (timer: ReturnType<typeof setTimeout>) => {
    timersRef.current.add(timer);
  };

  const clearTimer = (timer: ReturnType<typeof setTimeout>) => {
    clearTimeout(timer);
    timersRef.current.delete(timer);
  };

  const clearAllTimers = () => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
  };

  // Poll servo config, but pause when app is backgrounded to avoid unnecessary
  // network requests and state updates that trigger re-renders.
  useEffect(() => {
    const { AppState } = require('react-native');

    let interval: ReturnType<typeof setInterval> | null = null;
    let appStateSubscription: any = null;

    const fetchServoConfig = async () => {
      try {
        const res: any = await services.getMissionServoConfig();
        const cfg = res?.message || res?.config || res?.data || res;
        if (typeof cfg?.servo_enabled === 'boolean') {
          setGlobalServoEnabled(cfg.servo_enabled);
        }
      } catch (err) {
        // Silently ignore — servo config fetch failure is non-critical
      }
    };

    const startPolling = () => {
      if (interval) clearInterval(interval);
      fetchServoConfig(); // Fetch immediately on start/resume
      interval = setInterval(fetchServoConfig, 2000);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    // Start polling immediately
    startPolling();

    // Pause/resume polling on app background/foreground
    appStateSubscription = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active') {
        startPolling();
      } else {
        stopPolling();
      }
    });

    return () => {
      stopPolling();
      appStateSubscription?.remove();
    };
  }, [services]);

  useEffect(() => {
    mountedRef.current = true;
    console.log('[PathPlanScreen] Component mounted');

    // App state listener to handle background/foreground transitions
    const { AppState } = require('react-native');
    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active') {
        // App returned to foreground - reset export flag if stuck
        if (exportInProgressRef.current) {
          console.log('[PathPlanScreen] App returned to foreground - resetting export flag');
          exportInProgressRef.current = false;
        }
      }
    });

    return () => {
      mountedRef.current = false;

      // Remove app state listener
      subscription?.remove();

      // Clear all pending timers
      clearAllTimers();

      // Reset operation flags
      isUploadingRef.current = false;
      exportInProgressRef.current = false;

      // Cancel pending operations (they will check mountedRef)
      pendingOperationsRef.current.clear();

      console.log('[PathPlanScreen] Component unmounting - all async operations cancelled');
    };
  }, []);

  // Use context waypoints directly - convert format on the fly
  const waypoints = React.useMemo(() =>
    (missionWaypoints as any[]).map((wp, idx) => ({
      id: wp.sn ?? wp.id ?? idx + 1,
      lat: wp.lat,
      lon: wp.lng ?? wp.lon,
      alt: wp.alt ?? 0,
      row: wp.row ?? '',
      block: wp.block ?? '',
      pile: wp.pile ?? String(idx + 1),
      distance: wp.distance ?? 0,
      mark: typeof wp.mark === 'boolean' ? wp.mark : undefined,
    })),
    [missionWaypoints]
  );

  // Update waypoints in context
  const updateWaypoints = React.useCallback((newWaypoints: PathPlanWaypoint[]) => {
    setMissionWaypoints(
      newWaypoints.map((wp, idx) => ({
        sn: wp.id,
        block: wp.block ?? '',
        row: wp.row ?? '',
        pile: wp.pile ?? String(idx + 1),
        lat: wp.lat,
        lng: wp.lon,
        lon: wp.lon,
        alt: wp.alt,
        status: 'Pending' as const,
        time: '—',
        remark: '—',
        distance: wp.distance ?? 0,
        mark: wp.mark,
      }))
    );
  }, [setMissionWaypoints]);

  // Undo/Redo history — wraps updateWaypoints for all user-initiated changes
  const { undo, redo, canUndo, canRedo, recordAndApply } = useWaypointHistory(waypoints, updateWaypoints);

  const [selectedWaypoint, setSelectedWaypoint] = useState<number | null>(null);

  // GPS Failsafe state
  const [showFailsafeModeSelector, setShowFailsafeModeSelector] = useState(false);
  const [showStrictPopup, setShowStrictPopup] = useState(false);
  const [showRelaxNotification, setShowRelaxNotification] = useState(false);
  const [failsafeEvent, setFailsafeEvent] = useState<{ wpDistCm: number; thresholdCm: number } | null>(null);

  // Sync waypoints to context only when explicitly needed (e.g., on upload)
  // Removed automatic sync to prevent infinite loop
  const [missionName, setMissionName] = useState('DRAWN MISSION - 4:15:34');
  const [uploadPreviewWaypoints, setUploadPreviewWaypoints] = useState<PathPlanWaypoint[] | null>(null);
  const [uploadPreviewName, setUploadPreviewName] = useState<string>('');
  const [uploadPreviewValidationErrors, setUploadPreviewValidationErrors] = useState<ValidationError[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showUploadProgress, setShowUploadProgress] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [showDownloadProgress, setShowDownloadProgress] = useState<boolean>(false);
  const [pathAssignmentMode, setPathAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [manualPathConnections, setManualPathConnections] = useState<number[]>([]);
  const [isConnectingPath, setIsConnectingPath] = useState<boolean>(false);
  const [showConnectionChoice, setShowConnectionChoice] = useState<boolean>(false);
  const [useMapForConnection, setUseMapForConnection] = useState<boolean>(false);

  // Drawing tools state
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null);
  const [showCircleDialog, setShowCircleDialog] = useState(false);
  const [showSurveyGridDialog, setShowSurveyGridDialog] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [showCADCanvas, setShowCADCanvas] = useState(false);
  const [showPrecisePathDialog, setShowPrecisePathDialog] = useState(false);
  const [precisePathPreview, setPrecisePathPreview] = useState<PathPlanWaypoint[] | null>(null);

  // When precise path mode is active, the map shows preview waypoints instead
  const displayedWaypoints = precisePathPreview ?? waypoints;

  const handlePrecisePathPreviewChange = React.useCallback((preview: PathPlanWaypoint[]) => {
    setPrecisePathPreview(preview);
  }, []);

  const handlePrecisePathApply = React.useCallback((optimized: PathPlanWaypoint[]) => {
    recordAndApply(optimized);
    setPrecisePathPreview(null);
    setShowPrecisePathDialog(false);
  }, [updateWaypoints]);

  const handlePrecisePathClose = React.useCallback(() => {
    setPrecisePathPreview(null);
    setShowPrecisePathDialog(false);
  }, []);

  // ── CAD Georeferencing state ──────────────────────────────
  const [isCADMode, setIsCADMode] = useState(false);
  const [showGPSInput, setShowGPSInput] = useState(false);

  const cadAlignment = useCADAlignment({
    includeLines: true,
    includePolylines: true,
    includeArcCenters: true,
    includePoints: true,
    defaultAlt: 0,
  });

  const [gpsInputA, setGpsInputA] = useState<{ lat: string; lon: string }>({ lat: '', lon: '' });
  const [gpsInputB, setGpsInputB] = useState<{ lat: string; lon: string }>({ lat: '', lon: '' });
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [showCornerExtensionDialog, setShowCornerExtensionDialog] = useState(false);
  const [showSolarTableDialog, setShowSolarTableDialog] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [homePosition, setHomePosition] = useState<{ lat: number; lng: number } | null>(null);

  // Measure tool state
  const [measurePoints, setMeasurePoints] = useState<{ lat: number; lon: number; seq: number; waypointId?: number }[]>([]);
  const [measureResult, setMeasureResult] = useState<{ distance: number; heading: number } | null>(null);

  // Clear measure state when tool changes away from measure
  React.useEffect(() => {
    if (activeDrawingTool !== 'measure') {
      setMeasurePoints([]);
      setMeasureResult(null);
    }
  }, [activeDrawingTool]);

  const handleMeasureWaypointSelect = React.useCallback((id: number) => {
    const wp = waypoints.find(w => w.id === id);
    if (!wp) return;
    setMeasurePoints(prev => {
      if (prev.length >= 2) return prev; // already have 2, clear first via ✕
      const newPts = [...prev, { lat: wp.lat, lon: wp.lon, seq: prev.length + 1, waypointId: id }];
      if (newPts.length === 2) {
        const dist = vincentyDistance(
          { lat: newPts[0].lat, lon: newPts[0].lon },
          { lat: newPts[1].lat, lon: newPts[1].lon }
        );
        const hdg = calcBearing(
          { lat: newPts[0].lat, lon: newPts[0].lon },
          { lat: newPts[1].lat, lon: newPts[1].lon }
        );
        setMeasureResult({ distance: dist, heading: hdg });
      }
      return newPts;
    });
  }, [waypoints]);

  // Manual control state
  const [showManualControl, setShowManualControl] = useState(false);

  // Full screen map state
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // Drawing tools panel collapse state
  const [isDrawingToolsCollapsed, setIsDrawingToolsCollapsed] = useState(false);

  // Map visualization controls state
  const [mapVisualization, setMapVisualization] = useState<MapVisualization>({
    distanceLabel: true,
    angleLabel: true,
    snapFeature: true,
    roverIcon: true,
    waypointPreview: true,
  });

  // Load persisted PathPlan state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const [savedHomePosition, savedDrawingMode, savedActiveTool, savedUIState, savedMapVisualization] = await Promise.all([
          PersistentStorage.loadHomePosition(),
          PersistentStorage.loadDrawingMode(),
          PersistentStorage.loadActiveTool(),
          PersistentStorage.loadPathPlanUIState(),
          PersistentStorage.loadMapVisualization(),
        ]);

        if (savedHomePosition) {
          setHomePosition(savedHomePosition);
          console.log('[PathPlanScreen] 📂 Restored home position');
        }

        if (savedDrawingMode) {
          setIsDrawingMode(savedDrawingMode);
          console.log('[PathPlanScreen] 📂 Restored drawing mode');
        }

        if (savedActiveTool) {
          setActiveDrawingTool(savedActiveTool);
          console.log('[PathPlanScreen] 📂 Restored active tool');
        }

        // Restore UI state
        if (savedUIState) {
          if (savedUIState.selectedWaypoint !== undefined) {
            setSelectedWaypoint(savedUIState.selectedWaypoint);
            console.log('[PathPlanScreen] 📂 Restored selected waypoint:', savedUIState.selectedWaypoint);
          }
          if (savedUIState.isDrawingToolsCollapsed !== undefined) {
            setIsDrawingToolsCollapsed(savedUIState.isDrawingToolsCollapsed);
            console.log('[PathPlanScreen] 📂 Restored drawing tools collapsed:', savedUIState.isDrawingToolsCollapsed);
          }
          // Map center and zoom are restored by the map component itself
        }

        // Restore map visualization settings
        if (savedMapVisualization) {
          setMapVisualization(savedMapVisualization);
          console.log('[PathPlanScreen] 📂 Restored map visualization settings');
        }
      } catch (error) {
        console.error('[PathPlanScreen] Failed to load persisted state:', error);
      }
    };

    loadPersistedState();
  }, []);

  // Listen for GPS Failsafe servo_suppressed events
  useEffect(() => {
    if (!socket) return;

    const handleServoSuppressed = (event: any) => {
      console.log('[PathPlanScreen] 🚫 Servo suppressed event received:', JSON.stringify(event, null, 2));
      console.log('[PathPlanScreen] 📋 Event details:', {
        mode: gpsFailsafeMode,
        wp_dist_cm: event.wp_dist_cm,
        xtrack_cm: event.xtrack_cm,
        threshold_cm: 6.0,
        mission_paused: event.mission_paused,
        waypoint_id: event.waypoint_id,
        timestamp: event.timestamp
      });

      setFailsafeEvent({
        wpDistCm: event.wp_dist_cm ?? 0,
        thresholdCm: 6.0,  // New threshold: 6.0 cm
      });

      console.log('[PathPlanScreen] GPS Failsafe mode:', gpsFailsafeMode);
      if (gpsFailsafeMode === 'strict') {
        console.log('[PathPlanScreen] ⚠️ STRICT MODE: Showing failsafe popup');
        console.log('[PathPlanScreen] ⚠️ Mission should be PAUSED by backend');
        setShowStrictPopup(true);
      } else if (gpsFailsafeMode === 'relax') {
        console.log('[PathPlanScreen] ℹ️ RELAX MODE: Showing failsafe notification');
        console.log('[PathPlanScreen] ℹ️ Mission continues with spray suppressed');
        setShowRelaxNotification(true);
      }
    };

    socket.on('servo_suppressed', handleServoSuppressed);
    console.log('[PathPlanScreen] 👂 Listening for servo_suppressed events');
    return () => {
      socket.off('servo_suppressed', handleServoSuppressed);
      console.log('[PathPlanScreen] 🔇 Stopped listening for servo_suppressed events');
    };
  }, [socket, gpsFailsafeMode]);

  // Consolidated auto-save using refs to prevent multiple useEffect triggers
  // This prevents infinite loops from cascading state updates
  // NOTE: selectedWaypoint is intentionally excluded from this callback's deps.
  // It's saved in a separate effect to avoid triggering 5 AsyncStorage writes
  // on every waypoint click.
  const autoSaveTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  const debouncedAutoSave = useCallback(() => {
    // Clear existing timers
    Object.values(autoSaveTimersRef.current).forEach(timer => clearTimeout(timer));
    autoSaveTimersRef.current = {};

    // Home position - 500ms debounce
    if (homePosition) {
      autoSaveTimersRef.current.homePosition = setTimeout(() => {
        PersistentStorage.saveHomePosition(homePosition).catch(error => {
          console.error('[PathPlanScreen] Failed to persist home position:', error);
        });
      }, 500);
    }

    // Drawing mode - 300ms debounce
    autoSaveTimersRef.current.drawingMode = setTimeout(() => {
      PersistentStorage.saveDrawingMode(isDrawingMode).catch(error => {
        console.error('[PathPlanScreen] Failed to persist drawing mode:', error);
      });
    }, 300);

    // Active tool - 300ms debounce
    if (activeDrawingTool) {
      autoSaveTimersRef.current.activeTool = setTimeout(() => {
        PersistentStorage.saveActiveTool(activeDrawingTool).catch(error => {
          console.error('[PathPlanScreen] Failed to persist active tool:', error);
        });
      }, 300);
    }

    // UI state (collapsed state only) - 300ms debounce
    autoSaveTimersRef.current.uiState = setTimeout(() => {
      PersistentStorage.savePathPlanUIState({
        selectedWaypoint: null, // Don't save selectedWaypoint here — saved separately
        isDrawingToolsCollapsed,
      }).catch(error => {
        console.error('[PathPlanScreen] Failed to persist UI state:', error);
      });
    }, 300);

    // Map visualization settings - 300ms debounce
    autoSaveTimersRef.current.mapVisualization = setTimeout(() => {
      PersistentStorage.saveMapVisualization(mapVisualization).catch(error => {
        console.error('[PathPlanScreen] Failed to persist map visualization settings:', error);
      });
    }, 300);
  }, [homePosition, isDrawingMode, activeDrawingTool, isDrawingToolsCollapsed, mapVisualization]);

  // Separate effect for selectedWaypoint — only saves when it actually changes,
  // avoids triggering the full debouncedAutoSave cascade on every waypoint click.
  useEffect(() => {
    const timer = setTimeout(() => {
      PersistentStorage.savePathPlanUIState({
        selectedWaypoint,
        isDrawingToolsCollapsed,
      }).catch(error => {
        console.error('[PathPlanScreen] Failed to persist selected waypoint:', error);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedWaypoint]);

  // Single consolidated useEffect for all auto-saves
  useEffect(() => {
    debouncedAutoSave();

    return () => {
      Object.values(autoSaveTimersRef.current).forEach(timer => clearTimeout(timer));
      autoSaveTimersRef.current = {};
    };
  }, [debouncedAutoSave]);

  // Toggle full screen map mode
  const toggleMapFullscreen = () => {
    setIsMapFullscreen(prev => !prev);
  };

  const handleMapPress = (coord: { latitude: number; longitude: number }) => {
    // Measure tool — collect up to 2 points, then compute distance + heading
    if (activeDrawingTool === 'measure') {
      setMeasurePoints(prev => {
        if (prev.length >= 2) return prev; // already have 2, ignore extra taps
        const newPoints = [...prev, { lat: coord.latitude, lon: coord.longitude, seq: prev.length + 1 }];
        if (newPoints.length === 2) {
          const dist = vincentyDistance(
            { lat: newPoints[0].lat, lon: newPoints[0].lon },
            { lat: newPoints[1].lat, lon: newPoints[1].lon }
          );
          const hdg = calcBearing(
            { lat: newPoints[0].lat, lon: newPoints[0].lon },
            { lat: newPoints[1].lat, lon: newPoints[1].lon }
          );
          setMeasureResult({ distance: dist, heading: hdg });
        }
        return newPoints;
      });
      return;
    }

    // Block waypoint creation when any manual connection overlay is open
    // (Android WebView can leak touch events through native overlays)
    if (showManualConnectionCanvas || isConnectingPath) {
      return;
    }

    // Point tool validation: Only create waypoints if point tool is active
    // Silently ignore if point tool is not active (no alert, no UI change)
    if (activeDrawingTool !== 'line') {
      return;
    }

    const newId = waypoints.length + 1;
    const lastWp = waypoints[waypoints.length - 1];

    const dist = lastWp
      ? vincentyDistance(
        { lat: lastWp.lat, lon: lastWp.lon },
        { lat: coord.latitude, lon: coord.longitude }
      )
      : 0;

    const newWp: PathPlanWaypoint = {
      id: newId,
      lat: coord.latitude,
      lon: coord.longitude,
      alt: 50.0,
      distance: dist,
      block: 'B1',
      row: 'R1',
      pile: String(newId),
      mark: undefined,
    };

    recordAndApply([...waypoints, newWp]);
  };

  const handleWaypointClick = (id: number) => {
    if (!isConnectingPath) return;

    // Check if waypoint is already in the connection list
    if (manualPathConnections.includes(id)) {
      Alert.alert('Already Connected', `Marking point #${id} is already in your path.`);
      return;
    }

    // Add waypoint to the connection sequence
    setManualPathConnections(prev => [...prev, id]);
  };

  const handleWaypointDrag = (id: number, coord: { latitude: number; longitude: number }) => {
    // Point tool validation: Only allow dragging if point tool is active
    // Silently ignore if point tool is not active (user can drag but changes won't register)
    if (activeDrawingTool !== 'line') {
      return;
    }

    // Update waypoint coordinates and recalculate distances
    const updatedWaypoints = waypoints.map((wp, index) => {
      if (wp.id === id) {
        // Update the dragged waypoint's coordinates
        const prevWp = index > 0 ? waypoints[index - 1] : null;
        const distance = prevWp
          ? vincentyDistance(
            { lat: prevWp.lat, lon: prevWp.lon },
            { lat: coord.latitude, lon: coord.longitude }
          )
          : 0;

        return {
          ...wp,
          lat: coord.latitude,
          lon: coord.longitude,
          distance,
        };
      } else if (index > 0 && waypoints[index - 1].id === id) {
        // Recalculate distance for the waypoint AFTER the dragged one
        const distance = vincentyDistance(
          { lat: coord.latitude, lon: coord.longitude },
          { lat: wp.lat, lon: wp.lon }
        );

        return {
          ...wp,
          distance,
        };
      }
      return wp;
    });

    recordAndApply(updatedWaypoints);
  };

  const handleDeleteWaypoint = (id: number) => {
    recordAndApply(waypoints.filter(wp => wp.id !== id));
  };

  const handleToggleMark = React.useCallback((id: number, newMarkValue: boolean) => {
    const updatedWaypoints = missionWaypoints.map(wp => {
      const wpId = wp.sn;
      return wpId === id ? { ...wp, mark: newMarkValue } : wp;
    });
    setMissionWaypoints(updatedWaypoints);
  }, [missionWaypoints, setMissionWaypoints]);

  const handleAddWaypoints = (coords: { latitude: number; longitude: number }[]) => {
    // Block adding waypoints when manual connection overlay is open
    if (showManualConnectionCanvas || isConnectingPath) {
      return;
    }

    if (coords.length === 0) {
      Alert.alert('No Marking Points', 'No coordinates to add.');
      return;
    }

    const newWaypoints = coords.map((coord, index) => {
      const newId = waypoints.length + index + 1;
      const lastWp = index === 0 && waypoints.length > 0 ? waypoints[waypoints.length - 1] : null;
      const prevWp = index > 0 ? { lat: coords[index - 1].latitude, lon: coords[index - 1].longitude } : lastWp;

      const dist = prevWp
        ? vincentyDistance(
          { lat: prevWp.lat, lon: prevWp.lon },
          { lat: coord.latitude, lon: coord.longitude }
        )
        : 0;

      return {
        id: newId,
        lat: coord.latitude,
        lon: coord.longitude,
        alt: 50.0,
        distance: dist,
        block: 'AUTO',
        row: 'SHAPE',
        pile: String(newId),
      };
    });

    if (DEBUG_LOG) console.log('[PathPlan] Adding', newWaypoints.length, 'waypoints from drawing tool');
    recordAndApply([...waypoints, ...newWaypoints]);
    setActiveDrawingTool(null); // Clear active tool after adding waypoints

    Alert.alert('Marking Points Added', `✓ ${newWaypoints.length} marking points added to mission`);
  };

  const handleTextAnnotation = (text: string, alignment: 'left' | 'center' | 'right', letterWidth: number, letterHeight: number, letterSpacing: number) => {
    const center = roverPosition ? { lat: roverPosition.lat, lng: roverPosition.lng } : { lat: 13.0827, lng: 80.2707 };

    // Generate waypoint coordinates for the text
    const textCoords = textToWaypointPath({
      text,
      centerLat: center.lat,
      centerLon: center.lng,
      letterWidth,
      letterHeight,
      letterSpacing,
      alignment,
    });

    if (textCoords.length === 0) {
      Alert.alert('No Marking Points', 'Unable to generate marking points for the given text.');
      return;
    }

    // Filter out separation markers (NaN coordinates) and convert to PathPlanWaypoint format
    const newWaypoints: PathPlanWaypoint[] = [];
    let lastValidWp: { lat: number; lon: number } | null = waypoints.length > 0 ? waypoints[waypoints.length - 1] : null;
    let wpId = waypoints.length + 1;

    for (let i = 0; i < textCoords.length; i++) {
      const coord = textCoords[i];

      // Check if this is a separation marker
      if (isNaN(coord.latitude) || isNaN(coord.longitude)) {
        // Reset distance calculation for next letter (don't connect to previous letter)
        lastValidWp = null;
        continue;
      }

      const dist = lastValidWp
        ? vincentyDistance(
          { lat: lastValidWp.lat, lon: lastValidWp.lon },
          { lat: coord.latitude, lon: coord.longitude }
        )
        : 0;

      newWaypoints.push({
        id: wpId++,
        lat: coord.latitude,
        lon: coord.longitude,
        alt: 50.0,
        distance: dist,
        block: 'TEXT',
        row: text.substring(0, 10),
        pile: String(wpId - 1),
      });

      lastValidWp = { lat: coord.latitude, lon: coord.longitude };
    }

    recordAndApply([...waypoints, ...newWaypoints]);
    Alert.alert('Text Path Created', `${newWaypoints.length} marking points generated for "${text}"`);
  };

  // Handle freehand drawing completion from DrawingCanvas
  const handleDrawingComplete = (coords: { latitude: number; longitude: number }[]) => {
    if (coords.length === 0) {
      setIsDrawingMode(false);
      return;
    }

    // Convert drawn coordinates to PathPlanWaypoint format
    // Filter out NaN separators and track path breaks for distance calculation
    const newWaypoints: PathPlanWaypoint[] = [];
    let lastValidWp: { lat: number; lon: number } | null = waypoints.length > 0 ? waypoints[waypoints.length - 1] : null;
    let wpId = waypoints.length + 1;
    let pathSegmentIndex = 1;

    if (DEBUG_LOG) console.log('[PathPlan] Drawing completed with', coords.length, 'coordinates');

    for (let i = 0; i < coords.length; i++) {
      const coord = coords[i];

      // Check if this is a NaN separator (path break)
      if (isNaN(coord.latitude) || isNaN(coord.longitude)) {
        // Reset last waypoint for next segment (don't connect across gaps)
        lastValidWp = null;
        pathSegmentIndex++;
        if (DEBUG_LOG) console.log('[PathPlan] Path break at index', i);
        continue;
      }

      // Calculate distance from previous waypoint
      const dist = lastValidWp
        ? vincentyDistance(
          { lat: lastValidWp.lat, lon: lastValidWp.lon },
          { lat: coord.latitude, lon: coord.longitude }
        )
        : 0;

      newWaypoints.push({
        id: wpId,
        lat: coord.latitude,
        lon: coord.longitude,
        alt: 50.0,
        distance: dist,
        block: 'DRAW',
        row: `S${pathSegmentIndex}`,
        pile: String(wpId),
      });

      lastValidWp = { lat: coord.latitude, lon: coord.longitude };
      wpId++;
    }

    if (newWaypoints.length > 0) {
      if (DEBUG_LOG) console.log('[PathPlan] Adding', newWaypoints.length, 'waypoints from drawing');
      recordAndApply([...waypoints, ...newWaypoints]);
      Alert.alert('Drawing Complete', `✓ ${newWaypoints.length} marking points created from your drawing`);
    } else {
      Alert.alert('No Marking Points', 'Drawing did not generate any marking points. Try drawing a longer path.');
    }

    setIsDrawingMode(false);
  };

  // Manual control handlers
  const handleOpenManualControl = () => {
    setShowManualControl(true);
  };

  const handleCloseManualControl = () => {
    setShowManualControl(false);
  };

  const handleUpdateWaypoints = (updatedWaypoints: PathPlanWaypoint[]) => {
    recordAndApply(updatedWaypoints);
  };

  // Map visualization toggle handler
  const handleMapVisualizationToggle = (key: keyof MapVisualization) => {
    setMapVisualization(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const reverseWaypointOrder = useCallback((inputWaypoints: PathPlanWaypoint[]): PathPlanWaypoint[] => {
    const reversed = [...inputWaypoints].reverse().map((wp, index) => ({
      ...wp,
      id: index + 1,
    }));

    return recalculateWaypointDistances(reversed);
  }, []);

  const handleReverseUploadPreviewWaypoints = useCallback(() => {
    setUploadPreviewWaypoints(prev => (prev ? reverseWaypointOrder(prev) : prev));
  }, [reverseWaypointOrder]);

  const handleReverseAllWaypoints = useCallback(() => {
    const reversed = reverseWaypointOrder(waypoints);
    recordAndApply(reversed);
  }, [reverseWaypointOrder, waypoints, updateWaypoints]);

  // Corner extension preview
  const [cornerExtensionOptions, setCornerExtensionOptions] = useState<CornerExtensionOptions>(DEFAULT_EXTENSION_OPTIONS);

  const cornerDetectionResult = useMemo(() => {
    if (waypoints.length < 3) return { count: 0, shortWarnings: 0 };
    const corners = detectCorners(waypoints, cornerExtensionOptions.turnAngleThreshold, cornerExtensionOptions.extensionDistance);
    return {
      count: corners.length,
      shortWarnings: corners.filter(c => c.shortSegment).length,
    };
  }, [waypoints, cornerExtensionOptions.turnAngleThreshold, cornerExtensionOptions.extensionDistance]);

  const handleApplyCornerExtension = useCallback((options: CornerExtensionOptions) => {
    if (waypoints.length < 3) {
      Alert.alert('Not Enough Waypoints', 'At least 3 waypoints are required for corner extension.');
      return;
    }
    const extended = generateCornerExtensionWaypoints(waypoints, options);
    if (extended.length === waypoints.length) {
      Alert.alert('No Corners Detected', 'No corners above the threshold were found. No extension points added.');
      return;
    }
    recordAndApply(extended);
    setShowCornerExtensionDialog(false);
    Alert.alert(
      'Corner Extension Applied',
      `${extended.length - waypoints.length} extension point(s) added. Total: ${extended.length} waypoints.`
    );
  }, [waypoints, updateWaypoints]);

  // File type validation
  const ACCEPTED_EXTENSIONS = ['waypoint', 'waypoints', 'csv', 'dxf', 'json', 'kml'];

  const validateFileExtension = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (DEBUG_LOG) console.log('[PathPlan] validateFileExtension:', { filename, ext });
    return ACCEPTED_EXTENSIONS.includes(ext);
  };

  const validateWaypoint = (wp: any, index: number): boolean => {
    const lat = Number(wp.lat);
    const lon = Number(wp.lon ?? wp.lng);
    const alt = Number(wp.alt ?? 0);

    if (isNaN(lat) || isNaN(lon) || isNaN(alt)) {
      throw new Error(`Invalid numeric values at waypoint ${index + 1}`);
    }

    if (lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude ${lat} at waypoint ${index + 1}. Must be between -90 and 90.`);
    }

    if (lon < -180 || lon > 180) {
      throw new Error(`Invalid longitude ${lon} at waypoint ${index + 1}. Must be between -180 and 180.`);
    }

    return true;
  };

  const parseQGCWaypoints = (content: string): PathPlanWaypoint[] => {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (lines.length === 0 || !lines[0].startsWith('QGC WPL')) {
      throw new Error('Invalid QGC waypoint format. File must start with "QGC WPL 110".');
    }

    const dataLines = lines.slice(1); // Skip header
    const waypoints: PathPlanWaypoint[] = [];

    dataLines.forEach((line, idx) => {
      const parts = line.split(/\t/);

      if (parts.length < 11) {
        throw new Error(`Invalid QGC waypoint format at line ${idx + 2}. Expected at least 11 tab-separated fields.`);
      }

      const lat = parseFloat(parts[8]);
      const lon = parseFloat(parts[9]);
      const alt = parseFloat(parts[10]);

      const wp = {
        lat,
        lon,
        alt: isNaN(alt) ? 0 : alt,
      };

      validateWaypoint(wp, idx);

      waypoints.push({
        id: idx + 1,
        lat,
        lon,
        alt: wp.alt,
        distance: 0,
        block: '',
        row: '',
        pile: String(idx + 1),
      });
    });

    if (DEBUG_LOG) console.log('[PathPlan] parseQGCWaypoints -> parsed', waypoints.length, waypoints.slice(0, 6));

    return waypoints;
  };

  const parseCSV = (content: string): PathPlanWaypoint[] => {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      throw new Error('CSV file must contain headers and at least one data row.');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const latIndex = headers.findIndex(h => h === 'latitude' || h === 'lat');
    const lonIndex = headers.findIndex(h => h === 'longitude' || h === 'lon' || h === 'lng');
    const altIndex = headers.findIndex(h => h === 'altitude' || h === 'alt' || h === 'elevation' || h === 'ellipsoidal height');

    // Optional field indices
    const blockIndex = headers.findIndex(h => h === 'block');
    const rowIndex = headers.findIndex(h => h === 'row');
    const pileIndex = headers.findIndex(h => h === 'pile');

    if (latIndex === -1 || lonIndex === -1) {
      throw new Error('CSV must contain "latitude" and "longitude" columns in the header.');
    }

    const waypoints: PathPlanWaypoint[] = [];
    const dataLines = lines.slice(1);

    dataLines.forEach((line, idx) => {
      const values = line.split(',').map(v => v.trim());

      if (values.length <= Math.max(latIndex, lonIndex)) {
        throw new Error(`Insufficient columns at row ${idx + 2}.`);
      }

      const lat = parseFloat(values[latIndex]);
      const lon = parseFloat(values[lonIndex]);
      const alt = altIndex !== -1 ? parseFloat(values[altIndex]) : 0;

      const wp = { lat, lon, alt: isNaN(alt) ? 0 : alt };
      validateWaypoint(wp, idx);

      waypoints.push({
        id: idx + 1,
        lat,
        lon,
        alt: wp.alt,
        distance: 0,
        block: blockIndex !== -1 && values[blockIndex] ? values[blockIndex] : '',
        row: rowIndex !== -1 && values[rowIndex] ? values[rowIndex] : '',
        pile: pileIndex !== -1 && values[pileIndex] ? values[pileIndex] : String(idx + 1),
      });
    });

    if (DEBUG_LOG) console.log('[PathPlan] parseCSV -> parsed', waypoints.length, waypoints.slice(0, 6));

    return waypoints;
  };

  const parseJSON = (content: string): PathPlanWaypoint[] => {
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      throw new Error('JSON must be an array of waypoint objects.');
    }

    if (data.length === 0) {
      throw new Error('JSON array is empty.');
    }

    const waypoints: PathPlanWaypoint[] = [];

    data.forEach((item: any, idx: number) => {
      const lat = Number(item.lat ?? item.latitude);
      const lon = Number(item.lon ?? item.lng ?? item.longitude);
      const alt = Number(item.alt ?? item.altitude ?? 0);

      const wp = { lat, lon, alt };
      validateWaypoint(wp, idx);

      waypoints.push({
        id: item.id ?? idx + 1,
        lat,
        lon,
        alt,
        distance: Number(item.distance ?? 0),
        block: item.block ?? '',
        row: item.row ?? '',
        pile: item.pile ?? String(idx + 1),
        mark: typeof item.mark === 'boolean' ? item.mark : undefined,
      });
    });

    if (DEBUG_LOG) console.log('[PathPlan] parseJSON -> parsed', waypoints.length, waypoints.slice(0, 6));

    return waypoints;
  };

  const parseKML = (content: string): PathPlanWaypoint[] => {
    // Delegate to the core KML parser (fast-xml-parser based).
    // It handles namespaces, extracts only Point geometry (skips
    // LineString/Polygon/etc.), validates XML, and preserves
    // Placemark names as pile labels.
    const result = coreParseKML(content, 'upload.kml');

    if (result.warnings.length > 0 && DEBUG_LOG) {
      result.warnings.forEach(w => console.log('[PathPlan] KML warning:', w));
    }

    if (result.valid_points === 0) {
      const detail = result.warnings.length > 0
        ? result.warnings[0]
        : 'No valid Point placemarks found';
      throw new Error(`KML import failed: ${detail}`);
    }

    const waypoints = convertToPathPlanWaypoints(result.coordinates);

    if (DEBUG_LOG) console.log('[PathPlan] parseKML -> parsed', waypoints.length, 'from', result.total_rows, 'placemarks (skipped:', result.skipped_rows, ')');

    return waypoints;
  };

  // ── DXF import is now handled via CAD Mode workflow ──────
  // The old parseDXF function that directly converted DXF
  // coordinates to GPS waypoints has been REMOVED.
  //
  // New flow:
  //   1. DXF → parseDXF() → CADModel (CAD space only)
  //   2. User selects 2 CAD points on canvas
  //   3. User enters 2 GPS points
  //   4. georeferenceCAD() → GeoEntity[] (lat/lon)
  //   5. geoEntitiesToWaypoints() → PathPlanWaypoint[]
  //
  // See: useCADAlignment hook, CADAlignmentCanvas component

  const handleDXFUpload = (content: string, fileName: string) => {
    if (DEBUG_LOG) console.log('[PathPlan] DXF file selected:', fileName, '— entering CAD mode');
    cadAlignment.loadDXF(content);
    setIsCADMode(true);
  };

  const calculateDistances = (waypoints: PathPlanWaypoint[], useFast = true): PathPlanWaypoint[] => {
    // Haversine is ~5-10x faster than Vincenty with <0.5% error.
    // Use fast mode for preview/recalculation; Vincenty for final upload accuracy.
    const distanceFn = useFast ? haversineDistance : vincentyDistance;
    return waypoints.map((wp, idx) => {
      if (idx === 0) {
        return { ...wp, distance: 0 };
      }
      const prev = waypoints[idx - 1];
      const dist = distanceFn(
        { lat: prev.lat, lon: prev.lon },
        { lat: wp.lat, lon: wp.lon }
      );
      return { ...wp, distance: dist };
    });
  };

  // Helper function to get MIME type for each export format
  const getMimeType = (format: string): string => {
    switch (format) {
      case 'qgc':
        return 'text/plain';
      case 'json':
        return 'application/json';
      case 'kml':
        return 'application/vnd.google-earth.kml+xml';
      case 'csv':
        return 'text/csv';
      case 'dxf':
        return 'application/dxf';
      default:
        return 'text/plain';
    }
  };

  // Export mission file to device storage and share
  // CRITICAL FIX: Proper async handling and cleanup to prevent crashes
  const handleExportMission = async (format: string, content: string, filename?: string) => {
    // Prevent re-entrant exports
    if (exportInProgressRef.current) {
      console.log('[PathPlan] Export already in progress, ignoring request');
      Alert.alert('Export In Progress', 'Please wait for the current export to complete.');
      return;
    }

    // Check if component is mounted
    if (!mountedRef.current) {
      console.warn('[PathPlan] Component unmounted, aborting export');
      return;
    }

    exportInProgressRef.current = true;

    // Set a safety timeout to auto-reset flag if something goes wrong
    const safetyTimer = setTimeout(() => {
      if (exportInProgressRef.current) {
        console.warn('[PathPlan] Export safety timeout - resetting flag');
        exportInProgressRef.current = false;
      }
    }, 60000); // 60 second safety timeout
    addTimer(safetyTimer);

    try {
      if (!filename) {
        filename = `mission.${format === 'qgc' ? 'waypoints' : format}`;
      }

      // Create file path in app's temporary directory
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      if (DEBUG_LOG) console.log('[PathPlan] Exporting mission as', format, 'to', fileUri);

      // CRITICAL: Validate content before writing
      if (!content || content.length === 0) {
        throw new Error('Export content is empty');
      }

      // Check mount status before async file operation
      if (!mountedRef.current) {
        console.warn('[PathPlan] Component unmounted during export setup');
        clearTimer(safetyTimer);
        return;
      }

      // Write file to temporary storage first with timeout
      const writePromise = FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('File write timeout after 10 seconds')), 10000);
        addTimer(timer);
      });

      await Promise.race([writePromise, timeoutPromise]);

      // Check mount status after file write
      if (!mountedRef.current) {
        console.warn('[PathPlan] Component unmounted after file write');
        clearTimer(safetyTimer);
        return;
      }

      if (DEBUG_LOG) console.log('[PathPlan] File written successfully:', fileUri);

      // Use downloadFileToDevice to save directly to user-selected location
      // This opens native file picker on Android (SAF) or Share dialog on iOS
      // Wrap in timeout for permission dialogs
      console.log('[PathPlan] Requesting storage permission...');

      const downloadPromise = downloadFileToDevice(fileUri, filename, getMimeType(format));
      const downloadTimeout = new Promise<boolean>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Permission/download timeout after 30 seconds')), 30000);
        addTimer(timer);
      });

      const saved = await Promise.race([downloadPromise, downloadTimeout]);

      // Final mount check before showing result
      if (!mountedRef.current) {
        console.warn('[PathPlan] Component unmounted after download');
        clearTimer(safetyTimer);
        return;
      }

      clearTimer(safetyTimer);

      if (saved) {
        if (DEBUG_LOG) console.log('[PathPlan] File saved/shared successfully');
        Alert.alert('Export Successful', `Mission exported as ${filename}`);
      } else {
        // User cancelled - no action needed
        if (DEBUG_LOG) console.log('[PathPlan] User cancelled save operation');
      }
    } catch (error) {
      console.error('[PathPlan] Export error:', error);
      clearTimer(safetyTimer);

      // Only show alert if component is still mounted
      if (mountedRef.current) {
        // Don't show alert if user cancelled
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!errorMsg.includes('cancel') && !errorMsg.toLowerCase().includes('cancelled')) {
          Alert.alert(
            'Export Failed',
            `Failed to export mission:\n${errorMsg}\n\nTip: Make sure storage permissions are granted.`,
            [
              { text: 'OK' },
              { text: 'Retry', onPress: () => handleExportMission(format, content, filename) }
            ]
          );
        }
      }
    } finally {
      // Always reset flag and clear timer
      clearTimer(safetyTimer);
      exportInProgressRef.current = false;
      console.log('[PathPlan] Export operation completed - flag reset');
    }
  };

  // Load mission waypoints from controller/backend into the PathPlan editor
  const handleLoadFromController = async () => {
    // Check if component is mounted
    if (!mountedRef.current) {
      console.warn('[PathPlan] Component unmounted, aborting load from controller');
      return;
    }

    // Show progress UI and subscribe to progress events
    setDownloadProgress(0);
    setShowDownloadProgress(true);

    const unsubscribe = services.onDownloadProgress((progress) => {
      if (mountedRef.current) {
        setDownloadProgress(progress.percent);
      }
    });

    try {
      console.log('[PathPlan] Loading mission from controller...');

      const res: any = await services.downloadMission();

      // Validate response structure
      if (!res) {
        throw new Error('No response received from controller');
      }

      const wps = res?.waypoints ?? [];

      if (!Array.isArray(wps)) {
        throw new Error('Invalid response format - waypoints should be an array');
      }

      if (wps.length === 0) {
        Alert.alert(
          'No Mission',
          'No marking points available on controller.\n\nPlease upload a mission first or create marking points manually.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Safely map waypoints with validation
      const mapped: PathPlanWaypoint[] = [];
      const errors: string[] = [];

      wps.forEach((wp: any, idx: number) => {
        try {
          const lat = Number(wp.lat ?? wp.latitude ?? 0);
          const lon = Number(wp.lon ?? wp.lng ?? wp.longitude ?? 0);
          const alt = Number(wp.alt ?? wp.altitude ?? 0);

          // Validate coordinates
          if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
            errors.push(`Waypoint ${idx + 1}: Invalid coordinates`);
            return;
          }

          if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            errors.push(`Waypoint ${idx + 1}: Coordinates out of range`);
            return;
          }

          mapped.push({
            id: wp.id ?? idx + 1,
            lat,
            lon,
            alt: isNaN(alt) ? 0 : alt,
            distance: 0,
            block: String(wp.block ?? wp.block_id ?? ''),
            row: String(wp.row ?? wp.row_no ?? ''),
            pile: String(wp.pile ?? wp.pile_no ?? idx + 1),
            mark: typeof wp.mark === 'boolean' ? wp.mark : undefined,
          });
        } catch (wpError) {
          errors.push(`Waypoint ${idx + 1}: ${wpError instanceof Error ? wpError.message : 'Parse error'}`);
        }
      });

      if (mapped.length === 0) {
        const errorMsg = errors.length > 0 ? `\n\nErrors:\n${errors.slice(0, 3).join('\n')}` : '';
        throw new Error(`No valid waypoints could be loaded.${errorMsg}`);
      }

      // Check if still mounted before updating state
      if (!mountedRef.current) {
        console.warn('[PathPlan] Component unmounted during waypoint processing');
        return;
      }

      const withDistances = calculateDistances(mapped);
      recordAndApply(withDistances);

      const warningMsg = errors.length > 0 ? `\n\nWarning: ${errors.length} waypoints had errors and were skipped.` : '';
      Alert.alert(
        'Mission Loaded',
        `Successfully loaded ${withDistances.length} marking points from controller.${warningMsg}`,
        [{ text: 'OK' }]
      );

      console.log(`[PathPlan] Loaded ${withDistances.length} waypoints from controller`);
    } catch (err) {
      console.error('[PathPlan] loadFromController error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      Alert.alert(
        'Load Failed',
        `Could not load mission from controller:\n\n${errorMessage}`,
        [
          { text: 'OK', style: 'default' },
          {
            text: 'Retry', onPress: () => {
              const timer = setTimeout(() => {
                if (mountedRef.current) {
                  handleLoadFromController();
                }
              }, 100);
              addTimer(timer);
            }, style: 'cancel'
          }
        ]
      );
    } finally {
      // Cleanup subscription and hide progress
      unsubscribe();
      setShowDownloadProgress(false);
      setDownloadProgress(0);
    }
  };

  // Load mission waypoints TO the controller (upload current waypoints to mission controller)
  const handleLoadMissionToController = async () => {
    // Check if component is mounted
    if (!mountedRef.current) {
      console.warn('[PathPlan] Component unmounted, aborting mission upload');
      return;
    }

    try {
      if (waypoints.length === 0) {
        Alert.alert(
          'No Marking Points',
          'No marking points to load to controller.\n\nPlease add marking points first by clicking on the map, importing a file, or using drawing tools.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log(`[PathPlan] Uploading ${waypoints.length} waypoints to controller...`);

      // Validate waypoints before sending
      const invalidWaypoints: number[] = [];
      waypoints.forEach((wp, idx) => {
        if (isNaN(wp.lat) || isNaN(wp.lon) || wp.lat === 0 || wp.lon === 0) {
          invalidWaypoints.push(idx + 1);
        }
      });

      if (invalidWaypoints.length > 0) {
        Alert.alert(
          'Invalid Marking Points',
          `The following marking points have invalid coordinates: ${invalidWaypoints.join(', ')}\n\nPlease fix or remove them before uploading.`,
          [{ text: 'OK' }]
        );
        return;
      }

      const controllerWaypoints = waypoints.map((wp, idx) => ({
        command: '16',
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        lat: wp.lat,
        lng: wp.lon,
        alt: wp.alt,
        frame: 3,
        current: idx === 0 ? 1 : 0,
        autocontinue: 1,
        row: wp.row || '',
        block: wp.block || '',
        pile: wp.pile || String(idx + 1),
        ...(wp.mark !== undefined && { mark: wp.mark }),
      }));

      // Show progress UI and subscribe to progress events
      setUploadProgress(0);
      setShowUploadProgress(true);

      const unsubscribe = services.onUploadProgress((progress) => {
        if (mountedRef.current) {
          setUploadProgress(progress.percent);
        }
      });

      try {
        const response = await services.loadMissionToController(controllerWaypoints);

        // Check if still mounted before updating state
        if (!mountedRef.current) {
          console.warn('[PathPlan] Component unmounted during upload');
          return;
        }

        if (response && response.success) {
          console.log(`[PathPlan] Mission uploaded successfully: ${waypoints.length} waypoints`);

          // Update context with waypoints in proper Waypoint format
          try {
            const contextWaypoints = waypoints.map((wp, idx) => ({
              sn: idx + 1,
              block: wp.block || '',
              row: wp.row || '',
              pile: wp.pile || String(idx + 1),
              lat: wp.lat,
              lon: wp.lon,
              distance: wp.distance ?? 0,
              alt: wp.alt,
              mark: wp.mark,
              status: 'Pending' as const,
              time: new Date().toISOString(),
              remark: '',
            }));
            setMissionWaypoints(contextWaypoints);
          } catch (contextError) {
            console.error('[PathPlan] Failed to update context:', contextError);
            // Non-fatal error - mission was uploaded successfully
          }

          // BUGFIX: Clear mission runtime state when loading a new mission
          // This prevents the Mission Progress tab from showing stale "mission active" state
          // that was persisted from a previous mission session
          try {
            await Promise.all([
              PersistentStorage.saveMissionActive(false),        // Reset mission active flag
              PersistentStorage.saveStatusMap({}),               // Clear old waypoint statuses
              PersistentStorage.saveMissionStartTime(null),      // Clear old start time
              PersistentStorage.saveMissionEndTime(null),        // Clear old end time
            ]);
            console.log('[PathPlan] ✅ Cleared mission runtime state for new mission upload');
          } catch (storageError) {
            console.error('[PathPlan] ⚠️ Failed to clear mission runtime state:', storageError);
            // Non-fatal error - mission was uploaded successfully
          }

          Alert.alert(
            'Upload Successful',
            `Mission loaded successfully!\n\n${waypoints.length} marking points sent to controller.`,
            [{ text: 'OK' }]
          );
        } else {
          const errorMsg = response?.message || 'Unknown error occurred';
          throw new Error(errorMsg);
        }
      } catch (uploadError) {
        console.error('[PathPlan] loadMissionToController upload error:', uploadError);
        throw uploadError;
      } finally {
        // Cleanup subscription and hide progress
        unsubscribe();
        setShowUploadProgress(false);
        setUploadProgress(0);
      }
    } catch (err) {
      console.error('[PathPlan] loadMissionToController error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);

      Alert.alert(
        'Upload Failed',
        `Could not load mission to controller:\n\n${errorMessage}\n\nPlease check your connection and try again.`,
        [
          { text: 'OK', style: 'default' },
          {
            text: 'Retry', onPress: () => {
              const timer = setTimeout(() => {
                if (mountedRef.current) {
                  handleLoadMissionToController();
                }
              }, 100);
              addTimer(timer);
            }, style: 'cancel'
          }
        ]
      );
    }
  };

  const handleRequestUpload = async () => {
    if (isUploadingRef.current) {
      // Prevent re-entrant calls that can cause stack overflows
      if (DEBUG_LOG) console.log('[PathPlan] Upload already in progress, ignoring re-entrant call');
      return;
    }

    // Guard against component unmount during async operations
    if (!mountedRef.current) {
      console.warn('[PathPlan] Component unmounted, aborting upload');
      return;
    }

    isUploadingRef.current = true;
    try {
      if (DEBUG_LOG) console.log('[PathPlan] handleRequestUpload called - opening file picker dialog');

      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: [
          'text/csv',                                      // .csv
          'application/json',                              // .json
          'application/vnd.google-earth.kml+xml',          // .kml
          'text/plain',                                    // .waypoint, .waypoints
          'application/dxf',                               // .dxf (if registered)
          'application/octet-stream',                      // fallback: .dxf, .waypoints, unknown
          '*/*',                                           // broad fallback
        ],
      });

      if (DEBUG_LOG) console.log('[PathPlan] DocumentPicker response full:', res);
      if (DEBUG_LOG) console.log('[PathPlan] DocumentPicker response keys:', Object.keys(res));
      if (DEBUG_LOG) console.log('[PathPlan] DocumentPicker response.type:', (res as any).type);

      // Check both cancelled and success states
      if ((res as any).type === 'cancel' || (res as any).cancelled === true) {
        if (DEBUG_LOG) console.log('[PathPlan] DocumentPicker was cancelled by user');
        return;
      }

      if ((res as any).type !== 'success' && !(res as any).assets) {
        if (DEBUG_LOG) console.log('[PathPlan] DocumentPicker failed or cancelled - type:', (res as any).type);
        return;
      }

      // Handle both old and new response formats
      let uri: string;
      let name: string;

      if ((res as any).assets && Array.isArray((res as any).assets) && (res as any).assets.length > 0) {
        // New format with assets array
        const asset = (res as any).assets[0];
        uri = asset.uri;
        name = asset.name || asset.uri.split('/').pop() || 'waypoint.csv';
        if (DEBUG_LOG) console.log('[PathPlan] Using new DocumentPicker format:', { uri, name });
      } else if ((res as any).uri && (res as any).name) {
        // Old format with uri and name directly
        uri = (res as any).uri;
        name = (res as any).name;
        if (DEBUG_LOG) console.log('[PathPlan] Using old DocumentPicker format:', { uri, name });
      } else {
        if (DEBUG_LOG) console.log('[PathPlan] Unexpected DocumentPicker response format');
        Alert.alert('Upload Error', 'Unable to read file selection. Please try again.');
        return;
      }

      if (DEBUG_LOG) console.log('[PathPlan] Final extracted - uri:', uri, 'name:', name);

      // Validate file extension
      if (!validateFileExtension(name)) {
        Alert.alert(
          'Unsupported File Type',
          `Please select a valid file type: ${ACCEPTED_EXTENSIONS.join(', ')}`
        );
        return;
      }

      const ext = name.split('.').pop()?.toLowerCase() || '';
      if (DEBUG_LOG) console.log('[PathPlan] Selected file metadata:', { name, ext });

      // Check if component is still mounted before async file read
      if (!mountedRef.current) {
        console.warn('[PathPlan] Component unmounted during file selection');
        return;
      }

      let content: string;
      try {
        content = await FileSystem.readAsStringAsync(uri);
        if (DEBUG_LOG) console.log('[PathPlan] File content length:', content?.length ?? 0);
      } catch (readError) {
        console.error('[PathPlan] Failed to read file:', readError);
        Alert.alert(
          'File Read Error',
          `Could not read file: ${readError instanceof Error ? readError.message : String(readError)}\n\nPlease try selecting the file again.`
        );
        return;
      }

      // Validate content before parsing
      if (!content || content.length === 0) {
        Alert.alert('Empty File', 'The selected file appears to be empty.');
        return;
      }

      let parsed: PathPlanWaypoint[] = [];

      // Parse based on file type
      if (DEBUG_LOG) console.log('[PathPlan] Parsing as extension:', ext);
      switch (ext) {
        case 'waypoint':
        case 'waypoints':
          parsed = parseQGCWaypoints(content);
          break;
        case 'csv': {
          // Use chunked parser only for very large files (1000+ rows) to avoid JS thread freeze.
          // requestIdleCallback adds 800ms-1s overhead per chunk on field tablets;
          // inline parsing handles 400 rows in ~4ms, so chunking is counterproductive below 1000.
          const csvRows = content.split(/\r?\n/).filter(Boolean).length;
          if (csvRows > 1000) {
            if (DEBUG_LOG) console.log('[PathPlan] Using chunked parser for', csvRows, 'rows');
            parsed = await parseCSVChunked(content, name);
          } else {
            parsed = parseCSV(content);
          }
          break;
        }
        case 'json':
          parsed = parseJSON(content);
          break;
        case 'kml':
          parsed = parseKML(content);
          break;
        case 'dxf':
          handleDXFUpload(content, name);
          return; // Don't continue to preview flow — CAD mode handles it
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }

      if (DEBUG_LOG) console.log('[PathPlan] Parsed waypoints:', parsed.length, parsed.slice(0, 3));

      if (!parsed || parsed.length === 0) {
        Alert.alert('Import Failed', 'No valid marking points were found in the file.');
        return;
      }

      // Calculate distances between waypoints
      const waypointsWithDistances = calculateDistances(parsed);

      // Use the already-polled globalServoEnabled state (refreshed every 2s at mount)
      // instead of re-fetching servo config here, which blocked the upload for 1.5s
      // when the backend was unreachable.
      const waypointsWithMark = waypointsWithDistances.map(wp => ({
        ...wp,
        mark: wp.mark ?? globalServoEnabled,
      }));

      if (DEBUG_LOG) console.log('[PathPlan] Waypoints with distances:', waypointsWithMark.length);

      // Validate waypoints and get errors/warnings
      const validationErrors = validateWaypoints(waypointsWithMark);
      const criticalErrors = getCriticalErrors(validationErrors);
      const warnings = getWarnings(validationErrors);

      if (DEBUG_LOG) console.log('[PathPlan] Validation result:', { total: validationErrors.length, critical: criticalErrors.length, warnings: warnings.length });

      // Show preview modal instead of immediately replacing waypoints
      if (DEBUG_LOG) console.log('[PathPlan] Setting upload preview state and showing modal...');
      setUploadPreviewWaypoints(waypointsWithMark);
      setUploadPreviewName(name);
      setUploadPreviewValidationErrors(validationErrors);

      if (DEBUG_LOG) console.log('[PathPlan] About to setShowUploadPreview(true)');
      setShowUploadPreview(true);
      if (DEBUG_LOG) console.log('[PathPlan] setShowUploadPreview(true) called - modal should now be visible');
    } catch (err) {
      console.error('[PathPlan] Import error:', err);

      // Provide user-friendly error messages
      const errorMessage = err instanceof Error ? err.message : String(err);
      let userMessage = errorMessage;

      // Add helpful guidance based on error type
      if (errorMessage.includes('coordinates')) {
        userMessage += '\n\nTip: Check that latitude and longitude values are valid numbers.';
      } else if (errorMessage.includes('format') || errorMessage.includes('extension')) {
        userMessage += '\n\nSupported formats: .waypoint, .waypoints, .csv, .json, .kml, .dxf';
      } else if (errorMessage.includes('empty')) {
        userMessage += '\n\nThe file may be corrupted or in an unsupported format.';
      }

      Alert.alert(
        'Mission Import Failed',
        userMessage,
        [
          { text: 'OK', style: 'default' },
          {
            text: 'Try Again', onPress: () => {
              const timer = setTimeout(() => {
                if (mountedRef.current) {
                  handleRequestUpload();
                }
              }, 100);
              addTimer(timer);
            }, style: 'cancel'
          }
        ]
      );
    } finally {
      // Release the guard after a short tick to avoid immediate re-entry
      const timer = setTimeout(() => {
        isUploadingRef.current = false;
      }, 0);
      addTimer(timer);
    }
  };

  const handleGPSSubmit = () => {
    const latA = parseFloat(gpsInputA.lat);
    const lonA = parseFloat(gpsInputA.lon);
    const latB = parseFloat(gpsInputB.lat);
    const lonB = parseFloat(gpsInputB.lon);

    if (isNaN(latA) || isNaN(lonA) || isNaN(latB) || isNaN(lonB)) {
      Alert.alert('Invalid GPS', 'Please enter valid latitude and longitude values for both points.');
      return;
    }

    cadAlignment.setGPSPoints(
      { lat: latA, lon: lonA },
      { lat: latB, lon: lonB }
    );
    setShowGPSInput(false);
    cadAlignment.computeAlignment();
  };

  const handleApplyCADAlignment = () => {
    if (!cadAlignment.computedWaypoints) return;

    const waypoints = cadAlignment.computedWaypoints;

    if (waypoints.length === 0) {
      Alert.alert('No Waypoints', 'No convertible entities found. The DXF may contain only unsupported entity types.');
      return;
    }

    if (pathAssignmentMode === 'manual') {
      recordAndApply(waypoints);
      setManualPathConnections([]);
      setShowConnectionChoice(true);
      Alert.alert(
        '✏️ Manual Path Mode',
        `${waypoints.length} marking points imported from CAD. Choose your connection method.`,
        [{ text: 'Choose Method' }]
      );
    } else {
      recordAndApply(waypoints);
      Alert.alert('✓ CAD Import Complete', `Successfully georeferenced ${waypoints.length} marking points.`);
    }

    // Exit CAD mode
    setIsCADMode(false);
    cadAlignment.reset();
    setGpsInputA({ lat: '', lon: '' });
    setGpsInputB({ lat: '', lon: '' });
  };

  const handleCancelCADMode = () => {
    Alert.alert(
      'Cancel CAD Alignment',
      'Are you sure you want to cancel? All alignment progress will be lost.',
      [
        { text: 'Continue', style: 'cancel' },
        {
          text: 'Cancel Alignment',
          style: 'destructive',
          onPress: () => {
            setIsCADMode(false);
            cadAlignment.reset();
            setShowGPSInput(false);
            setGpsInputA({ lat: '', lon: '' });
            setGpsInputB({ lat: '', lon: '' });
          },
        },
      ]
    );
  };

  const renderCADModeUI = () => {
    const { state, cadModel, computedWaypoints, errorMessage } = cadAlignment;

    return (
      <Modal visible={isCADMode} transparent animationType="slide" onRequestClose={handleCancelCADMode}>
        <View style={cadStyles.modalOverlay}>
          <View style={cadStyles.modalContent}>
            {/* Header */}
            <View style={cadStyles.header}>
              <MaterialCommunityIcons name="vector-polyline" size={24} color={colors.cyan} />
              <Text style={cadStyles.headerTitle}>CAD Georeferencing</Text>
              <TouchableOpacity onPress={handleCancelCADMode} style={cadStyles.closeButton}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Error State */}
            {state === 'error' && errorMessage && (
              <View style={cadStyles.errorBox}>
                <MaterialCommunityIcons name="alert-circle" size={20} color={colors.red} />
                <Text style={cadStyles.errorText}>{errorMessage}</Text>
                <TouchableOpacity style={cadStyles.errorRetryButton} onPress={handleCancelCADMode}>
                  <Text style={cadStyles.errorRetryText}>Back to Map</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CAD Canvas — shown when model is loaded */}
            {state !== 'idle' && state !== 'error' && cadModel && (
              <CADAlignmentCanvas
                model={cadModel}
                onPointsSelected={(cadA, cadB) => {
                  cadAlignment.setCADPoints(cadA, cadB);
                  setShowGPSInput(true);
                }}
                onCancel={handleCancelCADMode}
              />
            )}

            {/* Quick Align — auto-place using rover position + North */}
            {state === 'cad_loaded' && cadModel && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
                <TouchableOpacity
                  style={[cadStyles.gpsComputeButton, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                  onPress={() => {
                    const roverLat = telemetry?.global?.lat ?? 0;
                    const roverLon = telemetry?.global?.lon ?? 0;
                    cadAlignment.autoAlign({ lat: roverLat, lon: roverLon });
                    setShowGPSInput(false);
                  }}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={18} color={colors.text} />
                  <Text style={cadStyles.gpsComputeText}>Quick Align (Rover Position)</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* GPS Input Dialog */}
            {showGPSInput && (
              <View style={cadStyles.gpsInputContainer}>
                <Text style={cadStyles.sectionTitle}>Enter GPS Reference Points</Text>

                {/* Point A */}
                <View style={cadStyles.gpsRow}>
                  <Text style={cadStyles.gpsLabel}>Point A — Lat:</Text>
                  <TouchableOpacity
                    style={cadStyles.gpsInput}
                    onPress={() => {
                      // Use current rover position as default
                      const curLat = telemetry?.global?.lat?.toFixed(6) ?? '';
                      const curLon = telemetry?.global?.lon?.toFixed(6) ?? '';
                      setGpsInputA(prev => ({ ...prev, lat: curLat }));
                    }}
                  >
                    <Text style={cadStyles.gpsInputText}>{gpsInputA.lat || 'tap to use current'}</Text>
                  </TouchableOpacity>
                  <Text style={cadStyles.gpsLabel}>Lon:</Text>
                  <TouchableOpacity
                    style={cadStyles.gpsInput}
                    onPress={() => {
                      const curLon = telemetry?.global?.lon?.toFixed(6) ?? '';
                      setGpsInputA(prev => ({ ...prev, lon: curLon }));
                    }}
                  >
                    <Text style={cadStyles.gpsInputText}>{gpsInputB.lon || 'tap to use current'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Point B */}
                <View style={cadStyles.gpsRow}>
                  <Text style={cadStyles.gpsLabel}>Point B — Lat:</Text>
                  <TouchableOpacity style={cadStyles.gpsInput} onPress={() => {}}>
                    <Text style={cadStyles.gpsInputText}>{gpsInputB.lat || 'enter value'}</Text>
                  </TouchableOpacity>
                  <Text style={cadStyles.gpsLabel}>Lon:</Text>
                  <TouchableOpacity style={cadStyles.gpsInput} onPress={() => {}}>
                    <Text style={cadStyles.gpsInputText}>{gpsInputB.lon || 'enter value'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={cadStyles.gpsButtons}>
                  <TouchableOpacity style={cadStyles.gpsComputeButton} onPress={handleGPSSubmit}>
                    <Text style={cadStyles.gpsComputeText}>Compute Alignment</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Computed Result — show waypoint count and apply button */}
            {state === 'computed' && computedWaypoints && (
              <View style={cadStyles.resultBox}>
                <MaterialCommunityIcons name="check-circle" size={28} color={colors.green} />
                <Text style={cadStyles.resultTitle}>Alignment Complete</Text>
                <Text style={cadStyles.resultCount}>{computedWaypoints.length} waypoints generated</Text>

                <View style={cadStyles.resultActions}>
                  <TouchableOpacity style={cadStyles.applyButton} onPress={handleApplyCADAlignment}>
                    <MaterialCommunityIcons name="check" size={18} color={colors.text} />
                    <Text style={cadStyles.applyButtonText}>Apply to Map</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={cadStyles.retryButton} onPress={() => {
                    cadAlignment.reset();
                    setShowGPSInput(false);
                    setIsCADMode(false);
                    // Re-load the DXF
                    if (cadAlignment.cadModel) {
                      // Reset to just CAD loaded state
                      cadAlignment.loadDXF(JSON.stringify(cadAlignment.cadModel));
                    }
                  }}>
                    <Text style={cadStyles.retryText}>Start Over</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Idle / Loading state */}
            {state === 'idle' && (
              <View style={cadStyles.loadingBox}>
                <MaterialCommunityIcons name="loading" size={24} color={colors.yellow} />
                <Text style={cadStyles.loadingText}>Loading CAD drawing...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.headerBlue} barStyle="light-content" />

      {/* Main Content - full height */}
      <View style={styles.mainContent}>
        {isMapFullscreen ? (
          /* Full Screen Map Mode */
          <View style={styles.fullscreenMap}>
            <PathPlanMap
              waypoints={displayedWaypoints}
              onMapPress={showPrecisePathDialog ? undefined : handleMapPress}
              onWaypointDrag={showPrecisePathDialog ? undefined : handleWaypointDrag}
              onWaypointClick={showPrecisePathDialog ? undefined : handleWaypointClick}
              onAddWaypoints={showPrecisePathDialog ? undefined : handleAddWaypoints}
              roverPosition={roverPosition ? { lat: roverPosition.lat, lon: roverPosition.lng } : { lat: 0, lon: 0 }}
              heading={telemetry.attitude?.yaw_deg ?? null}
              activeDrawingTool={showPrecisePathDialog ? null : activeDrawingTool}
              onDrawingComplete={showPrecisePathDialog ? undefined : handleDrawingComplete}
              isDrawingMode={false}
              onToggleFullscreen={toggleMapFullscreen}
              isManualConnectionMode={isConnectingPath}
              manualConnections={manualPathConnections}
              visualization={mapVisualization}
              onVisualizationToggle={handleMapVisualizationToggle}
              measurePoints={measurePoints}
              measureResult={measureResult}
              onMeasureClear={() => { setMeasurePoints([]); setMeasureResult(null); }}
              onMeasureWaypointSelect={handleMeasureWaypointSelect}
              isVisible={isVisible}
            />
          </View>
        ) : (
          <>
            {/* Left Sidebar - 25% width */}
            <View style={styles.leftPanel}>
              <View style={{ marginBottom: 12 }}>
                <DrawingToolsPanel
                  activeDrawingTool={activeDrawingTool}
                  onToolSelect={setActiveDrawingTool}
                  onShowCircleTool={() => setShowCircleDialog(true)}
                  onShowTextTool={() => setShowTextDialog(true)}
                  onShowCADDrawing={() => setShowCADCanvas(true)}
                  onShowManualConnection={() => {
                    setActiveDrawingTool(null); // Clear drawing tool to prevent map from creating new waypoints
                    setShowManualConnectionCanvas(true);
                  }}
                  onShowReverseTool={() => setShowReverseDialog(true)}
                  onShowCornerExtension={() => setShowCornerExtensionDialog(true)}
                  onShowSolarTableTool={() => setShowSolarTableDialog(true)}
                  onShowTemplateManager={() => setShowTemplateManager(true)}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                  isCollapsed={isDrawingToolsCollapsed}
                  onToggleCollapse={() => setIsDrawingToolsCollapsed(!isDrawingToolsCollapsed)}
                  isPrecisePathActive={showPrecisePathDialog}
                  precisePathWaypoints={waypoints}
                  onPrecisePathPreviewChange={handlePrecisePathPreviewChange}
                  onPrecisePathApply={handlePrecisePathApply}
                  onPrecisePathClose={handlePrecisePathClose}
                  onPrecisePathActivate={() => setShowPrecisePathDialog(true)}
                />
              </View>
              {/* PathSequenceSidebar - Always shown; collapses the DrawingToolsPanel to free up vertical space */}
              <PathSequenceSidebar
                waypoints={isConnectingPath && manualPathConnections.length > 0
                  ? [...new Set(manualPathConnections)].map(id => waypoints.find(wp => wp.id === id)).filter(Boolean) as PathPlanWaypoint[]
                  : waypoints
                }
                selectedWaypoint={selectedWaypoint}
                onSelectWaypoint={setSelectedWaypoint}
                onDeleteWaypoint={handleDeleteWaypoint}
                onUpdateWaypoints={handleUpdateWaypoints}
                onToggleMark={handleToggleMark}
                globalServoEnabled={globalServoEnabled}
                missionName={missionName}
                onMissionNameChange={setMissionName}
                missionMode={missionMode}
                roverPosition={roverPosition ? { lat: roverPosition.lat, lon: roverPosition.lng } : null}
              />
            </View>

            {/* Center Map - flex: 1 */}
            <View style={styles.centerPanel}>
              <View style={styles.mapWrapper}>
                <PathPlanMap
                  waypoints={displayedWaypoints}
                  onMapPress={showPrecisePathDialog ? undefined : handleMapPress}
                  onWaypointDrag={showPrecisePathDialog ? undefined : handleWaypointDrag}
                  onWaypointClick={showPrecisePathDialog ? undefined : handleWaypointClick}
                  onAddWaypoints={showPrecisePathDialog ? undefined : handleAddWaypoints}
                  roverPosition={roverPosition ? { lat: roverPosition.lat, lon: roverPosition.lng } : { lat: 0, lon: 0 }}
                  heading={telemetry.attitude?.yaw_deg ?? null}
                  activeDrawingTool={activeDrawingTool}
                  onDrawingComplete={handleDrawingComplete}
                  isDrawingMode={false}
                  onToggleFullscreen={toggleMapFullscreen}
                  isManualConnectionMode={isConnectingPath}
                  manualConnections={manualPathConnections}
                  visualization={mapVisualization}
                  onVisualizationToggle={handleMapVisualizationToggle}
                  measurePoints={measurePoints}
                  measureResult={measureResult}
                  onMeasureClear={() => { setMeasurePoints([]); setMeasureResult(null); }}
              onMeasureWaypointSelect={handleMeasureWaypointSelect}
                  isVisible={isVisible}
                />
              </View>
            </View>

            {/* Manual Connection Choice Dialog */}
            <ManualConnectionChoice
              visible={showConnectionChoice}
              onSelectCanvas={() => {
                setShowConnectionChoice(false);
                setIsConnectingPath(true);
                setUseMapForConnection(false);
              }}
              onSelectMap={() => {
                setShowConnectionChoice(false);
                setIsConnectingPath(true);
                setUseMapForConnection(true);
              }}
              onCancel={() => {
                setShowConnectionChoice(false);
                setManualPathConnections([]);
              }}
            />

            {/* Manual Connection Canvas from Drawing Tools Button */}
            <ManualPathConnectionCanvas
              visible={showManualConnectionCanvas}
              waypoints={waypoints}
              roverPosition={telemetry.global?.lat ? {
                lat: telemetry.global.lat,
                lng: telemetry.global.lon,
                heading: telemetry.attitude?.yaw_deg
              } : null}
              onConnectionsComplete={(connectedIds) => {
                // Remove duplicates to prevent React key errors
                const uniqueConnectedIds = [...new Set(connectedIds)];
                setManualPathConnections(uniqueConnectedIds);

                // ONLY keep connected waypoints in order (remove unconnected ones)
                const connectedWaypoints = uniqueConnectedIds.map(id =>
                  waypoints.find(wp => wp.id === id)
                ).filter(Boolean) as PathPlanWaypoint[];

                // Recalculate distances between connected waypoints
                const waypointsWithDistances = connectedWaypoints.map((wp, idx) => {
                  if (idx === 0) {
                    return { ...wp, distance: 0 };
                  }
                  const prevWp = connectedWaypoints[idx - 1];
                  const dist = vincentyDistance(
                    { lat: prevWp.lat, lon: prevWp.lon },
                    { lat: wp.lat, lon: wp.lon }
                  );
                  return { ...wp, distance: dist };
                });

                // Update waypoints to ONLY show connected ones with recalculated distances
                recordAndApply(waypointsWithDistances);
                setShowManualConnectionCanvas(false);
                Alert.alert('✓ Path Created', `Path created with ${uniqueConnectedIds.length} marking points. Unconnected marking points removed.`);
              }}
              onCancel={() => {
                setShowManualConnectionCanvas(false);
                setActiveDrawingTool(null);
              }}
              onDeleteWaypoints={(deletedIds) => {
                const remaining = waypoints.filter(wp => !deletedIds.includes(wp.id));
                recordAndApply(remaining);
              }}
            />

            {/* Manual Path Connection Drawing Canvas */}
            {isConnectingPath && !useMapForConnection && (
              <ManualPathConnectionCanvas
                visible={isConnectingPath}
                waypoints={waypoints}
                roverPosition={telemetry.global?.lat ? {
                  lat: telemetry.global.lat,
                  lng: telemetry.global.lon,
                  heading: telemetry.attitude?.yaw_deg
                } : null}
                onConnectionsComplete={(connectedIds) => {
                  // Remove duplicates to prevent React key errors
                  const uniqueConnectedIds = [...new Set(connectedIds)];
                  setManualPathConnections(uniqueConnectedIds);

                  // ONLY keep connected waypoints in order (remove unconnected ones)
                  const connectedWaypoints = uniqueConnectedIds.map(id =>
                    waypoints.find(wp => wp.id === id)
                  ).filter(Boolean) as PathPlanWaypoint[];

                  // Recalculate distances between connected waypoints
                  const waypointsWithDistances = connectedWaypoints.map((wp, idx) => {
                    if (idx === 0) {
                      return { ...wp, distance: 0 };
                    }
                    const prevWp = connectedWaypoints[idx - 1];
                    const dist = vincentyDistance(
                      { lat: prevWp.lat, lon: prevWp.lon },
                      { lat: wp.lat, lon: wp.lon }
                    );
                    return { ...wp, distance: dist };
                  });

                  // Update waypoints to ONLY show connected ones with recalculated distances
                  recordAndApply(waypointsWithDistances);
                  setIsConnectingPath(false);
                  Alert.alert('✓ Path Created', `Path created with ${uniqueConnectedIds.length} marking points. Unconnected marking points removed.`);
                }}
                onCancel={() => {
                  setIsConnectingPath(false);
                  setManualPathConnections([]);
                }}
                onDeleteWaypoints={(deletedIds) => {
                  const remaining = waypoints.filter(wp => !deletedIds.includes(wp.id));
                  recordAndApply(remaining);
                }}
              />
            )}

            {/* Manual Map Connection */}
            {isConnectingPath && useMapForConnection && (
              <ManualMapConnection
                visible={true}
                waypoints={waypoints}
                roverPosition={telemetry.global?.lat ? {
                  lat: telemetry.global.lat,
                  lng: telemetry.global.lon,
                  heading: telemetry.attitude?.yaw_deg
                } : null}
                onConnectionsComplete={(connectedIds) => {
                  // Remove duplicates to prevent React key errors
                  const uniqueConnectedIds = [...new Set(connectedIds)];
                  setManualPathConnections(uniqueConnectedIds);

                  // ONLY keep connected waypoints in order (remove unconnected ones)
                  const connectedWaypoints = uniqueConnectedIds.map(id =>
                    waypoints.find(wp => wp.id === id)
                  ).filter(Boolean) as PathPlanWaypoint[];

                  // Recalculate distances between connected waypoints
                  const waypointsWithDistances = connectedWaypoints.map((wp, idx) => {
                    if (idx === 0) {
                      return { ...wp, distance: 0 };
                    }
                    const prev = connectedWaypoints[idx - 1];
                    const dist = vincentyDistance(
                      { lat: prev.lat, lon: prev.lon },
                      { lat: wp.lat, lon: wp.lon }
                    );
                    return { ...wp, distance: dist };
                  });

                  // Update waypoints to ONLY show connected ones with recalculated distances
                  recordAndApply(waypointsWithDistances);
                  setIsConnectingPath(false);
                  setUseMapForConnection(false);
                  Alert.alert('✓ Path Created', `Path created with ${uniqueConnectedIds.length} marking points. Unconnected marking points removed.`);
                }}
                onCancel={() => {
                  setIsConnectingPath(false);
                  setUseMapForConnection(false);
                  setManualPathConnections([]);
                }}
              />
            )}

            {/* Right Sidebar - 25% width, split into ops (top) and stats (bottom) */}
            <View style={styles.rightPanel}>
              <View style={styles.opsPanel}>
                <MissionOpsPanel
                  waypoints={waypoints}
                  roverPosition={roverPosition ? { lat: roverPosition.lat, lon: roverPosition.lng, alt: telemetry.global?.alt_rel ?? 0 } : { lat: 0, lon: 0, alt: 0 }}
                  onRequestUpload={() => {
                    // console.log('[PathPlan] onRequestUpload wrapper called');
                    handleRequestUpload();
                  }}
                  onLoadMission={handleLoadMissionToController}
                  onManualControlOpen={handleOpenManualControl}
                  onExportMission={handleExportMission}
                />
              </View>
              <View style={styles.statsPanel}>
                <MissionStatistics
                  waypoints={isConnectingPath && manualPathConnections.length > 0
                    ? manualPathConnections.map(id => waypoints.find(wp => wp.id === id)).filter(Boolean) as PathPlanWaypoint[]
                    : waypoints
                  }
                  roverPosition={roverPosition ? { lat: roverPosition.lat, lon: roverPosition.lng } : null}
                />
              </View>
            </View>
          </>
        )}
      </View>

      {/* Upload Preview Modal */}
      <Modal visible={showUploadPreview} transparent animationType="slide" onRequestClose={() => setShowUploadPreview(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 900, backgroundColor: colors.panelBg, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, maxHeight: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Import Preview</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>{uploadPreviewName} — {uploadPreviewWaypoints ? uploadPreviewWaypoints.length : 0} marking points</Text>

            {/* Path Assignment Mode Selection */}
            <View style={{ marginBottom: 16, padding: 12, backgroundColor: colors.cardBg, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Path Assignment Mode:</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setPathAssignmentMode('auto')}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    backgroundColor: pathAssignmentMode === 'auto' ? colors.blueBtn : colors.inputBg,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: pathAssignmentMode === 'auto' ? '#4ADE80' : 'transparent'
                  }}>
                  <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'center', fontSize: 12 }}>🤖 Auto</Text>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 9, marginTop: 2 }}>Sequential order</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPathAssignmentMode('manual')}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    backgroundColor: pathAssignmentMode === 'manual' ? colors.blueBtn : colors.inputBg,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: pathAssignmentMode === 'manual' ? '#4ADE80' : 'transparent'
                  }}>
                  <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'center', fontSize: 12 }}>✏️ Manual</Text>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 9, marginTop: 2 }}>Draw connections</Text>
                </TouchableOpacity>
              </View>
              {pathAssignmentMode === 'auto' && (
                <TouchableOpacity
                  onPress={handleReverseUploadPreviewWaypoints}
                  disabled={!uploadPreviewWaypoints || uploadPreviewWaypoints.length < 2}
                  style={{
                    marginTop: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    backgroundColor: (!uploadPreviewWaypoints || uploadPreviewWaypoints.length < 2) ? '#475569' : colors.blueBtn,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: (!uploadPreviewWaypoints || uploadPreviewWaypoints.length < 2) ? 0.5 : 1,
                  }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Reverse Coordinates</Text>
                </TouchableOpacity>
              )}
              {pathAssignmentMode === 'manual' && (
                <View style={{ marginTop: 10, padding: 8, backgroundColor: 'rgba(74, 222, 128, 0.1)', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#4ADE80' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    💡 Tip: In manual mode, waypoints will appear on the map without connections. Click waypoints in order to connect your custom path.
                  </Text>
                </View>
              )}
            </View>

            {/* Validation Errors/Warnings Section */}
            {uploadPreviewValidationErrors.length > 0 && (
              <View style={{ marginBottom: 12, padding: 10, backgroundColor: 'rgba(255,100,100,0.15)', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#ff6464' }}>
                <Text style={{ color: '#ff6464', fontWeight: '700', marginBottom: 6 }}>
                  ⚠️ {uploadPreviewValidationErrors.length} Issue(s) Found
                </Text>
                <ScrollView style={{ maxHeight: 120 }}>
                  {getCriticalErrors(uploadPreviewValidationErrors).length > 0 && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ color: '#ff6464', fontWeight: '600', fontSize: 12, marginBottom: 4 }}>Critical Errors:</Text>
                      {getCriticalErrors(uploadPreviewValidationErrors).slice(0, 3).map((err, idx) => (
                        <Text key={`error-${err.message}-${idx}`} style={{ color: '#ff6464', fontSize: 11, marginBottom: 2 }}>
                          • {err.message}
                        </Text>
                      ))}
                      {getCriticalErrors(uploadPreviewValidationErrors).length > 3 && (
                        <Text style={{ color: '#ff6464', fontSize: 11 }}>... and {getCriticalErrors(uploadPreviewValidationErrors).length - 3} more</Text>
                      )}
                    </View>
                  )}
                  {getWarnings(uploadPreviewValidationErrors).length > 0 && (
                    <View>
                      <Text style={{ color: '#ffaa00', fontWeight: '600', fontSize: 12, marginBottom: 4 }}>Warnings:</Text>
                      {getWarnings(uploadPreviewValidationErrors).slice(0, 3).map((warn, idx) => (
                        <Text key={`warning-${warn.message}-${idx}`} style={{ color: '#ffaa00', fontSize: 11, marginBottom: 2 }}>
                          • {warn.message}
                        </Text>
                      ))}
                      {getWarnings(uploadPreviewValidationErrors).length > 3 && (
                        <Text style={{ color: '#ffaa00', fontSize: 11 }}>... and {getWarnings(uploadPreviewValidationErrors).length - 3} more</Text>
                      )}
                    </View>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Waypoints Table — virtualized with LegendList for instant modal open */}
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Marking Point Details:</Text>
            <View style={{ maxHeight: 280, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.cardBg }}>
              <View style={{ flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ flex: 0.4, color: '#67E8F9', fontWeight: '700', fontSize: 11 }}>#</Text>
                <Text style={{ flex: 1.8, color: '#67E8F9', fontWeight: '700', fontSize: 11 }}>Latitude</Text>
                <Text style={{ flex: 1.8, color: '#67E8F9', fontWeight: '700', fontSize: 11 }}>Longitude</Text>
                <Text style={{ flex: 0.8, color: '#67E8F9', fontWeight: '700', fontSize: 11 }}>Alt(m)</Text>
                <Text style={{ flex: 0.8, color: '#67E8F9', fontWeight: '700', fontSize: 11 }}>Dist(m)</Text>
                <Text style={{ flex: 1, color: '#67E8F9', fontWeight: '700', fontSize: 11 }}>Block/Row</Text>
              </View>
              <LegendList
                data={uploadPreviewWaypoints ?? []}
                renderItem={({ item }) => <PreviewRow item={item} />}
                keyExtractor={(item) => String(item.id)}
                recycleItems
                estimatedItemSize={40}
                drawDistance={150}
                waitForInitialLayout={false}
                style={{ maxHeight: 240 }}
                contentContainerStyle={{ paddingHorizontal: 8 }}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
              <TouchableOpacity onPress={() => {
                if (uploadPreviewWaypoints) {
                  const criticalErrors = getCriticalErrors(uploadPreviewValidationErrors);

                  if (criticalErrors.length > 0) {
                    Alert.alert(
                      'Cannot Proceed',
                      `${criticalErrors.length} critical error(s) found:\n\n${formatValidationErrors(uploadPreviewValidationErrors, 3)}`,
                      [
                        { text: 'Back to Edit' },
                        {
                          text: 'Upload New File', onPress: () => {
                            setShowUploadPreview(false);
                            const timer = setTimeout(() => {
                              if (mountedRef.current) {
                                handleRequestUpload();
                              }
                            }, 200);
                            addTimer(timer);
                          }
                        }
                      ]
                    );
                    return;
                  }

                  const warnings = getWarnings(uploadPreviewValidationErrors);
                  if (warnings.length > 0) {
                    Alert.alert(
                      'Warnings Detected',
                      `${warnings.length} warning(s) found:\n\n${formatValidationErrors(uploadPreviewValidationErrors)}`,
                      [
                        { text: 'Cancel' },
                        {
                          text: 'Proceed Anyway', onPress: () => {
                            const sanitized = sanitizeWaypointsForUpload(uploadPreviewWaypoints);

                            // Close modal first for instant visual response, then apply waypoints.
                            // Without this order swap, recordAndApply (394+ object transforms +
                            // context re-render) blocks the modal close for seconds.
                            setShowUploadPreview(false);

                            // Check pathAssignmentMode even when there are warnings
                            if (pathAssignmentMode === 'manual') {
                              if (DEBUG_LOG) console.log('[PathPlan] Importing waypoints in MANUAL mode (with warnings):', sanitized.length);
                              // Defer heavy waypoint update to next frame so modal close renders first
                              requestAnimationFrame(() => {
                                recordAndApply(sanitized);
                                setManualPathConnections([]);
                                setShowConnectionChoice(true);
                              });
                              Alert.alert(
                                '✏️ Manual Path Mode',
                                `${sanitized.length} marking points imported. Choose your preferred connection method.`,
                                [{ text: 'Choose Method' }]
                              );
                            } else {
                              // Auto mode: Sequential import as usual
                              if (DEBUG_LOG) console.log('[PathPlan] Applying imported waypoints (Proceed with warnings):', sanitized.length, sanitized.slice(0, 3));
                              requestAnimationFrame(() => {
                                recordAndApply(sanitized);
                              });
                              Alert.alert('✓ Import Complete', `Successfully imported ${sanitized.length} marking points.`);
                            }
                          }
                        }
                      ]
                    );
                  } else {
                    // Handle mode-specific import
                    // Close modal first for instant visual response, then apply waypoints.
                    setShowUploadPreview(false);

                    if (pathAssignmentMode === 'manual') {
                      // Manual mode: Import waypoints without sequential ordering, enable connection mode
                      const sanitized = sanitizeWaypointsForUpload(uploadPreviewWaypoints);
                      if (DEBUG_LOG) console.log('[PathPlan] Importing waypoints in MANUAL mode:', sanitized.length);
                      requestAnimationFrame(() => {
                        recordAndApply(sanitized);
                        setManualPathConnections([]);
                        setShowConnectionChoice(true);
                      });
                      Alert.alert(
                        '✏️ Manual Path Mode',
                        `${sanitized.length} marking points imported. Choose your preferred connection method.`,
                        [{ text: 'Choose Method' }]
                      );
                    } else {
                      // Auto mode: Sequential import as usual
                      const sanitized = sanitizeWaypointsForUpload(uploadPreviewWaypoints);
                      if (DEBUG_LOG) console.log('[PathPlan] Applying imported waypoints (Proceed clean):', sanitized.length, sanitized.slice(0, 3));
                      requestAnimationFrame(() => {
                        recordAndApply(sanitized);
                      });
                      Alert.alert('✓ Import Complete', `Successfully imported ${sanitized.length} marking points.`);
                    }
                  }
                }
              }} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: colors.greenBtn, borderRadius: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>✓ Proceed</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => {
                setShowUploadPreview(false);
                const timer = setTimeout(() => {
                  if (mountedRef.current) {
                    handleRequestUpload();
                  }
                }, 200);
                addTimer(timer);
              }} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: colors.blueBtn, borderRadius: 8 }}>
                <MaterialCommunityIcons
                  name="upload-circle-outline"
                  size={20}
                  color={colors.text}
                  style={{ marginBottom: 4 }}
                />
                <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>Upload New</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => {
                setShowUploadPreview(false);
              }} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: colors.inputBg, borderRadius: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Circle Generator Dialog */}
      <CircleGeneratorDialog
        visible={showCircleDialog}
        onClose={() => setShowCircleDialog(false)}
        onGenerate={handleAddWaypoints}
        defaultCenter={
          roverPosition
            ? { lat: roverPosition.lat, lng: roverPosition.lng, alt: telemetry.global?.alt_rel ?? 30 }
            : undefined
        }
      />

      {/* Survey Grid Dialog */}
      <SurveyGridDialog
        visible={showSurveyGridDialog}
        onClose={() => setShowSurveyGridDialog(false)}
        onGenerate={handleAddWaypoints}
        defaultCenter={
          roverPosition
            ? { lat: roverPosition.lat, lng: roverPosition.lng, alt: telemetry.global?.alt_rel ?? 30 }
            : undefined
        }
      />

      {/* Solar Table Generator Dialog */}
      <SolarTableDialog
        visible={showSolarTableDialog}
        onClose={() => setShowSolarTableDialog(false)}
        onGenerate={handleAddWaypoints}
        defaultCenter={
          roverPosition
            ? { lat: roverPosition.lat, lng: roverPosition.lng }
            : undefined
        }
      />

      {/* Template Manager Dialog */}
      <TemplateManagerDialog
        visible={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        onGenerate={handleAddWaypoints}
        defaultCenter={
          roverPosition
            ? { lat: roverPosition.lat, lng: roverPosition.lng }
            : undefined
        }
      />

      {/* Text Annotation Dialog */}
      <TextAnnotationDialog
        visible={showTextDialog}
        onClose={() => setShowTextDialog(false)}
        onConfirm={handleTextAnnotation}
        defaultCenter={
          roverPosition
            ? { lat: roverPosition.lat, lng: roverPosition.lng }
            : undefined
        }
      />

      {/* CAD Drawing Canvas */}
      <CADDrawingCanvas
        visible={showCADCanvas}
        onClose={() => setShowCADCanvas(false)}
        onSaveWaypoints={(cadWaypoints) => {
          // Add waypoints to the mission using PathPlanWaypoint type
          const newWaypoints: PathPlanWaypoint[] = cadWaypoints.map((wp, index) => ({
            id: Date.now() + index,
            lat: wp.lat,
            lon: wp.lng,
            alt: 0,
            distance: 0,
            block: '',
            row: '',
            pile: String(index + 1),
          }));
          recordAndApply([...waypoints, ...newWaypoints]);
        }}
        currentPosition={roverPosition || { lat: 13.0827, lng: 80.2707 }}
        onShowSurveyGrid={() => setShowSurveyGridDialog(true)}
      />

      {/* Reverse Waypoints Dialog */}
      <ReverseWaypointsDialog
        visible={showReverseDialog}
        waypointCount={waypoints.length}
        onReverse={handleReverseAllWaypoints}
        onClose={() => setShowReverseDialog(false)}
      />

      {/* Corner Extension Dialog */}
      <CornerExtensionDialog
        visible={showCornerExtensionDialog}
        onClose={() => setShowCornerExtensionDialog(false)}
        onApply={handleApplyCornerExtension}
        waypointCount={waypoints.length}
        cornersDetected={cornerDetectionResult.count}
        shortSegmentWarnings={cornerDetectionResult.shortWarnings}
      />

      {/* Manual Control Modal */}
      <Modal
        visible={showManualControl}
        transparent={false}
        animationType="slide"
        onRequestClose={handleCloseManualControl}
      >
        <View style={{ flex: 1, backgroundColor: colors.primary }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.headerBlue }}>
            <TouchableOpacity onPress={handleCloseManualControl} style={{ padding: 8, marginRight: 8 }}>
              <Text style={{ color: colors.text, fontSize: 16 }}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Manual Control</Text>
            <View style={{ width: 60 }} />
          </View>
          <ManualControlPanel onExitManualMode={handleCloseManualControl} />
        </View>
      </Modal>

      {/* GPS Failsafe Mode Selector */}
      <FailsafeModeSelector
        visible={showFailsafeModeSelector}
        currentMode={gpsFailsafeMode}
        onModeChange={setGpsFailsafeMode}
        onClose={() => setShowFailsafeModeSelector(false)}
        disabled={['running', 'RUNNING', 'active', 'ACTIVE'].includes(telemetry.mission.status)}
      />

      {/* GPS Failsafe Strict Mode Popup */}
      {showStrictPopup && failsafeEvent && (
        <FailsafeStrictPopup
          visible={showStrictPopup}
          wpDistCm={failsafeEvent.wpDistCm}
          thresholdCm={failsafeEvent.thresholdCm}
          onAcknowledge={onFailsafeAcknowledge}
          onResume={() => {
            onFailsafeResume();
            setShowStrictPopup(false);
          }}
          onRestart={() => {
            onFailsafeRestart();
            setShowStrictPopup(false);
          }}
          onStop={() => {
            services.stopMission();
            setShowStrictPopup(false);
          }}
        />
      )}

      {/* GPS Failsafe Relax Mode Notification */}
      {showRelaxNotification && failsafeEvent && (
        <FailsafeRelaxNotification
          visible={showRelaxNotification}
          accuracyError={failsafeEvent.wpDistCm}
          threshold={failsafeEvent.thresholdCm}
          onDismiss={() => setShowRelaxNotification(false)}
        />
      )}

      {/* Mission Upload Progress Modal */}
      {showUploadProgress && (
        <View style={styles.progressOverlay}>
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Uploading Mission</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
          </View>
        </View>
      )}

      {showDownloadProgress && (
        <View style={styles.progressOverlay}>
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Downloading Mission</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(downloadProgress)}%</Text>
          </View>
        </View>
      )}

      {/* ── CAD Georeferencing Mode Overlay ─────────────────── */}
      {isCADMode && renderCADModeUI()}

    </SafeAreaView>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingTop: 12,
    gap: 12,
    paddingHorizontal: 12,
  },
  leftPanel: {
    flex: 0.5,
    width: '25%',
    height: '98%',
    backgroundColor: colors.primary,
  },
  centerPanel: {
    flex: 1,
    height: '98%',
    backgroundColor: colors.primary,
  },
  mapWrapper: {
    flex: 1,
    backgroundColor: colors.panelBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  rightPanel: {
    width: '25%',
    height: '99%',
    backgroundColor: colors.primary,
  },
  opsPanel: {
    flex: 0.46,
    backgroundColor: colors.primary,
  },
  statsPanel: {
    flex: 0.53,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  bottomBar: {
    flex: 0.30,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  // Drawing mode overlay styles
  drawingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  drawingBanner: {
    backgroundColor: 'rgba(255, 193, 7, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginHorizontal: 8,
  },
  drawingText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  drawingCancel: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  drawingCancelText: {
    color: '#333',
    fontSize: 11,
    fontWeight: '600',
  },
  fullscreenMap: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 16,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
});

// ── CAD Mode Styles ─────────────────────────────────────────
const cadStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.background + 'EE',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'monospace',
  },
  closeButton: {
    padding: 4,
  },
  errorBox: {
    backgroundColor: colors.red + '15',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: colors.red,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  errorRetryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.redBtn,
    borderRadius: 6,
  },
  errorRetryText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  gpsInputContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.background + '80',
    borderRadius: 8,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  gpsLabel: {
    color: colors.textSecondary,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
  },
  gpsInput: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 100,
  },
  gpsInputText: {
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 11,
  },
  gpsButtons: {
    marginTop: 8,
  },
  gpsComputeButton: {
    backgroundColor: colors.blueBtn,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  gpsComputeText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  resultBox: {
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.green,
    fontFamily: 'monospace',
  },
  resultCount: {
    fontSize: 14,
    color: colors.text,
    fontFamily: 'monospace',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.greenBtn,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  applyButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  retryText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  loadingBox: {
    alignItems: 'center',
    padding: 30,
    gap: 8,
  },
  loadingText: {
    color: colors.yellow,
    fontFamily: 'monospace',
    fontSize: 13,
  },
});
