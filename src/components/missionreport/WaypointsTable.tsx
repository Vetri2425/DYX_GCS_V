import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LegendList, LegendListRenderItemProps } from '@legendapp/list';
import { colors } from '../../theme/colors';
import { Waypoint } from './types';
import MissionReportExport from './MissionReportExport';

// ── Pure helper functions (extracted for reuse in memoized rows) ──────────────

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return '—';
  try {
    const timestampLocal = timestamp.replace('Z', '');
    const date = new Date(timestampLocal);
    if (isNaN(date.getTime())) return '—';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  } catch {
    return '—';
  }
}

function getAccuracyDisplay(wpStatus: any): { text: string; color: string | undefined } {
  if (!wpStatus) return { text: '', color: undefined };
  if (wpStatus.position_error_cm !== undefined && wpStatus.position_error_cm !== null && wpStatus.position_error_cm > 0) {
    const level = wpStatus.accuracy_level || 'unknown';
    const levelCapitalized = level.charAt(0).toUpperCase() + level.slice(1);
    let color = '#94A3B8';
    if (level === 'excellent') color = '#10B981';
    else if (level === 'good') color = '#F59E0B';
    else if (level === 'poor') color = '#EF4444';
    const positionErrorMm = wpStatus.position_error_cm * 10;
    return { text: `${levelCapitalized} - ${positionErrorMm.toFixed(1)}mm`, color };
  }
  return { text: '', color: undefined };
}

function getWaypointStatusDisplay(wpStatus: any): { statusDisplay: string; statusColor: string } {
  const s = wpStatus?.status;
  if (s === 'completed') return { statusDisplay: 'Completed', statusColor: '#10B981' };
  if (s === 'skipped')  return { statusDisplay: 'Skipped', statusColor: '#94A3B8' };
  if (s === 'marked')   return { statusDisplay: 'Marked', statusColor: '#3B82F6' };
  if (s === 'reached')  return { statusDisplay: 'Reached', statusColor: '#F59E0B' };
  if (s === 'loading')  return { statusDisplay: 'Loading', statusColor: '#FBBF24' };
  if (s === 'spray_on') return { statusDisplay: 'Spray ON', statusColor: '#3B82F6' };
  if (s === 'spray_off')return { statusDisplay: 'Spray OFF', statusColor: '#3B82F6' };
  if (s === 'passed')   return { statusDisplay: 'Passed', statusColor: '#2DD4BF' };
  if (s === 'mission_end') return { statusDisplay: 'Done', statusColor: '#10B981' };
  return { statusDisplay: 'Pending', statusColor: '#94A3B8' };
}

function getRemarkText(s: string | undefined, wpStatus: any, statusDisplay: string): string {
  if (s === 'completed') return 'Completed';
  if (s === 'skipped') return 'Skipped';
  if (s === 'marked') return 'Marked';
  if (s === 'reached') return 'Reached';
  if (s === 'loading') return 'Loading';
  if (s === 'spray_on' || s === 'spray_off' || s === 'passed' || s === 'mission_end') return wpStatus?.remark || statusDisplay;
  if (wpStatus) return 'Pending';
  return '';
}

// ── Memoized row component (recycled by LegendList) ───────────────────────────

interface RowProps {
  wp: Waypoint;
  index: number;
  wpStatus: any;
  isCurrentWaypoint: boolean;
}

const WaypointRow = React.memo(({ wp, index, wpStatus, isCurrentWaypoint }: RowProps) => {
  const { statusDisplay, statusColor } = getWaypointStatusDisplay(wpStatus);
  const isSkipped = wpStatus?.status === 'skipped';
  const s = wpStatus?.status;

  return (
    <View style={[
      styles.tableRow,
      index % 2 === 0 && styles.tableRowAlt,
      isCurrentWaypoint && styles.currentWaypointRow,
      isSkipped && styles.skippedRow,
    ]}>
      <Text style={[styles.cell, styles.colSN, styles.cellYellow, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{index + 1}</Text>
      <Text style={[styles.cell, styles.colBlock, styles.cellYellow, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.block}</Text>
      <Text style={[styles.cell, styles.colRow, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.row}</Text>
      <Text style={[styles.cell, styles.colPile, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.pile}</Text>
      <Text style={[styles.cell, styles.colLat, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.lat.toFixed(7)}</Text>
      <Text style={[styles.cell, styles.colLon, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.lon.toFixed(7)}</Text>
      <Text style={[styles.cell, styles.colAlt, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.alt.toFixed(2)}</Text>
      <View style={[styles.colStatus, isSkipped && styles.skippedStatusCell]}>
        <Text style={[styles.cell, { color: statusColor }, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>
          {statusDisplay} {isCurrentWaypoint ? '◄' : ''}
        </Text>
        {isSkipped && <View style={styles.skippedBadge}><Text style={styles.skippedBadgeText}>SKIPPED</Text></View>}
      </View>
      <Text style={[styles.cell, styles.colTime, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>
        {formatTimestamp(wpStatus?.timestamp)}
      </Text>
      <View style={[styles.colRemark, styles.remarkCell]}>
        <Text style={[styles.cell, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>
          {getRemarkText(s, wpStatus, statusDisplay)}
        </Text>
        {(() => {
          const { text: accuracyText, color: accuracyColor } = getAccuracyDisplay(wpStatus);
          const displayText = accuracyText || wpStatus?.remark || '';
          return displayText ? (
            <Text style={[
              styles.cell,
              styles.remarkDetail,
              isCurrentWaypoint && styles.currentWaypointText,
              isSkipped && styles.skippedText,
              accuracyColor && { color: accuracyColor },
            ]}>
              {displayText}
            </Text>
          ) : null;
        })()}
      </View>
    </View>
  );
});

// ── Main table component ─────────────────────────────────────────────────────

interface Props {
  waypoints: Waypoint[];
  onExport: () => void;
  onExportComplete?: () => void;
  onClear?: () => void;
  statusMap: Record<number, {
    reached?: boolean;
    marked?: boolean;
    status?: 'completed' | 'loading' | 'skipped' | 'reached' | 'marked' | 'pending' | 'spray_on' | 'spray_off' | 'passed' | 'mission_end';
    timestamp?: string;
    pile?: string | number;
    rowNo?: string | number;
    remark?: string;
    hrms?: number;
    vrms?: number;
    lat_achieved?: number;
    lon_achieved?: number;
    accuracy_level?: string;
    position_error_cm?: number;
  }>;
  missionMode: string | null;
  currentIndex?: number | null;
  pinnedCount?: number;
  onReorder?: (fromIndex: number, direction: 'up' | 'down') => void;
}

const ROW_HEIGHT = 42;

export const WaypointsTable: React.FC<Props> = ({ waypoints, onExport, onExportComplete, onClear, statusMap, missionMode, currentIndex, pinnedCount = 4, onReorder }) => {
  const currentWaypointNumber = currentIndex != null ? currentIndex + 1 : null;

  const renderItem = useCallback(
    (props: LegendListRenderItemProps<Waypoint>) => (
      <WaypointRow
        wp={props.item}
        index={props.index}
        wpStatus={statusMap[props.item.sn]}
        isCurrentWaypoint={currentWaypointNumber !== null && props.item.sn === currentWaypointNumber}
      />
    ),
    [statusMap, currentWaypointNumber],
  );

  const keyExtractor = useCallback((item: Waypoint) => `wp-${item.sn}`, []);

  return (
    <View style={styles.container}>
      <View style={styles.cardPadding}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>MISSION MARKING POINTS</Text>
          <View style={styles.headerButtons}>
            {onClear && (
              <TouchableOpacity style={styles.clearButton} onPress={onClear}>
                <Text style={styles.clearIcon}>🗑️</Text>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
            <MissionReportExport
              waypoints={waypoints}
              statusMap={statusMap}
              missionMode={missionMode}
              onExport={onExport}
              onExportComplete={onExportComplete}
            />
          </View>
        </View>

        {/* Table */}
        <View style={styles.tableWrapper}>
          {/* Fixed Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.colSN]}>S/N</Text>
            <Text style={[styles.headerCell, styles.colBlock]}>BLOCK</Text>
            <Text style={[styles.headerCell, styles.colRow]}>ROW</Text>
            <Text style={[styles.headerCell, styles.colPile]}>PILE</Text>
            <Text style={[styles.headerCell, styles.colLat]}>LATITUDE</Text>
            <Text style={[styles.headerCell, styles.colLon]}>LONGITUDE</Text>
            <Text style={[styles.headerCell, styles.colAlt]}>ALTITUDE</Text>
            <Text style={[styles.headerCell, styles.colStatus]}>STATUS</Text>
            <Text style={[styles.headerCell, styles.colTime]}>TIMESTAMP</Text>
            <Text style={[styles.headerCell, styles.colRemark]}>REMARK</Text>
          </View>

          {/* Virtualized table body — only visible rows are mounted */}
          <LegendList
            data={waypoints}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            recycleItems={true}
            estimatedItemSize={ROW_HEIGHT}
            getFixedItemSize={() => ROW_HEIGHT}
            style={styles.scrollableTableBody}
            showsVerticalScrollIndicator
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002244',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardPadding: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34, 211, 238, 0.3)',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 1,
    textAlign: 'center',
  },
  tableWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#051a30ff',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  headerCell: {
    color: '#07daf6ff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
  },
  scrollableTableBody: {
    flex: 1,
    maxHeight: 200,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(34, 211, 238, 0.3)',
  },
  tableRowAlt: {
    backgroundColor: 'transparent',
  },
  cell: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'left',
  },
  cellYellow: {
    color: colors.textSecondary,
  },
  currentWaypointRow: {
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#22D3EE',
  },
  currentWaypointText: {
    color: '#22D3EE',
    fontWeight: '600',
  },
  skippedRow: {
    opacity: 0.55,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  skippedText: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  skippedBadge: {
    marginLeft: 8,
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'center',
  },
  skippedBadgeText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
  },
  skippedStatusCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colSN: { flex: 0.7, textAlign: 'center' },
  colBlock: { flex: 0.9 },
  colRow: { flex: 0.8 },
  colPile: { flex: 0.8 },
  colLat: { flex: 1.2 },
  colLon: { flex: 1.2 },
  colAlt: { flex: 0.9 },
  colStatus: { flex: 1.0 },
  colTime: { flex: 1.2 },
  colRemark: { flex: 1.3 },
  remarkCell: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  remarkDetail: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    flexDirection: 'row',
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    gap: 6,
  },
  clearIcon: {
    fontSize: 14,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});