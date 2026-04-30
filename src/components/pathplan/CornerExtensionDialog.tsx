import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import {
  CornerExtensionOptions,
  DEFAULT_EXTENSION_OPTIONS,
} from '../../utils/cornerExtension';

interface CornerExtensionDialogProps {
  visible: boolean;
  onClose: () => void;
  onApply: (options: CornerExtensionOptions) => void;
  waypointCount: number;
  cornersDetected: number;
  shortSegmentWarnings: number;
}

export const CornerExtensionDialog: React.FC<CornerExtensionDialogProps> = ({
  visible,
  onClose,
  onApply,
  waypointCount,
  cornersDetected,
  shortSegmentWarnings,
}) => {
  const [extensionDistance, setExtensionDistance] = useState(
    DEFAULT_EXTENSION_OPTIONS.extensionDistance.toString()
  );
  const [turnAngleThreshold, setTurnAngleThreshold] = useState(
    DEFAULT_EXTENSION_OPTIONS.turnAngleThreshold.toString()
  );
  const [keepOriginal, setKeepOriginal] = useState(
    DEFAULT_EXTENSION_OPTIONS.keepOriginalWaypoints
  );
  const [invertMode, setInvertMode] = useState(
    DEFAULT_EXTENSION_OPTIONS.invertMode
  );

  const canApply = waypointCount >= 3 && cornersDetected > 0;

  const handleApply = () => {
    const dist = parseFloat(extensionDistance);
    const threshold = parseFloat(turnAngleThreshold);

    if (isNaN(dist) || dist <= 0 || dist > 50) {
      Alert.alert('Invalid Input', 'Extension distance must be between 0.1 and 50 meters');
      return;
    }
    if (isNaN(threshold) || threshold < 10 || threshold > 90) {
      Alert.alert('Invalid Input', 'Turn angle threshold must be between 10 and 90 degrees');
      return;
    }
    if (waypointCount < 3) {
      Alert.alert('Not Enough Waypoints', 'At least 3 waypoints are required for corner extension');
      return;
    }

    onApply({
      extensionDistance: dist,
      turnAngleThreshold: threshold,
      keepOriginalWaypoints: keepOriginal,
      invertMode,
    });
  };

  const distNum = parseFloat(extensionDistance) || 0;
  const totalAfter = waypointCount + cornersDetected;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <MaterialCommunityIcons name="arrow-expand-all" size={22} color={colors.accent} />
              <Text style={styles.title}>CORNER EXTENSION</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>NAV Aid</Text>
              </View>
            </View>

            {/* Current Waypoints */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Path</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Marking points:</Text>
                  <Text style={styles.statValue}>{waypointCount}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Corners detected:</Text>
                  <Text style={styles.statValue}>
                    {waypointCount < 3 ? '—' : cornersDetected}
                  </Text>
                </View>
                {shortSegmentWarnings > 0 && (
                  <View style={styles.statRow}>
                    <Text style={styles.warningLabel}>Short segment warnings:</Text>
                    <Text style={styles.warningValue}>{shortSegmentWarnings}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Extension Parameters */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Extension Parameters</Text>
              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Extension Distance (m)</Text>
                  <TextInput
                    style={styles.input}
                    value={extensionDistance}
                    onChangeText={setExtensionDistance}
                    keyboardType="numeric"
                    placeholder="6.5"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text style={styles.hint}>Distance past corner along incoming path</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Turn Angle Threshold (°)</Text>
                  <TextInput
                    style={styles.input}
                    value={turnAngleThreshold}
                    onChangeText={setTurnAngleThreshold}
                    keyboardType="numeric"
                    placeholder="30"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text style={styles.hint}>Min angle to treat as a corner</Text>
                </View>
              </View>
            </View>

            {/* Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Options</Text>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setKeepOriginal(!keepOriginal)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, keepOriginal && styles.checkboxChecked]}>
                  {keepOriginal && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
                </View>
                <Text style={styles.checkboxLabel}>Keep original corner waypoints</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>
                {keepOriginal
                  ? 'Extension points added after corners (recommended)'
                  : 'Corner waypoints replaced by extension points'}
              </Text>

              {/* Invert Mode Toggle */}
              <View style={styles.invertRow}>
                <TouchableOpacity
                  style={[styles.invertBtn, !invertMode && styles.invertBtnActive]}
                  onPress={() => setInvertMode(false)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="arrow-top-right"
                    size={16}
                    color={!invertMode ? '#fff' : colors.textSecondary}
                  />
                  <Text style={[styles.invertBtnText, !invertMode && styles.invertBtnTextActive]}>
                    Standard
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.invertBtn, invertMode && styles.invertBtnActiveAlt]}
                  onPress={() => setInvertMode(true)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="arrow-bottom-left"
                    size={16}
                    color={invertMode ? '#000' : colors.textSecondary}
                  />
                  <Text style={[styles.invertBtnText, invertMode && styles.invertBtnTextActiveAlt]}>
                    Invert
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>
                {invertMode
                  ? 'Dummy placed before next WP — approach runway into corner'
                  : 'Dummy placed past corner — overshoot then turn'}
              </Text>
            </View>

            {/* Preview Stats */}
            {canApply && (
              <View style={styles.statsSection}>
                <Text style={styles.statsTitle}>Preview</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Extension points:</Text>
                    <Text style={styles.statValue}>+{cornersDetected}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total after apply:</Text>
                    <Text style={styles.statValue}>{totalAfter}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {invertMode ? (
                  <>
                    <Text style={styles.infoBold}>Invert mode:</Text> A dummy waypoint is placed{' '}
                    {distNum || 6.5}m before the next waypoint on the approach axis. The rover
                    gets a guaranteed {distNum || 6.5}m straight runway into each corner target,
                    improving alignment at short-segment turns.
                  </>
                ) : (
                  <>
                    <Text style={styles.infoBold}>Standard mode:</Text> At each corner where the
                    rover turns more than {turnAngleThreshold || 30}°, a navigation waypoint is
                    inserted {distNum || 6.5}m past the corner along the incoming direction. This
                    forces the rover to pass through the actual corner point before turning, preventing
                    corner cutting caused by ArduPilot look-ahead steering.
                  </>
                )}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]}
                onPress={handleApply}
                activeOpacity={0.7}
                disabled={!canApply}
              >
                <Text style={[styles.applyText, !canApply && styles.applyTextDisabled]}>
                  Apply Extension
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialog: {
    backgroundColor: colors.panelBg,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 1,
    textAlign: 'center',
    flex: 1,
  },
  badge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.cardBg,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxLabel: {
    fontSize: 13,
    color: colors.text,
  },
  invertRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  invertBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.cardBg,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  invertBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  invertBtnActiveAlt: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  invertBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  invertBtnTextActive: {
    color: '#fff',
  },
  invertBtnTextActiveAlt: {
    color: '#000',
  },
  statsGrid: {
    gap: 6,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  warningLabel: {
    fontSize: 11,
    color: '#fbbf24',
  },
  warningValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fbbf24',
  },
  statsSection: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 8,
  },
  infoBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  infoText: {
    fontSize: 11,
    color: '#fbbf24',
    lineHeight: 16,
  },
  infoBold: {
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.inputBg,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyBtnDisabled: {
    opacity: 0.4,
  },
  applyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  applyTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
});