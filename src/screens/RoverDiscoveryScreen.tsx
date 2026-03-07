/**
 * Rover Discovery Screen
 * Auto-scans network to find available Jetson devices
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scanForJetsonDevices, quickScanForJetsonDevices, JetsonDevice, PRIORITY_BACKEND_IPS, ALLOWED_DISCOVERY_IPS } from '../utils/jetsonDiscovery';
import { saveBackendURL, markSessionSkipped } from '../utils/backendStorage';
import axios from 'axios';

interface RoverDiscoveryScreenProps {
  onRoverSelected: (device: JetsonDevice) => void;
}

export default function RoverDiscoveryScreen({ onRoverSelected }: RoverDiscoveryScreenProps) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<JetsonDevice[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [scanType, setScanType] = useState<'quick' | 'full'>('quick');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('http://');
  const [testingManualUrl, setTestingManualUrl] = useState(false);

  useEffect(() => {
    // Start quick scan on mount
    startQuickScan();
  }, []);

  const startQuickScan = async () => {
    setScanning(true);
    setScanType('quick');
    setDevices([]);
    setProgress({ current: 0, total: PRIORITY_BACKEND_IPS.length });

    try {
      const foundDevices = await quickScanForJetsonDevices((current, total) => {
        setProgress({ current, total });
      });

      setDevices(foundDevices);

      if (foundDevices.length === 0) {
        // No devices found in quick scan, suggest full scan
        Alert.alert(
          'No Rovers Found',
          'Quick scan did not find any rovers. Try the full list or continue offline.',
          [
            { text: 'Offline Mode', onPress: handleSkip },
            { text: 'Full Scan', onPress: startFullScan },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Scan Error', 'Failed to scan for rovers. Please check your WiFi connection.');
    } finally {
      setScanning(false);
    }
  };

  const startFullScan = async () => {
    setScanning(true);
    setScanType('full');
    setDevices([]);
    setProgress({ current: 0, total: ALLOWED_DISCOVERY_IPS.length });

    try {
      const foundDevices = await scanForJetsonDevices('192.168.1', 1, 255, (current, total) => {
        setProgress({ current, total });
      });

      setDevices(foundDevices);

      if (foundDevices.length === 0) {
        Alert.alert(
          'No Rovers Found',
          'No rovers responded on the allowed IP list. You can retry or go offline.',
          [
            { text: 'Offline Mode', onPress: handleSkip },
            { text: 'OK' },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Scan Error', 'Failed to scan for rovers. Please check your WiFi connection.');
    } finally {
      setScanning(false);
    }
  };

  const handleSelectDevice = async (device: JetsonDevice) => {
    try {
      // Save the selected backend URL
      await saveBackendURL(device.url, device.ip, device.port);

      // Notify parent
      onRoverSelected(device);

      Alert.alert('Connected', `Successfully connected to ${device.name}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save rover connection');
    }
  };

  const handleConnectManualUrl = async () => {
    if (!manualUrl || manualUrl === 'http://') {
      Alert.alert('Invalid URL', 'Please enter a valid backend URL');
      return;
    }

    setTestingManualUrl(true);

    try {
      // Validate URL format
      const urlObj = new URL(manualUrl);
      const ip = urlObj.hostname;
      const port = urlObj.port ? parseInt(urlObj.port) : 5001;

      // Directly test /api/status endpoint with longer timeout
      const response = await axios.get(`${manualUrl}/api/status`, {
        timeout: 10000, // 10 second timeout for manual entry
        validateStatus: () => true,
      });

      if (response.status < 500) {
        // Create device object
        const customDevice: JetsonDevice = {
          id: 'custom-' + ip,
          name: `Custom Rover (${ip})`,
          ip,
          port,
          url: manualUrl,
          responseTime: 0,
        };

        // Save to storage (acts like .env configuration)
        await saveBackendURL(manualUrl, ip, port);
        setShowManualInput(false);
        onRoverSelected(customDevice);
        Alert.alert('Connected!', `Backend configured successfully\n${manualUrl}/api/status`);
      } else {
        Alert.alert(
          'Connection Failed',
          `Backend responded with status ${response.status}\n\nPlease verify the backend is running and accessible.`
        );
      }
    } catch (error: any) {
      let errorMessage = 'Could not reach the backend server.\n\n';

      if (error.message?.includes('Invalid URL')) {
        errorMessage += 'Invalid URL format. Use: http://IP:PORT\nExample: http://192.168.1.242:5001';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage += '✗ Connection refused\n✓ Check backend is running\n✓ Verify port is correct';
      } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        errorMessage += '✗ Connection timeout\n✓ Check IP address\n✓ Verify same network\n✓ Check firewall settings';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage += '✗ Host not found\n✓ Check IP address\n✓ Verify network connection';
      } else {
        errorMessage += `Error: ${error.message || 'Unknown error'}\n\nVerify:\n1. Backend is running\n2. IP and port are correct\n3. Same WiFi network`;
      }

      Alert.alert('Connection Error', errorMessage);
    } finally {
      setTestingManualUrl(false);
    }
  };

  const handleSkip = async () => {
    Alert.alert(
      'Skip Rover Selection',
      'You can continue without connecting to a rover. Some features may be limited in offline mode.\n\nNote: On next app restart, you will be asked to scan again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue Offline',
          onPress: async () => {
            try {
              // Create a dummy device for offline mode
              const offlineDevice: JetsonDevice = {
                id: 'offline',
                name: 'Offline Mode',
                ip: 'localhost',
                port: 8000,
                url: 'http://localhost:8000',
                responseTime: 0,
              };

              // Save the offline backend URL to storage so app knows it's "configured"
              await saveBackendURL(offlineDevice.url, offlineDevice.ip, offlineDevice.port);

              // Mark this session as skipped (one-time skip)
              await markSessionSkipped();

              // Notify parent
              onRoverSelected(offlineDevice);
            } catch (error) {
              Alert.alert('Error', 'Failed to configure offline mode');
            }
          },
        },
      ]
    );
  };

  const renderDevice = ({ item }: { item: JetsonDevice }) => (
    <TouchableOpacity style={styles.deviceCard} onPress={() => handleSelectDevice(item)}>
      <View style={styles.deviceIcon}>
        <Ionicons name="hardware-chip" size={32} color="#4CAF50" />
      </View>

      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceIP}>{item.ip}:{item.port}</Text>
        <Text style={styles.deviceResponse}>Response time: {item.responseTime}ms</Text>
      </View>

      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="search" size={48} color="#4CAF50" />
        <Text style={styles.title}>Find Your Rover</Text>
        <Text style={styles.subtitle}>
          Scanning network for available Way to mark ...
        </Text>
      </View>

      {/* Scanning Progress */}
      {scanning && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.progressText}>
            {scanType === 'quick' ? 'Quick scanning...' : 'Full network scan...'}
          </Text>
          <Text style={styles.progressDetail}>
            {progress.current} / {progress.total} ({progressPercent.toFixed(0)}%)
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      )}

      {/* Device List */}
      {!scanning && devices.length > 0 && (
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>Found {devices.length} rover(s)</Text>
          <FlatList
            data={devices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}

      {/* No Devices Found */}
      {!scanning && devices.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#999" />
          <Text style={styles.emptyText}>No rovers found</Text>
          <Text style={styles.emptyHint}>
            Make sure your Jetson is powered on and connected to the same WiFi network
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.quickScanButton]}
          onPress={startQuickScan}
          disabled={scanning}
        >
          <Ionicons name="flash" size={20} color="white" />
          <Text style={styles.buttonText}>Quick Scan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.fullScanButton]}
          onPress={startFullScan}
          disabled={scanning}
        >
          <Ionicons name="scan" size={20} color="white" />
          <Text style={styles.buttonText}>Full Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Manual URL Button */}
      <TouchableOpacity
        style={styles.manualUrlButton}
        onPress={() => setShowManualInput(true)}
        disabled={scanning}
      >
        <Ionicons name="link" size={18} color="white" />
        <Text style={styles.manualUrlButtonText}>Manual Backend URL</Text>
      </TouchableOpacity>

      {/* Skip Button */}
      <View style={styles.skipContainer}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={scanning}
        >
          <Text style={styles.skipButtonText}>Skip - Continue Offline</Text>
        </TouchableOpacity>
      </View>

      {/* Manual URL Input Modal */}
      <Modal
        visible={showManualInput}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Backend URL</Text>
            <Text style={styles.modalSubtitle}>
              Will connect to /api/status endpoint{"\n"}
              Example: http://192.168.1.242:5001
            </Text>

            <TextInput
              style={styles.urlInput}
              placeholder="http://192.168.1.242:5001"
              placeholderTextColor="#666"
              value={manualUrl}
              onChangeText={setManualUrl}
              editable={!testingManualUrl}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowManualInput(false)}
                disabled={testingManualUrl}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.connectButton]}
                onPress={handleConnectManualUrl}
                disabled={testingManualUrl}
              >
                {testingManualUrl ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonText}>Connect</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 15,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 20,
  },
  progressText: {
    fontSize: 16,
    color: 'white',
    marginTop: 15,
    fontWeight: '600',
  },
  progressDetail: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#3a3a3a',
    borderRadius: 4,
    marginTop: 15,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  listContainer: {
    flex: 1,
  },
  listTitle: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    marginBottom: 15,
  },
  listContent: {
    paddingBottom: 20,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  deviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1a4d2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  deviceIP: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 2,
  },
  deviceResponse: {
    fontSize: 12,
    color: '#888',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
  },
  emptyHint: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 20,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  quickScanButton: {
    backgroundColor: '#4CAF50',
  },
  fullScanButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  skipContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 12,
  },
  skipButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  manualUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FF9800',
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  manualUrlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  urlInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    color: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    fontSize: 14,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#3a3a3a',
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
