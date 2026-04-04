import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useRover } from '../context/RoverContext';
import { WizardStep, TuneState } from '../types/quicktune';

export default function QuickTuneScreen({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { telemetry, connectionState } = useRover();
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.Overview);
  const [tuneState, setTuneState] = useState<TuneState>(TuneState.Idle);
  const [isRunning, setIsRunning] = useState(false);

  const handleStartTuning = useCallback(() => {
    if (connectionState !== 'connected') {
      Alert.alert('Not Connected', 'Please connect to the rover before starting QuickTune.');
      return;
    }

    setIsRunning(true);
    setTuneState(TuneState.Checking);
    setCurrentStep(WizardStep.PretuneCheck);

    // Simulate tuning workflow
    setTimeout(() => {
      setTuneState(TuneState.ApplyingPretune);
      setCurrentStep(WizardStep.ApplyPretune);
    }, 1500);

    setTimeout(() => {
      setTuneState(TuneState.Tuning);
      setCurrentStep(WizardStep.RunTuning);
    }, 3000);

    setTimeout(() => {
      setTuneState(TuneState.ApplyingTuned);
      setCurrentStep(WizardStep.ApplyTuned);
    }, 8000);

    setTimeout(() => {
      setTuneState(TuneState.Success);
      setCurrentStep(WizardStep.Complete);
      setIsRunning(false);
    }, 10000);
  }, [connectionState]);

  const handleReset = useCallback(() => {
    setCurrentStep(WizardStep.Overview);
    setTuneState(TuneState.Idle);
    setIsRunning(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isRunning) {
      Alert.alert(
        'Tuning in Progress',
        'Are you sure you want to cancel the tuning process?',
        [
          { text: 'Continue', style: 'cancel' },
          {
            text: 'Cancel Tuning',
            style: 'destructive',
            onPress: () => {
              setTuneState(TuneState.Cancelled);
              setIsRunning(false);
              onClose();
            },
          },
        ],
      );
    } else {
      handleReset();
      onClose();
    }
  }, [isRunning, onClose, handleReset]);

  const getStepIcon = () => {
    switch (currentStep) {
      case WizardStep.Overview:
        return 'tune-variant';
      case WizardStep.PretuneCheck:
        return 'magnify-scan';
      case WizardStep.ApplyPretune:
        return 'download-circle-outline';
      case WizardStep.RunTuning:
        return 'tune';
      case WizardStep.ApplyTuned:
        return 'check-circle-outline';
      case WizardStep.Complete:
        return 'check-all';
      default:
        return 'tune-variant';
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case WizardStep.Overview:
        return 'QuickTune Overview';
      case WizardStep.PretuneCheck:
        return 'Checking Parameters';
      case WizardStep.ApplyPretune:
        return 'Applying Pretune Settings';
      case WizardStep.RunTuning:
        return 'Running Circle Mode Tuning';
      case WizardStep.ApplyTuned:
        return 'Applying Optimized Gains';
      case WizardStep.Complete:
        return 'Tuning Complete';
      default:
        return 'QuickTune';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case WizardStep.Overview:
        return 'Auto-tune steering and speed PID gains using Circle mode. This process will optimize your rover\'s handling and response.';
      case WizardStep.PretuneCheck:
        return 'Validating current parameter configuration and system readiness...';
      case WizardStep.ApplyPretune:
        return 'Applying baseline pretune parameters for stable tuning foundation...';
      case WizardStep.RunTuning:
        return 'Rover is executing circle trajectory to collect steering response data...';
      case WizardStep.ApplyTuned:
        return 'Writing optimized PID gains to the flight controller...';
      case WizardStep.Complete:
        return 'All parameters have been successfully optimized. Your rover is now tuned!';
      default:
        return '';
    }
  };

  const getStepColor = () => {
    if (tuneState === TuneState.Failed || tuneState === TuneState.Cancelled) {
      return colors.danger;
    }
    if (tuneState === TuneState.Success) {
      return colors.success;
    }
    return colors.warning;
  };

  const renderProgressBar = () => {
    const steps = Object.values(WizardStep);
    const currentIndex = steps.indexOf(currentStep);
    const progress = ((currentIndex + 1) / steps.length) * 100;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` as any, backgroundColor: getStepColor() }]} />
        </View>
        <Text style={styles.progressText}>Step {currentIndex + 1} of {steps.length}</Text>
      </View>
    );
  };

  const renderOverview = () => (
    <View style={styles.stepContent}>
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
        <Text style={styles.infoText}>
          QuickTune uses Circle mode to automatically optimize your rover's steering and speed PID gains.
        </Text>
      </View>

      <View style={styles.paramList}>
        <Text style={styles.paramListTitle}>Parameters to Tune</Text>
        {[
          { icon: 'steering', label: 'Steering PID (P, I, D)' },
          { icon: 'speedometer', label: 'Speed Response (UP, DN)' },
          { icon: 'rocket-launch', label: 'Acceleration Limits' },
          { icon: 'navigation', label: 'Navigation L1 Tuning' },
          { icon: 'gauge', label: 'Scheduler Speed/Turn' },
        ].map((item, idx) => (
          <View key={idx} style={styles.paramItem}>
            <MaterialCommunityIcons name={item.icon as any} size={16} color={colors.accent} />
            <Text style={styles.paramItemText}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.warningCard}>
        <Ionicons name="warning-outline" size={18} color={colors.warning} />
        <Text style={styles.warningText}>
          Ensure the rover has clear space to execute circle trajectories during tuning.
        </Text>
      </View>
    </View>
  );

  const renderActiveStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.statusAnimation}>
        <View style={[styles.statusRing, { borderColor: getStepColor() + '40' }]}>
          <MaterialCommunityIcons
            name={isRunning ? 'loading' : getStepIcon()}
            size={32}
            color={getStepColor()}
          />
        </View>
      </View>

      <Text style={styles.stepTitle}>{getStepTitle()}</Text>
      <Text style={styles.stepDescription}>{getStepDescription()}</Text>

      {isRunning && (
        <View style={styles.telemetryCard}>
          <Text style={styles.telemetryLabel}>Live Telemetry</Text>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryKey}>Mode:</Text>
            <Text style={styles.telemetryValue}>{telemetry.state.mode || '—'}</Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryKey}>Speed:</Text>
            <Text style={styles.telemetryValue}>{telemetry.global.vel.toFixed(2)} m/s</Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryKey}>Battery:</Text>
            <Text style={styles.telemetryValue}>{telemetry.battery.percentage.toFixed(0)}%</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderComplete = () => (
    <View style={styles.stepContent}>
      <View style={styles.successAnimation}>
        <View style={[styles.successRing, { borderColor: colors.success }]}>
          <MaterialCommunityIcons name="check-bold" size={36} color={colors.success} />
        </View>
      </View>

      <Text style={[styles.stepTitle, { color: colors.success }]}>Tuning Successful</Text>
      <Text style={styles.stepDescription}>
        All PID gains have been optimized and saved. Your rover should now have improved steering accuracy and speed control.
      </Text>

      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>What's Next?</Text>
        <View style={styles.resultItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.resultItemText}>Test the new gains in manual mode</Text>
        </View>
        <View style={styles.resultItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.resultItemText}>Run a short mission to verify path tracking</Text>
        </View>
        <View style={styles.resultItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.resultItemText}>Re-tune anytime if performance degrades</Text>
        </View>
      </View>
    </View>
  );

  const renderContent = () => {
    if (currentStep === WizardStep.Overview && !isRunning) {
      return renderOverview();
    }
    if (currentStep === WizardStep.Complete && tuneState === TuneState.Success) {
      return renderComplete();
    }
    return renderActiveStep();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIconWrap, { borderColor: getStepColor() + '40' }]}>
              <MaterialCommunityIcons name={getStepIcon()} size={18} color={getStepColor()} />
            </View>
            <Text style={[styles.headerTitle, { color: getStepColor() }]}>QUICK TUNE</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {renderProgressBar()}

        {/* ── CONTENT ── */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderContent()}
        </ScrollView>

        {/* ── BOTTOM ACTIONS ── */}
        <View style={styles.footer}>
          {currentStep === WizardStep.Overview && !isRunning && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.warning }]}
              onPress={handleStartTuning}
            >
              <MaterialCommunityIcons name="play-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Start QuickTune</Text>
            </TouchableOpacity>
          )}

          {isRunning && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: 0.6 }]}
              disabled
            >
              <MaterialCommunityIcons name="progress-clock" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Tuning in Progress...</Text>
            </TouchableOpacity>
          )}

          {(currentStep === WizardStep.Complete || tuneState === TuneState.Success) && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.success }]}
              onPress={handleClose}
            >
              <MaterialCommunityIcons name="check-all" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.accent + '20',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
  },
  content: {
    flex: 1,
    padding: 16,
  },

  // ── STEP CONTENT ──
  stepContent: {
    gap: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.panelBg,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  paramList: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  paramListTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  paramItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  paramItemText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  warningText: {
    flex: 1,
    color: colors.warning,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },

  // ── ACTIVE STEP ──
  statusAnimation: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  statusRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.panelBg,
  },
  stepTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  telemetryCard: {
    backgroundColor: colors.panelBg,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  telemetryLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  telemetryKey: {
    color: colors.textMuted,
    fontSize: 13,
  },
  telemetryValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── COMPLETE ──
  successAnimation: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.panelBg,
  },
  resultCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  resultItemText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
  },

  // ── FOOTER ──
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.primary,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
