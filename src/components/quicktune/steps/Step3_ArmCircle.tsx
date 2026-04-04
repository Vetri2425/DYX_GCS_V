import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../../../theme/colors';
import { useRover } from '../../../context/RoverContext';

interface Step3_ArmCircleProps {
  onNext: () => void;
  onAbort: () => void;
}

export const Step3_ArmCircle: React.FC<Step3_ArmCircleProps> = ({ onNext, onAbort }) => {
  const { telemetry, services } = useRover();
  const [arming, setArming] = useState(false);
  const [settingMode, setSettingMode] = useState(false);

  const isArmed = telemetry.state.armed;
  const isCircleMode = telemetry.state.mode === 'CIRCLE';
  const groundSpeed = telemetry.global.vel || 0;
  const isCircling = isArmed && isCircleMode && groundSpeed > 0.1;

  const canProceed = isCircling;

  const handleArm = async () => {
    if (arming || isArmed) return;
    setArming(true);
    try {
      await services.armVehicle();
    } catch (error) {
      console.error('[Step3_ArmCircle] Failed to arm rover:', error);
    } finally {
      setArming(false);
    }
  };

  const handleSetCircleMode = async () => {
    if (settingMode || isCircleMode) return;
    setSettingMode(true);
    try {
      await services.setMode('CIRCLE');
    } catch (error) {
      console.error('[Step3_ArmCircle] Failed to set CIRCLE mode:', error);
    } finally {
      setSettingMode(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Arm & Circle Test</Text>
      <Text style={styles.subtitle}>
        Follow the steps below to verify the rover can circle properly
      </Text>

      {/* Step 1: Arm */}
      <View style={[styles.stepCard, isArmed && styles.stepCardComplete]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepIndicator, isArmed && styles.stepIndicatorComplete]}>
            <Text style={[styles.stepNumber, isArmed && styles.stepNumberComplete]}>1</Text>
          </View>
          <Text style={[styles.stepTitle, isArmed && styles.stepTextComplete]}>Arm Rover</Text>
          {isArmed && <Text style={styles.checkmark}>✓</Text>}
        </View>

        {!isArmed && (
          <TouchableOpacity
            style={[styles.actionButton, arming && styles.actionButtonDisabled]}
            onPress={handleArm}
            disabled={arming}
          >
            {arming ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.actionButtonText}>Arm Rover</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Step 2: Set CIRCLE Mode */}
      <View style={[styles.stepCard, isCircleMode && styles.stepCardComplete]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepIndicator, isCircleMode && styles.stepIndicatorComplete]}>
            <Text style={[styles.stepNumber, isCircleMode && styles.stepNumberComplete]}>2</Text>
          </View>
          <Text style={[styles.stepTitle, isCircleMode && styles.stepTextComplete]}>
            Set CIRCLE Mode
          </Text>
          {isCircleMode && <Text style={styles.checkmark}>✓</Text>}
        </View>

        {!isCircleMode && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              !isArmed && styles.actionButtonDisabled,
              settingMode && styles.actionButtonDisabled,
            ]}
            onPress={handleSetCircleMode}
            disabled={!isArmed || settingMode}
          >
            {settingMode ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.actionButtonText}>Set CIRCLE Mode</Text>
            )}
          </TouchableOpacity>
        )}

        {!isCircleMode && !isArmed && (
          <Text style={styles.hintText}>Arm the rover first to enable this step</Text>
        )}
      </View>

      {/* Step 3: Confirm Circling */}
      <View style={[styles.stepCard, isCircling && styles.stepCardComplete]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepIndicator, isCircling && styles.stepIndicatorComplete]}>
            <Text style={[styles.stepNumber, isCircling && styles.stepNumberComplete]}>3</Text>
          </View>
          <Text style={[styles.stepTitle, isCircling && styles.stepTextComplete]}>
            Confirm Circling
          </Text>
          {isCircling && <Text style={styles.checkmark}>✓</Text>}
        </View>

        <View style={styles.telemetryRow}>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryLabel}>Ground Speed</Text>
            <Text style={styles.telemetryValue}>
              {groundSpeed.toFixed(2)} m/s
            </Text>
          </View>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryLabel}>Mode</Text>
            <Text style={styles.telemetryValue}>
              {telemetry.state.mode || 'UNKNOWN'}
            </Text>
          </View>
        </View>

        {!isCircling && isCircleMode && (
          <Text style={styles.hintText}>
            Rover should be moving. Speed must exceed 0.1 m/s to proceed.
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.abortButton} onPress={onAbort}>
          <Text style={styles.abortButtonText}>Abort</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
          onPress={onNext}
          disabled={!canProceed}
        >
          <Text style={[styles.nextButtonText, !canProceed && styles.nextButtonTextDisabled]}>
            Next
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.panelBg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  stepCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepCardComplete: {
    borderColor: colors.success,
    backgroundColor: `${colors.success}15`,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepIndicatorComplete: {
    backgroundColor: colors.success,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepNumberComplete: {
    color: colors.text,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  stepTextComplete: {
    color: colors.success,
  },
  checkmark: {
    fontSize: 20,
    color: colors.success,
    fontWeight: '700',
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: colors.border,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  hintText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  telemetryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  telemetryBox: {
    flex: 1,
    backgroundColor: colors.panelBg,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  telemetryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  abortButton: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  abortButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  nextButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: colors.border,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  nextButtonTextDisabled: {
    color: colors.textSecondary,
  },
});
