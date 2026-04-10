// ============================================================
// useCADAlignment Hook — CAD Georeferencing State Machine
// ============================================================
//
// Manages the full alignment workflow:
//   1. DXF file loaded → CAD model stored
//   2. User selects 2 CAD points on canvas
//   3. User enters 2 GPS coordinates
//   4. Georeferencing pipeline runs
//   5. GeoEntity[] → PathPlanWaypoint[]
//   6. Ready for apply/cancel
//
// This hook is UI-agnostic. It manages state and data flow only.

import { useState, useCallback } from 'react';
import { CADModel, Point2D, GeoPoint, GeorefResult } from '../../core/geometry/types';
import { parseDXF } from '../../core/parser/dxfParser';
import { georeferenceCAD } from '../../core/georef/georeferenceService';
import { geoEntitiesToWaypoints, GeoToWaypointConfig } from '../adapters/geoToWaypoints';
import { PathPlanWaypoint } from '../../types/pathplan';

/** Alignment workflow states */
export type CADAlignmentState =
  | 'idle'              // No CAD model
  | 'cad_loaded'        // DXF parsed, showing canvas
  | 'points_selected'   // 2 CAD points selected, waiting for GPS
  | 'gps_entered'       // GPS coordinates entered, ready to compute
  | 'computed'          // Georeferencing done, waypoints ready
  | 'error';            // Error state

export type UseCADAlignmentReturn = {
  // State
  state: CADAlignmentState;
  cadModel: CADModel | null;
  cadPointA: Point2D | null;
  cadPointB: Point2D | null;
  geoPointA: GeoPoint | null;
  geoPointB: GeoPoint | null;
  computedWaypoints: PathPlanWaypoint[] | null;
  georefResult: GeorefResult | null;
  errorMessage: string | null;

  // Actions
  loadDXF: (content: string) => void;
  setCADPoints: (a: Point2D, b: Point2D) => void;
  setGPSPoints: (a: GeoPoint, b: GeoPoint) => void;
  computeAlignment: () => void;
  reset: () => void;
};

/**
 * Hook that manages the CAD georeferencing alignment workflow.
 *
 * @param waypointConfig - Configuration for GeoEntity → Waypoint conversion
 * @returns State machine + actions for the alignment flow
 */
export function useCADAlignment(
  waypointConfig: GeoToWaypointConfig = {}
): UseCADAlignmentReturn {
  const [state, setState] = useState<CADAlignmentState>('idle');
  const [cadModel, setCadModel] = useState<CADModel | null>(null);
  const [cadPointA, setCadPointA] = useState<Point2D | null>(null);
  const [cadPointB, setCadPointB] = useState<Point2D | null>(null);
  const [geoPointA, setGeoPointA] = useState<GeoPoint | null>(null);
  const [geoPointB, setGeoPointB] = useState<GeoPoint | null>(null);
  const [computedWaypoints, setComputedWaypoints] = useState<PathPlanWaypoint[] | null>(null);
  const [georefResult, setGeorefResult] = useState<GeorefResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Step 1: Parse DXF content → CADModel */
  const loadDXF = useCallback((content: string) => {
    try {
      setErrorMessage(null);
      const model = parseDXF(content);

      if (model.entities.length === 0) {
        setErrorMessage('No supported entities found in DXF file.');
        setState('error');
        return;
      }

      setCadModel(model);
      setCadPointA(null);
      setCadPointB(null);
      setGeoPointA(null);
      setGeoPointB(null);
      setComputedWaypoints(null);
      setGeorefResult(null);
      setState('cad_loaded');
    } catch (err: any) {
      setErrorMessage(err.message ?? 'Failed to parse DXF file.');
      setState('error');
    }
  }, []);

  /** Step 2: User selects 2 CAD reference points on the canvas */
  const setCADPoints = useCallback((a: Point2D, b: Point2D) => {
    setCadPointA(a);
    setCadPointB(b);
    setState('points_selected');
  }, []);

  /** Step 3: User enters 2 GPS reference coordinates */
  const setGPSPoints = useCallback((a: GeoPoint, b: GeoPoint) => {
    setGeoPointA(a);
    setGeoPointB(b);
    setState('gps_entered');
  }, []);

  /** Step 4: Run georeferencing pipeline */
  const computeAlignment = useCallback(() => {
    if (!cadModel || !cadPointA || !cadPointB || !geoPointA || !geoPointB) {
      setErrorMessage('Missing reference points. Select CAD and GPS points first.');
      setState('error');
      return;
    }

    try {
      setErrorMessage(null);

      // Run the full pipeline
      const result = georeferenceCAD(cadModel, cadPointA, cadPointB, geoPointA, geoPointB);

      // Convert to waypoints
      const waypoints = geoEntitiesToWaypoints(result.geoEntities, waypointConfig);

      setGeorefResult(result);
      setComputedWaypoints(waypoints);
      setState('computed');
    } catch (err: any) {
      setErrorMessage(err.message ?? 'Georeferencing computation failed.');
      setState('error');
    }
  }, [cadModel, cadPointA, cadPointB, geoPointA, geoPointB, waypointConfig]);

  /** Reset to idle state */
  const reset = useCallback(() => {
    setCadModel(null);
    setCadPointA(null);
    setCadPointB(null);
    setGeoPointA(null);
    setGeoPointB(null);
    setComputedWaypoints(null);
    setGeorefResult(null);
    setErrorMessage(null);
    setState('idle');
  }, []);

  return {
    state,
    cadModel,
    cadPointA,
    cadPointB,
    geoPointA,
    geoPointB,
    computedWaypoints,
    georefResult,
    errorMessage,
    loadDXF,
    setCADPoints,
    setGPSPoints,
    computeAlignment,
    reset,
  };
}
