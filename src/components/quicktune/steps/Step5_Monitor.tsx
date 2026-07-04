import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRover } from '../../../context/RoverContext';
import { quickTuneService } from '../../../services/quickTuneService';
import { QUICKTUNE_AUX_CHANNEL, TUNING_STALL_TIMEOUT_MS } from '../../../constants/quicktune';
import { colors } from '../../../theme/colors';
import { qtLog } from '../../../utils/quicktuneLogger';

interface Step5MonitorProps {
  onComplete: () => void;
  onAbort: () => void;
}

interface LogEntry {
  id: number;
  timestamp: Date;
  message: string;
  progress: number | null;
  phase: 'steering' | 'speed' | 'unknown';
  isDone: boolean;
  severity?: string;
}

// Progress regex: matches "RTun: .+ (\d+)% complete"
const PROGRESS_REGEX = /RTun: .+ (\d+)% complete/;
const DONE_REGEX = /RTun: Tuning DONE/;

export default function Step5_Monitor({ onComplete, onAbort }: Step5MonitorProps) {
  const { socket } = useRover();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<'steering' | 'speed' | 'unknown'>('unknown');
  const [isDone, setIsDone] = useState(false);
  const [isAborting, setIsAborting] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [isStalled, setIsStalled] = useState(false);

  const logIdRef = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const STALL_TIMEOUT_MS = TUNING_STALL_TIMEOUT_MS;
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start stall timer on mount, clear it when tuning completes.
  // Empty deps is intentional — TUNING_STALL_TIMEOUT_MS is a module-level constant,
  // not a reactive value, so this effect only needs to run once on mount.
  useEffect(() => {
    stallTimerRef.current = setTimeout(() => {
      setIsStalled(true);
    }, STALL_TIMEOUT_MS);
    return () => {
      if (stallTimerRef.current !== null) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [logs]);

  // Parse a socket message and update state.
  // NOTE: currentPhase is read via ref inside the handler so the socket listener
  // never needs to re-subscribe when the phase changes (fixes stale-closure race).
  const currentPhaseRef = useRef(currentPhase);
  useEffect(() => {
    currentPhaseRef.current = currentPhase;
  }, [currentPhase]);

  const handleMessage = useCallback((message: string, severity?: string) => {
    // Check for completion
    if (DONE_REGEX.test(message)) {
      qtLog.info('Step5', 'Tuning DONE received', { message });
      const entry: LogEntry = {
        id: ++logIdRef.current,
        timestamp: new Date(),
        message,
        progress: 100,
        phase: currentPhaseRef.current,
        isDone: true,
        severity,
      };
      setLogs((prev) => [...prev, entry]);
      setProgress(100);
      setIsDone(true);
      return;
    }

    // Check for progress
    const progressMatch = message.match(PROGRESS_REGEX);
    if (progressMatch) {
      const progressValue = parseInt(progressMatch[1], 10);
      const phase = message.toLowerCase().includes('speed') ? 'speed' : 'steering';
      qtLog.info('Step5', `Progress update — ${phase} ${progressValue}%`, { message });
      setCurrentPhase(phase);
      setProgress(progressValue);

      const entry: LogEntry = {
        id: ++logIdRef.current,
        timestamp: new Date(),
        message,
        progress: progressValue,
        phase,
        isDone: false,
        severity,
      };
      setLogs((prev) => [...prev, entry]);
      return;
    }

    // Generic status message
    const entry: LogEntry = {
      id: ++logIdRef.current,
      timestamp: new Date(),
      message,
      progress: null,
      phase: currentPhaseRef.current,
      isDone: false,
      severity,
    };
    setLogs((prev) => [...prev, entry]);
  }, []); // stable — reads currentPhase via ref, no re-creation on phase changes

  // Stable ref so the socket handler always calls the latest handleMessage
  // without the useEffect needing handleMessage as a dependency.
  const handleMessageRef = useRef(handleMessage);
  useEffect(() => {
    handleMessageRef.current = handleMessage;
  }, [handleMessage]);

  // Subscribe to socket events — depends only on [socket], never re-subscribes on phase changes
  useEffect(() => {
    if (!socket) return;

    const handler = (data: unknown) => {
      let messageText = '';
      let severityLabel: string | undefined;
      if (typeof data === 'string') {
        messageText = data;
      } else if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        messageText = (obj.text as string) || (obj.message as string) || (obj.status_text as string) || JSON.stringify(data);
        severityLabel = (obj.severity_label as string) || undefined;
      }
      if (messageText) {
        qtLog.socket('Step5', 'quicktune_log', { messageText, severityLabel });
        handleMessageRef.current(messageText, severityLabel);
      }
    };

    const onDisconnect = (reason: string) => {
      qtLog.warn('Step5', 'Socket disconnected during tuning', { reason });
      console.warn('[Step5] Socket disconnected during tuning:', reason);
      setIsDisconnected(true);
    };

    const onReconnect = () => {
      qtLog.info('Step5', 'Socket reconnected');
      console.log('[Step5] Socket reconnected');
      setIsDisconnected(false);
    };

    socket.on('quicktune_log', handler);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect', onReconnect);

    return () => {
      socket.off('quicktune_log', handler);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect', onReconnect);
    };
  }, [socket]); // only re-subscribes when the socket instance itself changes

  // Clear stall timer as soon as tuning completes
  useEffect(() => {
    if (isDone && stallTimerRef.current !== null) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
      setIsStalled(false);
    }
  }, [isDone]);

  // Handle abort
  const handleAbort = useCallback(() => {
    Alert.alert(
      'Abort Tuning',
      'Are you sure you want to abort the tuning process?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Abort',
          style: 'destructive',
          onPress: async () => {
            setIsAborting(true);
            try {
              qtLog.api('Step5', 'POST', '/api/quicktune/aux_function', { action: 'stop' });
              await quickTuneService.sendAuxFunction('stop', QUICKTUNE_AUX_CHANNEL, 0);
              qtLog.info('Step5', 'Abort stop command sent');
              onAbort();
            } catch (error) {
              qtLog.error('Step5', 'Failed to abort tuning', error);
              console.error('Failed to abort tuning:', error);
            } finally {
              setIsAborting(false);
            }
          },
        },
      ]
    );
  }, [onAbort]);

  // Handle save/complete
  const handleComplete = useCallback(() => {
    if (!isDone) return;
    onComplete();
  }, [isDone, onComplete]);

  const phaseLabel = currentPhase === 'unknown' ? 'Initializing' : currentPhase === 'steering' ? 'Steering' : 'Speed';
  const phaseColor = currentPhase === 'steering' ? colors.accent : currentPhase === 'speed' ? colors.warning : colors.textMuted;

  return (
    <View style={styles.container}>
      {/* Disconnect warning banner */}
      {isDisconnected && (
        <View style={styles.disconnectBanner}>
          <ActivityIndicator size="small" color={colors.warning} />
          <Text style={styles.disconnectBannerText}>
            Connection lost — waiting to reconnect. Tuning may still be running on the vehicle.
          </Text>
        </View>
      )}

      {/* Stall warning banner — shown after 15 min with no completion */}
      {isStalled && !isDone && (
        <View style={styles.stallBanner}>
          <Text style={styles.stallBannerText}>
            Tuning has been running for over 15 minutes with no completion signal. The script may have stalled.
          </Text>
          <TouchableOpacity style={styles.stallAbortBtn} onPress={handleAbort}>
            <Text style={styles.stallAbortBtnText}>Abort</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Progress Section */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Tuning Progress</Text>
          <View style={[styles.phaseBadge, { backgroundColor: phaseColor }]}>
            <Text style={styles.phaseBadgeText}>{phaseLabel}</Text>
          </View>
        </View>

        <View style={styles.progressbarContainer}>
          <View style={styles.progressbarTrack}>
            <View style={[styles.progressbarFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>

        {isDone && (
          <View style={styles.doneBanner}>
            <Text style={styles.doneIcon}>✓</Text>
            <Text style={styles.doneText}>Tuning Complete!</Text>
          </View>
        )}
      </View>

      {/* Log Panel */}
      <View style={styles.logCard}>
        <Text style={styles.logTitle}>Live Log</Text>
        <ScrollView
          ref={scrollViewRef}
          style={styles.logScroll}
          contentContainerStyle={styles.logContent}
          showsVerticalScrollIndicator
        >
          {logs.length === 0 && (
            <View style={styles.emptyLog}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.emptyLogText}>Waiting for tuning messages...</Text>
            </View>
          )}
          {logs.map((entry) => {
            const sevColor =
              entry.severity === 'ERROR' || entry.severity === 'CRITICAL' ? colors.danger
              : entry.severity === 'WARNING' ? colors.warning
              : entry.severity === 'DEBUG' ? colors.textMuted
              : colors.textPrimary;
            return (
            <View key={entry.id} style={styles.logEntry}>
              <Text style={styles.logTimestamp}>
                {entry.timestamp.toLocaleTimeString()}
                {entry.severity ? ` [${entry.severity}]` : ''}
              </Text>
              <Text
                style={[
                  styles.logMessage,
                  { color: sevColor },
                  entry.isDone && styles.logMessageDone,
                ]}
              >
                {entry.message}
              </Text>
              {entry.progress !== null && (
                <Text style={styles.logProgress}>{entry.progress}%</Text>
              )}
            </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.abortButton, isAborting && styles.abortButtonDisabled]}
          onPress={handleAbort}
          disabled={isAborting}
          activeOpacity={0.7}
        >
          {isAborting ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.abortButtonText}>Abort</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveButton,
            !isDone && styles.saveButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={!isDone}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.saveButtonText,
              !isDone && styles.saveButtonTextDisabled,
            ]}
          >
            Save
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },

  // Progress Card
  progressCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  phaseBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  progressbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressbarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.primary,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressbarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 5,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    minWidth: 40,
    textAlign: 'right',
  },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.success + '20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success,
  },
  doneIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.success,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },

  // Log Card
  logCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    minHeight: 0,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  logScroll: {
    flex: 1,
  },
  logContent: {
    gap: 6,
  },
  emptyLog: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyLogText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  logEntry: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  logTimestamp: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  logMessageDone: {
    color: colors.success,
    fontWeight: '600',
  },
  logProgress: {
    fontSize: 11,
    color: colors.accent,
    marginTop: 2,
  },

  // Disconnect / stall banners
  disconnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.warning + '18',
    borderWidth: 1,
    borderColor: colors.warning + '50',
  },
  disconnectBannerText: {
    flex: 1,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  stallBanner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.danger + '15',
    borderWidth: 1,
    borderColor: colors.danger + '40',
    gap: 10,
  },
  stallBannerText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  stallAbortBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  stallAbortBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Action Row
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  abortButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abortButtonDisabled: {
    opacity: 0.5,
  },
  abortButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.greenBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  saveButtonTextDisabled: {
    color: colors.textMuted,
  },
});
