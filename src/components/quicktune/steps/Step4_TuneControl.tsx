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

interface Step4_TuneControlProps {
  onComplete: (snapshot: Record<string, number>) => void;
  onAbort: () => void;
}

/**
 * Step4_TuneControl — QuickTune wizard step that initiates the tuning process.
 *
 * Snapshots current tuned parameters, sends DO_AUX_FUNCTION(300, pos=1)
 * via quickTuneService.sendAuxFunction('start') to start the tune,
 * and displays an info card with the param list.
 */
export default function Step4_TuneControl({ onComplete, onAbort }: Step4_TuneControlProps) {
  const { services, connectionState } = useRover();
  const [isStarting, setIsStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const handleStartTune = useCallback(async () => {
    if (connectionState !== 'connected') {
      Alert.alert(
        'Not Connected',
        'Please connect to the rover before starting the tune process.',
      );
      return;
    }

    setIsStarting(true);

    try {
      // Snapshot current TUNED_PARAMS values from rover
      const snapshot: Record<string, number> = {};
      const fetchPromises = TUNED_PARAMS.map(async (paramName) => {
        try {
          const result = await services.getParam(paramName);
          const paramValue = (result as any).param?.value;
          snapshot[paramName] = paramValue ?? 0;
        } catch {
          // If param fetch fails, use 0 as fallback
          snapshot[paramName] = 0;
        }
      });

      await Promise.all(fetchPromises);

      // Send DO_AUX_FUNCTION(300, pos=1) via quickTuneService
      // This triggers the Lua script to start the tuning process
      await quickTuneService.sendAuxFunction('start');

      setHasStarted(true);
      onComplete(snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Failed to Start Tune',
        `Could not initiate tuning: ${message}`,
        [{ text: 'OK' }],
      );
    } finally {
      setIsStarting(false);
    }
  }, [connectionState, services, onComplete]);

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
            {TUNED_PARAMS.map((param, index) => (
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
                  <Text style={styles.paramStatus}>
                    {hasStarted ? 'Will be tuned' : 'Pending'}
                  </Text>
                </View>
                {hasStarted && (
                  <ActivityIndicator size="small" color={colors.accent} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Spacer for scroll */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── ACTION BAR ── */}
      <View style={styles.actionBar}>
        {!hasStarted ? (
          <TouchableOpacity
            style={[
              styles.startButton,
              (isStarting || connectionState !== 'connected') && styles.startButtonDisabled,
            ]}
            onPress={handleStartTune}
            disabled={isStarting || connectionState !== 'connected'}
          >
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
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  paramStatus: {
    color: colors.textMuted,
    fontSize: 11,
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
});
