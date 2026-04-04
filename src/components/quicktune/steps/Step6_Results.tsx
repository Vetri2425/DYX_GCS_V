import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { useRover } from '../../../context/RoverContext';
import { TUNED_PARAMS } from '../../../types/quicktune';
import { quickTuneService } from '../../../services/quickTuneService';
import { computeTuneResults, ParamChange } from '../../../utils/quicktuneResults';

// Re-export for unit testing
export { computeTuneResults } from '../../../utils/quicktuneResults';
export type { ParamChange } from '../../../utils/quicktuneResults';

// ============================================================================
// Component
// ============================================================================

interface Step6_ResultsProps {
  beforeParams: Record<string, number>;
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Step6_Results — QuickTune wizard step that shows before/after parameter
 * comparison with save functionality.
 *
 * Displays a comparison table of tuned parameters, allows saving gains
 * via quickTuneService.sendAuxFunction('save'), and fetches updated
 * params to show final results.
 */
export default function Step6_Results({ beforeParams, onClose }: Step6_ResultsProps) {
  const { services, connectionState } = useRover();
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [afterParams, setAfterParams] = useState<Record<string, number>>({});
  const [isFetching, setIsFetching] = useState(false);

  const fetchAfterParams = useCallback(async () => {
    setIsFetching(true);
    try {
      const paramsResult = await services.getParams();
      if (paramsResult.success) {
        const snapshot: Record<string, number> = {};
        paramsResult.params.forEach((param) => {
          if (TUNED_PARAMS.includes(param.name)) {
            snapshot[param.name] = param.value;
          }
        });
        setAfterParams(snapshot);
      }
    } catch (error) {
      console.error('Failed to fetch updated params:', error);
    } finally {
      setIsFetching(false);
    }
  }, [services]);

  const handleSaveGains = useCallback(async () => {
    if (connectionState !== 'connected') {
      Alert.alert(
        'Not Connected',
        'Please connect to the rover before saving gains.',
      );
      return;
    }

    setIsSaving(true);

    try {
      // Send AUX function to save gains (action: 'save')
      await quickTuneService.sendAuxFunction('save');

      // Fetch updated params after save
      await fetchAfterParams();
      setHasSaved(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Failed to Save Gains',
        `Could not save tuning gains: ${message}`,
        [{ text: 'OK' }],
      );
    } finally {
      setIsSaving(false);
    }
  }, [connectionState, fetchAfterParams]);

  const results = computeTuneResults(beforeParams, afterParams);

  const getChangeColor = (changePercent: number) => {
    if (changePercent === 0) return colors.textMuted;
    // Green for any change (improved or adjusted)
    return colors.success;
  };

  const getChangeIcon = (changePercent: number) => {
    if (changePercent === 0) return 'minus';
    if (changePercent > 0) return 'arrow-up';
    return 'arrow-down';
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentInner}
      >
        {/* ── HEADER ── */}
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Tuning Complete</Text>
            <Text style={styles.headerText}>
              {hasSaved
                ? 'Gains saved successfully. Review the parameter changes below.'
                : 'Save your tuning gains to apply the optimized parameters.'}
            </Text>
          </View>
        </View>

        {/* ── RESULTS TABLE ── */}
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <MaterialCommunityIcons name="table-column" size={20} color={colors.accent} />
            <Text style={styles.tableTitle}>Parameter Changes</Text>
          </View>

          {/* Table Header Row */}
          <View style={styles.tableRow}>
            <Text style={[styles.tableCellText, styles.tableCellParam]}>Parameter</Text>
            <Text style={[styles.tableCellText, styles.tableCellValue]}>Before</Text>
            <Text style={[styles.tableCellText, styles.tableCellValue]}>After</Text>
            <Text style={[styles.tableCellText, styles.tableCellChange]}>Change</Text>
          </View>

          {/* Loading State */}
          {isFetching && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>Fetching updated parameters...</Text>
            </View>
          )}

          {/* Data Rows */}
          {!isFetching && results.length > 0 && (
            results.map((change, index) => (
              <View
                key={change.name}
                style={[
                  styles.tableRow,
                  index === results.length - 1 && styles.tableRowLast,
                ]}
              >
                <Text style={[styles.tableCellText, styles.tableCellParam]} numberOfLines={1}>
                  {change.name}
                </Text>
                <Text style={[styles.tableCellText, styles.tableCellValue]}>
                  {change.before.toFixed(2)}
                </Text>
                <Text style={[styles.tableCellText, styles.tableCellValue]}>
                  {hasSaved ? change.after.toFixed(2) : '—'}
                </Text>
                <View style={styles.tableCellChange}>
                  {hasSaved ? (
                    <View style={styles.changeBadge}>
                      <Ionicons
                        name={getChangeIcon(change.changePercent) as any}
                        size={14}
                        color={getChangeColor(change.changePercent)}
                      />
                      <Text
                        style={[
                          styles.changeText,
                          { color: getChangeColor(change.changePercent) },
                        ]}
                      >
                        {change.changePercent > 0 ? '+' : ''}
                        {change.changePercent.toFixed(1)}%
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.pendingText}>—</Text>
                  )}
                </View>
              </View>
            ))
          )}

          {/* Empty State */}
          {!isFetching && results.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="information-circle-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>No parameter data available</Text>
            </View>
          )}
        </View>

        {/* Spacer for scroll */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── ACTION BAR ── */}
      <View style={styles.actionBar}>
        {!hasSaved ? (
          <TouchableOpacity
            style={[
              styles.saveButton,
              (isSaving || connectionState !== 'connected') && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveGains}
            disabled={isSaving || connectionState !== 'connected'}
          >
            {isSaving ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.saveButtonText}>Saving...</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="content-save-check" size={22} color="#fff" />
                <Text style={styles.saveButtonText}>Save Gains</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onClose}
          >
            <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: 16,
    gap: 16,
  },

  // ── HEADER CARD ──
  headerCard: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  headerText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  // ── TABLE CARD ──
  tableCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.panelBg,
  },
  tableTitle: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ── TABLE ROWS ──
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCellText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tableCellParam: {
    flex: 2,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  tableCellValue: {
    flex: 1,
    color: colors.textSecondary,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  tableCellChange: {
    flex: 1.2,
    alignItems: 'center',
  },

  // ── CHANGE BADGE ──
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  pendingText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  // ── LOADING ──
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },

  // ── EMPTY STATE ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },

  // ── ACTION BAR ──
  actionBar: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.panelBg,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 14,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
