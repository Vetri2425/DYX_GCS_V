import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Waypoint } from './types';
// import { Geodesic } from 'geographiclib'; // COMMENTED OUT: Using backend distance_to_next_m instead

interface Props {
  waypoints: Waypoint[];
  currentIndex: number | null;
  markedCount?: number;
  statusMap?: Record<number, {
    reached?: boolean;
    marked?: boolean;
    status?: 'completed' | 'loading' | 'skipped' | 'reached' | 'marked' | 'pending' | 'spray_on' | 'spray_off' | 'passed' | 'mission_end';
    timestamp?: string;
    pile?: string | number;
    rowNo?: string | number;
    remark?: string;
  }>;
  isMissionActive?: boolean;
  wpDistCm?: number; // DEPRECATED: Legacy backend distance, kept for backward compatibility
  distanceToNextM?: number; // Backend mission distance to next waypoint in meters (20Hz)

  // COMMENTED OUT: Frontend geodesic calculation replaced by backend distance_to_next_m
  currentRoverPosition?: {
    latitude: number;
    longitude: number;
  };
}

// Layout constants for quick adjustments
const PROGRESS_CARD_LAYOUT: { height?: number | string; minHeight?: number; width?: number | string; flex?: number } = {
  height: 200, // px or percentage string like '25%' (192 * 1.1 = 10% increase)
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
  distanceToNextM, // Backend mission distance to next waypoint in meters
  currentRoverPosition, // COMMENTED OUT: Frontend geodesic calculation replaced by backend
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

  // COMMENTED OUT: Frontend geodesic distance calculation
  // Now using backend distance_to_next_m (20Hz from mission_status events)
  // const calculateGeodesicDistance = (...) => { ... };
  // const distanceToCurrent = useMemo(() => { ... }, [isMissionActive, currentIndex, waypoints, currentRoverPosition]);

  /**
   * Format distance for display using backend distance_to_next_m
   *
   * Source: Backend mission_status events at 20Hz
   * Field: distance_to_next_m (meters)
   * Display: Converted to centimeters with 1 decimal place
   */
  const distanceText = useMemo(() => {
    if (!isMissionActive) {
      return '—';
    }

    if (distanceToNextM == null || distanceToNextM < 0) {
      return '—';
    }

    // Convert meters to centimeters for display
    const distanceCm = distanceToNextM * 100;
    return `${distanceCm.toFixed(1)}cm`;
  }, [isMissionActive, distanceToNextM]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="analytics" size={14} color={colors.accent} />
          </View>
          <Text style={styles.headerTitle}>PROGRESS</Text>
        </View>
        <View style={[styles.distanceBadge, { backgroundColor: 'rgba(103, 232, 249, 0.12)', borderColor: colors.accent }]}>
          <Text style={[styles.distanceBadgeText, { color: colors.accent }]}>
            {currentWp ? currentWp.sn : 0}/{totalWaypoints}
          </Text>
        </View>
      </View>

      {/* Distance Card */}
      <View style={styles.distanceCard}>
        <View style={[styles.distanceAccent, { backgroundColor: colors.accent }]} />
        <View style={styles.distanceCardInner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.distanceIconWrap, { borderColor: 'rgba(103, 232, 249, 0.3)' }]}>
              <Ionicons name="navigate-circle-outline" size={16} color={colors.accent} />
            </View>
            <Text style={styles.distanceCardLabel}>DISTANCE TO TARGET</Text>
          </View>
          <Text style={styles.distanceCardValue}>{distanceText}</Text>
        </View>
      </View>

      {/* Counters Row */}
      <View style={styles.counterRow}>
        {/* Last Marked */}
        <View style={[styles.counter, styles.markedCounter]}>
          <View style={[styles.counterAccent, { backgroundColor: colors.accent }]} />
          <View style={styles.counterInner}>
              <Text style={[styles.counterLabel, { color: 'rgba(103, 232, 249, 0.8)' }]}>LAST</Text>
            <Text style={[styles.counterValue, { color: colors.accent }]}>{markedCount}</Text>
          </View>
        </View>

        {/* Current */}
        <View style={[styles.counter, styles.currentCounter]}>
          <View style={[styles.counterAccent, { backgroundColor: colors.accent }]} />
          <View style={styles.counterInner}>
              <Text style={[styles.counterLabel, { color: 'rgba(103, 232, 249, 0.8)' }]}>CURRENT</Text>
            <Text style={[styles.counterValue, { color: colors.accent }]}>
              {currentWp ? currentWp.sn : '0'}
            </Text>
          </View>
        </View>

        {/* Next */}
        <View style={[styles.counter, styles.nextCounter]}>
          <View style={[styles.counterAccent, { backgroundColor: colors.accent }]} />
          <View style={styles.counterInner}>
              <Text style={[styles.counterLabel, { color: 'rgba(103, 232, 249, 0.8)' }]}>NEXT</Text>
            <Text style={[styles.counterValue, { color: colors.accent }]}>
              {nextWp ? nextWp.sn : '0'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    ...(PROGRESS_CARD_LAYOUT as any),
    backgroundColor: colors.panelBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 9,
    marginBottom: 12,
  },

  // ── HEADER ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  // ── DISTANCE CARD ──
  distanceCard: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  distanceAccent: {
    width: 2.5,
    backgroundColor: colors.accent,
    alignSelf: 'stretch',
  },
  distanceCardInner: {
    flex: 1,
    padding: 10,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distanceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceBadge: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  distanceCardLabel: {
    color: 'rgba(103, 232, 249, 0.8)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  distanceCardValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── COUNTERS ──
  counterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  counter: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  markedCounter: {
    backgroundColor: 'rgba(192, 132, 252, 0.08)',
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  currentCounter: {
    backgroundColor: 'rgba(103, 232, 249, 0.08)',
    borderColor: 'rgba(103, 232, 249, 0.3)',
  },
  nextCounter: {
    backgroundColor: 'rgba(110, 231, 183, 0.08)',
    borderColor: 'rgba(110, 231, 183, 0.3)',
  },
  counterAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  counterInner: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  counterLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
    marginBottom: 0.2,
  },
  counterValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});