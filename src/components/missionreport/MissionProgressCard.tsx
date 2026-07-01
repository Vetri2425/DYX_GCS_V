import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { PATH_PLAN_GLASS, PATH_PLAN_HEADER } from '../../constants/pathPlanGlass';
import { Waypoint } from './types';
import type { WaypointUiStatus } from '../../types/missionWaypointStatus';
import { isTerminalWaypointStatus, isErrorWaypointStatus } from '../../types/missionWaypointStatus';
// import { Geodesic } from 'geographiclib'; // COMMENTED OUT: Using backend distance_to_next_m instead

interface Props {
  waypoints: Waypoint[];
  currentIndex: number | null;
  markedCount?: number;
  statusMap?: Record<number, {
    reached?: boolean;
    marked?: boolean;
    status?: WaypointUiStatus;
    timestamp?: string;
    pile?: string | number;
    rowNo?: string | number;
    remark?: string;
  }>;
  isMissionActive?: boolean;
  dragGesture?: any;
  isDraggingActive?: boolean;
  onClose?: () => void;
}

// Layout constants for quick adjustments
const PROGRESS_CARD_LAYOUT: { minHeight?: number; width?: number | string; flex?: number } = {
  minHeight: 100,
  width: '100%',
};

export const MissionProgressCard: React.FC<Props> = ({
  waypoints,
  currentIndex,
  markedCount: providedMarkedCount,
  statusMap = {},
  isMissionActive = false,
  dragGesture,
  isDraggingActive,
  onClose,
}) => {
  const totalWaypoints = waypoints.length;

  // Use provided markedCount (from real-time statusMap) or default to 0
  // Show 0 when mission is not active
  const markedCount = isMissionActive ? (providedMarkedCount ?? 0) : 0;

  // Check if mission is completed — a target in ANY terminal state (completed,
  // skipped, failed, aborted, stopped) counts as resolved, so a mission that
  // ended with a failure is treated as terminal, not still running/pending.
  const isMissionCompleted = waypoints.length > 0 && waypoints.every(wp => {
    const wpStatus = statusMap[wp.sn];
    return wpStatus && isTerminalWaypointStatus(wpStatus.status);
  }) && !isMissionActive;

  // Calculate completion stats — each terminal category stays distinct.
  const completedCount = waypoints.filter(wp => {
    const wpStatus = statusMap[wp.sn];
    return wpStatus && wpStatus.status === 'completed';
  }).length;

  const skippedCount = waypoints.filter(wp => {
    const wpStatus = statusMap[wp.sn];
    return wpStatus && wpStatus.status === 'skipped';
  }).length;

  // Failed / aborted / stopped — unsuccessful terminal targets.
  const errorCount = waypoints.filter(wp => {
    const wpStatus = statusMap[wp.sn];
    return wpStatus && isErrorWaypointStatus(wpStatus.status);
  }).length;

  // Total resolved (any terminal status) — progress never undercounts terminals.
  const terminalCount = waypoints.filter(wp => {
    const wpStatus = statusMap[wp.sn];
    return wpStatus && isTerminalWaypointStatus(wpStatus.status);
  }).length;

  const nextIndex = (currentIndex ?? -1) + 1;
  const currentWp = isMissionActive && currentIndex !== null && currentIndex >= 0 ? waypoints[currentIndex] : null;
  const nextWp = isMissionActive && nextIndex < totalWaypoints ? waypoints[nextIndex] : null;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={dragGesture}>
        <View style={[styles.header, isDraggingActive && styles.headerDragging]}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="analytics" size={14} color={PATH_PLAN_GLASS.cyan} />
            </View>
            <Text style={styles.headerTitle}>MISSION PROGRESS</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.distanceBadge, { backgroundColor: PATH_PLAN_GLASS.badgeBg, borderColor: PATH_PLAN_GLASS.border }]}>
              <Text style={[styles.distanceBadgeText, { color: PATH_PLAN_GLASS.cyan }]}>
                {currentWp ? currentWp.sn : 0}/{totalWaypoints}
              </Text>
            </View>
            {onClose && (
              <TouchableOpacity style={styles.headerCloseBtn} onPress={onClose} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={14} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GestureDetector>

      {/* Counters Row */}
      <View style={styles.counterRow}>
        {/* Last Marked */}
        <View style={[styles.counter, styles.markedCounter]}>
          <View style={[styles.counterAccent, { backgroundColor: PATH_PLAN_GLASS.cyan }]} />
          <View style={styles.counterInner}>
              <Text style={styles.counterLabel}>LAST</Text>
            <Text style={[styles.counterValue, { color: PATH_PLAN_GLASS.cyan }]}>{markedCount}</Text>
          </View>
        </View>

        {/* Current */}
        <View style={[styles.counter, styles.currentCounter]}>
          <View style={[styles.counterAccent, { backgroundColor: PATH_PLAN_GLASS.cyan }]} />
          <View style={styles.counterInner}>
              <Text style={styles.counterLabel}>CURRENT</Text>
            <Text style={[styles.counterValue, { color: PATH_PLAN_GLASS.cyan }]}>
              {currentWp ? currentWp.sn : '0'}
            </Text>
          </View>
        </View>

        {/* Next */}
        <View style={[styles.counter, styles.nextCounter]}>
          <View style={[styles.counterAccent, { backgroundColor: PATH_PLAN_GLASS.cyan }]} />
          <View style={styles.counterInner}>
              <Text style={styles.counterLabel}>NEXT</Text>
            <Text style={[styles.counterValue, { color: PATH_PLAN_GLASS.cyan }]}>
              {nextWp ? nextWp.sn : '0'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...(PROGRESS_CARD_LAYOUT as any),
    backgroundColor: PATH_PLAN_GLASS.panelBg,
    borderRadius: PATH_PLAN_GLASS.borderRadius,
    borderWidth: 1,
    borderColor: PATH_PLAN_GLASS.border,
    padding: 16,
    gap: 12,
  },

  // ── HEADER ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: PATH_PLAN_GLASS.borderSubtle,
  },
  headerDragging: {
    borderBottomColor: PATH_PLAN_GLASS.dragBorder,
    backgroundColor: PATH_PLAN_GLASS.dragBg,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCloseBtn: PATH_PLAN_HEADER.closeBtn,
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  headerIconWrap: PATH_PLAN_HEADER.iconWrap,
  headerTitle: PATH_PLAN_HEADER.title,
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distanceBadge: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distanceBadgeText: PATH_PLAN_HEADER.badgeText,

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
    fontSize: 7,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: PATH_PLAN_GLASS.label,
    marginBottom: 0.2,
  },
  counterValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
