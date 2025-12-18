import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { useRover } from '../../context/RoverContext';
import { Waypoint } from './types';
import { Toast } from '../shared/Toast';
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
  onLoadMission,
  mode,
  onSetMode,
  isMissionActive = false,
}) => {
  const { services } = useRover();
  const [isLoadingMission, setIsLoadingMission] = React.useState(false);
  const [isTogglingMode, setIsTogglingMode] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [isStopping, setIsStopping] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isPausing, setIsPausing] = React.useState(false);
  const [isResuming, setIsResuming] = React.useState(false);
  const [isNexting, setIsNexting] = React.useState(false);
  const [isSkipping, setIsSkipping] = React.useState(false);
  const [isRunning, setIsRunning] = React.useState(false);
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

  // Sync internal isRunning state with external isMissionActive prop
  // This ensures the START/STOP button reflects the actual mission state
  // Only depends on isMissionActive to avoid infinite loops
  React.useEffect(() => {
    if (isMissionActive && !isRunning) {
      console.log('[MissionControlCard] 🟢 Mission started externally - updating button state to show STOP');
      setIsRunning(true);
      setIsPaused(false); // Reset pause state when starting
    } else if (!isMissionActive && isRunning) {
      console.log('[MissionControlCard] 🔴 Mission completed/stopped externally - resetting button state to show START');
      setIsRunning(false);
      setIsPaused(false); // Also reset pause state
    }
  }, [isMissionActive]);

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
      if (onStop) {
        console.log('[MissionControlCard] 🛑 Executing stop mission...');
        await onStop();

        // Reset all button states when stopping
        setIsRunning(false);
        setIsPaused(false);
        console.log('[MissionControlCard] ✅ Mission stopped - button reset to START state');
      }
    } catch (error) {
      console.error('[MissionControlCard] ❌ Stop Error:', error);
      showLocalToast('error', 'Failed to stop mission');
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
        showLocalToast('success', 'Moved to next waypoint');
      } else {
        showLocalToast('error', response?.message || 'Failed to move to next waypoint');
      }
      return response;
    } catch (error) {
      console.error('[MissionControlCard] Next Error:', error);
      showLocalToast('error', 'Failed to move to next waypoint');
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
        showLocalToast('success', 'Skipped waypoint');
      } else {
        showLocalToast('error', response?.message || 'Failed to skip waypoint');
      }
      return response;
    } catch (error) {
      console.error('[MissionControlCard] Skip waypoint failed:', error);
      showLocalToast('error', 'Failed to skip waypoint');
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
            ]}
            onPress={isPaused ? handleResume : handlePause}
          >
            <Text style={styles.buttonText}>
              {isPaused ? 'RESUME' : 'PAUSE'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.nextButton]}
            onPress={handleNext}
          >
            <Text style={styles.buttonText}>NEXT MARK</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.skipButton]}
            onPress={handleSkip}
            disabled={isSkipping}
          >
            <Text style={styles.buttonText}>
              {isSkipping ? '⏳ Skipping...' : 'SKIP MARK'}
            </Text>
          </TouchableOpacity>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'AUTO' && styles.modeButtonActive,
              ]}
              onPress={() => handleModeToggle('AUTO')}
              disabled={isTogglingMode}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === 'AUTO' && styles.modeTextActive,
                ]}
              >
                AUTO
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'MANUAL' && styles.modeButtonActive,
              ]}
              onPress={() => handleModeToggle('MANUAL')}
              disabled={isTogglingMode}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === 'MANUAL' && styles.modeTextActive,
                ]}
              >
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
  buttonsContainer: {
    gap: 12,
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
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    fontSize: 15,
  },
});

export default MissionControlCard;
