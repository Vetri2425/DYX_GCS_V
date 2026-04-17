import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { PathPlanWaypoint } from '../../types/pathplan';
import { optimizePath, PathAxis, PathDirection } from '../../utils/optimizePath';
import { vincentyDistance, calculateMissionDistance } from '../../utils/missionCalculator';

export type { PathAxis, PathDirection } from '../../utils/optimizePath';

interface PrecisePathPlanningDialogProps {
  visible: boolean;
  onClose: () => void;
  onApply: (optimizedWaypoints: PathPlanWaypoint[]) => void;
  waypoints: PathPlanWaypoint[];
}

const AXIS_OPTIONS: { value: PathAxis; label: string; description: string; icon: string }[] = [
  {
    value: 'EAST_WEST',
    label: 'East \u2194 West',
    description: 'Rows run left\u2192right, advance top\u2192bottom',
    icon: 'arrow-left-right',
  },
  {
    value: 'NORTH_SOUTH',
    label: 'North \u2194 South',
    description: 'Columns run top\u2192bottom, advance left\u2192right',
    icon: 'arrow-up-down',
  },
];

const DIRECTION_OPTIONS: { value: PathDirection; label: string; description: string }[] = [
  {
    value: 'FORWARD',
    label: 'Forward',
    description: 'First row goes left\u2192right (normal)',
  },
  {
    value: 'REVERSE',
    label: 'Reverse',
    description: 'First row goes right\u2192left (inverted)',
  },
];

export const PrecisePathPlanningDialog: React.FC<PrecisePathPlanningDialogProps> = ({
  visible,
  onClose,
  onApply,
  waypoints,
}) => {
  const [axis, setAxis] = useState<PathAxis>('EAST_WEST');
  const [direction, setDirection] = useState<PathDirection>('FORWARD');

  // Live preview — useMemo ensures O(n log n) only runs when inputs change
  const preview = useMemo(() => {
    if (waypoints.length < 2) return null;
    const optimized = optimizePath(waypoints, { axis, direction });

    const originalDistance = calculateMissionDistance(waypoints);
    const optimizedDistance = calculateMissionDistance(optimized);

    // Compute row/column count from grouping
    const groupKey = axis === 'EAST_WEST' ? 'lat' : 'lon';
    const sorted = [...waypoints].sort((a, b) => a[groupKey] - b[groupKey]);
    let groupCount = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i][groupKey] - sorted[i - 1][groupKey]) > 0.00001) {
        groupCount++;
      }
    }

    return { optimized, originalDistance, optimizedDistance, groupCount };
  }, [waypoints, axis, direction]);

  const handleApply = () => {
    if (waypoints.length < 2) {
      Alert.alert('Insufficient Waypoints', 'At least 2 waypoints are required for path optimization.');
      return;
    }

    if (!preview) return;

    // Validation: same count, no duplicates, no missing
    const optimized = preview.optimized;
    if (optimized.length !== waypoints.length) {
      Alert.alert('Error', 'Optimization produced a different number of waypoints. Please try again.');
      return;
    }

    const idSet = new Set(optimized.map(wp => wp.id));
    if (idSet.size !== optimized.length) {
      Alert.alert('Error', 'Optimization produced duplicate waypoint IDs. Please try again.');
      return;
    }

    onApply(optimized);
    onClose();
  };

  const formatDistance = (m: number): string => {
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(2)} km`;
  };

  const savingsPct = preview
    ? Math.max(0, ((preview.originalDistance - preview.optimizedDistance) / preview.originalDistance) * 100)
    : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconWrap}>
                <MaterialCommunityIcons name="map-marker-path" size={16} color={colors.accent} />
              </View>
              <Text style={styles.headerTitle}>PRECISE PATH</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Info card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>WAYPOINTS</Text>
                  <Text style={styles.infoValue}>{waypoints.length}</Text>
                </View>
                {preview && (
                  <>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>
                        {axis === 'EAST_WEST' ? 'ROWS' : 'COLUMNS'}
                      </Text>
                      <Text style={styles.infoValue}>{preview.groupCount}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>DISTANCE</Text>
                      <Text style={styles.infoValue}>{formatDistance(preview.optimizedDistance)}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Axis selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Traverse Axis</Text>
              <Text style={styles.sectionDescription}>
                Direction rows/columns run across the field
              </Text>
              {AXIS_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionBtn, axis === opt.value && styles.optionBtnActive]}
                  onPress={() => setAxis(opt.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionRadio}>
                    {axis === opt.value && <View style={styles.optionRadioDot} />}
                  </View>
                  <View style={styles.optionIconWrap}>
                    <MaterialCommunityIcons
                      name={opt.icon as any}
                      size={20}
                      color={axis === opt.value ? colors.accent : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Direction selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Start Direction</Text>
              <Text style={styles.sectionDescription}>
                Which way the first row/column traverses
              </Text>
              {DIRECTION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionBtn, direction === opt.value && styles.optionBtnActive]}
                  onPress={() => setDirection(opt.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionRadio}>
                    {direction === opt.value && <View style={styles.optionRadioDot} />}
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Savings preview */}
            {preview && preview.originalDistance > 0 && (
              <View style={styles.savingsCard}>
                <View style={styles.savingsRow}>
                  <View style={styles.savingsItem}>
                    <Text style={styles.savingsLabel}>CURRENT</Text>
                    <Text style={styles.savingsValue}>{formatDistance(preview.originalDistance)}</Text>
                  </View>
                  <View style={styles.savingsArrow}>
                    <MaterialCommunityIcons name="arrow-right" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.savingsItem}>
                    <Text style={styles.savingsLabel}>OPTIMIZED</Text>
                    <Text style={[styles.savingsValue, { color: colors.success }]}>
                      {formatDistance(preview.optimizedDistance)}
                    </Text>
                  </View>
                  {savingsPct > 0 && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>
                        -{savingsPct.toFixed(1)}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Zig-zag explanation */}
            <View style={styles.infoBox}>
              <MaterialCommunityIcons name="information" size={16} color={colors.accent} />
              <Text style={styles.infoBoxText}>
                Path optimization groups nearby points into rows or columns, then
                traverses them in a boustrophedon (zig-zag) pattern. This is a
                deterministic reorder — no clustering or TSP algorithms are used.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.7}>
              <MaterialCommunityIcons name="check-circle" size={18} color="#ffffff" />
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: colors.panelBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    letterSpacing: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  infoCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(103, 232, 249, 0.8)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 4,
    letterSpacing: 1,
  },
  sectionDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  optionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  savingsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savingsItem: {
    alignItems: 'center',
    flex: 1,
  },
  savingsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(103, 232, 249, 0.8)',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  savingsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  savingsArrow: {
    paddingHorizontal: 8,
  },
  savingsBadge: {
    backgroundColor: colors.success,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savingsBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    gap: 10,
    marginTop: 4,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 10,
    color: colors.accent,
    lineHeight: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.accent,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});