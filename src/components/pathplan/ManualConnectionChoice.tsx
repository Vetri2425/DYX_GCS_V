import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

interface Props {
  visible: boolean;
  onSelectCanvas: () => void;
  onSelectMap: () => void;
  onCancel: () => void;
}

export const ManualConnectionChoice: React.FC<Props> = ({
  visible,
  onSelectCanvas,
  onSelectMap,
  onCancel,
}) => {
  if (!visible) return null;

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>🎯 Choose Connection Method</Text>
            <Text style={styles.subtitle}>
              Select how you want to connect your marking points
            </Text>
          </View>

          <View style={styles.optionsContainer}>
            {/* Canvas Option */}
            <TouchableOpacity style={styles.optionCard} onPress={onSelectCanvas}>
              <View style={styles.optionHeader}>
                <Text style={styles.optionIcon}>✏️</Text>
                <Text style={styles.optionTitle}>Canvas Mode</Text>
              </View>
              <Text style={styles.optionDescription}>
                Connect waypoints on a simplified canvas view. Good for quick connections with basic visualization.
              </Text>
              <View style={styles.optionFeatures}>
                <Text style={styles.feature}>• Simple touch interface</Text>
                <Text style={styles.feature}>• Grid overlay</Text>
                <Text style={styles.feature}>• Tap or drag modes</Text>
              </View>
            </TouchableOpacity>

            {/* Map Option */}
            <TouchableOpacity style={styles.optionCard} onPress={onSelectMap}>
              <View style={styles.optionHeader}>
                <Text style={styles.optionIcon}>🗺️</Text>
                <Text style={styles.optionTitle}>Map Mode (Recommended)</Text>
              </View>
              <Text style={styles.optionDescription}>
                Connect waypoints on real satellite map. Preserves exact shapes, distances, and geographic accuracy.
              </Text>
              <View style={styles.optionFeatures}>
                <Text style={styles.feature}>• Real map tiles</Text>
                <Text style={styles.feature}>• Exact geographic accuracy</Text>
                <Text style={styles.feature}>• No shape distortion</Text>
                <Text style={styles.feature}>• Preserves real distances</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  optionsContainer: {
    padding: 20,
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    minHeight: 140,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  optionDescription: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    marginBottom: 12,
  },
  optionFeatures: {
    gap: 4,
  },
  feature: {
    fontSize: 12,
    color: '#6b7280',
    paddingLeft: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ManualConnectionChoice;
