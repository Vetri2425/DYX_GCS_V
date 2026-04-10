// ============================================================
// DXF Parser — Production-Grade CAD File Parser
// ============================================================
//
// Uses the `dxf-parser` library for raw parsing, then normalizes
// to our internal entity format with:
//   - Correct unit scaling (mm, cm, m, inch, foot, yard, km, mile)
//   - LWPOLYLINE bulge → Arc segment conversion
//   - POLYLINE (nested vertex format) support
//   - Proper Point entity (not faked as Line)
//   - Layer metadata on every entity
//   - Angle normalization (always radians, handle wrap-around)
//
// Bulge math:
//   bulge = tan(theta / 4) where theta is the included angle
//   theta = 4 * atan(bulge)
//   chordLength = distance between consecutive vertices
//   sagitta = chordLength * |bulge| / 2
//   radius = chordLength / (2 * sin(|theta| / 2))
//   Arc direction: bulge > 0 = CCW, bulge < 0 = CW

import DxfParserLib from 'dxf-parser';
import {
  CADModel,
  CADUnits,
  UNIT_TO_METER,
  Entity,
  Line,
  PointEntity,
  Polyline,
  PolylineSegment,
  Arc,
  Point2D,
} from '../geometry/types';

// ============================================================
// Unit Detection & Scaling
// ============================================================

/** DXF $INSUNITS integer codes → our unit strings (AutoCAD standard) */
const DXF_UNIT_MAP: Record<number, CADUnits> = {
  0:  'unknown',     // Unitless
  1:  'inch',        // Inches
  2:  'foot',        // Feet
  3:  'mile',        // Miles
  4:  'mm',          // Millimeters
  5:  'cm',          // Centimeters
  6:  'm',           // Meters
  7:  'microinch',   // Microinches
  8:  'mil',         // Mils
  9:  'yard',        // Yards
  10: 'unknown',     // Angstroms
  11: 'unknown',     // Nanometers
  12: 'unknown',     // Microns
  13: 'unknown',     // Decimeters
  14: 'unknown',     // Decameters
  15: 'unknown',     // Hectometers
  16: 'km',          // Kilometers
  17: 'unknown',     // Decimal inches
  18: 'unknown',     // Decimal feet
  19: 'unknown',     // Decimal yards
  20: 'm',           // Astronomical units
  21: 'm',           // Light years
  22: 'm',           // Parsecs
} as const;

/**
 * Detect the drawing units from DXF header.
 * Falls back to 'unknown' if $INSUNITS is not set.
 */
function detectUnits(dxf: any): CADUnits {
  const headerUnits = dxf?.header?.$INSUNITS;
  if (typeof headerUnits === 'number' && headerUnits in DXF_UNIT_MAP) {
    return DXF_UNIT_MAP[headerUnits] as CADUnits;
  }
  return 'unknown';
}

// ============================================================
// ID Generation
// ============================================================

let entityCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}_${++entityCounter}`;
}

// ============================================================
// Bulge → Arc Math
// ============================================================

/**
 * Compute arc parameters from a bulge value between two vertices.
 *
 * The bulge is the tangent of 1/4 of the included angle (theta)
 * that the arc subtends between the two vertices.
 *
 *   bulge = tan(theta / 4)
 *   theta = 4 * atan(bulge)
 *
 * Positive bulge = arc is CCW from start to end
 * Negative bulge = arc is CW from start to end
 *
 * @param start - Start vertex of the segment
 * @param end   - End vertex of the segment
 * @param bulge - Bulge value (non-zero)
 * @returns Arc parameters: center, radius, startAngle, endAngle
 */
function bulgeToArc(
  start: Point2D,
  end: Point2D,
  bulge: number
): { center: Point2D; radius: number; startAngle: number; endAngle: number } {
  // Chord vector and length
  const chordX = end.x - start.x;
  const chordY = end.y - start.y;
  const chordLength = Math.sqrt(chordX * chordX + chordY * chordY);

  // Included angle from bulge
  const theta = 4 * Math.atan(bulge);
  const absTheta = Math.abs(theta);

  // Radius: r = chord / (2 * sin(theta/2))
  // Guard against division by zero (straight line — should not reach here)
  const sinHalf = Math.sin(absTheta / 2);
  const radius = chordLength / (2 * sinHalf);

  // Midpoint of chord
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  // Distance from chord midpoint to arc center (sagitta geometry)
  // h = chord/2 * (1/|tan(theta/2)|) = r * cos(theta/2)
  // But we need the signed distance to determine which side of the chord the center is on.
  // Using: h = (chordLength/2) / tan(|theta|/2)
  // Sign: if bulge > 0, center is to the LEFT of the chord direction
  const cosHalf = Math.cos(absTheta / 2);
  const h = radius * cosHalf; // distance from chord midpoint to center

  // Perpendicular to chord (rotated 90° CCW)
  // Chord direction: (chordX, chordY)
  // Perpendicular: (-chordY, chordX) — normalized
  const perpX = -chordY / chordLength;
  const perpY = chordX / chordLength;

  // Center is on the left side of chord if bulge > 0
  const sign = bulge > 0 ? 1 : -1;
  const centerX = midX + sign * h * perpX;
  const centerY = midY + sign * h * perpY;

  // Start and end angles from center
  const startAngle = Math.atan2(start.y - centerY, start.x - centerX);
  const endAngle = Math.atan2(end.y - centerY, end.x - centerX);

  return { center: { x: centerX, y: centerY }, radius, startAngle, endAngle };
}

// ============================================================
// Angle Normalization
// ============================================================

/**
 * Normalize an angle to [0, 2π) range.
 * DXF stores angles in degrees; we always work in radians.
 */
function normalizeAngle(angleRad: number): number {
  const twoPi = 2 * Math.PI;
  let normalized = angleRad % twoPi;
  if (normalized < 0) normalized += twoPi;
  return normalized;
}

/**
 * Convert DXF angle (degrees) to radians, normalized to [0, 2π).
 */
function dxfAngleToRadians(degrees: number): number {
  return normalizeAngle((degrees * Math.PI) / 180);
}

// ============================================================
// Coordinate Scaling
// ============================================================

/**
 * Scale a point by the unit-to-meter factor.
 * All coordinates in the output are in meters.
 */
function scalePoint(p: Point2D, scale: number): Point2D {
  return { x: p.x * scale, y: p.y * scale };
}

// ============================================================
// Entity Conversion
// ============================================================

function convertLine(raw: any, unitScale: number): Line {
  const start = scalePoint(
    { x: raw.vertices[0].x ?? 0, y: raw.vertices[0].y ?? 0 },
    unitScale
  );
  const end = scalePoint(
    { x: raw.vertices[1].x ?? 0, y: raw.vertices[1].y ?? 0 },
    unitScale
  );

  return {
    id: nextId('line'),
    type: 'Line',
    start,
    end,
    layer: raw.layer ?? undefined,
  };
}

function convertPoint(raw: any, unitScale: number): PointEntity {
  const position = scalePoint(
    { x: raw.position?.x ?? 0, y: raw.position?.y ?? 0 },
    unitScale
  );

  return {
    id: nextId('point'),
    type: 'Point',
    position,
    layer: raw.layer ?? undefined,
  };
}

function convertArc(raw: any, unitScale: number): Arc {
  const center = scalePoint(
    { x: raw.center?.x ?? 0, y: raw.center?.y ?? 0 },
    unitScale
  );
  const radius = (raw.radius ?? 0) * unitScale;
  const startAngle = dxfAngleToRadians(raw.startAngle ?? 0);
  const endAngle = dxfAngleToRadians(raw.endAngle ?? 360);

  return {
    id: nextId('arc'),
    type: 'Arc',
    center,
    radius,
    startAngle,
    endAngle,
    layer: raw.layer ?? undefined,
  };
}

function convertCircle(raw: any, unitScale: number): Arc {
  const center = scalePoint(
    { x: raw.center?.x ?? 0, y: raw.center?.y ?? 0 },
    unitScale
  );
  const radius = (raw.radius ?? 0) * unitScale;

  return {
    id: nextId('arc'),
    type: 'Arc',
    center,
    radius,
    startAngle: 0,
    endAngle: 2 * Math.PI,
    layer: raw.layer ?? undefined,
  };
}

/**
 * Convert a LWPOLYLINE entity to our Polyline type.
 *
 * LWPOLYLINE stores vertices in a flat array with optional bulge per vertex.
 * The bulge on vertex i applies to the segment from vertex i to vertex i+1.
 *
 * Each segment is either:
 *   - Line (bulge === 0 or absent)
 *   - Arc (bulge !== 0)
 */
function convertLWPolyline(raw: any, unitScale: number): Polyline {
  const vertices: Array<{ x: number; y: number; bulge?: number }> = raw.vertices || [];
  const isClosed = raw.shape === true || raw.closed === true;

  // Scale all vertices
  const scaledVertices = vertices.map((v) =>
    scalePoint({ x: v.x ?? 0, y: v.y ?? 0 }, unitScale)
  );

  // Build segments
  const segments: PolylineSegment[] = [];
  const segmentCount = isClosed ? scaledVertices.length : scaledVertices.length - 1;

  for (let i = 0; i < segmentCount; i++) {
    const startIdx = i;
    const endIdx = (i + 1) % scaledVertices.length;
    const start = scaledVertices[startIdx];
    const end = scaledVertices[endIdx];
    const bulge = vertices[startIdx]?.bulge ?? 0;

    if (Math.abs(bulge) > 1e-10) {
      // Bulge present → Arc segment
      const arc = bulgeToArc(start, end, bulge);
      segments.push({
        segmentType: 'Arc',
        center: scalePoint(arc.center, 1), // already scaled via start/end
        radius: arc.radius,
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        to: end,
      });
    } else {
      // Straight segment
      segments.push({
        segmentType: 'Line',
        to: end,
      });
    }
  }

  return {
    id: nextId('polyline'),
    type: 'Polyline',
    startPoint: scaledVertices[0] ?? { x: 0, y: 0 },
    segments,
    closed: isClosed,
    layer: raw.layer ?? undefined,
  };
}

/**
 * Convert a POLYLINE entity (old-style, nested vertices).
 *
 * POLYLINE uses a different structure: vertices are in a separate
 * `vertices` array with full vertex objects (x, y, bulge).
 */
function convertPolyline(raw: any, unitScale: number): Polyline {
  const vertices: Array<{ x: number; y: number; bulge?: number }> = raw.vertices || [];
  const isClosed = raw.shape === true || raw.closed === true;

  if (vertices.length === 0) {
    // Empty polyline — return degenerate
    return {
      id: nextId('polyline'),
      type: 'Polyline',
      startPoint: { x: 0, y: 0 },
      segments: [],
      closed: false,
      layer: raw.layer ?? undefined,
    };
  }

  const scaledVertices = vertices.map((v) =>
    scalePoint({ x: v.x ?? 0, y: v.y ?? 0 }, unitScale)
  );

  const segments: PolylineSegment[] = [];
  const segmentCount = isClosed ? scaledVertices.length : scaledVertices.length - 1;

  for (let i = 0; i < segmentCount; i++) {
    const startIdx = i;
    const endIdx = (i + 1) % scaledVertices.length;
    const start = scaledVertices[startIdx];
    const end = scaledVertices[endIdx];
    const bulge = vertices[startIdx]?.bulge ?? 0;

    if (Math.abs(bulge) > 1e-10) {
      const arc = bulgeToArc(start, end, bulge);
      segments.push({
        segmentType: 'Arc',
        center: arc.center,
        radius: arc.radius,
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        to: end,
      });
    } else {
      segments.push({
        segmentType: 'Line',
        to: end,
      });
    }
  }

  return {
    id: nextId('polyline'),
    type: 'Polyline',
    startPoint: scaledVertices[0],
    segments,
    closed: isClosed,
    layer: raw.layer ?? undefined,
  };
}

// ============================================================
// Main Parser
// ============================================================

/**
 * Parse a DXF file string into our internal CADModel.
 *
 * All output coordinates are in meters (after unit scaling).
 *
 * @param dxfContent - Raw DXF file content as string
 * @returns CADModel with normalized entities, detected units, and unit scale
 * @throws Error if parsing fails
 */
export function parseDXF(dxfContent: string): CADModel {
  entityCounter = 0;

  const parser = new DxfParserLib();
  let dxf: any;

  try {
    dxf = parser.parse(dxfContent);
  } catch (err: any) {
    throw new Error(`DXF parse error: ${err.message ?? String(err)}`);
  }

  const units = detectUnits(dxf);
  const unitScale = UNIT_TO_METER[units];
  const entities: Entity[] = [];

  const rawEntities = dxf?.entities || [];

  for (const raw of rawEntities) {
    const entityType = raw.type?.toUpperCase();

    switch (entityType) {
      case 'LINE':
        if (raw.vertices && raw.vertices.length >= 2) {
          entities.push(convertLine(raw, unitScale));
        }
        break;

      case 'LWPOLYLINE':
        if (raw.vertices && raw.vertices.length >= 2) {
          entities.push(convertLWPolyline(raw, unitScale));
        }
        break;

      case 'POLYLINE':
        // Old-style polyline with nested vertices
        if (raw.vertices && raw.vertices.length >= 2) {
          entities.push(convertPolyline(raw, unitScale));
        }
        break;

      case 'ARC':
        entities.push(convertArc(raw, unitScale));
        break;

      case 'CIRCLE':
        entities.push(convertCircle(raw, unitScale));
        break;

      case 'POINT':
        entities.push(convertPoint(raw, unitScale));
        break;

      default:
        // Skip unsupported entity types silently
        break;
    }
  }

  return { entities, units, unitScale };
}

// ============================================================
// Mock CAD Model (for testing)
// ============================================================

/**
 * Create a mock CADModel for testing without a real DXF file.
 * Returns a 10×10 meter square with proper Point entity.
 */
export function createMockCADModel(): CADModel {
  return {
    units: 'm',
    unitScale: 1.0,
    entities: [
      {
        id: 'mock_line_1',
        type: 'Line',
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
        layer: '0',
      },
      {
        id: 'mock_line_2',
        type: 'Line',
        start: { x: 10, y: 0 },
        end: { x: 10, y: 10 },
        layer: '0',
      },
      {
        id: 'mock_line_3',
        type: 'Line',
        start: { x: 10, y: 10 },
        end: { x: 0, y: 10 },
        layer: '0',
      },
      {
        id: 'mock_line_4',
        type: 'Line',
        start: { x: 0, y: 10 },
        end: { x: 0, y: 0 },
        layer: '0',
      },
    ],
  };
}
