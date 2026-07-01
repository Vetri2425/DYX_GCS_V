import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useRover } from '../../context/RoverContext';
import useJoystickLease from '../../hooks/useJoystickLease';
import { disarmVehicle } from '../../services/vehicleControlService';
import { processAxis } from '../../utils/joystickMath';
import { PATH_PLAN_GLASS } from '../../constants/pathPlanGlass';
import { ManualJoystick, JoystickValues } from './ManualJoystick';

const DEFAULT_MAX_THROTTLE = 0.15;
const DEFAULT_MAX_STEERING = 0.5;
const DEAD_ZONE = 0.03;
const RESPONSE_CURVE = 1;

interface ManualDrivePanelProps {
  visible: boolean;
  onClose: () => void;
}

interface DriveIntent {
  throttle: number;
  steering: number;
}

const NEUTRAL_INTENT: DriveIntent = {
  throttle: 0,
  steering: 0,
};

function leaseLabel(state: string): string {
  switch (state) {
    case 'active':
      return 'Lease active';
    case 'acquiring':
      return 'Acquiring';
    case 'releasing':
      return 'Releasing';
    case 'error':
      return 'Error';
    default:
      return 'Available';
  }
}

function isCentered(intent: DriveIntent): boolean {
  return Math.abs(intent.throttle) < 0.001 && Math.abs(intent.steering) < 0.001;
}

export const ManualDrivePanel: React.FC<ManualDrivePanelProps> = ({
  visible,
  onClose,
}) => {
  const { telemetry, connectionState, services } = useRover();
  const [intent, setIntent] = useState<DriveIntent>(NEUTRAL_INTENT);
  const [estopping, setEstopping] = useState(false);

  const isConnected =
    connectionState === 'connected' && telemetry.fcu_connected !== false;
  const isArmed = Boolean(telemetry.state?.armed);
  const mode = telemetry.state?.mode || 'UNKNOWN';

  const {
    leaseState,
    leaseInfo,
    leaseError,
    isActive,
    isDisabled,
    sendCommand,
  } = useJoystickLease({
    enabled: visible && isConnected && isArmed,
  });

  const maxThrottle = leaseInfo?.maxThrottle ?? DEFAULT_MAX_THROTTLE;
  const maxSteering = leaseInfo?.maxSteering ?? DEFAULT_MAX_STEERING;
  const canDrive = visible && isConnected && isArmed && isActive && !isDisabled;
  const driving = canDrive && !isCentered(intent);

  const status = useMemo(() => {
    if (!isConnected) return { label: 'offline', color: '#ef4444' };
    if (!isArmed) return { label: 'arm vehicle first', color: '#f59e0b' };
    if (isDisabled) return { label: 'manual disabled', color: '#ef4444' };
    if (driving) return { label: 'driving', color: '#22c55e' };
    if (isActive) return { label: 'lease active', color: '#f4c10c' };
    return { label: leaseLabel(leaseState).toLowerCase(), color: '#94a3b8' };
  }, [driving, isActive, isArmed, isConnected, isDisabled, leaseState]);

  const sendNeutral = useCallback(() => {
    setIntent(NEUTRAL_INTENT);
    sendCommand(0, 0, false);
  }, [sendCommand]);

  const handleJoystickChange = useCallback(
    (values: JoystickValues) => {
      const nextIntent = {
        throttle: processAxis(values.forward, DEAD_ZONE, RESPONSE_CURVE, maxThrottle),
        steering: processAxis(values.yaw, DEAD_ZONE, RESPONSE_CURVE, maxSteering),
      };
      const shouldDrive = canDrive && !isCentered(nextIntent);
      setIntent(nextIntent);
      sendCommand(
        shouldDrive ? nextIntent.throttle : 0,
        shouldDrive ? nextIntent.steering : 0,
        shouldDrive,
      );
    },
    [canDrive, maxSteering, maxThrottle, sendCommand],
  );

  useEffect(() => {
    if (!visible || !canDrive) {
      sendNeutral();
    }
  }, [canDrive, sendNeutral, visible]);

  const handleEstop = useCallback(async () => {
    setEstopping(true);
    sendNeutral();
    try {
      const response = await services.emergencyStop();
      if (!response.success) {
        Alert.alert('E-stop failed', response.message || response.error || 'Unable to send E-stop');
        return;
      }

      if (isArmed) {
        const disarmResponse = await disarmVehicle();
        if (!disarmResponse.success) {
          Alert.alert(
            'Disarm failed',
            disarmResponse.message || 'E-stop was sent, but the rover did not disarm.',
          );
        }
      }
    } catch (err) {
      Alert.alert('E-stop failed', err instanceof Error ? err.message : 'Unable to send E-stop');
    } finally {
      setEstopping(false);
    }
  }, [isArmed, sendNeutral, services]);

  const handleClose = useCallback(() => {
    sendNeutral();
    onClose();
  }, [onClose, sendNeutral]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="gamepad-variant" size={20} color="#f4c10c" />
              </View>
              <View>
                <Text style={styles.title}>Manual Control</Text>
                <Text style={styles.subtitle}>
                  {canDrive ? 'Ready to drive' : leaseLabel(leaseState)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.78}
            >
              <MaterialCommunityIcons name="close" size={19} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.manualStatusBar}>
            <View style={[styles.manualStatusDot, { backgroundColor: status.color }]} />
            <Text style={styles.manualStatusText}>{status.label}</Text>
            <Text style={styles.modeText}>{mode}</Text>
          </View>

          {leaseError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{leaseError.message || leaseError.code}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.estopButton, estopping && styles.disabledAction]}
              onPress={handleEstop}
              disabled={estopping}
              activeOpacity={0.82}
            >
              {estopping ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <MaterialCommunityIcons name="octagon" size={17} color="#ffffff" />
              )}
              <Text style={styles.actionText}>E-STOP</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.commandStrip}>
            <View style={styles.commandTile}>
              <Text style={styles.commandLabel}>Throttle</Text>
              <Text style={styles.commandValue}>
                {Math.round((intent.throttle / maxThrottle) * 100)}%
              </Text>
            </View>
            <View style={styles.commandTile}>
              <Text style={styles.commandLabel}>Steering</Text>
              <Text style={styles.commandValue}>
                {Math.round((intent.steering / maxSteering) * 100)}%
              </Text>
            </View>
            <View style={styles.commandTile}>
              <Text style={styles.commandLabel}>Rate</Text>
              <Text style={styles.commandValue}>
                {leaseInfo?.commandRateHz ? `${leaseInfo.commandRateHz}Hz` : '--'}
              </Text>
            </View>
          </View>

          <View style={styles.joystickCard}>
            <ManualJoystick
              onChange={handleJoystickChange}
              onRelease={sendNeutral}
              size={176}
              knobSize={54}
              disabled={!canDrive}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.28)',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingRight: 18,
    paddingBottom: 18,
    paddingLeft: 18,
  },
  panel: {
    width: 342,
    maxWidth: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PATH_PLAN_GLASS.border,
    backgroundColor: PATH_PLAN_GLASS.panelBg,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: PATH_PLAN_GLASS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 193, 12, 0.28)',
    backgroundColor: 'rgba(244, 193, 12, 0.1)',
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: PATH_PLAN_GLASS.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  manualStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  manualStatusText: {
    color: PATH_PLAN_GLASS.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
    flex: 1,
  },
  modeText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '800',
  },
  errorBox: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(127, 29, 29, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.38)',
  },
  errorText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '800',
  },
  joystickCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  commandStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  commandTile: {
    flex: 1,
    minHeight: 54,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  commandLabel: {
    color: 'rgba(226, 232, 240, 0.58)',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  commandValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 5,
  },
  actions: {
    gap: 10,
  },
  estopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#991b1b',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  disabledAction: {
    opacity: 0.55,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default ManualDrivePanel;
