import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { VehicleStatus } from './types';
import { RoverTelemetry } from '../../types/telemetry';
import { NTRIPProfile } from '../../types/ntrip';
import { NTRIPProfileList } from './NTRIPProfileList';
import { NTRIPProfileEditor } from './NTRIPProfileEditor';

interface Props {
  status: VehicleStatus;
  telemetry?: RoverTelemetry;
  isConnected: boolean;
  services?: {
    injectRTK: (url: string) => Promise<{ success: boolean; message?: string }>;
    stopRTK: () => Promise<{ success: boolean; message?: string }>;
    getRTKStatus: () => Promise<{ success: boolean; running?: boolean; total_bytes?: number; caster?: string }>;
  };
  onOpenRTKInjection?: () => void;
}

interface RTKConfig {
  casterAddress: string;
  port: string;
  mountpoint: string;
  username: string;
  password: string;
}

type ModalScreen = 'list' | 'editor';

// Layout constants for quick adjustments
// Edit these values to change the card size without touching the StyleSheet below.
const VEHICLE_CARD_LAYOUT: { height?: number | string; minHeight?: number; width?: number | string; flex?: number } = {
  height: 345, // px or percentage string like '30%'
  minHeight: 120,
  width: '100%',
};

export const VehicleStatusCard: React.FC<Props> = ({ status, telemetry, isConnected, services, onOpenRTKInjection }) => {
  // RTK Modal State
  const [showRTKModal, setShowRTKModal] = useState(false);
  const [modalScreen, setModalScreen] = useState<ModalScreen>('list');
  const [selectedProfile, setSelectedProfile] = useState<NTRIPProfile | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  
  // Legacy RTK config state (kept for backward compatibility if needed)
  const [config, setConfig] = useState<RTKConfig>({
    casterAddress: '',
    port: '2101',
    mountpoint: '',
    username: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStreamRunning, setIsStreamRunning] = useState(false);
  const [totalBytes, setTotalBytes] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBytesRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  // Get status dot color based on connection status
  const connectionStatusColor = isConnected ? colors.success : colors.danger;

  // Get RTK status color for the text
  const rtkStatusColor = useMemo(() => {
    if (!telemetry) return colors.danger;
    const fixType = telemetry.rtk.fix_type;
    if (fixType >= 5) return colors.success; // RTK Float/Fixed = Green
    if (fixType >= 3) return colors.warning; // 3D Fix = Orange
    return colors.danger; // No Fix = Red
  }, [telemetry]);

  // Get battery color based on percentage
  const batteryColor = useMemo(() => {
    if (!telemetry) return colors.danger;
    const pct = telemetry.battery.percentage;
    if (pct > 50) return colors.success;
    if (pct > 20) return colors.warning;
    return colors.danger;
  }, [telemetry]);

  // Get HRMS/VRMS color based on accuracy value (in meters)
  const getAccuracyColor = (value: number): string => {
    if (value < 0.1) return colors.success; // < 10cm = Green
    if (value < 5) return colors.warning;   // 10cm to < 5m = Orange
    if (value < 10) return '#3B82F6';       // 5m to < 10m = Blue
    return colors.danger;                    // >= 10m = Red
  };

  // Get HRMS and VRMS colors
  const hrmsColor = useMemo(() => {
    if (!telemetry) return colors.danger;
    return getAccuracyColor(telemetry.hrms);
  }, [telemetry]);

  const vrmsColor = useMemo(() => {
    if (!telemetry) return colors.danger;
    return getAccuracyColor(telemetry.vrms);
  }, [telemetry]);

  // Get satellite count color
  const satelliteColor = useMemo(() => {
    if (!telemetry) return colors.danger;
    const satCount = telemetry.global.satellites_visible;
    if (satCount >= 14) return colors.success;  // 14+ = Green
    if (satCount >= 6) return colors.warning;   // 6-13 = Orange
    if (satCount >= 2) return '#3B82F6';        // 2-6 = Blue
    return colors.danger;                        // 0-2 = Red
  }, [telemetry]);

  // RTK Monitor Functions
  const stopMonitor = useCallback(() => {
    if (monitorRef.current) {
      clearInterval(monitorRef.current);
      monitorRef.current = null;
    }
  }, []);

  const startMonitor = useCallback(() => {
    if (monitorRef.current || !services) return;
    lastBytesRef.current = 0;
    lastTsRef.current = Date.now();
    monitorRef.current = setInterval(async () => {
      try {
        const rtk_status = await services.getRTKStatus();
        if (rtk_status.success) {
          const now = Date.now();
          const bytes = rtk_status.total_bytes ?? 0;
          setTotalBytes(bytes);
          lastBytesRef.current = bytes;
          lastTsRef.current = now;
          if (!rtk_status.running) {
            setIsStreamRunning(false);
            stopMonitor();
          }
        }
      } catch (e) {
        console.error('RTK monitor error:', e);
      }
    }, 250);
  }, [services, stopMonitor]);

  // Check RTK status on modal open
  useEffect(() => {
    if (showRTKModal && services) {
      const checkStatus = async () => {
        try {
          const rtk_status = await services.getRTKStatus();
          if (rtk_status.success) {
            setIsStreamRunning(rtk_status.running || false);
            setTotalBytes(rtk_status.total_bytes || 0);
            if (rtk_status.running) {
              startMonitor();
            }
          }
        } catch (err) {
          console.error('Failed to get RTK status:', err);
        }
      };
      checkStatus();
    }
  }, [showRTKModal, services, startMonitor]);

  // Stop RTK on rover disconnect
  useEffect(() => {
    if (!isConnected && isStreamRunning && services) {
      const stopStream = async () => {
        try {
          await services.stopRTK();
          setIsStreamRunning(false);
          stopMonitor();
        } catch (err) {
          console.error('Failed to stop RTK on disconnect:', err);
        }
      };
      stopStream();
    }
  }, [isConnected, isStreamRunning, services, stopMonitor]);

  useEffect(() => {
    return () => {
      stopMonitor();
    };
  }, [stopMonitor]);

  const handleInputChange = (field: keyof RTKConfig) => (value: string) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Profile Management Handlers
  const handleOpenRTKModal = () => {
    setModalScreen('list');
    setSelectedProfile(null);
    setShowRTKModal(true);
  };

  const handleRTKPress = () => {
    if (onOpenRTKInjection) {
      onOpenRTKInjection();
    } else {
      handleOpenRTKModal();
    }
  };

  const handleSelectProfile = async (profile: NTRIPProfile) => {
    if (!services) {
      Alert.alert('Error', 'RTK services not available');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setError(null);

    try {
      const ntripUrl = `rtcm://${profile.username}:${profile.password}@${profile.casterAddress}:${profile.port}/${profile.mountpoint}`;
      console.log('[RTK] Starting stream with URL:', ntripUrl);
      const response = await services.injectRTK(ntripUrl.trim());

      if (response.success) {
        setFeedback(response.message ?? 'RTK stream started successfully.');
        setIsStreamRunning(true);
        setActiveProfileId(profile.id);
        
        // Wait a moment then verify actual connection status
        setTimeout(async () => {
          try {
            const status = await services.getRTKStatus();
            console.log('[RTK] Status check after start:', status);
            if (status.success) {
              if (status.running) {
                console.log('[RTK] Connection verified - stream is running');
                startMonitor();
                Alert.alert('Success', `Connected to ${profile.name}`);
              } else {
                console.error('[RTK] Stream failed to connect - backend reported not running');
                setError('Stream started but connection failed. Check credentials and network.');
                setIsStreamRunning(false);
                setActiveProfileId(null);
                Alert.alert('Connection Failed', 'Stream started but backend connection failed.\n\nCheck:\n• NTRIP credentials\n• Network connectivity\n• Caster availability');
              }
            }
          } catch (err) {
            console.warn('[RTK] Failed to verify connection status:', err);
            // Still try to start monitor in case status check failed but stream is OK
            startMonitor();
          }
        }, 1000); // Wait 1 second for backend to establish connection
      } else {
        setError(response.message ?? 'Failed to start RTK stream.');
        Alert.alert('Connection Failed', response.message ?? 'Failed to start RTK stream.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start RTK stream.';
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewProfile = () => {
    setSelectedProfile(null);
    setModalScreen('editor');
  };

  const handleEditProfile = (profile: NTRIPProfile) => {
    setSelectedProfile(profile);
    setModalScreen('editor');
  };

  const handleProfileSaved = (profile: NTRIPProfile) => {
    setModalScreen('list');
    setSelectedProfile(null);
  };

  const handleCancelEdit = () => {
    setModalScreen('list');
    setSelectedProfile(null);
  };

  const handleStartStream = async () => {
    if (!services) {
      Alert.alert('Error', 'RTK services not available');
      return;
    }

    const requiredFields: (keyof RTKConfig)[] = [
      'casterAddress', 'port', 'mountpoint', 'username', 'password',
    ];
    const missingFields = requiredFields.filter(field => !config[field].trim());
    if (missingFields.length > 0) {
      setError(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setError(null);

    try {
      const ntripUrl = `rtcm://${config.username}:${config.password}@${config.casterAddress}:${config.port}/${config.mountpoint}`;
      console.log('[RTK] Starting stream with URL:', ntripUrl);
      const response = await services.injectRTK(ntripUrl.trim());

      if (response.success) {
        setFeedback(response.message ?? 'RTK stream started successfully.');
        setIsStreamRunning(true);
        
        // Wait a moment then verify actual connection status
        setTimeout(async () => {
          try {
            const status = await services.getRTKStatus();
            console.log('[RTK] Status check after start:', status);
            if (status.success) {
              if (status.running) {
                console.log('[RTK] Connection verified - stream is running');
                startMonitor();
              } else {
                console.error('[RTK] Stream failed to connect - backend reported not running');
                setError('Stream started but connection failed. Check credentials and network.');
                setIsStreamRunning(false);
                Alert.alert('Connection Failed', 'Stream started but backend connection failed.\n\nCheck:\n• NTRIP credentials\n• Network connectivity\n• Caster availability');
              }
            }
          } catch (err) {
            console.warn('[RTK] Failed to verify connection status:', err);
            // Still try to start monitor in case status check failed but stream is OK
            startMonitor();
          }
        }, 1000); // Wait 1 second for backend to establish connection
      } else {
        setError(response.message ?? 'Failed to start RTK stream.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start RTK stream.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopStream = async () => {
    if (!services) {
      Alert.alert('Error', 'RTK services not available');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await services.stopRTK();

      if (response.success) {
        setFeedback(response.message ?? 'RTK stream stopped successfully.');
        setIsStreamRunning(false);
        setActiveProfileId(null);
        stopMonitor();
      } else {
        setError(response.message ?? 'Failed to stop RTK stream.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop RTK stream.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🚁</Text>
        </View>
        <Text style={styles.title}>Robot Status</Text>
        <View style={[styles.statusDot, { backgroundColor: connectionStatusColor }]} />
      </View>

      {/* Status Items - Scrollable List */}
      <ScrollView style={styles.statusList} showsVerticalScrollIndicator={true}>
        <View key="battery" style={styles.statusRow}>
          <Text style={styles.label}>Battery</Text>
          <View style={[styles.accuracyBox, { backgroundColor: batteryColor }]}>
            <Text style={styles.accuracyValue}>{status.battery}</Text>
          </View>
        </View>

        {/* GPS/RTK - Now a button */}
        <TouchableOpacity
          key="gps-rtk"
          style={styles.statusRow}
          onPress={handleRTKPress}
          activeOpacity={0.7}
        >
          <Text style={styles.label}>GPS/RTK</Text>
          <View style={styles.valueRow}>
            <View style={[styles.accuracyBox, { backgroundColor: rtkStatusColor }]}>
              <Text style={styles.accuracyValue}>{status.gps}</Text>
            </View>
            <Text style={styles.gearIcon}> ⚙</Text>
          </View>
        </TouchableOpacity>

        <View key="satellites" style={styles.statusRow}>
          <Text style={styles.label}>Satellites</Text>
          <View style={[styles.accuracyBox, { backgroundColor: satelliteColor }]}>
            <Text style={styles.accuracyValue}>{status.satellites}</Text>
          </View>
        </View>
        {/* Satellite Signal Status Row */}
        {status.satelliteSignal && (
          <View key="satellite-signal" style={styles.statusRow}>
            <Text style={styles.label}>Sat Signal</Text>
            <View style={[styles.accuracyBox, { backgroundColor: satelliteColor }]}>
              <Text style={styles.accuracyValue}>{status.satelliteSignal}</Text>
            </View>
          </View>
        )}
        <View key="hrms" style={styles.statusRow}>
          <Text style={styles.label}>HRMS</Text>
          <View style={[styles.accuracyBox, { backgroundColor: hrmsColor }]}>
            <Text style={styles.accuracyValue}>{status.hrms}</Text>
          </View>
        </View>
        <View key="vrms" style={styles.statusRow}>
          <Text style={styles.label}>VRMS</Text>
          <View style={[styles.accuracyBox, { backgroundColor: vrmsColor }]}>
            <Text style={styles.accuracyValue}>{status.vrms}</Text>
          </View>
        </View>
        <View key="imu" style={styles.statusRow}>
          <Text style={styles.label}>IMU</Text>
          <View style={[styles.accuracyBox, { backgroundColor: colors.info }]}>
            <Text style={styles.accuracyValue}>{status.imu}</Text>
          </View>
        </View>
        {/* Mode Status Row */}
        {status.mode && (
          <View key="mode" style={[styles.statusRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Mode</Text>
            <View style={[styles.accuracyBox, { backgroundColor: colors.info }]}>
              <Text style={styles.accuracyValue}>{status.mode}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* RTK Profile Manager Modal */}
      <Modal
        visible={showRTKModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowRTKModal(false);
          setModalScreen('list');
          setSelectedProfile(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalContainer}>
            {/* Header with Stop Button */}
            <View style={styles.profileModalHeader}>
              <View>
                <Text style={styles.profileModalTitle}>
                  {modalScreen === 'list' ? '📡 NTRIP Profiles' : (selectedProfile ? '✏️ Edit Profile' : '➕ New Profile')}
                </Text>
                {isStreamRunning && modalScreen === 'list' && (
                  <View style={styles.streamingBadge}>
                    <View style={styles.streamingDot} />
                    <Text style={styles.streamingText}>Streaming</Text>
                    <Text style={styles.streamingBytes}>
                      {(totalBytes / 1024).toFixed(1)} KB
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.headerActions}>
                {isStreamRunning && modalScreen === 'list' && (
                  <TouchableOpacity
                    style={styles.stopStreamButton}
                    onPress={handleStopStream}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.stopStreamText}>⏹️ Stop</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setShowRTKModal(false);
                    setModalScreen('list');
                    setSelectedProfile(null);
                  }}
                >
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal Content */}
            {modalScreen === 'list' ? (
              <NTRIPProfileList
                onSelectProfile={handleSelectProfile}
                onAddNew={handleAddNewProfile}
                onEditProfile={handleEditProfile}
                isConnecting={isSubmitting}
                activeProfileId={activeProfileId}
              />
            ) : (
              <NTRIPProfileEditor
                profile={selectedProfile}
                onSave={handleProfileSaved}
                onCancel={handleCancelEdit}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    ...(VEHICLE_CARD_LAYOUT as any),
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 12,
    paddingBottom: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 4,
  },
  iconContainer: {
    backgroundColor: 'rgba(64, 132, 241, 0.8)',
    padding: 4,
    borderRadius: 4,
    marginRight: 6,
  },
  icon: {
    fontSize: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  statusList: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginBottom: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gearIcon: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  accuracyBox: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  accuracyValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  profileModalContainer: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.secondary,
  },
  profileModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  streamingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  streamingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  streamingText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
    marginRight: 8,
  },
  streamingBytes: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stopStreamButton: {
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stopStreamText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 28,
    color: colors.textSecondary,
    fontWeight: '300',
    paddingHorizontal: 8,
  },
  modalContainer: {
    backgroundColor: colors.panelBg,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  streamStatus: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  streamStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streamLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  streamValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    fontFamily: 'monospace',
  },
  formContainer: {
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(30, 41, 59, 1)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 1)',
    borderRadius: 8,
    color: colors.text,
    fontSize: 14,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: '#16a34a',
  },
  stopButton: {
    backgroundColor: '#dc2626',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackSuccess: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 8,
    marginBottom: 8,
  },
  feedbackError: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    marginBottom: 8,
  },
  feedbackText: {
    fontSize: 13,
    color: colors.text,
  },
});