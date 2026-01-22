import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../theme/colors';
import { Waypoint } from './types';
import MissionReportExport from './MissionReportExport';
import { formatAccuracyDisplay, getAccuracyLevel } from '../../utils/accuracyCalculation';

interface Props {
  waypoints: Waypoint[];
  onExport: () => void;
  onExportComplete?: () => void;
  statusMap: Record<number, {
    reached?: boolean;
    marked?: boolean;
    status?: 'completed' | 'loading' | 'skipped' | 'reached' | 'marked' | 'pending';
    timestamp?: string;
    pile?: string | number;
    rowNo?: string | number;
    remark?: string;
    // Accuracy fields
    hrms?: number;
    vrms?: number;
    lat_achieved?: number;
    lon_achieved?: number;
    accuracy_level?: string;
    position_error_mm?: number;
  }>;
  missionMode: string | null;
  currentIndex?: number | null; // Currently active waypoint index
  pinnedCount?: number; // number of top, fixed waypoints (non-movable)
  onReorder?: (fromIndex: number, direction: 'up' | 'down') => void; // reorder handler
}

export const WaypointsTable: React.FC<Props> = ({ waypoints, onExport, onExportComplete, statusMap, missionMode, currentIndex, pinnedCount = 4, onReorder }) => {
  // Format ISO timestamp to readable time string
  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return '—';
    try {
      // CRITICAL FIX: Backend sends IST time but marks it as UTC with 'Z'
      // We need to strip the 'Z' and parse as local time
      // Example: "2026-01-20T15:26:17.056849Z" should be treated as local IST (15:26), not UTC
      
      const timestampLocal = timestamp.replace('Z', ''); // Remove UTC marker
      const date = new Date(timestampLocal);
      
      if (isNaN(date.getTime())) return '—';
      
      // Get local time components
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      
      return `${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error('[WaypointsTable] Error formatting timestamp:', error);
      return '—';
    }
  };

  // Get accuracy display text and color
  const getAccuracyDisplay = (wpStatus: any) => {
    if (!wpStatus?.position_error_mm) {
      return { text: '', color: undefined };
    }
    
    const accuracy = getAccuracyLevel(wpStatus.position_error_mm);
    const text = formatAccuracyDisplay(wpStatus.position_error_mm, accuracy);
    return { text, color: accuracy.color };
  };

  // Calculate display status and color based on statusMap
  const getWaypointStatus = (wp: Waypoint, index: number) => {
    const wpStatus = statusMap[wp.sn];
    
    let statusDisplay = 'Pending';
    let statusColor = '#94A3B8'; // Gray for pending
    
    if (wpStatus?.status === 'completed') {
      statusDisplay = 'Completed';
      statusColor = '#10B981'; // Green
    } else if (wpStatus?.marked) {
      statusDisplay = 'Marked';
      statusColor = '#3B82F6'; // Blue
    } else if (wpStatus?.reached) {
      statusDisplay = 'Reached';
      statusColor = '#F59E0B'; // Orange
    } else if (wpStatus?.status === 'loading') {
      statusDisplay = 'Loading';
      statusColor = '#FBBF24'; // Yellow
    } else if (wpStatus?.status === 'skipped') {
      statusDisplay = 'Skipped';
      statusColor = '#94A3B8'; // Gray
    }
    
    return { statusDisplay, statusColor, wpStatus };
  };

  return (
    <View style={styles.container}>
      <View style={styles.cardPadding}>
        {/* Header Row */}
        <View style={styles.headerRow}>
        <Text style={styles.title}>MISSION MARKING POINTS</Text>
        <MissionReportExport
          waypoints={waypoints}
          statusMap={statusMap}
          missionMode={missionMode}
          onExport={onExport}
          onExportComplete={onExportComplete}
        />
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

        {/* Scrollable Table Body - All Waypoints */}
        <ScrollView style={styles.scrollableTableBody} showsVerticalScrollIndicator>
          {waypoints.map((wp, index) => {
            const { statusDisplay, statusColor, wpStatus } = getWaypointStatus(wp, index);
            // Fix: Compare waypoint sn with current waypoint number (currentIndex + 1 since currentIndex is 0-based)
            const currentWaypointNumber = currentIndex !== null && currentIndex !== undefined ? currentIndex + 1 : null;
            const isCurrentWaypoint = currentWaypointNumber !== null && wp.sn === currentWaypointNumber;
            
            const isSkipped = wpStatus?.status === 'skipped';
            return (
              <View key={`wp-${index}-${wp.sn}-${wp.lat}-${wp.lon}`} style={[
                styles.tableRow, 
                index % 2 === 0 && styles.tableRowAlt,
                isCurrentWaypoint && styles.currentWaypointRow,
                isSkipped && styles.skippedRow
              ]}>
                <Text style={[styles.cell, styles.colSN, styles.cellYellow, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.sn}</Text>
                <Text style={[styles.cell, styles.colBlock, styles.cellYellow, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.block}</Text>
                <Text style={[styles.cell, styles.colRow, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.row}</Text>
                <Text style={[styles.cell, styles.colPile, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.pile}</Text>
                <Text style={[styles.cell, styles.colLat, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.lat.toFixed(7)}</Text>
                <Text style={[styles.cell, styles.colLon, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.lon.toFixed(7)}</Text>
                <Text style={[styles.cell, styles.colAlt, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{wp.alt.toFixed(2)}</Text>
                <View style={[styles.cell, styles.colStatus, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedStatusCell]}>
                  <Text style={[{ color: statusColor }, isSkipped && styles.skippedText]}>{statusDisplay} {isCurrentWaypoint ? '◄' : ''}</Text>
                  {isSkipped && <View style={styles.skippedBadge}><Text style={styles.skippedBadgeText}>SKIPPED</Text></View>}
                </View>
                <Text style={[styles.cell, styles.colTime, isCurrentWaypoint && styles.currentWaypointText, isSkipped && styles.skippedText]}>{formatTimestamp(wpStatus?.timestamp)}</Text>
                <Text style={[
                  styles.cell, 
                  styles.colRemark, 
                  isCurrentWaypoint && styles.currentWaypointText, 
                  isSkipped && styles.skippedText,
                  getAccuracyDisplay(wpStatus).color && { color: getAccuracyDisplay(wpStatus).color }
                ]}>
                  {getAccuracyDisplay(wpStatus).text || wpStatus?.remark || (wpStatus?.status === 'skipped' ? 'Skipped' : wpStatus?.status === 'completed' ? 'Completed' : 'Pending')}
                </Text>
              </View>
            );
          })}
        </ScrollView>
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
    fontSize: 14,
    fontWeight: '600',
    color: '#67E8F9',
    letterSpacing: 0.5,
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
    //borderBottomWidth: 1,
    //borderBottomColor: 'rgba(34, 211, 238, 0.3)',
  },
  headerCell: {
    color: '#07daf6ff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
  },
  fixedTableBody: {
    // Fixed height for exactly 1 rows
  },
  scrollableTableBody: {
    flex: 1,
    maxHeight: 200, // Increased height to show more rows
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
    backgroundColor: 'rgba(255,255,255,0.02)'
  },
  skippedText: {
    textDecorationLine: 'line-through',
    color: '#94A3B8'
  },
  skippedBadge: {
    marginLeft: 8,
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'center'
  },
  skippedBadgeText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700'
  },
  skippedStatusCell: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  // Column widths (flexible to fit container)
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
});
