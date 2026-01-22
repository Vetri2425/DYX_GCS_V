import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { Waypoint } from './types';

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
  roverPosition?: { lat: number; lng: number } | null;
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
  roverPosition,
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

  // Calculate distance between two points using Vincenty formula
  // (More accurate than Haversine - accurate to within 0.5mm vs ~0.5% error)
  const calculateDistance = (point1: { lat: number; lon?: number; lng?: number } | null, point2: { lat: number; lon?: number; lng?: number } | null): number => {
    if (!point1 || !point2) return 0;

    const lon1 = point1.lon ?? point1.lng ?? 0;
    const lon2 = point2.lon ?? point2.lng ?? 0;

    // WGS-84 ellipsoid parameters
    const a = 6378137.0; // semi-major axis in meters
    const b = 6356752.314245; // semi-minor axis in meters
    const f = 1 / 298.257223563; // flattening

    const lat1 = (point1.lat * Math.PI) / 180;
    const lat2 = (point2.lat * Math.PI) / 180;
    const lon1Rad = (lon1 * Math.PI) / 180;
    const lon2Rad = (lon2 * Math.PI) / 180;

    const L = lon2 - lon1;
    const U1 = Math.atan((1 - f) * Math.tan(lat1));
    const U2 = Math.atan((1 - f) * Math.tan(lat2));
    const sinU1 = Math.sin(U1);
    const cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2);
    const cosU2 = Math.cos(U2);

    let lambda = L;
    let lambdaP: number;
    let iterLimit = 100;
    let cosSqAlpha: number;
    let sinSigma: number;
    let cos2SigmaM: number;
    let cosSigma: number;
    let sigma: number;

    do {
      const sinLambda = Math.sin(lambda);
      const cosLambda = Math.cos(lambda);
      sinSigma = Math.sqrt(
        (cosU2 * sinLambda) * (cosU2 * sinLambda) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) *
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda)
      );
      
      if (sinSigma === 0) return 0; // co-incident points
      
      cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
      sigma = Math.atan2(sinSigma, cosSigma);
      const sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
      cosSqAlpha = 1 - sinAlpha * sinAlpha;
      cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
      
      if (!Number.isFinite(cos2SigmaM)) cos2SigmaM = 0; // equatorial line
      
      const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
      lambdaP = lambda;
      lambda = L + (1 - C) * f * sinAlpha *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma *
          (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);

    if (iterLimit === 0) {
      // Vincenty failed to converge, fall back to Haversine
      const R = 6371000;
      const dLat = lat2 - lat1;
      const dLon = lon2 - lon1;
      const aHav = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const cHav = 2 * Math.atan2(Math.sqrt(aHav), Math.sqrt(1 - aHav));
      return R * cHav;
    }

    const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    const deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma *
      (-1 + 2 * cos2SigmaM * cos2SigmaM) - B / 6 * cos2SigmaM *
      (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

    const distance = b * A * (sigma - deltaSigma);
    return Number.isFinite(distance) && distance >= 0 ? distance : 0;
  };

  // Calculate live distance: from rover position to next waypoint if mission active
  const distance = isMissionActive && roverPosition && nextWp
    ? calculateDistance(roverPosition, nextWp)
    : calculateDistance(currentWp, nextWp);
  const distanceText = distance > 0 ? `${(distance * 100).toFixed(1)}cm` : '—';

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