import { PathPlanWaypoint } from '../types/pathplan';
import { recalculateWaypointDistances } from './missionCalculator';

export type PathAxis = 'EAST_WEST' | 'NORTH_SOUTH';
export type PathDirection = 'FORWARD' | 'REVERSE';

export interface OptimizePathOptions {
  axis: PathAxis;
  direction: PathDirection;
}

/**
 * Group points by proximity on the secondary axis.
 * EAST_WEST: group by latitude (rows)
 * NORTH_SOUTH: group by longitude (columns)
 *
 * Uses a simple sort-then-merge approach:
 * sort by grouping key, then merge consecutive points
 * within the threshold into the same group.
 */
function groupByAxis(
  points: PathPlanWaypoint[],
  axis: PathAxis,
  threshold: number,
): PathPlanWaypoint[][] {
  const groupKey = axis === 'EAST_WEST' ? 'lat' : 'lon';
  const sorted = [...points].sort((a, b) => {
    const diff = a[groupKey] - b[groupKey];
    return axis === 'EAST_WEST' ? -diff : diff;
    // EAST_WEST: rows sorted top→bottom (lat DESC)
    // NORTH_SOUTH: columns sorted left→right (lon ASC)
  });

  const groups: PathPlanWaypoint[][] = [];
  let currentGroup: PathPlanWaypoint[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevKey = sorted[i - 1][groupKey];
    const currKey = sorted[i][groupKey];

    if (Math.abs(currKey - prevKey) <= threshold) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
    }
  }
  groups.push(currentGroup);

  return groups;
}

/**
 * Sort waypoints within each group by the primary axis.
 * EAST_WEST: sort each row by longitude (left→right)
 * NORTH_SOUTH: sort each column by latitude (top→bottom)
 */
function sortGroupInternally(
  groups: PathPlanWaypoint[][],
  axis: PathAxis,
): PathPlanWaypoint[][] {
  const sortKey = axis === 'EAST_WEST' ? 'lon' : 'lat';

  return groups.map(group =>
    [...group].sort((a, b) => {
      if (axis === 'NORTH_SOUTH') {
        // top→bottom = lat DESC
        return b[sortKey] - a[sortKey];
      }
      // left→right = lon ASC
      return a[sortKey] - b[sortKey];
    }),
  );
}

/**
 * Apply zig-zag (boustrophedon) reversal to alternate groups.
 *
 * For each group index:
 *   shouldReverse = (index % 2 === 1 && direction === FORWARD)
 *                  || (index % 2 === 0 && direction === REVERSE)
 */
function applyZigZag(
  groups: PathPlanWaypoint[][],
  direction: PathDirection,
): PathPlanWaypoint[][] {
  return groups.map((group, index) => {
    const shouldReverse =
      (index % 2 === 1 && direction === 'FORWARD') ||
      (index % 2 === 0 && direction === 'REVERSE');

    return shouldReverse ? [...group].reverse() : group;
  });
}

/**
 * Deterministic path reorder for structured grid traversal.
 *
 * This is NOT a path planning or TSP algorithm.
 * It groups points into rows/columns by proximity, sorts within
 * each group, and applies boustrophedon (zig-zag) traversal.
 *
 * Algorithm for EAST_WEST:
 *   1. Group by latitude (threshold ≈ 0.00001° ≈ 1.1m)
 *   2. Sort groups top→bottom (lat DESC)
 *   3. Sort within each group left→right (lon ASC)
 *   4. Apply zig-zag reversal
 *   5. Flatten, reassign IDs 1..N, recalculate distances
 *
 * Algorithm for NORTH_SOUTH:
 *   1. Group by longitude (threshold ≈ 0.00001°)
 *   2. Sort groups left→right (lon ASC)
 *   3. Sort within each column top→bottom (lat DESC)
 *   4. Apply zig-zag reversal
 *   5. Flatten, reassign IDs 1..N, recalculate distances
 *
 * Returns a NEW array — does NOT mutate input.
 */
export function optimizePath(
  points: PathPlanWaypoint[],
  options: OptimizePathOptions,
): PathPlanWaypoint[] {
  if (points.length === 0) return [];
  if (points.length <= 1) return [{ ...points[0], id: 1, distance: 0 }];

  const { axis, direction } = options;

  // ~0.00001° latitude ≈ 1.1m; good threshold for rover row detection
  const GROUP_THRESHOLD = 0.00001;

  // Step 1: Group by secondary axis
  const groups = groupByAxis(points, axis, GROUP_THRESHOLD);

  // Step 2: Sort within each group by primary axis
  const sortedGroups = sortGroupInternally(groups, axis);

  // Step 3: Apply zig-zag reversal
  const zigZagged = applyZigZag(sortedGroups, direction);

  // Step 4: Flatten
  const flattened = zigZagged.flat();

  // Step 5: Validate — no missing or duplicate waypoints
  if (flattened.length !== points.length) {
    // Should never happen with deterministic grouping, but guard anyway
    console.error(
      `[optimizePath] Length mismatch: input=${points.length}, output=${flattened.length}. ` +
      `Falling back to input with re-sequenced IDs.`,
    );
    return recalculateWaypointDistances(
      points.map((wp, i) => ({ ...wp, id: i + 1 })),
    );
  }

  // Step 6: Reassign sequential IDs and recalculate distances
  const resequenced = flattened.map((wp, index) => ({
    ...wp,
    id: index + 1,
  }));

  return recalculateWaypointDistances(resequenced);
}