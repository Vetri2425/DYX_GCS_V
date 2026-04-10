import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { SAVE_COUNTDOWN_TICK_MS } from '../../../constants/quicktune';
import { computeTuneResults, ParamChange } from '../../../utils/quicktuneResults';
import { qtLog } from '../../../utils/quicktuneLogger';

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
  const [saveCountdown, setSaveCountdown] = useState<number | null>(null);

  // Refs to track mounted state and pending timers for cleanup on unmount
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const fetchAfterParams = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsFetching(true);
    qtLog.api('Step6', 'GET', '/api/params/{name} x11 (post-save fetch)');
    try {
      const snapshot: Record<string, number> = {};
      await Promise.all(
        TUNED_PARAMS.map(async (name) => {
          try {
            const result = await services.getParam(name);
            snapshot[name] = result.param?.value ?? 0;
          } catch {
            qtLog.warn('Step6', `Failed to fetch ${name} post-save`);
            snapshot[name] = 0;
          }
        })
      );
      if (!mountedRef.current) return;
      qtLog.apiResult('Step6', '/api/params/{name} x11', snapshot);
      setAfterParams(snapshot);
    } catch (error) {
      qtLog.error('Step6', 'Failed to fetch updated params', error);
      if (!mountedRef.current) return;
      console.error('Failed to fetch updated params:', error);
    } finally {
      if (mountedRef.current) setIsFetching(false);
    }
  }, [services]);

  const handleSaveGains = useCallback(async () => {
    if (connectionState !== 'connected') {
      Alert.alert('Not Connected', 'Please connect to the rover before saving gains.');
      return;
    }

    setIsSaving(true);

    try {
      qtLog.api('Step6', 'POST', '/api/quicktune/aux_function', { action: 'save' });
      const result = await quickTuneService.sendAuxFunction('save');
      qtLog.apiResult('Step6', '/api/quicktune/aux_function save', result);
      if (!mountedRef.current) return;

      // Start countdown from auto_save_seconds (default 5)
      const countdownSec = result.auto_save_seconds ?? 5;
      setSaveCountdown(countdownSec);

      // Tick down every second — store ref so unmount can clear it
      let remaining = countdownSec;
      intervalRef.current = setInterval(() => {
        if (!mountedRef.current) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return;
        }
        remaining -= 1;
        setSaveCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setSaveCountdown(null);
        }
      }, SAVE_COUNTDOWN_TICK_MS);

      // Wait for the countdown to finish before fetching params — store ref so unmount can cancel it
      await new Promise<void>((resolve) => {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          resolve();
        }, countdownSec * 1000);
      });

      if (!mountedRef.current) return;

      // Fetch updated params after save
      await fetchAfterParams();
      if (mountedRef.current) {
        qtLog.info('Step6', 'Gains saved and params refreshed');
        setHasSaved(true);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      qtLog.error('Step6', 'Failed to save gains', { message, error });
      Alert.alert('Failed to Save Gains', `Could not save tuning gains: ${message}`, [{ text: 'OK' }]);
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  }, [connectionState, fetchAfterParams]);

  const results = computeTuneResults(beforeParams, afterParams);

  const getChangeColor = (changePercent: number) => {
    if (changePercent === 0) return colors.textMuted;
    // Green for any change (improved or adjusted)
    return colors.success;
  };

  const getChangeIcon = (changePercent: number): 'remove' | 'arrow-up' | 'arrow-down' => {
    if (changePercent === 0) return 'remove';
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
          <View style={[styles.tableRow, styles.tableHeadRow]}>
            <Text style={[styles.tableHeadText, styles.tableCellParam]}>Parameter</Text>
            <Text style={[styles.tableHeadText, styles.tableCellValue, styles.tableHeadValue]}>Before</Text>
            <Text style={[styles.tableHeadText, styles.tableCellValue, styles.tableHeadValue]}>After</Text>
            <Text style={[styles.tableHeadText, styles.tableCellChangeText]}>Change</Text>
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
                  {String(change.before)}
                </Text>
                <Text style={[styles.tableCellText, styles.tableCellValue]}>
                  {hasSaved ? String(change.after) : '—'}
                </Text>
                <View style={styles.tableCellChange}>
                  {hasSaved ? (
                    <View style={styles.changeBadge}>
                      <Ionicons
                        name={getChangeIcon(change.changePercent)}
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
        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* ── SAVE COUNTDOWN BANNER ── */}
      {saveCountdown !== null && saveCountdown > 0 && (
        <View style={styles.countdownBanner}>
          <ActivityIndicator size="small" color={colors.warning} />
          <Text style={styles.countdownText}>
            Saving PID parameters — do NOT power off ({saveCountdown}s)
          </Text>
        </View>
      )}

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
            accessibilityRole="button"
            accessibilityLabel="Save tuning gains to vehicle"
            accessibilityState={{ disabled: isSaving || connectionState !== 'connected' }}
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
            accessibilityRole="button"
            accessibilityLabel="Close wizard"
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
  tableHeadRow: {
    paddingVertical: 8,
    backgroundColor: colors.panelBg + '70',
  },
  tableCellText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tableHeadText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tableCellParam: {
    flex: 1.6,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    fontWeight: '600',
    fontSize: 10,
  },
  tableCellValue: {
    flex: 1.8,
    color: colors.textSecondary,
    textAlign: 'right',
    paddingRight: 10,
    fontFamily: 'monospace',
    fontSize: 10,
  },
  tableHeadValue: {
    textAlign: 'center',
    paddingRight: 0,
  },
  tableCellChange: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCellChangeText: {
    flex: 1,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
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
  countdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.warning + '18',
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  countdownText: {
    flex: 1,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
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
  scrollSpacer: { height: 20 },
});

