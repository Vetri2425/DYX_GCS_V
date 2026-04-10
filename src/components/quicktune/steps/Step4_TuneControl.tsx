import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ParamGetResponse } from '../../../types/params';
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
import { qtLog } from '../../../utils/quicktuneLogger';

interface Step4_TuneControlProps {
  onComplete: (snapshot: Record<string, number>) => void;
  onBack: () => void;
  onAbort: () => void;
}

/**
 * Step4_TuneControl — QuickTune wizard step that initiates the tuning process.
 *
 * Snapshots current tuned parameters, sends DO_AUX_FUNCTION(300, pos=1)
 * via quickTuneService.sendAuxFunction('start') to start the tune,
 * and displays an info card with the param list.
 */
export default function Step4_TuneControl({ onComplete, onBack, onAbort }: Step4_TuneControlProps) {
  const { services, connectionState } = useRover();
  const [isStarting, setIsStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, number | null>>({});
  const [isLoadingParams, setIsLoadingParams] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch current param values on mount so the table shows real data immediately
  useEffect(() => {
    if (connectionState !== 'connected') {
      setIsLoadingParams(false);
      return;
    }

    const fetchParams = async () => {
      setIsLoadingParams(true);
      qtLog.info('Step4', `Fetching ${TUNED_PARAMS.length} tuned params on mount`);
      const values: Record<string, number | null> = {};
      const promises = TUNED_PARAMS.map(async (name) => {
        try {
          const result: ParamGetResponse = await services.getParam(name);
          values[name] = result.param?.value ?? null;
        } catch {
          qtLog.warn('Step4', `Failed to fetch ${name}`);
          values[name] = null;
        }
      });
      await Promise.all(promises);
      if (!mountedRef.current) return;
      qtLog.info('Step4', 'Params loaded for display', values);
      setParamValues(values);
      setIsLoadingParams(false);
    };

    fetchParams();
  }, [connectionState, services]);

  const handleStartTune = useCallback(async () => {
    if (connectionState !== 'connected') {
      Alert.alert('Not Connected', 'Please connect to the rover before starting the tune process.');
      return;
    }

    setIsStarting(true);

    try {
      // Pre-check: get quicktune status to validate readiness
      try {
        qtLog.api('Step4', 'GET', '/api/quicktune/status');
        const status = await quickTuneService.getStatus();
        qtLog.apiResult('Step4', '/api/quicktune/status', status);
        if (!mountedRef.current) return;
        if (status.reboot_required) {
          qtLog.warn('Step4', 'Blocked — reboot required', status);
          Alert.alert('Reboot Required', 'The flight controller needs a reboot before tuning can start.');
          setIsStarting(false);
          return;
        }
        if (status.SCR_ENABLE !== 1) {
          qtLog.warn('Step4', 'Blocked — SCR_ENABLE != 1', { SCR_ENABLE: status.SCR_ENABLE });
          Alert.alert('Scripting Disabled', 'SCR_ENABLE must be set to 1. Go back to Step 1 to fix this.');
          setIsStarting(false);
          return;
        }
        if (status.RTUN_ENABLE !== 1) {
          qtLog.warn('Step4', 'Blocked — RTUN_ENABLE != 1', { RTUN_ENABLE: status.RTUN_ENABLE });
          Alert.alert('QuickTune Disabled', 'RTUN_ENABLE must be set to 1. Go back to Step 1 to fix this.');
          setIsStarting(false);
          return;
        }
        qtLog.info('Step4', 'Pre-check passed', { SCR_ENABLE: status.SCR_ENABLE, RTUN_ENABLE: status.RTUN_ENABLE, mode: status.current_mode });
      } catch (err) {
        if (!mountedRef.current) return;
        qtLog.warn('Step4', 'Status pre-check failed — proceeding with caution', err);
        Alert.alert(
          'Pre-check Warning',
          'Could not verify vehicle readiness. Proceeding anyway — tuning will fail if the vehicle is not in the correct state.',
          [{ text: 'Continue' }],
        );
      }

      // Build snapshot from fresh per-param reads right before start
      qtLog.info('Step4', `Snapshotting ${TUNED_PARAMS.length} tuned params before start (fresh per-param)`);
      const snapshot: Record<string, number> = {};
      await Promise.all(
        TUNED_PARAMS.map(async (name) => {
          try {
            const result: ParamGetResponse = await services.getParam(name);
            snapshot[name] = result.param?.value ?? (paramValues[name] ?? 0);
          } catch {
            qtLog.warn('Step4', `Failed to fetch ${name} for start snapshot - using displayed fallback`);
            snapshot[name] = paramValues[name] ?? 0;
          }
        })
      );
      if (!mountedRef.current) return;
      qtLog.info('Step4', 'Param snapshot complete', snapshot);
      setParamValues((prev) => ({ ...prev, ...snapshot }));

      if (!mountedRef.current) return;

      // Send DO_AUX_FUNCTION(300, pos=1) to start tuning
      qtLog.api('Step4', 'POST', '/api/quicktune/aux_function', { action: 'start' });
      await quickTuneService.sendAuxFunction('start');
      qtLog.info('Step4', 'sendAuxFunction(start) succeeded — tuning initiated');

      if (!mountedRef.current) return;

      setHasStarted(true);
      onComplete(snapshot);
    } catch (error) {
      if (!mountedRef.current) return;
      const backendMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const message = backendMsg || (error instanceof Error ? error.message : 'Unknown error occurred');
      qtLog.error('Step4', 'Failed to start tune', { message, error });
      Alert.alert('Failed to Start Tune', message, [{ text: 'OK' }]);
    } finally {
      if (mountedRef.current) setIsStarting(false);
    }
  }, [connectionState, services, onComplete, paramValues]);

  const handleAbort = useCallback(() => {
    Alert.alert(
      'Abort Tuning?',
      'Are you sure you want to abort the current tuning process?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Abort',
          style: 'destructive',
          onPress: () => {
            setHasStarted(false);
            onAbort();
          },
        },
      ],
    );
  }, [onAbort]);

  const handleBack = useCallback(() => {
    if (hasStarted) {
      Alert.alert(
        'Go Back?',
        'Tuning has already started. Going back will abort the current tune.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Go Back', style: 'destructive', onPress: onBack },
        ],
      );
    } else {
      onBack();
    }
  }, [hasStarted, onBack]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentInner}
      >
        {/* ── INFO CARD ── */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardIcon}>
            <Ionicons name="information-circle" size={24} color={colors.info} />
          </View>
          <View style={styles.infoCardBody}>
            <Text style={styles.infoCardTitle}>What Happens Next?</Text>
            <Text style={styles.infoCardText}>
              The tuning process will automatically adjust 11 key parameters to
              optimize your rover's steering and navigation performance.
            </Text>
            <Text style={styles.infoCardText}>
              This process typically takes 5–10 minutes. Ensure the rover is on
              a flat, open area with good GPS reception.
            </Text>
            <View style={styles.infoCardBadge}>
              <View style={styles.infoCardBadgeDot} />
              <Text style={styles.infoCardBadgeText}>
                {hasStarted ? 'Tuning in Progress...' : 'Ready to Start'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── PARAMETERS LIST ── */}
        <View style={styles.paramCard}>
          <View style={styles.paramCardHeader}>
            <View style={styles.paramCardHeaderLeft}>
              <MaterialCommunityIcons name="tune" size={20} color={colors.accent} />
              <Text style={styles.paramCardTitle}>Parameters to Tune (11)</Text>
            </View>
          </View>

          <View style={styles.paramList}>
            {TUNED_PARAMS.map((param, index) => {
              const val = paramValues[param];
              return (
                <View
                  key={param}
                  style={[
                    styles.paramItem,
                    index === TUNED_PARAMS.length - 1 && styles.paramItemLast,
                  ]}
                >
                  <View style={styles.paramNumberBadge}>
                    <Text style={styles.paramNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.paramInfo}>
                    <Text style={styles.paramName}>{param}</Text>
                  </View>
                  <View style={styles.paramValueWrap}>
                    {isLoadingParams ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : val !== null && val !== undefined ? (
                      <Text style={styles.paramValue}>{String(val)}</Text>
                    ) : (
                      <Text style={styles.paramValueError}>—</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* ── ACTION BAR ── */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back to previous step"
        >
          <MaterialCommunityIcons name="arrow-left" size={18} color={colors.textSecondary} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        {!hasStarted ? (
          <TouchableOpacity
            style={[
              styles.startButton,
              (isStarting || connectionState !== 'connected') && styles.startButtonDisabled,
            ]}
            onPress={handleStartTune}
            disabled={isStarting || connectionState !== 'connected'}
            accessibilityRole="button"
            accessibilityLabel="Start tuning process"
            accessibilityState={{ disabled: isStarting || connectionState !== 'connected' }}          >
            {isStarting ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.startButtonText}>Starting...</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="play-circle-outline" size={22} color="#fff" />
                <Text style={styles.startButtonText}>Start Tuning</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.abortButton}
            onPress={handleAbort}
            accessibilityRole="button"
            accessibilityLabel="Abort tuning process"
          >
            <MaterialCommunityIcons name="stop-circle-outline" size={22} color={colors.danger} />
            <Text style={styles.abortButtonText}>Abort Tuning</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

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

  // ── INFO CARD ──
  infoCard: {
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
  infoCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.info + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCardBody: {
    flex: 1,
    gap: 8,
  },
  infoCardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  infoCardText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  infoCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent + '20',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoCardBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  infoCardBadgeText: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '600',
  },

  // ── PARAM CARD ──
  paramCard: {
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
  paramCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.panelBg,
  },
  paramCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paramCardTitle: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  paramList: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  paramItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  paramItemLast: {
    borderBottomWidth: 0,
  },
  paramNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paramNumberText: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '700',
  },
  paramInfo: {
    flex: 1,
    gap: 2,
  },
  paramName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  paramValueWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  paramValue: {
    color: colors.accentLight,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  paramValueError: {
    color: colors.textMuted,
    fontSize: 12,
  },

  // ── ACTION BAR ──
  actionBar: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.panelBg,
    gap: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  startButton: {
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
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  abortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.danger + '20',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 14,
  },
  abortButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  scrollSpacer: { height: 20 },
});
