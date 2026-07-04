import React from 'react';
import { Modal, Alert, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface ReverseWaypointsDialogProps {
  visible: boolean;
  waypointCount: number;
  onReverse: () => void;
  onClose: () => void;
}

export const ReverseWaypointsDialog: React.FC<ReverseWaypointsDialogProps> = ({
  visible,
  waypointCount,
  onReverse,
  onClose,
}) => {
  const handleReverse = () => {
    Alert.alert(
      'Confirm Reverse',
      `Reverse all ${waypointCount} waypoints? This will reverse the order of all waypoints in the mission.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reverse',
          style: 'destructive',
          onPress: () => {
            onReverse();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <MaterialCommunityIcons name="swap-vertical" size={24} color={colors.accent} />
            </View>
            <Text style={styles.headerTitle}>REVERSE WAYPOINTS</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
              <Text style={styles.infoText}>
                This will reverse the order of all <Text style={styles.countText}>{waypointCount}</Text> waypoints in the mission.
              </Text>
            </View>
            <Text style={styles.description}>
              The first waypoint will become the last, and the last will become the first. All distances will be recalculated.
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.reverseButton]}
              onPress={handleReverse}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="swap-vertical" size={18} color="#fff" />
              <Text style={styles.reverseButtonText}>Reverse {waypointCount} Waypoints</Text>
            </TouchableOpacity>
          </View>
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
  },
  dialog: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: colors.panelBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warning + '12',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  infoText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  countText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  description: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  reverseButton: {
    backgroundColor: colors.accent,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  reverseButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
