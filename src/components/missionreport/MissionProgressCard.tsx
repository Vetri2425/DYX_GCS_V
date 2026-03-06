import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { Waypoint } from './types';
import { Geodesic } from 'geographiclib';

interface Props {
  waypoints: Waypoint[];
  currentIndex: number | null;
  markedCount?: number;
  statusMap?: Record<number, {
    reached?: boolean;
    marked?: boolean;
    status?: 'completed' | 'loading' | 'skipped' | 'reached' | 'marked' | 'pending';
    timestamp?: string;
    pile?: string | number;
    rowNo?: string | number;
    remark?: string;
  }>;
  isMissionActive?: boolean;
  wpDistCm?: number; // DEPRECATED: Legacy backend distance, kept for backward compatibility
  
  // NEW REQUIRED PROP: Current rover GPS position for accurate distance calculation
  currentRoverPosition?: {
    latitude: number;   // Rover's current GPS latitude (decimal degrees)
    longitude: number;  // Rover's current GPS longitude (decimal degrees)
  };
}

// Layout constants for quick adjustments
const PROGRESS_CARD_LAYOUT: { height?: number | string; minHeight?: number; width?: number | string; flex?: number } = {
  height: 192, // px or percentage string like '25%'
  minHeight: 100,
  width: '100%',
};

export const MissionProgressCard: React.FC<Props> = ({
  waypoints,
  currentIndex,
  markedCount: providedMarkedCount,
  statusMap = {},
  isMissionActive = false,
  wpDistCm, // DEPRECATED: Legacy backend distance
  currentRoverPosition, // NEW: Current rover GPS position
}) => {
  const totalWaypoints = waypoints.length;

  // Use provided markedCount (from real-time statusMap) or default to 0
  // Show 0 when mission is not active
  const markedCount = isMissionActive ? (providedMarkedCount ?? 0) : 0;

  // Check if mission is completed
  const isMissionCompleted = waypoints.length > 0 && waypoints.every(wp => {
    const wpStatus = statusMap[wp.sn];
    return wpStatus && (wpStatus.status === 'completed' || wpStatus.status === 'skipped');
  }) && !isMissionActive;

  // Calculate completion stats
  const completedCount = waypoints.filter(wp => {
    const wpStatus = statusMap[wp.sn];
    return wpStatus && wpStatus.status === 'completed';
  }).length;

  const skippedCount = waypoints.filter(wp => {
    const wpStatus = statusMap[wp.sn];
    return wpStatus && wpStatus.status === 'skipped';
  }).length;

  const nextIndex = (currentIndex ?? -1) + 1;
  const currentWp = isMissionActive && currentIndex !== null && currentIndex >= 0 ? waypoints[currentIndex] : null;
  const nextWp = isMissionActive && nextIndex < totalWaypoints ? waypoints[nextIndex] : null;

  /**
   * HIGH-PRECISION GEODETIC DISTANCE CALCULATION
   * 
   * Calculate distance using Karney's formula (WGS84 ellipsoid)
   * - Accuracy: ~15 nanometers for any distance on Earth
   * - Method: Solves inverse geodesic problem on WGS84 ellipsoid
   * - Better than Vincenty: More accurate and handles antipodal points
   * 
   * Reference: Karney, C. F. F. (2013). Algorithms for geodesics. 
   *            Journal of Geodesy, 87(1), 43-55.
   */
  const calculateGeodesicDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    try {
      // Initialize WGS84 ellipsoid (Earth's reference ellipsoid)
      const geod = Geodesic.WGS84;

      // Solve inverse geodesic problem
      const result = geod.Inverse(lat1, lon1, lat2, lon2);

      // Return distance in meters (s12 = geodesic distance)
      // Type assertion: GeographicLib always returns s12 for valid coordinates
      return (result as any).s12 ?? 0;
    } catch (error) {
      console.error('[MissionProgressCard] Geodesic calculation error:', error);
      return 0;
    }
  };

  /**
   * Calculate distance to current target waypoint (MEMOIZED)
   * 
   * Only recalculates when:
   * - Mission active status changes
   * - Current waypoint index changes
   * - Rover position updates
   * - Waypoints array changes
   */
  const distanceToCurrent = useMemo(() => {
    // Guard: Mission must be active
    if (!isMissionActive) {
      return null;
    }

    // Guard: Must have valid current waypoint index
    if (currentIndex === null || currentIndex < 0 || currentIndex >= waypoints.length) {
      return null;
    }

    // Guard: Must have current rover position
    if (!currentRoverPosition?.latitude || !currentRoverPosition?.longitude) {
      console.warn('[MissionProgressCard] Missing rover position for distance calculation');
      return null;
    }

    // Get target waypoint
    const targetWaypoint = waypoints[currentIndex];

    // Guard: Validate waypoint coordinates
    if (!targetWaypoint?.lat || !targetWaypoint?.lon) {
      console.error('[MissionProgressCard] Invalid waypoint coordinates at index', currentIndex);
      return null;
    }

    /**
     * Validate coordinate ranges (WGS84 bounds)
     * Valid latitude: -90 to 90
     * Valid longitude: -180 to 180
     */
    const isValidCoordinate = (lat: number, lon: number): boolean => {
      return (
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180 &&
        !isNaN(lat) &&
        !isNaN(lon) &&
        isFinite(lat) &&
        isFinite(lon)
      );
    };

    if (!isValidCoordinate(currentRoverPosition.latitude, currentRoverPosition.longitude)) {
      console.error('[MissionProgressCard] Invalid rover coordinates:', currentRoverPosition);
      return null;
    }

    if (!isValidCoordinate(targetWaypoint.lat, targetWaypoint.lon)) {
      console.error('[MissionProgressCard] Invalid waypoint coordinates:', targetWaypoint);
      return null;
    }

    // Calculate geodesic distance using Karney formula
    const distanceMeters = calculateGeodesicDistance(
      currentRoverPosition.latitude,
      currentRoverPosition.longitude,
      targetWaypoint.lat,
      targetWaypoint.lon
    );

    // Convert meters to centimeters for display
    const distanceCm = distanceMeters * 100;

    return distanceCm;
  }, [isMissionActive, currentIndex, waypoints, currentRoverPosition]);

  /**
   * Format distance for display
   * 
   * Display Rules:
   * - Mission inactive: Show "—" (em dash)
   * - No distance calculated: Show "—"
   * - Distance ≥ 0: Show with 1 decimal precision (e.g., "245.3cm")
   * 
   * Unit: Centimeters (cm) for consistency with original implementation
   * Precision: 1 decimal place (millimeter accuracy)
   */
  const distanceText = useMemo(() => {
    if (!isMissionActive) {
      return '—'; // Mission not active
    }

    if (distanceToCurrent === null) {
      return '—'; // No valid distance calculated
    }

    // Format with 1 decimal place
    return `${distanceToCurrent.toFixed(1)}cm`;
  }, [isMissionActive, distanceToCurrent]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MISSION PROGRESS</Text>
        <Text style={styles.progressCount}>
          {currentWp ? currentWp.sn : 0}/{totalWaypoints}
        </Text>
      </View>

      {/* Distance Row */}
      <View style={styles.distanceRow}>
        <Text style={styles.distanceLabel}>Distance</Text>
        <Text style={styles.distanceValue}>{distanceText}</Text>
      </View>

      {/* Counters Row - Numbers Only */}
      <View style={styles.counterRow}>
        <View style={[styles.counter, styles.markedCounter]}>
          <Text style={[styles.counterValue, { color: '#C084FC' }]}>{markedCount}</Text>
        </View>

        <View style={[styles.counter, styles.currentCounter]}>
          <Text style={[styles.counterValue, { color: '#67E8F9' }]}>
            {currentWp ? currentWp.sn : '0'}
          </Text>
        </View>

        <View style={[styles.counter, styles.nextCounter]}>
          <Text style={[styles.counterValue, { color: '#6EE7B7' }]}>
            {nextWp ? nextWp.sn : '0'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    ...(PROGRESS_CARD_LAYOUT as any),
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'column',
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#67E8F9',
    letterSpacing: 0.5,
  },
  progressCount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6EE7B7',
  },
  distanceRow: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distanceLabel: {
    fontSize: 13,
    color: colors.text,
  },
  distanceValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
  },
  counterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  counter: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  markedCounter: {
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.4)',
  },
  currentCounter: {
    backgroundColor: 'rgba(103, 232, 249, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.4)',
  },
  nextCounter: {
    backgroundColor: 'rgba(110, 231, 183, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.4)',
  },
  counterLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  counterValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});