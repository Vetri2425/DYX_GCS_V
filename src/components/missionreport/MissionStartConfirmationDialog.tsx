import React from 'react';
import { View, StyleSheet, Modal, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface MissionStartConfirmationDialogProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  hasExistingData: boolean;
  existingMissionInfo?: {
    waypointCount: number;
    hasProgress: boolean;
  };
}

export const MissionStartConfirmationDialog: React.FC<MissionStartConfirmationDialogProps> = ({
  visible,
  onConfirm,
  onCancel,
  hasExistingData,
  existingMissionInfo
}) => {
  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Warning Icon */}
          <View style={styles.iconContainer}>
            <MaterialIcons 
              name={hasExistingData ? "warning" : "play-arrow"} 
              size={48} 
              color={hasExistingData ? "#F59E0B" : "#0047AB"} 
            />
          </View>
          
          {/* Title */}
          <Text style={styles.title}>
            {hasExistingData ? 'Start New Mission?' : 'Confirm Mission Start'}
          </Text>
          
          {/* Message */}
          <View style={styles.messageContainer}>
            {hasExistingData && existingMissionInfo ? (
              <React.Fragment key="existing-data">
                <Text style={styles.warningMessage}>
                  You have existing mission data that will be cleared:
                </Text>
                
                <View style={styles.existingDataInfo}>
                  <View style={styles.dataRow}>
                    <MaterialIcons name="place" size={20} color="#666" />
                    <Text style={styles.dataText}>
                      {existingMissionInfo.waypointCount} waypoints loaded
                    </Text>
                  </View>
                  
                  {existingMissionInfo.hasProgress && (
                    <View style={styles.dataRow}>
                      <MaterialIcons name="trending-up" size={20} color="#666" />
                      <Text style={styles.dataText}>
                        Mission progress recorded
                      </Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.confirmMessage}>
                  Starting a new mission will reset the mission table and clear all current progress. 
                  Previous mission data will still be available for export.
                </Text>
                
                <Text style={styles.exportReminder}>
                  💡 Tip: Export your current mission report before starting if needed.
                </Text>
              </React.Fragment>
            ) : (
              <Text style={styles.confirmMessage}>
                Ready to start the mission with {existingMissionInfo?.waypointCount || 0} waypoints?
              </Text>
            )}
          </View>
          
          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
              <MaterialIcons name="play-arrow" size={20} color="#fff" style={styles.confirmIcon} />
              <Text style={styles.confirmButtonText}>
                {hasExistingData ? 'Start New Mission' : 'Start Mission'}
              </Text>
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
    maxWidth: 500,
    width: '100%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  messageContainer: {
    marginBottom: 24,
  },
  warningMessage: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  existingDataInfo: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    fontWeight: '500',
  },
  confirmMessage: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  exportReminder: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#0047AB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  confirmIcon: {
    marginRight: 4,
  },
});