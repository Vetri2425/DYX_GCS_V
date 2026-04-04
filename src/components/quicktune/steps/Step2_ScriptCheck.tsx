/**
 * Step2_ScriptCheck — QuickTune Wizard
 *
 * Checks if the QuickTune script exists on the vehicle.
 * States: checking, found, not_found, uploading, uploaded, error
 *
 * Flow:
 * 1. On mount → call quickTuneService.checkScript()
 * 2. If found → show "found" state, enable Next
 * 3. If not found → show "not_found" with Upload button
 * 4. Upload → calls quickTuneService.uploadScript() → transitions to "uploaded"
 * 5. Error → show error state with retry option
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { quickTuneService } from '../../../services/quickTuneService';

// ── State types ──────────────────────────────────────────────────────────────

type ScriptCheckState =
  | 'checking'
  | 'found'
  | 'not_found'
  | 'uploading'
  | 'uploaded'
  | 'error';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Step2_ScriptCheck({ onNext, onBack }: Props) {
  const [state, setState] = useState<ScriptCheckState>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    runScriptCheck();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runScriptCheck = useCallback(async () => {
    try {
      setState('checking');
      setErrorMessage('');
      const result = await quickTuneService.checkScript();

      if (!mountedRef.current) return;

      if (result.exists) {
        setState('found');
      } else {
        setState('not_found');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  }, []);

  const handleUpload = useCallback(async () => {
    try {
      setState('uploading');
      setErrorMessage('');
      await quickTuneService.uploadScript();

      if (!mountedRef.current) return;
      setState('uploaded');
    } catch (err) {
      if (!mountedRef.current) return;
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  }, []);

  const handleRetry = useCallback(() => {
    runScriptCheck();
  }, [runScriptCheck]);

  const isNextEnabled = state === 'found' || state === 'uploaded';

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderChecking = () => (
    <View style={styles.centerContent}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.statusText}>Checking for QuickTune script...</Text>
      <Text style={styles.subText}>
        Scanning vehicle for existing script files
      </Text>
    </View>
  );

  const renderFound = () => (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: colors.success }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.cardIconWrap, { borderColor: colors.success + '40' }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.success} />
            </View>
            <Text style={styles.cardLabel}>SCRIPT DETECTED</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <View style={[styles.statusBadgeDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.statusBadgeText, { color: colors.success }]}>FOUND</Text>
          </View>
        </View>
        <Text style={styles.descriptionText}>
          QuickTune script is already installed on the vehicle.
        </Text>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="file-check" size={16} color={colors.success} />
          <Text style={styles.infoText}>rover-quicktune.lua</Text>
        </View>
        <Text style={styles.hintText}>
          You can proceed to the next step or re-upload to ensure the latest version.
        </Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={18} color={colors.text} />
          <Text style={styles.uploadBtnText}>Re-upload Script</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNotFound = () => (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: colors.warning }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.cardIconWrap, { borderColor: colors.warning + '40' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.warning} />
            </View>
            <Text style={styles.cardLabel}>SCRIPT NOT FOUND</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
            <View style={[styles.statusBadgeDot, { backgroundColor: colors.warning }]} />
            <Text style={[styles.statusBadgeText, { color: colors.warning }]}>MISSING</Text>
          </View>
        </View>
        <Text style={styles.descriptionText}>
          No QuickTune script was found on the vehicle. Upload the bundled script to continue.
        </Text>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="file-outline" size={16} color={colors.warning} />
          <Text style={styles.infoText}>rover-quicktune.lua (bundled)</Text>
        </View>
        <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={18} color={colors.text} />
          <Text style={styles.uploadBtnText}>Upload Script</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUploading = () => (
    <View style={styles.centerContent}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.statusText}>Uploading QuickTune script...</Text>
      <Text style={styles.subText}>
        This may take a moment depending on connection speed
      </Text>
    </View>
  );

  const renderUploaded = () => (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: colors.success }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.cardIconWrap, { borderColor: colors.success + '40' }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.success} />
            </View>
            <Text style={styles.cardLabel}>UPLOAD SUCCESSFUL</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
            <View style={[styles.statusBadgeDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.statusBadgeText, { color: colors.success }]}>UPLOADED</Text>
          </View>
        </View>
        <Text style={styles.descriptionText}>
          QuickTune script has been uploaded and is ready to use.
        </Text>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="check-bold" size={16} color={colors.success} />
          <Text style={styles.infoText}>rover-quicktune.lua — uploaded</Text>
        </View>
        <TouchableOpacity style={styles.outlineBtn} onPress={handleUpload}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={16} color={colors.accent} />
          <Text style={styles.outlineBtnText}>Re-upload Script</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderError = () => (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: colors.danger }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.cardIconWrap, { borderColor: colors.danger + '40' }]}>
              <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.danger} />
            </View>
            <Text style={styles.cardLabel}>ERROR</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.danger + '20', borderColor: colors.danger }]}>
            <View style={[styles.statusBadgeDot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.statusBadgeText, { color: colors.danger }]}>FAILED</Text>
          </View>
        </View>
        <Text style={styles.descriptionText}>
          An error occurred during the script check:
        </Text>
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-octagon-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
          <MaterialCommunityIcons name="reload" size={18} color={colors.text} />
          <Text style={styles.retryBtnText}>Retry Check</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (state) {
      case 'checking':
        return renderChecking();
      case 'found':
        return renderFound();
      case 'not_found':
        return renderNotFound();
      case 'uploading':
        return renderUploading();
      case 'uploaded':
        return renderUploaded();
      case 'error':
        return renderError();
      default:
        return renderChecking();
    }
  };

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Step header */}
        <View style={styles.stepHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={styles.stepTitle}>Script Check</Text>
          <Text style={styles.stepSubtitle}>
            Verify the QuickTune script is installed on the vehicle
          </Text>
        </View>

        {renderContent()}
      </ScrollView>

      {/* Footer navigation */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" size={18} color={colors.text} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, !isNextEnabled && styles.nextBtnDisabled]}
          disabled={!isNextEnabled}
          onPress={onNext}
        >
          <Text style={styles.nextBtnText}>Next</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles (Dashboard patterns) ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scroll: {
    flex: 1,
  },

  // ── Step header ────────────────────────────────────────────────────────
  stepHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stepSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  // ── Card base (Dashboard pattern) ──────────────────────────────────────
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  cardAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardLabel: {
    color: 'rgba(103, 232, 249, 0.8)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // ── Status badge (Dashboard pattern) ───────────────────────────────────
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusBadgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ── Content text ───────────────────────────────────────────────────────
  descriptionText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.panelBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  infoText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  hintText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // ── Center content (checking / uploading) ──────────────────────────────
  centerContent: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Error ──────────────────────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.danger + '15',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    flex: 1,
    fontWeight: '500',
  },

  // ── Buttons ────────────────────────────────────────────────────────────
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.accent + '50',
    marginTop: 4,
  },
  outlineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  // ── Footer navigation ──────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.secondary,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.panelBg,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  nextBtnDisabled: {
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
