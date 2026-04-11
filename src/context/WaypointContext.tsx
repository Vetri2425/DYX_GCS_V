/**
 * WaypointContext — Mission and waypoint state (low-frequency updates)
 *
 * Split from RoverContext to prevent waypoint consumers from re-rendering
 * on every telemetry tick (20Hz). Components that only need mission data
 * (waypoints, mission mode, drawing tools) should use useWaypointContext()
 * instead of useRover() to avoid unnecessary re-renders.
 *
 * For backward compatibility, RoverContext still provides all these values
 * by composing from WaypointContext internally.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PersistentStorage from '../services/PersistentStorage';
import { Waypoint } from '../components/missionreport/types';

const TTS_LANGUAGE_STORAGE_KEY = 'tts_language';

export interface WaypointContextValue {
  // Waypoint state
  missionWaypoints: Waypoint[];
  setMissionWaypoints: (waypoints: Waypoint[]) => void;
  clearMissionWaypoints: () => void;

  // Mission mode
  missionMode: string;
  setMissionMode: (mode: string) => void;

  // TTS language (mission-related UI)
  ttsLanguage: string;
  setTTSLanguage: (language: string) => void;

  // PathPlan modal state
  showUploadPreview: boolean;
  setShowUploadPreview: (visible: boolean) => void;
  showManualConnectionCanvas: boolean;
  setShowManualConnectionCanvas: (visible: boolean) => void;
}

const WaypointContext = createContext<WaypointContextValue | null>(null);

interface WaypointProviderProps {
  children: ReactNode;
}

export function WaypointProvider({ children }: WaypointProviderProps): React.ReactElement {
  const [missionWaypoints, setMissionWaypointsState] = useState<Waypoint[]>([]);
  const [missionMode, setMissionModeState] = useState<string>('DGPS Mark');
  const [ttsLanguage, setTTSLanguageState] = useState<string>('en');
  const [showUploadPreview, setShowUploadPreviewState] = useState<boolean>(false);
  const [showManualConnectionCanvas, setShowManualConnectionCanvasState] = useState<boolean>(false);

  // Load persisted data on mount
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(TTS_LANGUAGE_STORAGE_KEY);
        if (savedLanguage) {
          setTTSLanguageState(savedLanguage);
        }

        const savedMissionMode = await PersistentStorage.loadMissionMode();
        if (savedMissionMode) {
          setMissionModeState(savedMissionMode);
        }
      } catch (error) {
        console.error('[WaypointContext] Failed to load persisted data:', error);
      }
    };
    loadPersistedData();
  }, []);

  const setMissionWaypoints = useCallback((waypoints: Waypoint[]) => {
    if (!waypoints || !Array.isArray(waypoints)) {
      console.warn('[WaypointContext] Attempted to set invalid waypoints:', waypoints);
      return;
    }

    // Use a version counter instead of O(n) field-by-field comparison.
    // The old approach iterated all waypoints checking 7 fields each —
    // for 395 waypoints that's 2,765 comparisons on every update.
    // With a version counter, we always accept the new array and let
    // React.memo on consumers decide if they need to re-render.
    setMissionWaypointsState(waypoints);
    PersistentStorage.saveWaypoints(waypoints).catch(error => {
      console.error('[WaypointContext] Failed to persist waypoints:', error);
    });
  }, []);

  const clearMissionWaypoints = useCallback(() => {
    setMissionWaypointsState([]);
    PersistentStorage.clearMissionData().catch(error => {
      console.error('[WaypointContext] Failed to clear persisted data:', error);
    });
  }, []);

  const setMissionMode = useCallback((mode: string) => {
    setMissionModeState(mode);
    PersistentStorage.saveMissionMode(mode).catch(error => {
      console.error('[WaypointContext] Failed to persist mission mode:', error);
    });
  }, []);

  const setTTSLanguage = useCallback(async (language: string) => {
    try {
      setTTSLanguageState(language);
      await AsyncStorage.setItem(TTS_LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.error('[WaypointContext] Failed to save TTS language:', error);
    }
  }, []);

  const setShowUploadPreview = useCallback((visible: boolean) => {
    setShowUploadPreviewState(visible);
  }, []);

  const setShowManualConnectionCanvas = useCallback((visible: boolean) => {
    setShowManualConnectionCanvasState(visible);
  }, []);

  const contextValue = React.useMemo<WaypointContextValue>(() => ({
    missionWaypoints,
    setMissionWaypoints,
    clearMissionWaypoints,
    missionMode,
    setMissionMode,
    ttsLanguage,
    setTTSLanguage,
    showUploadPreview,
    setShowUploadPreview,
    showManualConnectionCanvas,
    setShowManualConnectionCanvas,
  }), [
    missionWaypoints,
    setMissionWaypoints,
    clearMissionWaypoints,
    missionMode,
    setMissionMode,
    ttsLanguage,
    setTTSLanguage,
    showUploadPreview,
    setShowUploadPreview,
    showManualConnectionCanvas,
    setShowManualConnectionCanvas,
  ]);

  return React.createElement(
    WaypointContext.Provider,
    { value: contextValue },
    children
  );
}

/**
 * Hook: useWaypointContext
 *
 * Access mission/waypoint state without subscribing to telemetry updates.
 * Components using this hook will NOT re-render on telemetry changes (20Hz).
 */
export function useWaypointContext(): WaypointContextValue {
  const ctx = useContext(WaypointContext);
  if (!ctx) {
    throw new Error('useWaypointContext must be used within a WaypointProvider');
  }
  return ctx;
}

export default WaypointContext;