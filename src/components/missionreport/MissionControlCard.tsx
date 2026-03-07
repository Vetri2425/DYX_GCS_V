import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, TextInput } from 'react-native';
import { colors } from '../../theme/colors';
import { useRover } from '../../context/RoverContext';
import { Waypoint } from './types';
import { Toast } from '../shared/Toast';
import { validateBulkSkip } from '../../utils/bulkSkipValidator';
import { useActionGuard, useComponentLifecycle } from '../../hooks/useComponentReadiness';

export type MissionControlCardProps = {
  waypoints?: Waypoint[];
  onUpdateWaypoints?: (waypoints: Waypoint[]) => void;
  onStart?: () => Promise<any>;
  onStop?: () => Promise<void>;
  onPause?: () => Promise<any>;
  onResume?: () => Promise<any>;
  onNext?: () => Promise<any>;
  onSkip?: () => Promise<any>;
  onBulkSkip?: () => Promise<any>;
  onLoadMission?: () => Promise<void>;
  onRestart?: () => void;
  mode: 'AUTO' | 'MANUAL';
  onSetMode: (mode: 'AUTO' | 'MANUAL') => void;
  isMissionActive?: boolean;
};

const MissionControlCard: React.FC<MissionControlCardProps> = ({
  waypoints = [],
  onStart,
  onStop,
  onPause,
  onResume,
  onNext,
  onSkip,
  onBulkSkip,
  onLoadMission,
  mode,
  onSetMode,
}) => {
  const { services, telemetry } = useRover();
  const [isLoadingMission, setIsLoadingMission] = React.useState(false);
  const [isTogglingMode, setIsTogglingMode] = React.useState(false);
  const [isRunning, setIsRunning] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [isStopping, setIsStopping] = React.useState(false);
  const [isNexting, setIsNexting] = React.useState(false);
  const [isSkipping, setIsSkipping] = React.useState(false);
  const [isBulkMode, setIsBulkMode] = React.useState(false);
  const [showBulkModal, setShowBulkModal] = React.useState(false);
  const [bulkFrom, setBulkFrom] = React.useState<string>('');
  const [bulkTo, setBulkTo] = React.useState<string>('');
  const [bulkError, setBulkError] = React.useState<string | null>(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = React.useState(false);
  const [isPausing, setIsPausing] = React.useState(false);
  const [isResuming, setIsResuming] = React.useState(false);
  
  const [confirmAction, setConfirmAction] = React.useState<null | {
    action: string;
    onConfirm: () => void
  }>(null);
  const [toast, setToast] = React.useState<{ visible: boolean; type: 'success' | 'error' | 'info'; message?: string }>({ visible: false, type: 'info', message: undefined });

  // Track mission control readiness - must be called before useActionGuard
  // NOT critical - this is just a UI component, shouldn't block entire system
  const lifecycle = useComponentLifecycle(
    'mission-control',
    'Mission Control',
    'mission',
    false // not critical - just UI controls
  );

  // Mark as ready once component mounts
  React.useEffect(() => {
    lifecycle.setReady('Mission control ready');
  }, []); // Empty deps - only run once on mount

  // Action guard to prevent actions when system isn't ready
  // Called after useComponentLifecycle to ensure component is registered first
  const { isReady, preventAction } = useActionGuard('mission-control', true);

  const showLocalToast = (type: 'success' | 'error' | 'info', message?: string, duration = 3000) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast({ visible: false, type: 'info', message: undefined }), duration);
  };

  // Primary sync: WebSocket telemetry.mission.status drives button state (~300ms latency)
  // Backend states: running, paused, idle, stopped, completed, error, ready, loading
  React.useEffect(() => {
    const s = (telemetry?.mission?.status ?? '').toLowerCase().trim();
    const shouldBeRunning = s === 'running' || s === 'paused';
    const shouldBePaused  = s === 'paused';
    if (shouldBeRunning !== isRunning) setIsRunning(shouldBeRunning);
    if (shouldBePaused  !== isPaused)  setIsPaused(shouldBePaused);
  }, [telemetry?.mission?.status]);

  // Recovery fetch on mount — restores state when app opens mid-mission or WebSocket reconnects
  React.useEffect(() => {
    let mounted = true;
    services.getMissionStatus().then((response) => {
      if (!mounted || !response) return;
      const rd = response.data || response;
      const raw = rd.status?.mission_state || rd.latest_update?.mission_state || rd.mission_state || rd.state || '';
      const s = raw.toString().toLowerCase().trim();
      if (!s) return;
      setIsRunning(s === 'running' || s === 'paused');
      setIsPaused(s === 'paused');
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Mission control handlers with action guard protection
  const handleStart = preventAction(async () => {
    if (!isReady) {
      showLocalToast('error', 'System is initializing. Please wait...');
      return;
    }
    
    setIsStarting(true);
    try {
      if (onStart) {
        const res = await onStart();
        // Only mark running if backend acknowledged success
        if (!res || res.success === undefined || res.success === true) {
          setIsRunning(true);
        } else {
          // show failure message locally and keep isRunning false
          const msg = res?.message ?? (typeof res === 'string' ? res : JSON.stringify(res));
          console.warn('[MissionControlCard] Start returned failure:', msg);
          showLocalToast('error', msg);
        }
      }
    } catch (error) {
      console.error('[MissionControlCard] Start Error:', error);
      showLocalToast('error', (error as any)?.message ?? 'Failed to start mission');
    } finally {
      setIsStarting(false);
    }
  }, 'Cannot start mission while system is initializing');

  const handleStop = async () => {
    setIsStopping(true);
    try {
      console.log('[MissionControlCard] 🛑 Executing stop mission...');

      // Call backend service to stop mission
      const response = await services.stopMission();

      // Check if stop was successful
      if (response && response.success) {
        // Reset all button states when stopping successfully
        setIsRunning(false);
        setIsPaused(false);
        console.log('[MissionControlCard] ✅ Mission stopped - button reset to START state');
        showLocalToast('success', 'Mission stopped');
      } else if (response?.message?.includes('No mission running')) {
        // Mission is already stopped - treat as success
        setIsRunning(false);
        setIsPaused(false);
        console.log('[MissionControlCard] ✅ Mission already stopped - button reset to START state');
        showLocalToast('info', 'Mission already stopped');
      } else {
        // Stop failed - show error and let telemetry sync correct the state
        const msg = response?.message ?? 'Stop command failed - mission may not be running';
        console.warn('[MissionControlCard] ⚠️ Stop returned failure:', msg);
        showLocalToast('error', msg);
        // Let telemetry sync handle state correction
      }

      // Also call the optional callback if provided
      if (onStop) {
        await onStop();
      }
    } catch (error) {
      console.error('[MissionControlCard] ❌ Stop Error:', error);
      showLocalToast('error', 'Failed to stop mission');
      // Let telemetry sync handle state correction
    } finally {
      setIsStopping(false);
    }
  };

  const handlePause = async () => {
    setIsPausing(true);
    try {
      const response = onPause ? await onPause() : await services.pauseMission();
      if (response && response.success) {
        setIsPaused(true);
        showLocalToast('success', 'Mission paused');
      } else {
        showLocalToast('error', response?.message || 'Failed to pause mission');
      }
      return response;
    } catch (error) {
      console.error('[MissionControlCard] Pause Error:', error);
      showLocalToast('error', 'Failed to pause mission');
      return { success: false, message: String(error) };
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    setIsResuming(true);
    try {
      const response = onResume ? await onResume() : await services.resumeMission();
      if (response && response.success) {
        setIsPaused(false);
        showLocalToast('success', 'Mission resumed');
      } else {
        showLocalToast('error', response?.message || 'Failed to resume mission');
      }
      return response;
    } catch (error) {
      console.error('[MissionControlCard] Resume Error:', error);
      showLocalToast('error', 'Failed to resume mission');
      return { success: false, message: String(error) };
    } finally {
      setIsResuming(false);
    }
  };

  const handleNext = async () => {
    try {
      setIsNexting(true);
      const response = onNext ? await onNext() : await services.nextMission();
      if (response && response.success) {
        showLocalToast('success', 'Moved to next marking point');
      } else {
        showLocalToast('error', response?.message || 'Failed to move to next marking point');
      }
      return response;
    } catch (error) {
      console.error('[MissionControlCard] Next Error:', error);
      showLocalToast('error', 'Failed to move to next marking point');
      return { success: false, message: String(error) };
    } finally {
      setIsNexting(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      const response = onSkip ? await onSkip() : await services.skipMission();
      if (response && response.success) {
        showLocalToast('success', 'Skipped marking point');
      } else {
        showLocalToast('error', response?.message || 'Failed to skip marking point');
      }
      return response;
    } catch (error) {
      console.error('[MissionControlCard] Skip waypoint failed:', error);
      showLocalToast('error', 'Failed to skip marking point');
      return { success: false, message: String(error) };
    } finally {
      setIsSkipping(false);
    }
  };

  const handleModeToggle = async (newMode: 'AUTO' | 'MANUAL') => {
    setIsTogglingMode(true);
    try {
      console.log('[MissionControlCard] Changing mode to:', newMode);
      const response = await services.setMode(newMode);
      
      if (response.success) {
        onSetMode(newMode);
        console.log('[MissionControlCard] Mode changed successfully');
      } else {
        console.error('[MissionControlCard] Mode change failed:', response.message);
        showLocalToast('error', response.message || 'Failed to change mode');
      }
    } catch (error) {
      console.error('[MissionControlCard] Failed to set mission mode:', error);
      showLocalToast('error', 'Failed to change mode');
    } finally {
      setIsTogglingMode(false);
    }
  };

  const showConfirmDialog = (action: string, onConfirm: () => void) => {
    setConfirmAction({ action, onConfirm });
  };

  return (
    <View style={styles.container}>
      <View style={styles.cardPadding}>
        {/* Control Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              isRunning ? styles.stopButton : styles.startButton,
            ]}
            onPress={() => {
              if (isRunning) {
                showConfirmDialog('Stop Mission', handleStop);
              } else {
                showConfirmDialog('Start Mission', handleStart);
              }
            }}
            disabled={isStarting || isStopping}
          >
            <Text style={styles.buttonText}>
              {isStarting
                  ? '⏳ Starting...'
                  : isStopping
                    ? '⏳ Stopping...'
                    : isRunning
                      ? 'STOP'
                      : 'START'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              isPaused ? styles.resumeButton : styles.pauseButton,
              (!isRunning || isPausing || isResuming) && styles.buttonDisabled,
            ]}
            onPress={isPaused ? handleResume : handlePause}
            disabled={!isRunning || isPausing || isResuming}
          >
            <Text style={styles.buttonText}>
              {isPaused ? 'RESUME' : 'PAUSE'}
            </Text>
          </TouchableOpacity>

          {/* NEXT MARK — only active in MANUAL mode */}
          <TouchableOpacity
            style={[
              styles.controlButton,
              styles.nextButton,
              (!isRunning || isNexting || mode !== 'MANUAL') && styles.buttonDisabled,
            ]}
            onPress={handleNext}
            disabled={!isRunning || isNexting || mode !== 'MANUAL'}
          >
            <Text style={styles.buttonText}>NEXT MARK</Text>
          </TouchableOpacity>

          {/* SKIP — always enabled while mission is running, regardless of mode */}
          <View style={styles.skipRow}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                styles.skipButton,
                (!isRunning || isSkipping) && styles.buttonDisabled,
                { flex: 1, position: 'relative' },
              ]}
              onPress={async () => {
                if (isBulkMode) {
                  const current = telemetry?.mission?.current_wp ?? 1;
                  const total = telemetry?.mission?.total_wp ?? 1;
                  setBulkFrom(String(Math.max(1, current)));
                  setBulkTo(String(Math.max(1, Math.min(total - 1, current + 1))));
                  setBulkError(null);
                  setShowBulkModal(true);
                } else {
                  handleSkip();
                }
              }}
              disabled={!isRunning || isSkipping}
            >
              <Text style={styles.buttonText}>
                {isSkipping ? '⏳ Skipping...' : (isBulkMode ? 'BULK SKIP' : 'SKIP MARK')}
              </Text>

              {/* Inline bulk toggle in top-right corner */}
              <TouchableOpacity
                style={[styles.bulkToggleInside, isBulkMode ? styles.bulkToggleActive : {}]}
                onPress={() => setIsBulkMode((v) => !v)}
                accessibilityLabel="Toggle bulk skip"
              >
                <Text style={[styles.bulkToggleText, isBulkMode ? styles.bulkToggleTextActive : {}]}>
                  {isBulkMode ? 'B' : 'b'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          {/* AUTO / MANUAL — DGPS marking mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                !isTogglingMode && mode === 'AUTO' && styles.modeButtonActive,
                isTogglingMode && styles.buttonDisabled,
              ]}
              onPress={() => handleModeToggle('AUTO')}
              disabled={isTogglingMode}
            >
              <Text style={[
                styles.modeText,
                !isTogglingMode && mode === 'AUTO' && styles.modeTextActive,
              ]}>
                AUTO
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                !isTogglingMode && mode === 'MANUAL' && styles.modeButtonActive,
                isTogglingMode && styles.buttonDisabled,
              ]}
              onPress={() => handleModeToggle('MANUAL')}
              disabled={isTogglingMode}
            >
              <Text style={[
                styles.modeText,
                !isTogglingMode && mode === 'MANUAL' && styles.modeTextActive,
              ]}>
                MANUAL
              </Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Loading Mission Modal */}
        <Modal
          transparent
          visible={isLoadingMission}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.modalTitle}>Loading Mission</Text>
              <Text style={styles.modalText}>
                Sending waypoints to controller...
              </Text>
            </View>
          </View>
        </Modal>

        {/* Start Mission Modal */}
        <Modal
          transparent
          visible={isStarting}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ActivityIndicator size="large" color={colors.greenBtn} />
              <Text style={styles.modalTitle}>Starting Mission</Text>
              <Text style={styles.modalText}>
                Initializing mission controller...
              </Text>
            </View>
          </View>
        </Modal>

        {/* Stop Mission Modal */}
        <Modal
          transparent
          visible={isStopping}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ActivityIndicator size="large" color={colors.danger} />
              <Text style={styles.modalTitle}>Stopping Mission</Text>
              <Text style={styles.modalText}>
                Shutting down mission controller...
              </Text>
            </View>
          </View>
        </Modal>

        {/* Bulk Skip Modal */}
        <Modal transparent visible={showBulkModal} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.bulkModalCard}>
              <Text style={styles.confirmTitle}>Bulk Skip Waypoints</Text>
              <Text style={styles.confirmText}>Enter waypoint range to skip (mission must be PAUSED).</Text>

              <View style={{ width: '100%', marginTop: 12 }}>
                <Text style={styles.inputLabel}>From</Text>
                <TextInput
                  value={bulkFrom}
                  onChangeText={(t) => setBulkFrom(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  style={styles.inputField}
                  placeholder="e.g., 6"
                />

                <Text style={[styles.inputLabel, { marginTop: 8 }]}>To</Text>
                <TextInput
                  value={bulkTo}
                  onChangeText={(t) => setBulkTo(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  style={styles.inputField}
                  placeholder="e.g., 7"
                />

                {bulkError ? <Text style={styles.errorText}>{bulkError}</Text> : null}
              </View>

              <View style={[styles.confirmButtons, { marginTop: 14 }]}> 
                <TouchableOpacity style={[styles.confirmButton, styles.cancelBtn]} onPress={() => setShowBulkModal(false)} disabled={isBulkSubmitting}>
                  <Text style={styles.confirmButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmBtn]}
                  onPress={() => {
                    setBulkError(null);
                    const from = parseInt(bulkFrom, 10);
                    const to = parseInt(bulkTo, 10);
                    const current = telemetry?.mission?.current_wp ?? 0;
                    const total = telemetry?.mission?.total_wp ?? 0;

                    const validationError = validateBulkSkip({ from, to, current, total });
                    if (validationError) {
                      setBulkError(validationError);
                      return;
                    }

                    // Ensure mission is paused on client before sending bulk skip
                    const missionStatus = (telemetry?.mission?.status || '').toString().toUpperCase();
                    if (missionStatus !== 'PAUSED') {
                      setBulkError('Mission must be PAUSED to perform bulk skip');
                      return;
                    }

                    // Prepare confirmed action to execute the bulk skip when user confirms
                    const performBulkSkip = async () => {
                      setIsBulkSubmitting(true);
                      try {
                        let response;
                        if (onBulkSkip) {
                          response = await onBulkSkip();
                        } else {
                          response = await services.bulkSkipRange(from, to);
                        }
                        if (response && response.success) {
                          showLocalToast('success', `Skipped ${from}-${to}`);
                          setShowBulkModal(false);
                        } else {
                          setBulkError(response?.message || 'Bulk skip failed');
                        }
                      } catch (err) {
                        console.error('[MissionControlCard] bulk skip error', err);
                        setBulkError((err as any)?.message || 'Bulk skip error');
                      } finally {
                        setIsBulkSubmitting(false);
                      }
                    };

                    setConfirmAction({ action: `Confirm Skip ${from} → ${to}`, onConfirm: performBulkSkip });
                  }}
                  disabled={isBulkSubmitting}
                >
                  <Text style={[styles.confirmButtonText, { fontWeight: '700' }]}>{isBulkSubmitting ? 'Skipping...' : 'Confirm Skip'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Confirmation Modal - modern styled dialog */}
        <Modal transparent visible={!!confirmAction} animationType="fade">
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>{confirmAction?.action}</Text>
              <Text style={styles.confirmText}>
                {`Are you sure you want to ${confirmAction?.action?.toLowerCase()}?`}
              </Text>

              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.cancelBtn]}
                  onPress={() => setConfirmAction(null)}
                >
                  <Text style={styles.confirmButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmBtn]}
                  onPress={() => {
                    try {
                      if (confirmAction && confirmAction.onConfirm) confirmAction.onConfirm();
                    } finally {
                      setConfirmAction(null);
                    }
                  }}
                >
                  <Text style={[styles.confirmButtonText, { fontWeight: '700' }]}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Toast
          visible={toast.visible}
          type={toast.type}
          message={toast.message}
          position="bottom"
          style={{ left: 0, right: 0, bottom: 0 }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPadding: {
    padding: 12,
  },
  emergencyButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#991B1B',
  },
  emergencyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  restartButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonsContainer: {
    gap: 12,
  },
  skipRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  controlButton: {
    paddingVertical: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  stopButton: {
    backgroundColor: colors.danger,
  },
  pauseButton: {
    backgroundColor: '#F97316',
  },
  resumeButton: {
    backgroundColor: colors.accent,
  },
  nextButton: {
    backgroundColor: '#B45309',
  },
  skipButton: {
    backgroundColor: '#0891B2',
    position: 'relative',
  },
  bulkToggle: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkToggleActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  bulkToggleText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '700',
  },
  bulkToggleTextActive: {
    color: '#000',
  },
  bulkToggleInside: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 8,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#475569',
    alignItems: 'center',
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: '#10B981',
  },
  modeButtonManual: {
    backgroundColor: '#475569',
  },
  modeText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 24,
    maxWidth: 300,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkModalCard: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 18,
    maxWidth: 420,
    width: '86%',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: '#000',
  },
  errorText: {
    color: '#b91c1c',
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmBtn: {
    backgroundColor: colors.greenBtn || '#10B981',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 20,
  },
});

export default MissionControlCard;
