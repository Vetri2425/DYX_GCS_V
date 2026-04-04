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
import { colors } from '../../../theme/colors';

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
}

// Progress regex: matches "RTun: .+ (\d+)% complete"
const PROGRESS_REGEX = /RTun: .+ (\d+)% complete/;
const DONE_REGEX = /RTun: Tuning DONE/;

// Mock messages for testing
const MOCK_MESSAGES: { message: string; delay: number }[] = [
  { message: 'RTun: Starting tuning sequence...', delay: 2000 },
  { message: 'RTun: Steering phase - initializing', delay: 4000 },
  { message: 'RTun: Steering tune 10% complete', delay: 6000 },
  { message: 'RTun: Steering tune 25% complete', delay: 8000 },
  { message: 'RTun: Steering tune 40% complete', delay: 10000 },
  { message: 'RTun: Steering tune 55% complete', delay: 12000 },
  { message: 'RTun: Steering tune 70% complete', delay: 14000 },
  { message: 'RTun: Steering tune 85% complete', delay: 16000 },
  { message: 'RTun: Steering tune 100% complete', delay: 18000 },
  { message: 'RTun: Speed phase - initializing', delay: 20000 },
  { message: 'RTun: Speed tune 15% complete', delay: 22000 },
  { message: 'RTun: Speed tune 30% complete', delay: 24000 },
  { message: 'RTun: Speed tune 50% complete', delay: 26000 },
  { message: 'RTun: Speed tune 75% complete', delay: 28000 },
  { message: 'RTun: Speed tune 90% complete', delay: 30000 },
  { message: 'RTun: Speed tune 100% complete', delay: 32000 },
  { message: 'RTun: Tuning DONE', delay: 34000 },
];

const USE_MOCK = true;

export default function Step5_Monitor({ onComplete, onAbort }: Step5MonitorProps) {
  const { socket } = useRover();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<'steering' | 'speed' | 'unknown'>('unknown');
  const [isDone, setIsDone] = useState(false);
  const [isAborting, setIsAborting] = useState(false);

  const logIdRef = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const mockTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [logs]);

  // Parse a socket message and update state
  const handleMessage = useCallback((message: string) => {
    // Check for completion
    if (DONE_REGEX.test(message)) {
      const entry: LogEntry = {
        id: ++logIdRef.current,
        timestamp: new Date(),
        message,
        progress: 100,
        phase: currentPhase,
        isDone: true,
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
      setCurrentPhase(phase);
      setProgress(progressValue);

      const entry: LogEntry = {
        id: ++logIdRef.current,
        timestamp: new Date(),
        message,
        progress: progressValue,
        phase,
        isDone: false,
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
      phase: currentPhase,
      isDone: false,
    };
    setLogs((prev) => [...prev, entry]);
  }, [currentPhase]);

  // Subscribe to socket events
  useEffect(() => {
    if (!socket) return;

    const handler = (data: unknown) => {
      // Handle both string messages and object payloads
      let messageText = '';
      if (typeof data === 'string') {
        messageText = data;
      } else if (typeof data === 'object' && data !== null) {
        // Check for STATUSTEXT pattern
        const obj = data as Record<string, unknown>;
        messageText = (obj.text as string) || (obj.message as string) || (obj.status_text as string) || JSON.stringify(data);
      }
      if (messageText) {
        handleMessage(messageText);
      }
    };

    socket.on('quicktune_log', handler);

    return () => {
      socket.off('quicktune_log', handler);
    };
  }, [socket, handleMessage]);

  // Mock mode: inject demo messages
  useEffect(() => {
    if (!USE_MOCK) return;

    const timeouts = MOCK_MESSAGES.map(({ message, delay }) => {
      return setTimeout(() => {
        handleMessage(message);
      }, delay);
    });

    mockTimeoutsRef.current = timeouts;

    return () => {
      timeouts.forEach(clearTimeout);
      mockTimeoutsRef.current = [];
    };
  }, [handleMessage]);

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
              // Send DO_AUX_FUNCTION(300, 0) to abort tuning
              await quickTuneService.sendAuxFunction('stop', 300, 0);
              // Clear mock timeouts if in mock mode
              if (USE_MOCK) {
                mockTimeoutsRef.current.forEach(clearTimeout);
                mockTimeoutsRef.current = [];
              }
              onAbort();
            } catch (error) {
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
              {USE_MOCK && (
                <Text style={styles.emptyLogHint}>Mock messages will appear shortly</Text>
              )}
            </View>
          )}
          {logs.map((entry) => (
            <View key={entry.id} style={styles.logEntry}>
              <Text style={styles.logTimestamp}>
                {entry.timestamp.toLocaleTimeString()}
              </Text>
              <Text
                style={[
                  styles.logMessage,
                  entry.isDone && styles.logMessageDone,
                ]}
              >
                {entry.message}
              </Text>
              {entry.progress !== null && (
                <Text style={styles.logProgress}>{entry.progress}%</Text>
              )}
            </View>
          ))}
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
  emptyLogHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
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
