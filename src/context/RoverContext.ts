/**
 * React Native Context: RoverContext
 *
 * Provides rover telemetry and services to the entire app.
 * Waypoint/mission state is now in WaypointContext (split for performance).
 * RoverContext composes from WaypointContext for backward compatibility.
 * Usage: Wrap App with <RoverProvider>, then use useRover() hook
 */

import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import useRoverTelemetry, {
  UseRoverTelemetryResult,
  RoverServices
} from '../hooks/useRoverTelemetry';
import { RoverTelemetry, GpsFailsafeMode, GpsFailsafeStatus, GpsFailsafeEvent } from '../types/telemetry';
import { Waypoint } from '../components/missionreport/types';
import { WaypointProvider, useWaypointContext } from './WaypointContext';

export interface RoverContextValue extends UseRoverTelemetryResult {
  missionWaypoints: Waypoint[];
  setMissionWaypoints: (waypoints: Waypoint[]) => void;
  clearMissionWaypoints: () => void;
  missionMode: string;
  setMissionMode: (mode: string) => void;
  ttsLanguage: string;
  setTTSLanguage: (language: string) => void;
  gpsFailsafeMode: GpsFailsafeMode;
  setGpsFailsafeMode: (mode: GpsFailsafeMode) => void;
  gpsFailsafeStatus: GpsFailsafeStatus | null;
  onFailsafeAcknowledge: () => void;
  onFailsafeResume: () => void;
  onFailsafeRestart: () => void;
  // PathPlan modal state
  showUploadPreview: boolean;
  setShowUploadPreview: (visible: boolean) => void;
  showManualConnectionCanvas: boolean;
  setShowManualConnectionCanvas: (visible: boolean) => void;
}

const RoverContext = createContext<RoverContextValue | null>(null);

interface RoverProviderProps {
  children: ReactNode;
}

/**
 * Provider Component: RoverProvider
 * 
 * Wrap your app with this to enable rover telemetry throughout
 * 
 * @example
 * ```tsx
 * <RoverProvider>
 *   <App />
 * </RoverProvider>
 * ```
 */
export function RoverProvider({ children }: RoverProviderProps): React.ReactElement {
  const rover = useRoverTelemetry();
  const [gpsFailsafeMode, setGpsFailsafeModeState] = useState<GpsFailsafeMode>('disable');
  const [gpsFailsafeStatus, setGpsFailsafeStatus] = useState<GpsFailsafeStatus | null>(null);

  // Waypoint/mission state is now managed by WaypointContext.
  // Read from WaypointContext for backward compatibility with RoverContext consumers.
  const waypointCtx = useWaypointContext();

  // Update GPS failsafe status from telemetry
  useEffect(() => {
    if (rover.telemetry.gps_failsafe) {
      console.log('[RoverContext] GPS Failsafe status updated:', rover.telemetry.gps_failsafe);
      setGpsFailsafeStatus(rover.telemetry.gps_failsafe);
    }
  }, [rover.telemetry.gps_failsafe]);

  const setGpsFailsafeMode = useCallback((mode: GpsFailsafeMode) => {
    console.log('[RoverContext] Setting GPS failsafe mode:', mode);
    setGpsFailsafeModeState(mode);

    // Emit to backend
    if (rover.socket) {
      rover.socket.emit('set_gps_failsafe_mode', { mode });
    }
  }, [rover.socket]);

  const onFailsafeAcknowledge = useCallback(() => {
    console.log('[RoverContext] Acknowledging GPS failsafe');
    if (rover.socket) {
      rover.socket.emit('failsafe_acknowledge');
    }
  }, [rover.socket]);

  const onFailsafeResume = useCallback(() => {
    console.log('[RoverContext] Resuming mission after failsafe');
    if (rover.socket) {
      rover.socket.emit('failsafe_resume_mission');
    }
  }, [rover.socket]);

  const onFailsafeRestart = useCallback(() => {
    console.log('[RoverContext] Restarting mission after failsafe');
    if (rover.socket) {
      rover.socket.emit('failsafe_restart_mission');
    }
  }, [rover.socket]);

  // Listen for GPS failsafe events and mission mode updates
  useEffect(() => {
    if (!rover.socket || rover.connectionState !== 'connected') {
      // Only log when connection state changes to avoid spam
      if (rover.connectionState !== 'connecting') {
        console.log('[RoverContext] Socket not ready for listeners. Connection state:', rover.connectionState);
      }
      return;
    }

    console.log('[RoverContext] Registering listeners. Connection state:', rover.connectionState);

    const handleServoSuppressed = (event: GpsFailsafeEvent) => {
      console.log('[RoverContext] Servo suppressed event:', event);
    };

    const handleFailsafeModeChanged = (data: { mode: GpsFailsafeMode }) => {
      console.log('[RoverContext] Received failsafe mode from backend:', data.mode);
      setGpsFailsafeModeState(data.mode);
    };

    // Handle mission mode updates from backend mission events — delegate to WaypointContext
    const handleMissionModeUpdate = (event: any) => {
      if (event.mission_mode) {
        const backendMode = String(event.mission_mode).trim();
        waypointCtx.setMissionMode(backendMode);
      }
    };

    rover.socket.on('servo_suppressed', handleServoSuppressed);
    rover.socket.on('failsafe_mode_changed', handleFailsafeModeChanged);
    rover.socket.on('mission_status', handleMissionModeUpdate);
    console.log('[RoverContext] Listeners registered');

    // Request current GPS failsafe mode after registering listener
    console.log('[RoverContext] Requesting current GPS failsafe mode from backend');
    rover.socket.emit('request_gps_failsafe_mode');

    return () => {
      console.log('[RoverContext] Unregistering listeners');
      rover.socket?.off('servo_suppressed', handleServoSuppressed);
      rover.socket?.off('failsafe_mode_changed', handleFailsafeModeChanged);
      rover.socket?.off('mission_status', handleMissionModeUpdate);
    };
  }, [rover.socket, rover.connectionState, waypointCtx.setMissionMode]);

  // Memoize context value: telemetry changes at 20Hz, but waypoint values
  // only change on user actions. Components using useWaypointContext() avoid
  // re-rendering on telemetry ticks.
  const contextValue = React.useMemo<RoverContextValue>(() => ({
    telemetry: rover.telemetry,
    roverPosition: rover.roverPosition,
    connectionState: rover.connectionState,
    reconnect: rover.reconnect,
    services: rover.services,
    onMissionEvent: rover.onMissionEvent,
    socket: rover.socket,
    // Waypoint values delegated to WaypointContext — still available via useRover()
    missionWaypoints: waypointCtx.missionWaypoints,
    setMissionWaypoints: waypointCtx.setMissionWaypoints,
    clearMissionWaypoints: waypointCtx.clearMissionWaypoints,
    missionMode: waypointCtx.missionMode,
    setMissionMode: waypointCtx.setMissionMode,
    ttsLanguage: waypointCtx.ttsLanguage,
    setTTSLanguage: waypointCtx.setTTSLanguage,
    gpsFailsafeMode,
    setGpsFailsafeMode,
    gpsFailsafeStatus,
    onFailsafeAcknowledge,
    onFailsafeResume,
    onFailsafeRestart,
    showUploadPreview: waypointCtx.showUploadPreview,
    setShowUploadPreview: waypointCtx.setShowUploadPreview,
    showManualConnectionCanvas: waypointCtx.showManualConnectionCanvas,
    setShowManualConnectionCanvas: waypointCtx.setShowManualConnectionCanvas,
  }), [
    rover.telemetry,
    rover.roverPosition,
    rover.connectionState,
    rover.reconnect,
    rover.services,
    rover.onMissionEvent,
    rover.socket,
    waypointCtx.missionWaypoints,
    waypointCtx.setMissionWaypoints,
    waypointCtx.clearMissionWaypoints,
    waypointCtx.missionMode,
    waypointCtx.setMissionMode,
    waypointCtx.ttsLanguage,
    waypointCtx.setTTSLanguage,
    waypointCtx.showUploadPreview,
    waypointCtx.setShowUploadPreview,
    waypointCtx.showManualConnectionCanvas,
    waypointCtx.setShowManualConnectionCanvas,
    gpsFailsafeMode,
    setGpsFailsafeMode,
    gpsFailsafeStatus,
    onFailsafeAcknowledge,
    onFailsafeResume,
    onFailsafeRestart,
  ]);

  return React.createElement(
    RoverContext.Provider,
    { value: contextValue },
    children
  );
}

/**
 * Hook: useRover
 * 
 * Access rover telemetry and services throughout your app
 * Must be used within <RoverProvider>
 * 
 * @example
 * ```tsx
 * const { telemetry, services, connectionState } = useRover();
 * ```
 */
export function useRover(): RoverContextValue {
  const ctx = useContext(RoverContext);
  if (!ctx) {
    throw new Error('useRover must be used within a RoverProvider');
  }
  return ctx;
}

// Re-export types
export type { RoverTelemetry, RoverServices };

export default RoverContext;
