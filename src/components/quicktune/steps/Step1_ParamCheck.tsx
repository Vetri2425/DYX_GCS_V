/**
 * Step1_ParamCheck — QuickTune Wizard Step 1
 *
 * Displays all PRETUNE_PARAMS with current vs expected (recommended) values.
 * - Shows OK/WARN badge per param
 * - Tap the pencil on any current value to edit it inline
 * - Tap the expected value chip to apply the recommended value in one tap
 * - Reboot warning if SCR_ENABLE was changed
 * - Next button always enabled (no fix required to proceed)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { useRover } from '../../../context/RoverContext';
import { PRETUNE_PARAMS } from '../../../types/quicktune';
import { QUICKTUNE_AUX_CHANNEL, PARAM_APPLY_STATUS_CLEAR_MS } from '../../../constants/quicktune';
import { qtLog } from '../../../utils/quicktuneLogger';

const RECOMMENDED_VALUES: Record<string, number> = {
  SCR_ENABLE: 1,
  RTUN_ENABLE: 1,
  RTUN_AXES: 3,
  RTUN_RC_FUNC: QUICKTUNE_AUX_CHANNEL,
  RTUN_AUTO_SAVE: 5,
  RTUN_AUTO_FILTER: 1,
  RTUN_STR_FFRATIO: 0.9,
  RTUN_STR_P_RATIO: 0.5,
  RTUN_STR_I_RATIO: 0.5,
  RTUN_SPD_FFRATIO: 1.0,
  RTUN_SPD_P_RATIO: 1.0,
  RTUN_SPD_I_RATIO: 1.0,
  CIRC_SPEED: 1.0,
  CIRC_RADIUS: 4.0,
  CIRC_DIR: 0,
  ATC_STR_ACC_MAX: 120.0,
  ATC_STR_RAT_MAX: 120.0,
  ATC_BRAKE: 1,
};

const REBOOT_REQUIRED_PARAMS = new Set(['SCR_ENABLE']);
const MATCH_TOLERANCE = 0.001;

interface Step1ParamCheckProps {
  onNext?: () => void;
  onBack?: () => void;
}

// ── ParamRow ──────────────────────────────────────────────────────────────────

interface ParamRowProps {
  name: string;
  currentValue: number | null;
  recommendedValue: number;
  isLoading: boolean;
  applyResult: 'success' | 'error' | null;
  isEditing: boolean;
  onApplyRecommended: () => void;
  onStartEdit: () => void;
  onConfirmEdit: (raw: string) => void;
  onCancelEdit: () => void;
}

const ParamRow: React.FC<ParamRowProps> = ({
  name,
  currentValue,
  recommendedValue,
  isLoading,
  applyResult,
  isEditing,
  onApplyRecommended,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
}) => {
  const [editText, setEditText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // When edit mode opens, seed the input with the current value
  useEffect(() => {
    if (isEditing) {
      const seed =
        currentValue !== null
          ? Number.isInteger(currentValue)
            ? String(currentValue)
            : currentValue.toFixed(4)
          : '';
      setEditText(seed);
      // Small delay so the row has rendered before focusing
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isEditing, currentValue]);

  const matches =
    currentValue !== null &&
    Math.abs(currentValue - recommendedValue) <= MATCH_TOLERANCE;
  const hasDiff =
    currentValue !== null &&
    Math.abs(currentValue - recommendedValue) > MATCH_TOLERANCE;
  const needsReboot = REBOOT_REQUIRED_PARAMS.has(name);

  const displayCurrent =
    currentValue !== null
      ? Number.isInteger(currentValue)
        ? String(currentValue)
        : currentValue.toFixed(4)
      : '—';
  const displayRecommended = Number.isInteger(recommendedValue)
    ? String(recommendedValue)
    : recommendedValue.toFixed(4);

  return (
    <View style={[styles.row, isEditing && styles.rowEditing]}>
      {/* Left: param name + status badge */}
      <View style={styles.rowLeft}>
        <View style={styles.nameRow}>
          <Text style={styles.paramName} numberOfLines={1}>{name}</Text>
          {needsReboot && (
            <View style={styles.rebootBadge}>
              <Ionicons name="refresh-circle" size={12} color={colors.warning} />
              <Text style={styles.rebootBadgeText}>REBOOT</Text>
            </View>
          )}
        </View>
        <View style={styles.badgeRow}>
          {isLoading ? (
            <View style={[styles.badge, styles.badgePending]}>
              <ActivityIndicator size="small" color={colors.textMuted} />
            </View>
          ) : matches ? (
            <View style={[styles.badge, styles.badgeOk]}>
              <Ionicons name="checkmark-circle" size={10} color={colors.success} />
              <Text style={[styles.badgeText, styles.badgeTextOk]}>OK</Text>
            </View>
          ) : hasDiff ? (
            <View style={[styles.badge, styles.badgeWarn]}>
              <Ionicons name="warning" size={10} color={colors.warning} />
              <Text style={[styles.badgeText, styles.badgeTextWarn]}>DIFF</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgePending]}>
              <Text style={styles.badgeText}>—</Text>
            </View>
          )}
        </View>
      </View>

      {/* Center: current value — editable */}
      <View style={styles.rowCenter}>
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              ref={inputRef}
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              keyboardType="decimal-pad"
              returnKeyType="done"
              selectTextOnFocus
              onSubmitEditing={() => onConfirmEdit(editText)}
              accessibilityLabel={`Edit value for ${name}`}
            />
            <TouchableOpacity
              style={styles.editConfirmBtn}
              onPress={() => onConfirmEdit(editText)}
              accessibilityRole="button"
              accessibilityLabel="Confirm edit"
            >
              <Ionicons name="checkmark" size={14} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editCancelBtn}
              onPress={onCancelEdit}
              accessibilityRole="button"
              accessibilityLabel="Cancel edit"
            >
              <Ionicons name="close" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.currentValueBtn}
            onPress={onStartEdit}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${name}, current value ${displayCurrent}`}
          >
            {applyResult === 'success' ? (
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            ) : applyResult === 'error' ? (
              <Ionicons name="close-circle" size={16} color={colors.danger} />
            ) : (
              <>
                <Text style={styles.currentValueText}>{displayCurrent}</Text>
                <Ionicons name="pencil" size={11} color={colors.textMuted} style={styles.pencilIcon} />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Right: recommended value — one-tap apply */}
      <View style={styles.rowRight}>
        {!isEditing && (
          <TouchableOpacity
            style={[
              styles.expectedValueBtn,
              hasDiff && styles.expectedValueBtnMismatch,
            ]}
            onPress={hasDiff ? onApplyRecommended : undefined}
            activeOpacity={hasDiff ? 0.7 : 1}
            accessibilityRole="button"
            accessibilityLabel={hasDiff ? `Apply recommended value ${displayRecommended} for ${name}` : undefined}
          >
            <Text style={styles.expectedValueText}>{displayRecommended}</Text>
            {hasDiff && (
              <Ionicons name="flash" size={11} color={colors.warning} style={styles.flashIcon} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const Step1ParamCheck: React.FC<Step1ParamCheckProps> = ({ onNext, onBack }) => {
  const { services, connectionState } = useRover();
  const isConnected = connectionState === 'connected';

  const [currentValues, setCurrentValues] = useState<Record<string, number | null>>({});
  const [loadingParams, setLoadingParams] = useState<Record<string, boolean>>({});
  const [applyStatus, setApplyStatus] = useState<Record<string, 'success' | 'error' | null>>({});
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [scrEnableChanged, setScrEnableChanged] = useState(false);
  const mountedRef = useRef(true);
  const applyStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (applyStatusTimerRef.current !== null) {
        clearTimeout(applyStatusTimerRef.current);
        applyStatusTimerRef.current = null;
      }
    };
  }, []);

  // Load all param values on connect
  useEffect(() => {
    if (!isConnected) return;

    const loadParams = async () => {
      const loadingInit: Record<string, boolean> = {};
      PRETUNE_PARAMS.forEach((p) => { loadingInit[p] = true; });
      setLoadingParams(loadingInit);

      const results = await Promise.allSettled(
        PRETUNE_PARAMS.map(async (name) => {
          try { return await services.getParam(name); }
          catch (err) { return { success: false, param: null, error: err }; }
        })
      );

      if (!mountedRef.current) return;

      const values: Record<string, number | null> = {};
      const loadingAfter: Record<string, boolean> = {};
      results.forEach((result, index) => {
        const name = PRETUNE_PARAMS[index];
        loadingAfter[name] = false;
        if (result.status === 'fulfilled' && result.value.success) {
          values[name] = result.value.param?.value ?? null;
        } else {
          values[name] = null;
        }
      });

      setCurrentValues(values);
      setLoadingParams(loadingAfter);
    };

    loadParams();
  }, [isConnected, services]);

  useEffect(() => {
    const scrCurrent = currentValues['SCR_ENABLE'];
    if (scrCurrent !== null && scrCurrent !== undefined) {
      setScrEnableChanged(Math.abs(scrCurrent - 1) > MATCH_TOLERANCE);
    }
  }, [currentValues]);

  const scheduleStatusClear = useCallback((name: string) => {
    applyStatusTimerRef.current = setTimeout(() => {
      applyStatusTimerRef.current = null;
      if (mountedRef.current) {
        setApplyStatus((prev) => ({ ...prev, [name]: null }));
      }
    }, PARAM_APPLY_STATUS_CLEAR_MS);
  }, []);

  // Write a value to the rover and update local state
  const writeParam = useCallback(async (name: string, value: number) => {
    if (!isConnected) return;
    setApplyStatus((prev) => ({ ...prev, [name]: null }));
    qtLog.api('Step1', 'POST', `/api/params/${name}`, { value });
    try {
      const result = await services.setParam(name, value);
      if (!mountedRef.current) return;
      if (result.success) {
        qtLog.info('Step1', `${name} set to ${value}`);
        setApplyStatus((prev) => ({ ...prev, [name]: 'success' }));
        setCurrentValues((prev) => ({ ...prev, [name]: value }));
      } else {
        qtLog.warn('Step1', `setParam ${name} returned success=false`);
        setApplyStatus((prev) => ({ ...prev, [name]: 'error' }));
      }
    } catch (err) {
      qtLog.error('Step1', `setParam ${name} failed`, err);
      if (!mountedRef.current) return;
      setApplyStatus((prev) => ({ ...prev, [name]: 'error' }));
    }
    scheduleStatusClear(name);
  }, [isConnected, services, scheduleStatusClear]);

  // Apply recommended value in one tap
  const handleApplyRecommended = useCallback((name: string) => {
    writeParam(name, RECOMMENDED_VALUES[name]);
  }, [writeParam]);

  // Open inline editor for a param
  const handleStartEdit = useCallback((name: string) => {
    if (!isConnected) return;
    Keyboard.dismiss(); // close any open keyboard first
    setEditingParam(name);
  }, [isConnected]);

  // Confirm custom value from inline editor
  const handleConfirmEdit = useCallback((name: string, raw: string) => {
    setEditingParam(null);
    Keyboard.dismiss();
    const parsed = parseFloat(raw.replace(',', '.'));
    if (isNaN(parsed)) {
      qtLog.warn('Step1', `Invalid edit input for ${name}: "${raw}"`);
      return;
    }
    writeParam(name, parsed);
  }, [writeParam]);

  const handleCancelEdit = useCallback(() => {
    setEditingParam(null);
    Keyboard.dismiss();
  }, []);

  const isLoading = Object.values(loadingParams).some((v) => v);
  const showRebootWarning = scrEnableChanged || applyStatus['SCR_ENABLE'] === 'success';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="clipboard-outline" size={20} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Parameter Check</Text>
            <Text style={styles.headerSubtitle}>
              {isLoading
                ? 'Loading parameters…'
                : 'Tap ✏ to edit · tap expected value to apply recommended'}
            </Text>
          </View>
        </View>
      </View>

      {/* Connection warning */}
      {!isConnected && (
        <View style={styles.warningBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
          <Text style={styles.warningText}>
            Not connected — cannot read or write parameters.
          </Text>
        </View>
      )}

      {/* Reboot warning */}
      {showRebootWarning && (
        <View style={styles.rebootBanner}>
          <Ionicons name="refresh-circle" size={18} color={colors.warning} />
          <Text style={styles.rebootBannerText}>
            SCR_ENABLE was changed. A vehicle reboot is required.
          </Text>
        </View>
      )}

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.tableHeaderParam]}>Parameter</Text>
        <Text style={[styles.tableHeaderCell, styles.tableHeaderValue]}>Current</Text>
        <Text style={[styles.tableHeaderCell, styles.tableHeaderValue]}>Expected</Text>
      </View>

      {/* Parameter list */}
      <ScrollView
        style={styles.listScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {PRETUNE_PARAMS.map((name) => (
          <ParamRow
            key={name}
            name={name}
            currentValue={currentValues[name] ?? null}
            recommendedValue={RECOMMENDED_VALUES[name]}
            isLoading={loadingParams[name] || false}
            applyResult={applyStatus[name] ?? null}
            isEditing={editingParam === name}
            onApplyRecommended={() => handleApplyRecommended(name)}
            onStartEdit={() => handleStartEdit(name)}
            onConfirmEdit={(raw) => handleConfirmEdit(name, raw)}
            onCancelEdit={handleCancelEdit}
          />
        ))}
        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {onBack && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => onNext?.()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Proceed to next step"
        >
          <Text style={styles.nextBtnText}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accent + '18', borderWidth: 1, borderColor: colors.accent + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, backgroundColor: colors.warning + '12', borderWidth: 1, borderColor: colors.warning + '30',
  },
  warningText: { flex: 1, fontSize: 11, color: colors.warning, fontWeight: '500' },
  rebootBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, backgroundColor: colors.warning + '12', borderWidth: 1, borderColor: colors.warning + '30',
  },
  rebootBannerText: { flex: 1, fontSize: 11, color: colors.warning, fontWeight: '500' },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.secondary,
  },
  tableHeaderCell: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  tableHeaderParam: { flex: 2 },
  tableHeaderValue: { flex: 1, textAlign: 'center' },

  listScroll: { flex: 1 },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border + '40', minHeight: 52,
  },
  rowEditing: {
    backgroundColor: colors.accent + '08',
    borderBottomColor: colors.accent + '40',
  },
  rowLeft: { flex: 2, paddingRight: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paramName: {
    fontSize: 12, fontWeight: '600', color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rebootBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.warning + '25', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1,
  },
  rebootBadgeText: { fontSize: 7, fontWeight: '700', color: colors.warning, letterSpacing: 0.5 },
  badgeRow: { marginTop: 3 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1,
  },
  badgeOk: { backgroundColor: colors.success + '15', borderColor: colors.success + '35' },
  badgeWarn: { backgroundColor: colors.warning + '15', borderColor: colors.warning + '35' },
  badgePending: { backgroundColor: colors.textMuted + '15', borderColor: colors.textMuted + '25' },
  badgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 1, color: colors.textMuted },
  badgeTextOk: { color: colors.success },
  badgeTextWarn: { color: colors.warning },

  // Current value cell
  rowCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  currentValueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 5, borderRadius: 6,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border,
    minWidth: 56,
  },
  currentValueText: {
    fontSize: 12, color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', textAlign: 'center',
  },
  pencilIcon: { opacity: 0.6 },

  // Inline edit
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editInput: {
    flex: 1, minWidth: 52, maxWidth: 72,
    backgroundColor: colors.secondary,
    borderWidth: 1, borderColor: colors.accent,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4,
    color: colors.text, fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  editConfirmBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center',
  },
  editCancelBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },

  // Expected value cell
  rowRight: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  expectedValueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, minWidth: 60,
  },
  expectedValueBtnMismatch: { borderColor: colors.warning + '50', backgroundColor: colors.warning + '08' },
  expectedValueText: {
    fontSize: 12, color: colors.accentLight,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '600', textAlign: 'center',
  },
  flashIcon: { opacity: 0.8 },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.secondary, gap: 8,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border,
  },
  backBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.greenBtn,
  },
  nextBtnText: { fontSize: 14, fontWeight: '700', color: colors.text },
  scrollSpacer: { height: 100 },
});

export default Step1ParamCheck;
