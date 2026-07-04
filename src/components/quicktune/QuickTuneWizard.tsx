import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Step1ParamCheck from './steps/Step1_ParamCheck';
import Step2_ScriptCheck from './steps/Step2_ScriptCheck';
import { Step3_ArmCircle } from './steps/Step3_ArmCircle';
import Step4_TuneControl from './steps/Step4_TuneControl';
import Step5_Monitor from './steps/Step5_Monitor';
import Step6_Results from './steps/Step6_Results';
import { quickTuneService } from '../../services/quickTuneService';
import { QUICKTUNE_AUX_CHANNEL } from '../../constants/quicktune';
import { useRover } from '../../context/RoverContext';
import { qtLog } from '../../utils/quicktuneLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

interface StepConfig {
  label: string;
}

const STEPS: Record<WizardStep, StepConfig> = {
  1: { label: 'Params' },
  2: { label: 'Script' },
  3: { label: 'Arm' },
  4: { label: 'Tune' },
  5: { label: 'Monitor' },
  6: { label: 'Results' },
};

export interface QuickTuneWizardProps {
  /** Called when the wizard is fully closed (abort or done) */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuickTuneWizard({ onClose }: QuickTuneWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [paramSnapshot, setParamSnapshot] = useState<Record<string, number> | null>(null);
  const { services } = useRover();

  // --- callbacks -----------------------------------------------------------

  const goNext = useCallback(() => {
    setCurrentStep(prev => {
      const next = prev < 6 ? ((prev + 1) as WizardStep) : prev;
      qtLog.step(prev, next);
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep(prev => {
      const next = prev > 1 ? ((prev - 1) as WizardStep) : prev;
      if (next !== prev) qtLog.step(prev, next);
      return next;
    });
  }, []);

  /** Abort: DO_AUX_FUNCTION(300, 0) → HOLD mode → close wizard.
   *
   * Both commands are safety-critical. If the stop command fails the vehicle
   * may still be executing the tuning script. We surface that to the user
   * instead of silently swallowing the error and closing.
   */
  const onAbort = useCallback(async () => {
    qtLog.warn('Wizard', 'Abort triggered', { currentStep });
    let stopFailed = false;
    let modeFailed = false;

    try {
      qtLog.api('Wizard', 'POST', 'aux_function stop');
      await quickTuneService.sendAuxFunction('stop', QUICKTUNE_AUX_CHANNEL, 0);
      qtLog.info('Wizard', 'Abort stop command sent');
    } catch (err) {
      stopFailed = true;
      qtLog.error('Wizard', 'Abort stop command failed', err);
      console.error('[QuickTuneWizard] Abort stop command failed:', err);
    }

    try {
      qtLog.api('Wizard', 'POST', 'setMode HOLD');
      await services.setMode('HOLD');
      qtLog.info('Wizard', 'Mode set to HOLD');
    } catch (err) {
      modeFailed = true;
      qtLog.error('Wizard', 'Abort setMode(HOLD) failed', err);
      console.error('[QuickTuneWizard] Abort setMode(HOLD) failed:', err);
    }

    // If the stop command failed, warn the user — the vehicle may still be
    // running the tuning script. Give them the choice to close anyway or stay.
    if (stopFailed) {
      Alert.alert(
        'Abort Command Failed',
        'The stop command could not be sent to the vehicle. The tuning script may still be running.\n\n' +
        'Ensure the vehicle is safe before closing.',
        [
          {
            text: 'Stay in Wizard',
            style: 'cancel',
          },
          {
            text: 'Close Anyway',
            style: 'destructive',
            onPress: onClose,
          },
        ],
      );
      return;
    }

    // Stop succeeded but HOLD mode failed — less critical, just warn and close.
    if (modeFailed) {
      Alert.alert(
        'Mode Change Failed',
        'Tuning was stopped but the vehicle could not be set to HOLD mode. Check the vehicle state.',
        [{ text: 'OK', onPress: onClose }],
      );
      return;
    }

    onClose();
  }, [services, onClose]);

  /** Step 4 captures the tuned-parameter snapshot and passes it downstream */
  const onTuneComplete = useCallback((snapshot: Record<string, number>) => {
    qtLog.info('Wizard', 'Step4 complete — param snapshot captured', snapshot);
    setParamSnapshot(snapshot);
    goNext();
  }, [goNext]);

  const onMonitorComplete = useCallback(() => {
    goNext();
  }, [goNext]);

  // --- render helpers ------------------------------------------------------

  const renderStep = useMemo(() => {
    switch (currentStep) {
      case 1:
        return <Step1ParamCheck onNext={goNext} onBack={onClose} />;
      case 2:
        return <Step2_ScriptCheck onNext={goNext} onBack={goBack} />;
      case 3:
        return <Step3_ArmCircle onNext={goNext} onBack={goBack} onAbort={onAbort} />;
      case 4:
        return <Step4_TuneControl onComplete={onTuneComplete} onBack={goBack} onAbort={onAbort} />;
      case 5:
        return <Step5_Monitor onComplete={onMonitorComplete} onAbort={onAbort} />;
      case 6:
        return (
          <Step6_Results
            beforeParams={paramSnapshot ?? {}}
            onClose={onClose}
          />
        );
      default:
        return null;
    }
  }, [currentStep, goNext, goBack, onAbort, onTuneComplete, onMonitorComplete, onClose, paramSnapshot]);

  // --- layout --------------------------------------------------------------

  return (
    <View style={styles.root}>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        {([1, 2, 3, 4, 5, 6] as WizardStep[]).map(step => {
          const isActive = step === currentStep;
          const isPast = step < currentStep;
          return (
            <View key={step} style={styles.stepItem}>
              <View
                style={[
                  styles.dot,
                  isActive && styles.dotActive,
                  isPast && styles.dotPast,
                ]}
              >
                {isPast && <Text style={styles.dotCheckText}>✓</Text>}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  isActive && styles.stepLabelActive,
                ]}
                numberOfLines={1}
              >
                {STEPS[step].label}
              </Text>
              {/* Connector line between dots (except after last) */}
              {step < 6 && (
                <View
                  style={[
                    styles.connector,
                    isPast && styles.connectorPast,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Step content */}
      <View style={styles.content}>{renderStep}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const COLORS = {
  bg: '#0A1628',
  surface: '#132238',
  border: '#1E3A5F',
  primary: '#3B82F6',
  primaryDim: '#1D4ED8',
  success: '#10B981',
  textMuted: '#64748B',
  text: '#E2E8F0',
  textActive: '#FFFFFF',
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.border,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  dotActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  dotPast: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  dotCheckText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: COLORS.textActive,
    fontWeight: '600',
  },
  connector: {
    position: 'absolute',
    top: 7,
    left: '55%',
    width: '90%',
    height: 2,
    backgroundColor: COLORS.border,
    zIndex: 1,
  },
  connectorPast: {
    backgroundColor: COLORS.success,
  },
  content: {
    flex: 1,
  },
});
