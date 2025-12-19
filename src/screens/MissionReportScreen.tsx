import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, StatusBar, Text, Alert } from 'react-native';
import { colors } from '../theme/colors';
import { Toast } from '../components/shared/Toast';
import { VehicleStatusCard } from '../components/missionreport/VehicleStatusCard';
import { MissionProgressCard } from '../components/missionreport/MissionProgressCard';
import { SystemStatusPanel } from '../components/missionreport/SystemStatusPanel';
import { WaypointsTable } from '../components/missionreport/WaypointsTable';
import { MissionMap } from '../components/missionreport/MissionMap';
import { Mode, VehicleStatus, Waypoint } from '../components/missionreport/types';
import { RTKInjectionScreen } from '../components/missionreport/RTKInjectionScreen';
import { useRover } from '../context/RoverContext';
import { AutoAssignDialog } from '../components/missionreport/AutoAssignDialog';
import { WaypointPreviewDialog } from '../components/missionreport/WaypointPreviewDialog';
import { MissionCompletionDialog } from '../components/missionreport/MissionCompletionDialog';
import { LogClearDialog } from '../components/missionreport/LogClearDialog';
import { MissionStartConfirmationDialog } from '../components/missionreport/MissionStartConfirmationDialog';
import { useScreenReadiness } from '../hooks/useComponentReadiness';
import PersistentStorage from '../services/PersistentStorage';

// Layout constants — change these to adjust the overall layout quickly
const LEFT_PANEL_WIDTH = '21%';
const RIGHT_PANEL_WIDTH = '23%';
const TOP_ROW_FLEX = 0.7; // fraction for top (columns) vs bottom table
const BOTTOM_ROW_FLEX = 0.29;
const COLUMN_GAP = 5; // horizontal gap between columns
const PANEL_PADDING_H = 3; // horizontal padding for left/right panels
const PANEL_PADDING_V = 8; // vertical padding for left/right panels

// Status map type matching web application
type WpStatus = {
  reached?: boolean;
  marked?: boolean;
  status?: 'completed' | 'loading' | 'skipped' | 'reached' | 'marked' | 'pending';
  timestamp?: string;
  pile?: string | number;
  rowNo?: string | number;
  remark?: string;
};

export default function MissionReportScreen() {
  const DEBUG_MISSION_LOGS = false;
  const missionLog = (...args: any[]) => {
    if (DEBUG_MISSION_LOGS) console.log(...args);
  };
  const { telemetry, roverPosition, services, onMissionEvent, connectionState, missionWaypoints, setMissionWaypoints, clearMissionWaypoints, missionMode, setMissionMode } = useRover();
  const [mode, setMode] = useState<Mode>('AUTO');
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [statusMap, setStatusMap] = useState<Record<number, WpStatus>>({});
  
  // Track screen readiness - prevents user actions until all components initialized
  const { isReady: screenReady } = useScreenReadiness(
    'mission-report-screen',
    'Mission Report Screen',
    async (setProgress) => {
      setProgress(20, 'Loading waypoints...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setProgress(40, 'Initializing telemetry...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setProgress(60, 'Setting up map...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setProgress(80, 'Connecting services...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Screen ready
    },
    true, // critical
    [] // No dependencies
  );
  
  // Mission log persistence states
  const [previousMissionData, setPreviousMissionData] = useState<{
    waypoints: Waypoint[];
    statusMap: Record<number, WpStatus>;
    missionMode: string | null;
    startTime: Date | null;
    endTime: Date | null;
  } | null>(null);
  const [hasPendingMissionStart, setHasPendingMissionStart] = useState(false);
  const [notification, setNotification] = useState<{ visible: boolean; type: 'success' | 'error' | 'info'; title?: string; message?: string }>({ visible: false, type: 'info', title: undefined, message: undefined });
  
  // Dialog states for mission upload workflow
  const [showAutoAssignDialog, setShowAutoAssignDialog] = useState(false);
  const [showWaypointPreviewDialog, setShowWaypointPreviewDialog] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isUploadingMission, setIsUploadingMission] = useState(false);
  
  // Mission completion dialog state
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showClearLogsDialog, setShowClearLogsDialog] = useState(false); // Post-export clear logs dialog
  const [missionStartTime, setMissionStartTime] = useState<Date | null>(null);
  const [missionEndTime, setMissionEndTime] = useState<Date | null>(null);
  const [isMissionActive, setIsMissionActive] = useState(false); // Track if mission is currently running
  
  // Mission start confirmation dialog state
  const [showStartConfirmationDialog, setShowStartConfirmationDialog] = useState(false);
  
  // Full screen map state
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // RTK Injection overlay
  const [showRTKInjection, setShowRTKInjection] = useState(false);

  // Toggle full screen map mode
  const toggleMapFullscreen = () => {
    setIsMapFullscreen(prev => !prev);
  };

  const openRTKInjection = () => setShowRTKInjection(true);
  const closeRTKInjection = () => setShowRTKInjection(false);
  
  // TRAIL DISABLED: Trail tracking for rover path visualization
  // const [trailPoints, setTrailPoints] = useState<Array<{ latitude: number; longitude: number }>>([]);
  // const MAX_TRAIL_POINTS = 500;

  // Ref to track notification timeout for cleanup
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use waypoints from shared context for persistence across screens
  const waypoints = missionWaypoints;
  const PINNED_COUNT = 4;

  // Check if showing previous mission data
  const isShowingPreviousMission = previousMissionData && !isMissionActive && Object.keys(statusMap).length === 0;

  // Refs to store latest values for mission event handler (prevents stale closures)
  const waypointsRef = useRef(waypoints);
  const statusMapRef = useRef(statusMap);
  const missionStartTimeRef = useRef(missionStartTime);
  const missionEndTimeRef = useRef(missionEndTime);
  const isMissionActiveRef = useRef(isMissionActive);
  const missionModeRef = useRef(missionMode);

  // Keep refs in sync with state
  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);
  
  useEffect(() => {
    statusMapRef.current = statusMap;
  }, [statusMap]);
  
  useEffect(() => {
    missionStartTimeRef.current = missionStartTime;
  }, [missionStartTime]);
  
  useEffect(() => {
    missionEndTimeRef.current = missionEndTime;
  }, [missionEndTime]);
  
  useEffect(() => {
    isMissionActiveRef.current = isMissionActive;
  }, [isMissionActive]);
  
  useEffect(() => {
    missionModeRef.current = missionMode;
  }, [missionMode]);

  const showNotification = (type: 'success' | 'error' | 'info', title: string, message?: string, duration = 3000) => {
    // Clear any existing notification timeout to prevent memory leaks
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    setNotification({ visible: true, type, title, message });
    notificationTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setNotification(prev => ({ ...prev, visible: false }));
      }
      notificationTimeoutRef.current = null;
    }, duration);
  };

  // Check for missing Block/Row/Pile fields in waypoints
  const checkMissingFields = (): string[] => {
    const missing: string[] = [];
    let hasRow = false;
    let hasBlock = false;
    let hasPile = false;

    waypoints.forEach(wp => {
      if (wp.row) hasRow = true;
      if (wp.block) hasBlock = true;
      if (wp.pile) hasPile = true;
    });

    if (!hasRow) missing.push('Row');
    if (!hasBlock) missing.push('Block');
    if (!hasPile) missing.push('Pile');

    return missing;
  };

  // Auto-assign sequence numbers to missing fields
  const handleAutoAssignSequence = () => {
    setShowAutoAssignDialog(false);

    try {
      const updatedWaypoints = waypoints.map((wp, idx) => ({
        ...wp,
        row: wp.row || `R${idx + 1}`,
        block: wp.block || 'B1',
        pile: wp.pile || `${idx + 1}`,
      }));

      setMissionWaypoints(updatedWaypoints);
      showNotification('success', 'Success', 'Sequence numbers auto-assigned successfully!');
      
      // Show preview dialog after auto-assignment
      const previewTimer = setTimeout(() => {
        if (mountedRef.current) {
          setShowWaypointPreviewDialog(true);
        }
      }, 100);

      // Cleanup timer (though component should be mounted, this is defensive)
      return () => clearTimeout(previewTimer);
    } catch (error) {
      console.error('[MissionReportScreen] Auto-assign error:', error);
      showNotification('error', 'Error', 'Failed to auto-assign sequence numbers');
    }
  };

  // Proceed without auto-assignment
  const handleProceedWithoutAssign = () => {
    setShowAutoAssignDialog(false);
    setShowWaypointPreviewDialog(true);
  };

  // Confirm and upload mission to controller
  const handleConfirmUpload = async () => {
    setShowWaypointPreviewDialog(false);
    setIsUploadingMission(true);

    try {
      console.log('[MissionReportScreen] Uploading mission to controller...');
      
      // Load waypoints to mission controller
      const response = await services.loadMissionToController(waypoints as any);
      
      if (response.success) {
        console.log('[MissionReportScreen] Mission uploaded successfully');
        showNotification('success', 'Success', 'Mission uploaded successfully!');
      } else {
        console.error('[MissionReportScreen] Upload failed:', response.message);
        showNotification('error', 'Error', response.message || 'Failed to upload mission');
      }
    } catch (error) {
      console.error('[MissionReportScreen] Upload Error:', error);
      showNotification('error', 'Error', 'Failed to upload mission');
    } finally {
      setIsUploadingMission(false);
    }
  };

  // Debug waypoints setup
  React.useEffect(() => {
    missionLog('[MissionReportScreen] Waypoints updated:', {
      count: waypoints.length,
      waypoints: waypoints.map(wp => ({ sn: wp.sn, status: wp.status }))
    });
  }, [waypoints]);

  // Debug current waypoint tracking
  React.useEffect(() => {
    const currentWaypointNumber = currentIndex !== null ? currentIndex + 1 : null;
    missionLog('[MissionReportScreen] Current waypoint tracking:', {
      currentIndex,
      currentWaypointNumber,
      waypoints_count: waypoints.length,
      target_waypoint: currentWaypointNumber ? waypoints.find(wp => wp.sn === currentWaypointNumber) : null
    });
  }, [currentIndex, waypoints]);

  // LIVE UPDATE FIX: Fetch fresh statusMap when component mounts or focus returns (handles tab switching)
  // This ensures table shows live data instead of stale/memorized data
  useEffect(() => {
    console.log('[MissionReportScreen] 🔄 Component mounted/focused - verifying live data');
    // StatusMap is updated via real-time socket events
    // No explicit fetch needed - socket listener will update it
    // This useEffect serves as a lifecycle marker for debugging
  }, []);

  // STALE STATUS CLEANUP: Clear old waypoint statuses that are no longer current
  // When rover moves from point 5 to point 9, clear marks from points that won't be revisited
  useEffect(() => {
    if (!isMissionActive || waypoints.length === 0 || currentIndex === null) return;

    // Only clean up old statuses during active missions
    const currentWaypointSn = currentIndex + 1; // Convert 0-based index to 1-based SN
    
    // Create a new statusMap keeping only:
    // 1. Current waypoint + next waypoint
    // 2. All waypoints that were already marked as completed/skipped (don't remove mission history)
    const newStatusMap = { ...statusMap };
    let hasChanges = false;

    Object.keys(statusMap).forEach(snStr => {
      const sn = parseInt(snStr, 10);
      const status = statusMap[sn];
      
      // Keep statuses that are completed or skipped (mission history)
      if (status?.status === 'completed' || status?.status === 'skipped') {
        return; // Keep this entry
      }
      
      // For waypoints with reached/loading/pending/marked status:
      // Only keep if they're current or next waypoint
      if (sn !== currentWaypointSn && sn !== currentWaypointSn + 1) {
        // This is an old reached/marked status that's no longer relevant
        // Remove it to keep table clean during mission progress
        if (status?.status === 'reached' || status?.status === 'marked') {
          delete newStatusMap[sn];
          hasChanges = true;
          console.log(`[MissionReportScreen] 🗑️ Cleaned up stale "${status.status}" status for waypoint ${sn}`);
        }
      }
    });

    // Update statusMap only if we removed old statuses
    if (hasChanges) {
      setStatusMap(newStatusMap);
    }
  }, [currentIndex, isMissionActive, waypoints, statusMap]);

  // IDLE STATE RESET: When mission ends, reset statusMap to show pending instead of keeping completed
  // This ensures idle state shows clean "pending" or "-" status instead of old "completed/reached"
  useEffect(() => {
    if (isMissionActive) return; // Only reset when NOT active

    // If statusMap has entries but mission is idle, it means mission just ended
    if (Object.keys(statusMap).length > 0 && !isShowingPreviousMission) {
      console.log('[MissionReportScreen] 🔄 Mission ended - resetting statusMap to pending state');
      setStatusMap({});
    }
  }, [isMissionActive, isShowingPreviousMission, statusMap]);

  const handleReorder = (fromIndex: number, direction: 'up' | 'down') => {
    // Only allow reordering of indices >= PINNED_COUNT and keep them >= PINNED_COUNT
    if (fromIndex < PINNED_COUNT) return;
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < PINNED_COUNT || toIndex >= waypoints.length) return;
    const next = waypoints.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    // Recompute S/N if desired (optional)
    setMissionWaypoints(next.map((wp, i) => ({ ...wp, sn: i + 1 })));
  };

  // ✅ FIX: Depend on entire telemetry object to ensure live updates (matches DYX-GCS source)
  const vehicleStatus = useMemo((): VehicleStatus => {
    missionLog('[MissionReportScreen] 🔄 Recomputing vehicleStatus with telemetry:', {
      battery: telemetry.battery.percentage,
      gps: telemetry.rtk.fix_type,
      satellites: telemetry.global.satellites_visible,
      hrms: telemetry.hrms,
      vrms: telemetry.vrms,
    });
    return {
      battery: `${telemetry.battery.percentage.toFixed(1)}% (${telemetry.battery.voltage.toFixed(2)}V)`,
      gps: getFixTypeLabel(telemetry.rtk.fix_type),
      satellites: telemetry.global.satellites_visible,
      satelliteSignal: `${telemetry.global.satellites_visible}/10`,
      hrms: `${telemetry.hrms.toFixed(3)} m`,
      vrms: `${telemetry.vrms.toFixed(3)} m`,
      imu: telemetry.imu_status,
      mode: telemetry.state?.mode || 'UNKNOWN',
    };
  }, [telemetry]);

  // ✅ FIX: Depend on entire objects to ensure live updates (matches DYX-GCS pattern)
  const mapProps = useMemo(() => {
    const props = {
      roverLat: roverPosition?.lat ?? 0,
      roverLon: roverPosition?.lng ?? 0,
      heading: telemetry.attitude?.yaw_deg ?? null,
      armed: telemetry.state?.armed ?? false,
      rtkFixType: telemetry.rtk?.fix_type ?? 0,
    };

    // Debug log map props updates (10% sample rate)
    if (DEBUG_MISSION_LOGS && Math.random() < 0.1) {
      missionLog('[MissionReportScreen] 📍 Map props updated:', {
        lat: props.roverLat.toFixed(7),
        lon: props.roverLon.toFixed(7),
        heading: props.heading !== null ? props.heading.toFixed(1) + '°' : 'N/A',
        armed: props.armed,
        rtkFixType: props.rtkFixType,
      });
    }

    return props;
  }, [roverPosition, telemetry]);

  // Calculate marked waypoints count from real-time statusMap
  const markedCount = useMemo(() => {
    const count = Object.values(statusMap).filter(
      status => status.status === 'completed' || status.status === 'marked'
    ).length;

    // Debug logging for statusMap changes
    if (Object.keys(statusMap).length > 0) {
      missionLog('[MissionReportScreen] StatusMap update:', {
        totalStatuses: Object.keys(statusMap).length,
        markedCount: count,
        statusMap: Object.entries(statusMap).reduce((acc, [key, status]) => {
          acc[key] = status.status;
          return acc;
        }, {} as Record<string, string | undefined>)
      });
    }

    return count;
  }, [statusMap]);

  // Automatically derive currentIndex from statusMap to keep UI in sync
  // This fixes the issue where currentIndex gets stuck even though statusMap updates correctly
  useEffect(() => {
    if (waypoints.length === 0) return;

    // Find the first waypoint that is NOT completed or skipped
    // This represents the current active waypoint
    let derivedIndex: number | null = null;

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const wpStatus = statusMap[wp.sn];

      // If no status exists, this is the current waypoint (not yet reached)
      if (!wpStatus) {
        derivedIndex = i;
        break;
      }

      // If status is not completed/skipped, this is the current waypoint
      if (wpStatus.status !== 'completed' && wpStatus.status !== 'skipped') {
        derivedIndex = i;
        break;
      }
    }

    // If all waypoints are completed/skipped, set to null (mission complete)
    if (derivedIndex === null && waypoints.length > 0) {
      const allCompleted = waypoints.every(wp => {
        const wpStatus = statusMap[wp.sn];
        return wpStatus && (wpStatus.status === 'completed' || wpStatus.status === 'skipped');
      });

      if (!allCompleted) {
        // Mission not started yet, keep currentIndex as is
        return;
      }
    }

    // Only update if the derived index is different from current
    setCurrentIndex(prev => {
      if (prev !== derivedIndex) {
        missionLog(`[MissionReportScreen] 🔄 Auto-derived currentIndex from statusMap: ${prev} -> ${derivedIndex} (waypoint #${derivedIndex !== null ? derivedIndex + 1 : 'null'})`);
        return derivedIndex;
      }
      return prev;
    });
  }, [statusMap, waypoints]);

  // Separate effect to handle mission completion detection without circular dependencies
  // Using refs to avoid infinite loops - only triggers when currentIndex becomes null
  useEffect(() => {
    // Check for mission completion: currentIndex is null, all waypoints completed, and mission is active
    if (currentIndex === null && waypointsRef.current.length > 0 && isMissionActiveRef.current) {
      const allCompleted = waypointsRef.current.every(wp => {
        const wpStatus = statusMapRef.current[wp.sn];
        return wpStatus && (wpStatus.status === 'completed' || wpStatus.status === 'skipped');
      });

      if (allCompleted && !missionEndTimeRef.current) {
        console.log('[MissionReportScreen] 🏁 Mission completion detected - all waypoints processed!');

        // Set mission start time if not set (fallback)
        if (!missionStartTimeRef.current) {
          console.log('[MissionReportScreen] ⚠️ Mission start time missing, using fallback (1 minute ago)');
          setMissionStartTime(new Date(Date.now() - 60000));
        }

        const completionTime = new Date();
        setMissionEndTime(completionTime);

        // CRITICAL: Mark mission as inactive to reset START/STOP button
        setIsMissionActive(false);
        console.log('[MissionReportScreen] ✅ isMissionActive set to false - button should reset to START');

        // Preserve mission data for export access
        preserveCurrentMission.current();

        // Show completion notification
        showNotification('success', 'Mission Completed', 'All marking points have been processed!');

        // Show completion dialog after a brief delay to ensure UI updates
        const completionTimer = setTimeout(() => {
          if (mountedRef.current) {
            setShowCompletionDialog(true);
          }
        }, 1000);

        // Cleanup timer on unmount or re-run
        return () => clearTimeout(completionTimer);
      }
    }
  }, [currentIndex]);

  // TRAIL DISABLED: WEB APP STYLE: Trail system with timestamps, fading, and smart filtering
  // const trailPointsRef = useRef<Array<{lat: number, lng: number, timestamp: number}>>([]);
  // const lastTrailUpdateRef = useRef<number>(0);
  // const TRAIL_UPDATE_THROTTLE_MS = 100; // Update every 100ms like web app
  // const MIN_TRAIL_DISTANCE_M = 1.5; // Minimum distance between permanent points
  // const TRAIL_FADE_START_SEC = 15; // Start fading after 15 seconds
  // const TRAIL_MAX_AGE_SEC = 30; // Remove points older than 30 seconds

  // TRAIL DISABLED: Update trail when rover position changes (web app style)
  // useEffect(() => {
  //   if (roverPosition && roverPosition.lat && roverPosition.lng) {
  //     const now = Date.now();
  //     
  //     // Smart trail filtering with Haversine distance calculation
  //     const shouldAddTrailPoint = (() => {
  //       if (trailPointsRef.current.length === 0) return true;
  //
  //       const lastPoint = trailPointsRef.current[trailPointsRef.current.length - 1];
  //       const timeSinceLastPoint = now - lastTrailUpdateRef.current;
  //
  //       if (timeSinceLastPoint < TRAIL_UPDATE_THROTTLE_MS) return false;
  //
  //       // Haversine distance calculation (meters)
  //       const R = 6371000; // Earth radius in meters
  //       const lat1 = lastPoint.lat * Math.PI / 180;
  //       const lat2 = roverPosition.lat * Math.PI / 180;
  //       const deltaLat = (roverPosition.lat - lastPoint.lat) * Math.PI / 180;
  //       const deltaLng = (roverPosition.lng - lastPoint.lng) * Math.PI / 180;
  //
  //       const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
  //                Math.cos(lat1) * Math.cos(lat2) *
  //                Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
  //       const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  //       const distance = R * c;
  //
  //       return distance >= MIN_TRAIL_DISTANCE_M;
  //     })();
  //
  //     if (shouldAddTrailPoint) {
  //       trailPointsRef.current.push({
  //         lat: roverPosition.lat,
  //         lng: roverPosition.lng,
  //         timestamp: now
  //       });
  //       lastTrailUpdateRef.current = now;
  //     }
  //
  //     // Remove old trail points (older than TRAIL_MAX_AGE_SEC)
  //     const maxAgeMs = TRAIL_MAX_AGE_SEC * 1000;
  //     trailPointsRef.current = trailPointsRef.current.filter(p => (now - p.timestamp) < maxAgeMs);
  //
  //     // Keep only MAX_TRAIL_POINTS
  //     if (trailPointsRef.current.length > MAX_TRAIL_POINTS) {
  //       trailPointsRef.current = trailPointsRef.current.slice(-MAX_TRAIL_POINTS);
  //     }
  //
  //     // Convert to format expected by MissionMap with fading
  //     const trailWithFading = trailPointsRef.current.map(p => {
  //       const ageSeconds = (now - p.timestamp) / 1000;
  //       let opacity = 1.0;
  //
  //       // Start fading after TRAIL_FADE_START_SEC
  //       if (ageSeconds > TRAIL_FADE_START_SEC) {
  //         const fadeProgress = (ageSeconds - TRAIL_FADE_START_SEC) / (TRAIL_MAX_AGE_SEC - TRAIL_FADE_START_SEC);
  //         opacity = Math.max(0.1, 1.0 - fadeProgress);
  //       }
  //
  //       return {
  //         latitude: p.lat,
  //         longitude: p.lng,
  //         opacity: opacity,
  //         timestamp: p.timestamp
  //       };
  //     });
  //
  //     // Only update trailPoints state when the trail actually changes (new point added or old point removed)
  //     // Don't trigger updates on every position change - this prevents unnecessary re-renders
  //     setTrailPoints(trailWithFading);
  //   }
  // }, [roverPosition]);

  // Preserve current mission data as previous mission (for export access)
  // Using a stable ref callback that always has access to current values
  const preserveCurrentMission = useRef(() => {
    const wps = waypointsRef.current;
    const sMap = statusMapRef.current;
    if (wps.length > 0 || Object.keys(sMap).length > 0) {
      console.log('[MissionReportScreen] Preserving current mission data for export access');
      setPreviousMissionData({
        waypoints: [...wps],
        statusMap: { ...sMap },
        missionMode: missionModeRef.current,
        startTime: missionStartTimeRef.current,
        endTime: missionEndTimeRef.current,
      });
    }
  });

  // Get mission data for display (current or previous)
  const getDisplayMissionData = () => {
    // If we have a completed previous mission and no current mission activity, show previous
    if (previousMissionData && !isMissionActive && Object.keys(statusMap).length === 0) {
      return {
        waypoints: previousMissionData.waypoints,
        statusMap: previousMissionData.statusMap,
        missionMode: previousMissionData.missionMode,
        startTime: previousMissionData.startTime,
        endTime: previousMissionData.endTime,
      };
    }
    // Otherwise show current mission data
    return {
      waypoints,
      statusMap,
      missionMode,
      startTime: missionStartTime,
      endTime: missionEndTime,
    };
  };

  // Calculate mission statistics for completion dialog
  const getMissionStats = () => {
    const displayData = getDisplayMissionData();
    const totalWaypoints = displayData.waypoints.length;
    const completedWaypoints = displayData.waypoints.filter(wp => {
      const wpStatus = displayData.statusMap[wp.sn];
      return wpStatus && wpStatus.status === 'completed';
    }).length;
    const skippedWaypoints = displayData.waypoints.filter(wp => {
      const wpStatus = displayData.statusMap[wp.sn];
      return wpStatus && wpStatus.status === 'skipped';
    }).length;

    const formatTime = (date: Date | null) => {
      if (!date) return 'N/A';
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
      });
    };

    const formatDuration = () => {
      const startTime = displayData.startTime;
      const endTime = displayData.endTime;
      if (!startTime || !endTime) return 'N/A';
      const durationMs = endTime.getTime() - startTime.getTime();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    };

    return {
      totalWaypoints,
      completedWaypoints,
      skippedWaypoints,
      missionDuration: formatDuration(),
      startTime: formatTime(displayData.startTime),
      endTime: formatTime(displayData.endTime),
    };
  };

  // DEBUG: Manual function to test completion dialog
  const testCompletionDialog = () => {
    console.log('[MissionReportScreen] 🧪 TEST: Manually opening completion dialog');
    console.log('[MissionReportScreen] 🧪 Current state:', {
      showCompletionDialog,
      isMissionActive,
      missionStartTime,
      missionEndTime,
      waypointCount: waypoints.length,
      statusMapKeys: Object.keys(statusMap).length,
    });
    setShowCompletionDialog(true);
  };

  // Check if there's existing mission data that would be cleared
  const hasExistingMissionData = () => {
    const hasWaypoints = waypoints.length > 0;
    const hasProgress = Object.keys(statusMap).length > 0;
    const hasPreviousData = previousMissionData !== null;
    return hasWaypoints || hasProgress || hasPreviousData;
  };

  // Get existing mission info for confirmation dialog
  const getExistingMissionInfo = () => {
    return {
      waypointCount: waypoints.length,
      hasProgress: Object.keys(statusMap).length > 0,
    };
  };

  // Clear current mission data when starting new mission
  const clearCurrentMissionData = () => {
    console.log('[MissionReportScreen] Clearing current mission data for new mission');
    setStatusMap({});
    setPreviousMissionData(null); // AUTO-CLEAR: Also clear previous mission logs on new mission start
    setCurrentIndex(null);
    setMissionStartTime(null);
    setMissionEndTime(null);
    // TRAIL DISABLED: Clear trail commented out
    // setTrailPoints([]);
    // trailPointsRef.current = [];
  };

  // Mission control handlers matching web application
  const handleStart = async () => {
    // Check if we need confirmation before starting
    if (hasExistingMissionData()) {
      console.log('[MissionReportScreen] Existing mission data detected - showing confirmation dialog');
      setShowStartConfirmationDialog(true);
      return { success: false, message: 'Awaiting user confirmation' };
    }
    
    // No existing data, start immediately
    return executeStartMission();
  };

  // Handle confirmation dialog result
  const handleStartConfirmation = () => {
    setShowStartConfirmationDialog(false);
    executeStartMission();
  };

  const handleStartCancellation = () => {
    setShowStartConfirmationDialog(false);
    console.log('[MissionReportScreen] Mission start cancelled by user');
  };

  // Actual mission start function (after confirmation)
  const executeStartMission = async () => {
    // Check if component is mounted
    if (!mountedRef.current) {
      console.warn('[MissionReportScreen] Component unmounted, aborting mission start');
      return { success: false, message: 'Component unmounted' };
    }
    
    try {
      console.log('[MissionReportScreen] Starting mission...');

      // Quick client-side validation: ensure we have waypoints to start
      if (!waypoints || waypoints.length === 0) {
        const msg = 'No waypoints available. Upload or add waypoints before starting.';
        console.warn('[MissionReportScreen] Start blocked -', msg);
        showNotification('error', 'No Marking Points', msg);
        return { success: false, message: msg };
      }
      
      // Validate waypoints have valid coordinates
      const invalidWaypoints = waypoints.filter(wp => 
        isNaN(wp.lat) || isNaN(wp.lon) || wp.lat === 0 || wp.lon === 0
      );
      
      if (invalidWaypoints.length > 0) {
        const msg = `${invalidWaypoints.length} waypoint(s) have invalid coordinates. Please fix before starting.`;
        console.error('[MissionReportScreen]', msg);
        showNotification('error', 'Invalid Marking Points', msg);
        return { success: false, message: msg };
      }

      // Clear previous mission data to start fresh
      clearCurrentMissionData();

      // Call explicit start endpoint (mission will start with current mode selected by user)
      const response = await services.startMission();

      // Log full response for debugging when start fails
      if (!response || response.success !== true) {
        console.error('[MissionReportScreen] Start failed - backend response:', response);
        const message = response?.message ?? (response ? JSON.stringify(response) : 'Unknown error');
        showNotification('error', 'Start Failed', message);
        return response;
      }

      // Success
      setCurrentIndex(0);
      setIsMissionActive(true); // Mark mission as active immediately after successful start
      console.log('[MissionReportScreen] Mission started (backend acknowledged)');
      showNotification('success', 'Mission Started', 'Mission controller started successfully!');
      return response;
    } catch (error) {
      console.error('[MissionReportScreen] Start Error:', error);
      // Try to extract useful info
      let errMsg = 'Failed to start mission';
      try {
        if ((error as any)?.message) errMsg = (error as any).message;
        else errMsg = String(error);
      } catch (e) {
        errMsg = 'Failed to start mission';
      }
      showNotification('error', 'Error', errMsg);
      return { success: false, message: errMsg };
    }
  };

  const handlePause = async () => {
    try {
      console.log('[MissionReportScreen] Pausing mission...');
      const response = await services.pauseMission();
      
      if (response.success) {
        console.log('[MissionReportScreen] Mission paused successfully');
        showNotification('success', 'Mission Paused', 'Mission paused successfully');
      } else {
        console.error('[MissionReportScreen] Pause failed:', response.message);
        showNotification('error', 'Pause Failed', response.message || 'Failed to pause mission');
      }
      return response;
    } catch (error) {
      console.error('[MissionReportScreen] Pause Error:', error);
      showNotification('error', 'Error', 'Failed to pause mission');
      return { success: false, message: String(error) };
    }
  };

  const handleResume = async () => {
    try {
      console.log('[MissionReportScreen] Resuming mission...');
      const response = await services.resumeMission();
      
      if (response.success) {
        console.log('[MissionReportScreen] Mission resumed successfully');
        showNotification('success', 'Mission Resumed', 'Mission resumed successfully');
      } else {
        console.error('[MissionReportScreen] Resume failed:', response.message);
        showNotification('error', 'Resume Failed', response.message || 'Failed to resume mission');
      }
      return response;
    } catch (error) {
      console.error('[MissionReportScreen] Resume Error:', error);
      showNotification('error', 'Error', 'Failed to resume mission');
      return { success: false, message: String(error) };
    }
  };

  const handleStop = async () => {
    try {
      console.log('[MissionReportScreen] Stopping mission (explicit stop)...');
      const response = await services.stopMission();

      if (response.success) {
        setCurrentIndex(null);
        setIsMissionActive(false); // Mark mission as inactive
        // Preserve mission data when manually stopped (for export access)
        preserveCurrentMission.current();
        console.log('[MissionReportScreen] Mission stopped (backend acknowledged)');
        showNotification('success', 'Mission Stopped', 'Mission controller stopped successfully!');
        // TRAIL DISABLED: Clear trail when mission stops commented out
        // trailPointsRef.current = [];
        // setTrailPoints([]);
      } else {
        console.error('[MissionReportScreen] Stop failed:', response.message);
        showNotification('error', 'Stop Failed', response.message || 'Failed to stop mission');
      }
    } catch (error) {
      console.error('[MissionReportScreen] Stop Error:', error);
      showNotification('error', 'Error', 'Failed to stop mission');
    }
  };

  const handleNext = async () => {
    try {
      console.log('[MissionReportScreen] Requesting backend to move to next waypoint');
      const response = await services.nextMission();
      if (response.success) {
        // Backend will emit mission_status; optimistic increment as fallback
        setCurrentIndex(prev => (prev === null ? 0 : Math.min(prev + 1, waypoints.length - 1)));
        console.log('[MissionReportScreen] Next waypoint requested successfully');
        showNotification('success', 'Next Marking Point', 'Moved to next marking point successfully');
      } else {
        console.error('[MissionReportScreen] Next failed:', response.message);
        showNotification('error', 'Next Failed', response.message || 'Failed to move to next marking point');
      }
      return response;
    } catch (error) {
      console.error('[MissionReportScreen] Next Error:', error);
      showNotification('error', 'Error', 'Failed to move to next marking point');
      return { success: false, message: String(error) };
    }
  };

  const handleSkip = async () => {
    try {
      console.log('[MissionReportScreen] Requesting backend to skip current waypoint');
      const response = await services.skipMission();
      if (response.success) {
        setCurrentIndex(prev => (prev === null ? 0 : Math.min(prev + 1, waypoints.length - 1)));
        console.log('[MissionReportScreen] Skip requested successfully');
        showNotification('success', 'Marking Point Skipped', 'Skipped current marking point successfully');
      } else {
        console.error('[MissionReportScreen] Skip failed:', response.message);
        showNotification('error', 'Skip Failed', response.message || 'Failed to skip marking point');
      }
      return response;
    } catch (error) {
      console.error('[MissionReportScreen] Skip Error:', error);
      showNotification('error', 'Error', 'Failed to skip marking point');
      return { success: false, message: String(error) };
    }
  };

  const handleExport = () => {
    console.log('[MissionReportScreen] Export report triggered');
  };

  // Handle export completion - prompt user to clear logs or keep for review
  const handleExportComplete = () => {
    console.log('[MissionReportScreen] 📤 Export completed - showing clear logs prompt');
    // Show dialog asking if user wants to clear mission logs
    setShowClearLogsDialog(true);
  };

  // User confirmed to clear logs after export
  const handleClearLogsAfterExport = async () => {
    try {
      console.log('[MissionReportScreen] 🗑️ User confirmed - clearing mission logs after export');
      // Clear all mission data
      await PersistentStorage.clearMissionData();
      
      // Clear local state
      setStatusMap({});
      setPreviousMissionData(null);
      setCurrentIndex(null);
      setMissionStartTime(null);
      setMissionEndTime(null);
      setShowClearLogsDialog(false);
      
      showNotification('success', 'Logs Cleared', 'Mission logs cleared successfully');
      console.log('[MissionReportScreen] ✅ Mission logs cleared after export');
    } catch (error) {
      console.error('[MissionReportScreen] ❌ Failed to clear logs:', error);
      showNotification('error', 'Clear Failed', 'Failed to clear mission logs');
    }
  };

  // User declined to clear logs - keep for review
  const handleKeepLogsAfterExport = () => {
    console.log('[MissionReportScreen] 📋 User declined - keeping mission logs for review');
    setShowClearLogsDialog(false);
    showNotification('info', 'Logs Kept', 'Mission logs preserved for review');
  };

  // Clear all mission data (user-initiated)
  const handleClearMissionData = async () => {
    Alert.alert(
      'Clear Mission Data',
      'This will clear all marking points, progress, and mission logs. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear from persistent storage
              await PersistentStorage.clearMissionData();
              
              // Clear local state
              clearMissionWaypoints();
              setStatusMap({});
              setMissionStartTime(null);
              setMissionEndTime(null);
              setIsMissionActive(false);
              setMissionMode('DGPS Mark');
              setCurrentIndex(null);
              
              showNotification('success', 'Mission Data Cleared', 'All mission data has been cleared from storage');
              console.log('[MissionReportScreen] ✅ All mission data cleared');
            } catch (error) {
              console.error('[MissionReportScreen] ❌ Failed to clear mission data:', error);
              showNotification('error', 'Clear Failed', 'Failed to clear mission data');
            }
          },
        },
      ]
    );
  };

  // Debug function to test mission events (for development/testing)
  const simulateWaypointReached = (wpSn: number) => {
    console.log(`[MissionReportScreen] 🧪 Simulating waypoint ${wpSn} reached`);
    setStatusMap(prev => ({
      ...prev,
      [wpSn]: {
        ...(prev[wpSn] || {}),
        reached: true,
        status: 'reached',
        timestamp: new Date().toISOString(),
      },
    }));
  };

  const simulateWaypointCompleted = (wpSn: number) => {
    console.log(`[MissionReportScreen] 🧪 Simulating waypoint ${wpSn} completed`);
    setStatusMap(prev => ({
      ...prev,
      [wpSn]: {
        ...(prev[wpSn] || {}),
        marked: true,
        status: 'completed',
        timestamp: new Date().toISOString(),
        remark: 'Test completion',
      },
    }));
  };

  // Test mission events by triggering them manually
  const testMissionEvents = () => {
    console.log('[MissionReportScreen] 🧪 Testing mission events with waypoints:', waypoints.length);
    
    if (waypoints.length === 0) {
      showNotification('error', 'No Marking Points', 'Please load marking points first to test mission events');
      return;
    }

    // Test waypoint 1 reached
    setTimeout(() => {
      console.log('[MissionReportScreen] 🧪 Simulating waypoint 1 reached...');
      simulateWaypointReached(1);
    }, 1000);

    // Test waypoint 1 completed
    setTimeout(() => {
      console.log('[MissionReportScreen] 🧪 Simulating waypoint 1 completed...');
      simulateWaypointCompleted(1);
    }, 3000);

    // Test current waypoint change
    setTimeout(() => {
      console.log('[MissionReportScreen] 🧪 Simulating current waypoint change to 2...');
      setCurrentIndex(1); // Waypoint 2 (0-based index)
    }, 5000);

    showNotification('info', 'Test Started', 'Mission event simulation started - check console logs');
  };

  // Add to window for debugging in development
  React.useEffect(() => {
    if (__DEV__) {
      (global as any).simulateWaypointReached = simulateWaypointReached;
      (global as any).simulateWaypointCompleted = simulateWaypointCompleted;
      (global as any).testMissionEvents = testMissionEvents;
      console.log('[MissionReportScreen] Debug functions added to global scope:');
      console.log('  - simulateWaypointReached(wpSn)');
      console.log('  - simulateWaypointCompleted(wpSn)');
      console.log('  - testMissionEvents() - runs full test sequence');
    }
  }, [waypoints.length]);

  // Component mounted flag to prevent state updates after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;

      // Clear notification timeout on unmount to prevent memory leaks
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
        notificationTimeoutRef.current = null;
      }

      console.log('[MissionReportScreen] Component unmounting - cleaned up timers');
    };
  }, []);

  // Load persisted mission state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const [savedStatusMap, savedStartTime, savedEndTime, savedIsActive, savedMode, savedUIState] = await Promise.all([
          PersistentStorage.loadStatusMap(),
          PersistentStorage.loadMissionStartTime(),
          PersistentStorage.loadMissionEndTime(),
          PersistentStorage.loadMissionActive(),
          PersistentStorage.loadMissionMode(),
          PersistentStorage.loadMissionReportUIState(),
        ]);

        if (savedStatusMap && Object.keys(savedStatusMap).length > 0) {
          setStatusMap(savedStatusMap);
          console.log('[MissionReportScreen] 📂 Restored status map with', Object.keys(savedStatusMap).length, 'entries');
        }

        if (savedStartTime) {
          setMissionStartTime(savedStartTime);
          console.log('[MissionReportScreen] 📂 Restored mission start time');
        }

        if (savedEndTime) {
          setMissionEndTime(savedEndTime);
          console.log('[MissionReportScreen] 📂 Restored mission end time');
        }

        if (savedIsActive) {
          setIsMissionActive(savedIsActive);
          console.log('[MissionReportScreen] 📂 Restored mission active state:', savedIsActive);
        }

        if (savedMode) {
          setMissionMode(savedMode);
          console.log('[MissionReportScreen] 📂 Restored mission mode:', savedMode);
        } else {
          // Ensure mode is set to default if no saved mode
          setMissionMode('DGPS Mark');
        }

        // Restore UI state
        if (savedUIState) {
          if (savedUIState.isMapFullscreen !== undefined) {
            setIsMapFullscreen(savedUIState.isMapFullscreen);
            console.log('[MissionReportScreen] 📂 Restored map fullscreen state:', savedUIState.isMapFullscreen);
          }
          if (savedUIState.currentIndex !== undefined) {
            setCurrentIndex(savedUIState.currentIndex);
            console.log('[MissionReportScreen] 📂 Restored current waypoint index:', savedUIState.currentIndex);
          }
          if (savedUIState.mode) {
            setMode(savedUIState.mode);
            console.log('[MissionReportScreen] 📂 Restored mode:', savedUIState.mode);
          }
        }
      } catch (error) {
        console.error('[MissionReportScreen] Failed to load persisted state:', error);
      }
    };

    loadPersistedState();
  }, []);

  // Auto-save statusMap changes
  useEffect(() => {
    if (Object.keys(statusMap).length > 0) {
      PersistentStorage.saveStatusMap(statusMap).catch(error => {
        console.error('[MissionReportScreen] Failed to persist statusMap:', error);
      });
    }
  }, [statusMap]);

  // Auto-save mission times and active state
  useEffect(() => {
    if (missionStartTime) {
      PersistentStorage.saveMissionStartTime(missionStartTime).catch(error => {
        console.error('[MissionReportScreen] Failed to persist start time:', error);
      });
    }
  }, [missionStartTime]);

  useEffect(() => {
    if (missionEndTime) {
      PersistentStorage.saveMissionEndTime(missionEndTime).catch(error => {
        console.error('[MissionReportScreen] Failed to persist end time:', error);
      });
    }
  }, [missionEndTime]);

  useEffect(() => {
    PersistentStorage.saveMissionActive(isMissionActive).catch(error => {
      console.error('[MissionReportScreen] Failed to persist active state:', error);
    });
  }, [isMissionActive]);

  useEffect(() => {
    if (missionMode) {
      PersistentStorage.saveMissionMode(missionMode).catch(error => {
        console.error('[MissionReportScreen] Failed to persist mission mode:', error);
      });
    }
  }, [missionMode]);

  // Auto-save UI state changes (map fullscreen, current index, mode)
  useEffect(() => {
    PersistentStorage.saveMissionReportUIState({
      isMapFullscreen,
      currentIndex,
      mode,
    }).catch(error => {
      console.error('[MissionReportScreen] Failed to persist UI state:', error);
    });
  }, [isMapFullscreen, currentIndex, mode]);

  // Mission event handler for real-time status updates
  useEffect(() => {
    // Subscribe to mission events from backend
    const unsubscribe = onMissionEvent((event: any) => {
      if (!mountedRef.current) return;
      
      const eventType = event.type || event.event || 'unknown';
      
      // DEBUG: Log ALL mission events to diagnose the issue
      // console.log(`[MissionReportScreen] 🔔 ALL Mission Events [${eventType}]`, {
      //   eventType,
      //   event,
      //   waypoint_id: event.waypoint_id,
      //   id: event.id,
      //   current_waypoint: event.current_waypoint,
      //   waypoints_count: waypoints.length
      // });
      
      // Skip high-frequency events (mission_status, unknown telemetry updates)
      if (eventType === 'mission_status' || eventType === 'unknown') {
        // Process state updates silently without logging
        if (eventType === 'unknown' && event.data?.message === 'Telemetry update') {
          return; // Ignore telemetry update events
        }
      }
      
      // Handle waypoint reached events (multiple possible event formats)
      if (eventType === 'waypoint_reached' || event.event_type === 'waypoint_reached' || 
          (event.data && event.data.event_type === 'waypoint_reached')) {
        const wpId = event.waypoint_id ?? event.id ?? event.data?.waypoint_id ?? event.data?.id ?? 0;
        const timestamp = event.timestamp ? (typeof event.timestamp === 'string' ? event.timestamp : new Date(event.timestamp).toISOString()) : new Date().toISOString();
        
        console.log(`[MissionReportScreen] 🎯 Processing waypoint_reached: wpId=${wpId}, waypoints.length=${waypointsRef.current.length}`);
        
        // Find the corresponding waypoint by waypoint_id to get the correct sn
        const targetWaypoint = waypointsRef.current.find(wp => wp.sn === wpId);
        const statusKey = targetWaypoint ? targetWaypoint.sn : wpId;
        
        const prevEntry = statusMapRef.current[statusKey];
        const nextEntry = {
          ...(prevEntry || {}),
          reached: true,
          status: 'reached',
          timestamp,
          pile: event.pile ?? prevEntry?.pile,
          rowNo: event.rowNo ?? event.row_no ?? prevEntry?.rowNo,
        } as WpStatus;

        const changed = !prevEntry ||
          prevEntry.status !== nextEntry.status ||
          prevEntry.reached !== nextEntry.reached ||
          prevEntry.pile !== nextEntry.pile ||
          prevEntry.rowNo !== nextEntry.rowNo;

        if (changed) {
          setStatusMap(prev => ({
            ...prev,
            [statusKey]: nextEntry,
          }));
        }
        
        console.log(`[MissionReportScreen] ✅ Waypoint ${statusKey} reached at ${timestamp}`);
        // showNotification('info', 'Waypoint Reached', `Reached waypoint ${statusKey}`);
      }

      // Handle waypoint marked/completed events (multiple possible event formats)
      if (eventType === 'waypoint_marked' || eventType === 'waypoint_completed' ||
          event.event_type === 'waypoint_marked' || event.event_type === 'waypoint_completed' ||
          (event.data && (event.data.event_type === 'waypoint_marked' || event.data.event_type === 'waypoint_completed'))) {
        const wpId = event.waypoint_id ?? event.id ?? event.data?.waypoint_id ?? event.data?.id ?? 0;
        const timestamp = event.timestamp 
          ? (typeof event.timestamp === 'string' ? event.timestamp : new Date(event.timestamp).toISOString())
          : new Date().toISOString();
        const markingStatus = event.marking_status ?? event.markingStatus ?? event.status ?? event.data?.marking_status ?? 'completed';
        
        console.log(`[MissionReportScreen] ✅ Processing waypoint_marked/completed: wpId=${wpId}, status=${markingStatus}`);
        
        // Find the corresponding waypoint by waypoint_id to get the correct sn
        const targetWaypoint = waypointsRef.current.find(wp => wp.sn === wpId);
        const statusKey = targetWaypoint ? targetWaypoint.sn : wpId;
        
        const prevEntry = statusMapRef.current[statusKey];
        const nextEntry = {
          ...(prevEntry || {}),
          marked: true,
          status: markingStatus === 'skipped' ? 'skipped' : 'completed',
          timestamp,
          pile: event.pile ?? prevEntry?.pile,
          rowNo: event.rowNo ?? event.row_no ?? prevEntry?.rowNo,
          remark: event.remark ?? prevEntry?.remark ?? '—',
        } as WpStatus;

        const changed = !prevEntry ||
          prevEntry.status !== nextEntry.status ||
          prevEntry.marked !== nextEntry.marked ||
          prevEntry.pile !== nextEntry.pile ||
          prevEntry.rowNo !== nextEntry.rowNo ||
          prevEntry.remark !== nextEntry.remark;

        if (changed) {
          setStatusMap(prev => ({
            ...prev,
            [statusKey]: nextEntry,
          }));
        }
        
        const statusEmoji = markingStatus === 'skipped' ? '⏭️' : '✅';
        console.log(`[MissionReportScreen] ${statusEmoji} Waypoint ${statusKey} ${markingStatus} at ${timestamp}`);
        // showNotification(
        //   markingStatus === 'skipped' ? 'info' : 'success',
        //   markingStatus === 'skipped' ? 'Waypoint Skipped' : 'Waypoint Completed',
        //   `Waypoint ${statusKey} ${markingStatus}`
        // );
      }

      // Handle mission completed event - including mission_state: completed
      if (eventType === 'mission_completed' ||
          event.event_type === 'mission_completed' ||
          event.mission_state === 'completed' ||
          (event.data && event.data.event_type === 'mission_completed') ||
          (event.data && event.data.mission_state === 'completed')) {
        console.log('[MissionReportScreen] 🏁 Mission completed event received from backend');
        console.log('[MissionReportScreen] Completion event details:', {
          eventType,
          mission_state: event.mission_state,
          completion_time: event.completion_time,
          mission_duration: event.mission_duration,
        });

        // Set mission start time if not set (fallback for missed start event)
        if (!missionStartTimeRef.current) {
          console.log('[MissionReportScreen] ⚠️ Mission start time was not set! Using fallback.');
          // Calculate start time from completion_time and mission_duration if available
          if (event.completion_time && event.mission_duration) {
            const completionDate = new Date(event.completion_time);
            const startDate = new Date(completionDate.getTime() - (event.mission_duration * 1000));
            setMissionStartTime(startDate);
            console.log('[MissionReportScreen] ✅ Calculated mission start time from duration:', startDate);
          } else {
            // Fallback: use current time minus 1 minute as approximate start
            setMissionStartTime(new Date(Date.now() - 60000));
            console.log('[MissionReportScreen] ⚠️ Using fallback start time (1 minute ago)');
          }
        }

        // Set mission end time if not already set
        if (!missionEndTimeRef.current) {
          const completionTime = event.completion_time ? new Date(event.completion_time) : new Date();
          setMissionEndTime(completionTime);
          console.log('[MissionReportScreen] ✅ Mission end time set:', completionTime);
        }

        // Mark mission as inactive
        setIsMissionActive(false);
        console.log('[MissionReportScreen] ✅ isMissionActive set to false - button will reset to START');

        // Preserve mission data for export
        preserveCurrentMission.current();

        // Show completion notification
        showNotification('success', 'Mission Completed', 'All marking points have been processed!');

        // Show completion dialog
        const dialogTimer = setTimeout(() => {
          if (mountedRef.current) {
            // console.log('[MissionReportScreen] 📋 Opening mission completion dialog');
            setShowCompletionDialog(true);
          }
        }, 1000);

        // Cleanup timer if component unmounts before dialog shows
        return () => clearTimeout(dialogTimer);
      }

      // Handle mission status updates (high frequency - no notifications)
      if (eventType === 'mission_status') {
        let statusUpdated = false;

        if (event.current_waypoint != null) {
          const newIndex = event.current_waypoint - 1; // Convert from 1-based to 0-based
          const currentWaypointNumber = event.current_waypoint;
          setCurrentIndex(prev => {
            if (prev !== newIndex) {
              console.log(`[MissionReportScreen] 📍 Current waypoint changed: index ${prev} -> ${newIndex} (waypoint #${currentWaypointNumber})`);
              console.log(`[MissionReportScreen] 📍 Looking for waypoint with sn=${currentWaypointNumber} in ${waypointsRef.current.length} waypoints`);
              
              // Find and log the target waypoint
              const targetWaypoint = waypointsRef.current.find(wp => wp.sn === currentWaypointNumber);
              if (targetWaypoint) {
                console.log(`[MissionReportScreen] 📍 Found target waypoint:`, {
                  sn: targetWaypoint.sn,
                  block: targetWaypoint.block,
                  row: targetWaypoint.row,
                  pile: targetWaypoint.pile
                });
              } else {
                console.log(`[MissionReportScreen] ⚠️ Target waypoint sn=${currentWaypointNumber} not found in waypoints array`);
              }
              
              statusUpdated = true;
              return newIndex;
            }
            return prev;
          });
        }
        
        // Mission mode is now controlled by user selection in Mission Ops Panel
        // Backend mission_mode events are logged but don't override user selection
        if (event.mission_mode) {
          const backendMode = String(event.mission_mode).toLowerCase();
          console.log(`[MissionReportScreen] ℹ️ Backend reported mission mode: ${backendMode} (current user mode: ${missionModeRef.current})`);
        }
        
        // Check if mission_status contains waypoint completion info
        if (event.waypoint_status && event.current_waypoint) {
          const wpId = event.current_waypoint;
          const targetWaypoint = waypointsRef.current.find(wp => wp.sn === wpId);
          const statusKey = targetWaypoint ? targetWaypoint.sn : wpId;
          
          console.log(`[MissionReportScreen] 📊 Mission status contains waypoint info: wpId=${wpId}, status=${event.waypoint_status}`);
          
          const prevEntry = statusMapRef.current[statusKey];
          const nextEntry = {
            ...(prevEntry || {}),
            status: event.waypoint_status === 'completed' ? 'completed' : 
                   event.waypoint_status === 'reached' ? 'reached' : 
                   event.waypoint_status,
            timestamp: event.timestamp ? (typeof event.timestamp === 'string' ? event.timestamp : new Date(event.timestamp).toISOString()) : new Date().toISOString(),
            reached: event.waypoint_status === 'reached' || event.waypoint_status === 'completed',
            marked: event.waypoint_status === 'completed',
          } as WpStatus;

          const changed = !prevEntry ||
            prevEntry.status !== nextEntry.status ||
            prevEntry.reached !== nextEntry.reached ||
            prevEntry.marked !== nextEntry.marked;

          if (changed) {
            setStatusMap(prev => ({
              ...prev,
              [statusKey]: nextEntry,
            }));
          }
          statusUpdated = true;
        }
        
        // Only log mission_status when something actually changed to reduce noise
        if (statusUpdated) {
          console.log('[MissionReportScreen] Mission status updated:', {
            current_waypoint: event.current_waypoint,
            mission_mode: event.mission_mode,
            waypoint_status: event.waypoint_status,
            waypoints_count: waypointsRef.current.length
          });
        }
        return;
      }

      // Handle mission errors
      if (eventType === 'mission_error') {
        const errorMsg = event.message || event.error || 'Unknown mission error';
        console.error(`[MissionReportScreen] ❌ Mission error: ${errorMsg}`, event);
        showNotification('error', 'Mission Error', errorMsg);
      }

      // Handle mission state changes (show notifications only for important events)
      if (eventType === 'mission_started') {
        console.log('[MissionReportScreen] 🚀 Mission started');
        setMissionStartTime(new Date());
        setMissionEndTime(null); // Reset end time for new mission
        setIsMissionActive(true); // Mark mission as active
        // TRAIL DISABLED: Clear trail on new mission start commented out
        // trailPointsRef.current = [];
        // setTrailPoints([]); // Clear trail on new mission start
      }

      if (eventType === 'mission_paused') {
        console.log('[MissionReportScreen] ⏸️ Mission paused');
      }

      if (eventType === 'mission_resumed') {
        console.log('[MissionReportScreen] ▶️ Mission resumed');
      }

      // Note: mission_completed is handled earlier in the event handler (line ~848)

      // Catch-all handler for any other mission events that might contain waypoint updates
      if (eventType !== 'mission_status' && eventType !== 'unknown' && 
          (event.waypoint_id || event.id || event.current_waypoint)) {
        console.log(`[MissionReportScreen] 🔍 Unhandled mission event with waypoint info:`, {
          eventType,
          waypoint_id: event.waypoint_id,
          id: event.id,
          current_waypoint: event.current_waypoint,
          status: event.status,
          event_type: event.event_type
        });
        
        // Try to extract waypoint status updates from any unhandled events
        const wpId = event.waypoint_id ?? event.id ?? event.current_waypoint ?? 0;
        if (wpId > 0 && waypointsRef.current.length > 0) {
          const targetWaypoint = waypointsRef.current.find(wp => wp.sn === wpId);
          const statusKey = targetWaypoint ? targetWaypoint.sn : wpId;
          
          // Check for any status indicators in the event
          if (event.status === 'completed' || event.status === 'reached' || 
              event.status === 'marked' || event.status === 'skipped') {
            console.log(`[MissionReportScreen] 📝 Extracting status from unhandled event: wpId=${wpId}, status=${event.status}`);
            
            const prevEntry = statusMapRef.current[statusKey];
            const nextEntry = {
              ...(prevEntry || {}),
              status: event.status,
              timestamp: event.timestamp ? (typeof event.timestamp === 'string' ? event.timestamp : new Date(event.timestamp).toISOString()) : new Date().toISOString(),
              reached: event.status === 'reached' || event.status === 'completed',
              marked: event.status === 'completed' || event.status === 'marked',
              remark: event.remark ?? prevEntry?.remark ?? '—',
            } as WpStatus;

            const changed = !prevEntry ||
              prevEntry.status !== nextEntry.status ||
              prevEntry.reached !== nextEntry.reached ||
              prevEntry.marked !== nextEntry.marked ||
              prevEntry.remark !== nextEntry.remark;

            if (changed) {
              setStatusMap(prev => ({
                ...prev,
                [statusKey]: nextEntry,
              }));
            }
          }
        }
      }
    });

    return () => {
      // Cleanup subscription
      unsubscribe();
    };
  }, [onMissionEvent]);

  // Mission mode is now managed by RoverContext and synced with Mission Ops Panel
  // Initial mode is set to 'DGPS Mark' by default in context

  // Mission waypoints come from context (uploaded via PathPlan tab)
  // No need to fetch from backend as PathPlan handles upload and syncs to context

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.headerBlue} barStyle="light-content" />

      {/* Previous Mission Indicator */}
      {isShowingPreviousMission && (
        <View style={styles.previousMissionBanner}>
          <Text style={styles.previousMissionText}>
            📋 Viewing Previous Mission Data - Start new mission to clear
          </Text>
        </View>
      )}

      <View style={styles.mainContent}>
        {isMapFullscreen ? (
          /* Full Screen Map Mode */
          <View style={styles.fullscreenMap}>
            <MissionMap
              waypoints={getDisplayMissionData().waypoints}
              roverLat={mapProps.roverLat}
              roverLon={mapProps.roverLon}
              heading={mapProps.heading}
              activeWaypointIndex={currentIndex}
              armed={mapProps.armed}
              rtkFixType={mapProps.rtkFixType}
              onToggleFullscreen={toggleMapFullscreen}
            />
          </View>
        ) : (
          <>
            <View style={styles.leftPanel}>
              <VehicleStatusCard
                status={vehicleStatus}
                telemetry={telemetry}
                isConnected={connectionState === 'connected'}
                services={{
                  injectRTK: services.injectRTK,
                  stopRTK: services.stopRTK,
                  getRTKStatus: services.getRTKStatus,
                }}
                onOpenRTKInjection={openRTKInjection}
              />
              <MissionProgressCard
                waypoints={getDisplayMissionData().waypoints}
                currentIndex={currentIndex}
                markedCount={markedCount}
                statusMap={getDisplayMissionData().statusMap}
                isMissionActive={isMissionActive}
              />
            </View>
            <View style={styles.centerPanel}>
              <View style={styles.mapWrapper}>
                <MissionMap
                  waypoints={getDisplayMissionData().waypoints}
                  roverLat={mapProps.roverLat}
                  roverLon={mapProps.roverLon}
                  heading={mapProps.heading}
                  activeWaypointIndex={currentIndex}
                  // TRAIL DISABLED: trailPoints prop commented out
                  // trailPoints={trailPoints}
                  armed={mapProps.armed}
                  rtkFixType={mapProps.rtkFixType}
                  onToggleFullscreen={toggleMapFullscreen}
                />
              </View>
            </View>
            <View style={styles.rightPanel}>
              <SystemStatusPanel
                mode={mode}
                onSetMode={setMode}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
                onNext={handleNext}
                onSkip={handleSkip}
                waypoints={waypoints}
                isMissionActive={isMissionActive}
              />
            </View>
          </>
        )}
      </View>
      {/* Bottom full-width waypoints table */}
      <View style={styles.bottomTableContainer}>
        <WaypointsTable
          waypoints={getDisplayMissionData().waypoints}
          onExport={handleExport}
          onExportComplete={handleExportComplete}
          statusMap={getDisplayMissionData().statusMap}
          missionMode={getDisplayMissionData().missionMode}
          currentIndex={currentIndex}
          pinnedCount={PINNED_COUNT}
          onReorder={handleReorder}
        />
      </View>

      <Toast
        visible={notification.visible}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

        <RTKInjectionScreen
          visible={showRTKInjection}
          onClose={closeRTKInjection}
          services={services}
          isConnected={connectionState === 'connected'}
        />

      {/* Auto-Assign Dialog */}
      <AutoAssignDialog
        visible={showAutoAssignDialog}
        missingFields={missingFields}
        onAutoAssign={handleAutoAssignSequence}
        onProceedWithout={handleProceedWithoutAssign}
        onCancel={() => setShowAutoAssignDialog(false)}
      />

      {/* Waypoint Preview Dialog */}
      <WaypointPreviewDialog
        visible={showWaypointPreviewDialog}
        waypoints={waypoints}
        onConfirm={handleConfirmUpload}
        onCancel={() => setShowWaypointPreviewDialog(false)}
        isUploading={isUploadingMission}
      />

      {/* Mission Completion Dialog */}
      <MissionCompletionDialog
        visible={showCompletionDialog}
        onDismiss={() => {
          console.log('[MissionReportScreen] 📋 Closing mission completion dialog');
          setShowCompletionDialog(false);
        }}
        onExport={() => {
          console.log('[MissionReportScreen] 📤 Exporting mission report from completion dialog');
          setShowCompletionDialog(false);
          handleExport();
        }}
        missionStats={getMissionStats()}
      />

      {/* Clear Logs After Export Dialog */}
      <LogClearDialog
        visible={showClearLogsDialog}
        onConfirm={handleClearLogsAfterExport}
        onCancel={handleKeepLogsAfterExport}
      />

      {/* Mission Start Confirmation Dialog */}
      <MissionStartConfirmationDialog
        visible={showStartConfirmationDialog}
        onConfirm={handleStartConfirmation}
        onCancel={handleStartCancellation}
        hasExistingData={hasExistingMissionData()}
        existingMissionInfo={getExistingMissionInfo()}
      />
    </SafeAreaView>
  );
}

function getFixTypeLabel(fixType: number): string {
  const labels: { [key: number]: string } = {
    0: 'No GPS',
    1: 'No Fix',
    2: '2D Fix',
    3: '3D Fix',
    4: 'DGPS',
    5: 'RTK Float',
    6: 'RTK Fixed',
  };
  return labels[fixType] || 'Unknown';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  mainContent: {
    flex: TOP_ROW_FLEX,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingTop: COLUMN_GAP / 2,
    gap: COLUMN_GAP,
  },
  leftPanel: {
    width: LEFT_PANEL_WIDTH,
    paddingHorizontal: PANEL_PADDING_H,
    paddingVertical: PANEL_PADDING_V,
    backgroundColor: colors.primary,
  },
  centerPanel: {
    flex: 1,
    paddingHorizontal: PANEL_PADDING_H,
    paddingVertical: PANEL_PADDING_V,
    backgroundColor: colors.primary,
  },
  mapWrapper: {
    flex: 1,
    backgroundColor: colors.panelBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rightPanel: {
    width: RIGHT_PANEL_WIDTH,
    paddingHorizontal: PANEL_PADDING_H,
    paddingVertical: PANEL_PADDING_V,
    backgroundColor: colors.primary,
  },
  bottomTableContainer: {
    flex: BOTTOM_ROW_FLEX,
    backgroundColor: colors.primary,
    paddingHorizontal: PANEL_PADDING_H + 2,
    paddingTop: COLUMN_GAP / 2,
    paddingBottom: PANEL_PADDING_V,
  },
  previousMissionBanner: {
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FDBF47',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  previousMissionText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  fullscreenMap: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
});