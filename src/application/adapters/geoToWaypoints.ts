// ============================================================
// geoToWaypoints Adapter — GeoEntity → PathPlanWaypoint[]
// ============================================================
//
// Converts georeferenced entities (lat/lon) into PathPlanWaypoint
// format used by the PathPlanScreen.
//
// This adapter extracts waypoints from:
//   - GeoLine endpoints
//   - GeoPolyline vertices
//   - GeoArc centers (optional)
//   - GeoPointEntity positions
//
// The adapter is configurable: you can choose which entity types
// produce waypoints.

import { GeoEntity, GeoLine, GeoPolyline, GeoPointEntity, GeoArc } from '../../core/geometry/types';
import { PathPlanWaypoint } from '../../types/pathplan';

/** Configuration for the adapter */
export type GeoToWaypointConfig = {
  /** Include Line endpoints (default: true) */
  includeLines?: boolean;
  /** Include Polyline vertices (default: true) */
  includePolylines?: boolean;
  /** Include Arc centers as waypoints (default: false) */
  includeArcCenters?: boolean;
  /** Include Point entities as waypoints (default: true) */
  includePoints?: boolean;
  /** Default altitude for waypoints (default: 0) */
  defaultAlt?: number;
  /** Layer filter — only include entities from these layers (default: all) */
  layerFilter?: string[];
};

const DEFAULT_CONFIG: Required<GeoToWaypointConfig> = {
  includeLines: true,
  includePolylines: true,
  includeArcCenters: false,
  includePoints: true,
  defaultAlt: 0,
  layerFilter: [],
};

function passesLayerFilter(layer: string | undefined, filter: string[]): boolean {
  if (filter.length === 0) return true;
  if (!layer) return false;
  return filter.includes(layer);
}

/**
 * Convert GeoEntity[] → PathPlanWaypoint[]
 *
 * @param geoEntities - Georeferenced entities from georeferenceCAD
 * @param config - Adapter configuration
 * @returns PathPlanWaypoint array ready for updateWaypoints()
 */
export function geoEntitiesToWaypoints(
  geoEntities: GeoEntity[],
  config: GeoToWaypointConfig = {}
): PathPlanWaypoint[] {
  const cfg: Required<GeoToWaypointConfig> = { ...DEFAULT_CONFIG, ...config };
  const waypoints: PathPlanWaypoint[] = [];
  let wpId = 1;

  for (const entity of geoEntities) {
    // Layer filter
    if (!passesLayerFilter(entity.layer, cfg.layerFilter)) continue;

    switch (entity.type) {
      case 'Line': {
        if (!cfg.includeLines) continue;
        const line = entity as GeoLine;

        // Start point
        waypoints.push({
          id: wpId++,
          lat: line.geoStart.lat,
          lon: line.geoStart.lon,
          alt: line.geoStart.alt ?? cfg.defaultAlt,
          distance: 0,
          block: '',
          row: '',
          pile: `line_${wpId - 1}_start`,
          mark: false,
        });

        // End point
        waypoints.push({
          id: wpId++,
          lat: line.geoEnd.lat,
          lon: line.geoEnd.lon,
          alt: line.geoEnd.alt ?? cfg.defaultAlt,
          distance: 0,
          block: '',
          row: '',
          pile: `line_${wpId - 1}_end`,
          mark: false,
        });
        break;
      }

      case 'Point': {
        if (!cfg.includePoints) continue;
        const pt = entity as GeoPointEntity;

        waypoints.push({
          id: wpId++,
          lat: pt.geoPosition.lat,
          lon: pt.geoPosition.lon,
          alt: pt.geoPosition.alt ?? cfg.defaultAlt,
          distance: 0,
          block: '',
          row: '',
          pile: `point_${wpId - 1}`,
          mark: false,
        });
        break;
      }

      case 'Polyline': {
        if (!cfg.includePolylines) continue;
        const pl = entity as GeoPolyline;

        // Start vertex
        waypoints.push({
          id: wpId++,
          lat: pl.startGeo.lat,
          lon: pl.startGeo.lon,
          alt: pl.startGeo.alt ?? cfg.defaultAlt,
          distance: 0,
          block: '',
          row: '',
          pile: `polyline_${wpId - 1}_start`,
          mark: false,
        });

        // Subsequent vertices
        for (let i = 0; i < pl.segments.length; i++) {
          const seg = pl.segments[i];
          waypoints.push({
            id: wpId++,
            lat: seg.toGeo.lat,
            lon: seg.toGeo.lon,
            alt: seg.toGeo.alt ?? cfg.defaultAlt,
            distance: 0,
            block: '',
            row: '',
            pile: `polyline_${wpId - 1}_v${i + 1}`,
            mark: false,
          });
        }
        break;
      }

      case 'Arc': {
        if (!cfg.includeArcCenters) continue;
        const arc = entity as GeoArc;

        // Arc center as waypoint
        waypoints.push({
          id: wpId++,
          lat: arc.geoCenter.lat,
          lon: arc.geoCenter.lon,
          alt: arc.geoCenter.alt ?? cfg.defaultAlt,
          distance: 0,
          block: '',
          row: '',
          pile: `arc_center_${wpId - 1}`,
          mark: false,
        });
        break;
      }
    }
  }

  return waypoints;
}

/**
 * Extract ONLY polyline vertices as waypoints (most common use case).
 * This produces a continuous path following the CAD drawing.
 */
export function extractPolylineWaypoints(
  geoEntities: GeoEntity[],
  config: GeoToWaypointConfig = {}
): PathPlanWaypoint[] {
  return geoEntitiesToWaypoints(geoEntities, {
    ...config,
    includeLines: false,
    includePolylines: true,
    includeArcCenters: false,
    includePoints: false,
  });
}

/**
 * Extract ALL entity endpoints/vertices as waypoints.
 * This produces the densest waypoint set.
 */
export function extractAllWaypoints(
  geoEntities: GeoEntity[],
  config: GeoToWaypointConfig = {}
): PathPlanWaypoint[] {
  return geoEntitiesToWaypoints(geoEntities, {
    ...config,
    includeLines: true,
    includePolylines: true,
    includeArcCenters: true,
    includePoints: true,
  });
}
