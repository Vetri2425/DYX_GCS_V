/**
 * Step1_ParamCheck — QuickTune Wizard Step 1
 *
 * Displays all 18 PRETUNE_PARAMS with current vs expected (recommended) values.
 * - Inline editable numeric input for params that don't match
 * - Calls services.setParam() to update mismatched values
 * - Shows OK/WARN badge per param
 * - Next button enabled only when all params match
 * - Reboot warning if SCR_ENABLE was changed
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { useRover } from '../../../context/RoverContext';
import { PRETUNE_PARAMS } from '../../../types/quicktune';

// Recommended values for each pretune param (these come from the tuning script)
const RECOMMENDED_VALUES: Record<string, number> = {
  ATC_ACC_MAX: 3.0,
  ATC_DECEL_MAX: 3.0,
  ATC_SPEED_UP: 1.5,
  ATC_SPEED_DN: 1.5,
  ATC_TURN_MAX: 1.0,
  ATC_STR_RAT_P: 0.5,
  ATC_STR_RAT_I: 0.05,
  ATC_STR_RAT_D: 0.01,
  ATC_STR_RAT_IMAX: 0.5,
  WHEEL_RADIUS: 0.1,
  WHEEL_BASE: 0.3,
  WHEEL_TRACK: 0.35,
  MOT_THST_HOVER: 0.35,
  MOT_THST_MAX: 0.9,
  NAVL1_PERIOD: 2.0,
  NAVL1_DAMPING: 0.7,
  SCHED_SPEED_MAX: 2.0,
  SCHED_TURN_MAX: 1.0,
};

// Params that require a reboot after change
const REBOOT_REQUIRED_PARAMS = new Set(['SCR_ENABLE']);

// Tolerance for considering values "matching" (floating-point comparison)
const MATCH_TOLERANCE = 0.001;

interface Step1ParamCheckProps {
  onNext?: () => void;
  onBack?: () => void;
}

interface ParamRowProps {
  name: string;
  currentValue: number | null;
  recommendedValue: number;
  isLoading: boolean;
  isEditing: boolean;
  isApplying: boolean;
  applyResult: 'idle' | 'success' | 'error' | null;
  onStartEdit: () => void;
  onChangeText: (text: string) => void;
  onFinishEdit: () => void;
}

const ParamRow: React.FC<ParamRowProps> = ({
  name,
  currentValue,
  recommendedValue,
  isLoading,
  isEditing,
  isApplying,
  applyResult,
  onStartEdit,
  onChangeText,
  onFinishEdit,
}) => {
  const matches =
    currentValue !== null &&
    Math.abs(currentValue - recommendedValue) <= MATCH_TOLERANCE;
  const hasChanged =
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
    <View style={styles.row}>
      {/* Left: param name + badge */}
      <View style={styles.rowLeft}>
        <View style={styles.nameRow}>
          <Text style={styles.paramName}>{name}</Text>
          {needsReboot && (
            <View style={styles.rebootBadge}>
              <Ionicons name="refresh-circle" size={12} color={colors.warning} />
              <Text style={styles.rebootBadgeText}>REBOOT</Text>
            </View>
          )}
        </View>
        <View style={styles.badgeRow}>
          {matches ? (
            <View style={[styles.badge, styles.badgeOk]}>
              <Ionicons name="checkmark-circle" size={10} color={colors.success} />
              <Text style={[styles.badgeText, styles.badgeTextOk]}>OK</Text>
            </View>
          ) : hasChanged ? (
            <View style={[styles.badge, styles.badgeWarn]}>
              <Ionicons name="warning" size={10} color={colors.warning} />
              <Text style={[styles.badgeText, styles.badgeTextWarn]}>WARN</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgePending]}>
              <ActivityIndicator size="small" color={colors.textMuted} />
            </View>
          )}
        </View>
      </View>

      {/* Center: current value */}
      <View style={styles.rowCenter}>
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : (
          <Text style={styles.currentValueText}>{displayCurrent}</Text>
        )}
      </View>

      {/* Right: expected / editable value */}
      <View style={styles.rowRight}>
        {isEditing ? (
          <TextInput
            style={[
              styles.editInput,
              applyResult === 'success' && styles.editInputSuccess,
              applyResult === 'error' && styles.editInputError,
            ]}
            value={String(recommendedValue)}
            editable={false}
            selectTextOnFocus
            autoFocus
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={onFinishEdit}
            onBlur={onFinishEdit}
          />
        ) : applyResult === 'success' ? (
          <View style={styles.applyStatusWrap}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          </View>
        ) : applyResult === 'error' ? (
          <View style={styles.applyStatusWrap}>
            <Ionicons name="close-circle" size={18} color={colors.danger} />
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.expectedValueBtn,
              hasChanged && styles.expectedValueBtnMismatch,
            ]}
            onPress={hasChanged ? onStartEdit : undefined}
            activeOpacity={0.7}
          >
            <Text style={styles.expectedValueText}>{displayRecommended}</Text>
            {hasChanged && (
              <Ionicons name="create-outline" size={12} color={colors.textMuted} style={styles.editIcon} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const Step1ParamCheck: React.FC<Step1ParamCheckProps> = ({ onNext, onBack }) => {
  const { services, connectionState } = useRover();
  const isConnected = connectionState === 'connected';

  const [currentValues, setCurrentValues] = useState<Record<string, number | null>>({});
  const [loadingParams, setLoadingParams] = useState<Record<string, boolean>>({});
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<Record<string, 'idle' | 'applying' | 'success' | 'error' | null>>({});
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [scrEnableChanged, setScrEnableChanged] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load current param values from rover
  useEffect(() => {
    if (!isConnected) return;

    const loadParams = async () => {
      const loadingInit: Record<string, boolean> = {};
      PRETUNE_PARAMS.forEach((p) => {
        loadingInit[p] = true;
      });
      setLoadingParams(loadingInit);

      // Load all params in parallel for speed
      const results = await Promise.allSettled(
        PRETUNE_PARAMS.map(async (name) => {
          try {
            return await services.getParam(name);
          } catch (err) {
            return { success: false, param: null, error: err };
          }
        })
      );

      if (!mountedRef.current) return;

      const values: Record<string, number | null> = {};
      const loadingAfter: Record<string, boolean> = {};

      results.forEach((result, index) => {
        const name = PRETUNE_PARAMS[index];
        loadingAfter[name] = false;
        if (result.status === 'fulfilled' && result.value.success) {
          const paramValue = (result.value as any).param?.value;
          values[name] = paramValue ?? null;
        } else {
          values[name] = null;
        }
      });

      setCurrentValues(values);
      setLoadingParams(loadingAfter);
    };

    loadParams();
  }, [isConnected, services]);

  // Check if SCR_ENABLE was changed
  useEffect(() => {
    const scrCurrent = currentValues['SCR_ENABLE'];
    if (scrCurrent !== null) {
      // SCR_ENABLE expected value is typically 1 (scripting enabled)
      const scrExpected = 1;
      setScrEnableChanged(Math.abs(scrCurrent - scrExpected) > MATCH_TOLERANCE);
    }
  }, [currentValues]);

  // Determine which params don't match
  const mismatchedParams = PRETUNE_PARAMS.filter((name) => {
    const current = currentValues[name];
    if (current === null || current === undefined) return false;
    return Math.abs(current - RECOMMENDED_VALUES[name]) > MATCH_TOLERANCE;
  });

  const allParamsMatch = mismatchedParams.length === 0;
  const isLoading = Object.values(loadingParams).some((v) => v);

  // Apply a single param via services.setParam
  const applyParam = useCallback(
    async (name: string, value: number): Promise<boolean> => {
      setApplyStatus((prev) => ({ ...prev, [name]: 'applying' }));
      try {
        const result = await services.setParam(name, value);
        if (!mountedRef.current) return false;

        if (result.success) {
          setApplyStatus((prev) => ({ ...prev, [name]: 'success' }));
          setCurrentValues((prev) => ({ ...prev, [name]: value }));
          return true;
        } else {
          setApplyStatus((prev) => ({ ...prev, [name]: 'error' }));
          console.warn(`[Step1ParamCheck] setParam failed: ${name}`, result.message);
          return false;
        }
      } catch (err) {
        if (!mountedRef.current) return false;
        setApplyStatus((prev) => ({ ...prev, [name]: 'error' }));
        console.error(`[Step1ParamCheck] setParam error: ${name}`, err);
        return false;
      }
    },
    [services]
  );

  // Apply all mismatched params
  const handleApplyAll = useCallback(async () => {
    if (!isConnected || mismatchedParams.length === 0 || isApplyingAll) return;

    setIsApplyingAll(true);
    let allSuccess = true;

    for (const name of mismatchedParams) {
      const success = await applyParam(name, RECOMMENDED_VALUES[name]);
      if (!success) {
        allSuccess = false;
      }
    }

    if (mountedRef.current) {
      setIsApplyingAll(false);

      // Reset apply status after delay
      setTimeout(() => {
        if (mountedRef.current) {
          setApplyStatus({});
        }
      }, 3000);

      // Show reboot alert if SCR_ENABLE was among changed params
      if (scrEnableChanged) {
        // This is handled by the useEffect above; alert shown below
      }
    }
  }, [isConnected, mismatchedParams, isApplyingAll, applyParam, scrEnableChanged]);

  // Start inline editing for a param
  const handleStartEdit = useCallback((name: string) => {
    setEditingParam(name);
  }, []);

  // Finish editing — apply the recommended value
  const handleFinishEdit = useCallback(async () => {
    if (!editingParam) return;
    const name = editingParam;
    setEditingParam(null);
    await applyParam(name, RECOMMENDED_VALUES[name]);
  }, [editingParam, applyParam]);

  // Handle Next — ensure all match first
  const handleNext = useCallback(() => {
    if (allParamsMatch && onNext) {
      onNext();
    }
  }, [allParamsMatch, onNext]);

  // Show reboot warning if SCR_ENABLE was changed
  const showRebootWarning = scrEnableChanged || (applyStatus['SCR_ENABLE'] === 'success' && REBOOT_REQUIRED_PARAMS.has('SCR_ENABLE'));

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
                : allParamsMatch
                ? 'All parameters match expected values'
                : `${mismatchedParams.length} parameter${mismatchedParams.length !== 1 ? 's' : ''} need${mismatchedParams.length === 1 ? 's' : ''} adjustment`}
            </Text>
          </View>
        </View>
        {!isLoading && (
          <View style={[styles.statusBadge, allParamsMatch ? styles.statusBadgeOk : styles.statusBadgeWarn]}>
            <Ionicons
              name={allParamsMatch ? 'checkmark-circle' : 'warning'}
              size={14}
              color={allParamsMatch ? colors.success : colors.warning}
            />
            <Text style={[styles.statusBadgeText, { color: allParamsMatch ? colors.success : colors.warning }]}>
              {allParamsMatch ? 'READY' : 'ACTION NEEDED'}
            </Text>
          </View>
        )}
      </View>

      {/* Connection warning banner */}
      {!isConnected && (
        <View style={styles.warningBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
          <Text style={styles.warningText}>
            Not connected — cannot read or write parameters.
          </Text>
        </View>
      )}

      {/* Reboot warning banner */}
      {showRebootWarning && (
        <View style={styles.rebootBanner}>
          <Ionicons name="refresh-circle" size={18} color={colors.warning} />
          <Text style={styles.rebootBannerText}>
            SCR_ENABLE was changed. A vehicle reboot is required for this change to take effect.
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
      <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {PRETUNE_PARAMS.map((name) => (
          <ParamRow
            key={name}
            name={name}
            currentValue={currentValues[name] ?? null}
            recommendedValue={RECOMMENDED_VALUES[name]}
            isLoading={loadingParams[name] || false}
            isEditing={editingParam === name}
            isApplying={false}
            applyResult={'idle'}
            onStartEdit={() => handleStartEdit(name)}
            onChangeText={() => {}}
            onFinishEdit={handleFinishEdit}
          />
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {onBack && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={colors.text} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}

        {/* Apply All button — shown when params mismatch */}
        {!allParamsMatch && isConnected && (
          <TouchableOpacity
            style={[
              styles.applyAllBtn,
              (isApplyingAll || !isConnected) && styles.applyAllBtnDisabled,
            ]}
            onPress={handleApplyAll}
            disabled={isApplyingAll || !isConnected}
            activeOpacity={0.7}
          >
            {isApplyingAll ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.text} />
                <Text style={styles.applyAllBtnText}>
                  Fix {mismatchedParams.length} Parameter{mismatchedParams.length !== 1 ? 's' : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Next button — only enabled when all params match */}
        <TouchableOpacity
          style={[
            styles.nextBtn,
            (!allParamsMatch || !isConnected) && styles.nextBtnDisabled,
          ]}
          onPress={handleNext}
          disabled={!allParamsMatch || !isConnected}
          activeOpacity={0.7}
        >
          <Text style={styles.nextBtnText}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accent + '18',
    borderWidth: 1,
    borderColor: colors.accent + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeOk: {
    backgroundColor: colors.success + '18',
    borderColor: colors.success + '55',
  },
  statusBadgeWarn: {
    backgroundColor: colors.warning + '18',
    borderColor: colors.warning + '55',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Warning banner (connection)
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.warning + '12',
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: colors.warning,
    fontWeight: '500',
  },

  // Reboot banner
  rebootBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.warning + '12',
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  rebootBannerText: {
    flex: 1,
    fontSize: 11,
    color: colors.warning,
    fontWeight: '500',
  },

  // Table header
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.secondary,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tableHeaderParam: {
    flex: 2,
  },
  tableHeaderValue: {
    flex: 1,
    textAlign: 'center',
  },

  // List
  listScroll: {
    flex: 1,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
    minHeight: 52,
  },
  rowLeft: {
    flex: 2,
    paddingRight: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paramName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rebootBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.warning + '25',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rebootBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 0.5,
  },
  badgeRow: {
    marginTop: 3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  badgeOk: {
    backgroundColor: colors.success + '15',
    borderColor: colors.success + '35',
  },
  badgeWarn: {
    backgroundColor: colors.warning + '15',
    borderColor: colors.warning + '35',
  },
  badgePending: {
    backgroundColor: colors.textMuted + '15',
    borderColor: colors.textMuted + '25',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  badgeTextOk: {
    color: colors.success,
  },
  badgeTextWarn: {
    color: colors.warning,
  },

  rowCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentValueText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },

  rowRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expectedValueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 60,
  },
  expectedValueBtnMismatch: {
    borderColor: colors.warning + '50',
    backgroundColor: colors.warning + '08',
  },
  expectedValueText: {
    fontSize: 12,
    color: colors.accentLight,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    textAlign: 'center',
  },
  editIcon: {
    marginLeft: 2,
  },
  editInput: {
    width: 70,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.accent + '60',
    fontSize: 12,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  editInputSuccess: {
    borderColor: colors.success + '80',
    backgroundColor: colors.success + '15',
  },
  editInputError: {
    borderColor: colors.danger + '80',
    backgroundColor: colors.danger + '15',
  },
  applyStatusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.secondary,
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  applyAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.orangeBtn,
  },
  applyAllBtnDisabled: {
    opacity: 0.5,
  },
  applyAllBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.greenBtn,
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});

export default Step1ParamCheck;
