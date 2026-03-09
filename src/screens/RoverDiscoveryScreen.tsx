/**
 * Rover Discovery Screen
 * Full-screen discovery page shown on app launch.
 * Listens for UDP beacon broadcasts and presents rover list.
 * Landscape-optimized split layout for tablet.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { quickScanForJetsonDevices, JetsonDevice } from '../utils/jetsonDiscovery';
import { saveBackendURL, markSessionSkipped } from '../utils/backendStorage';
import beaconListener, { DiscoveredRover } from '../services/beaconListener';
import axios from 'axios';

interface RoverDiscoveryScreenProps {
  onRoverSelected: (device: JetsonDevice) => void;
}

export default function RoverDiscoveryScreen({ onRoverSelected }: RoverDiscoveryScreenProps) {
  const [discoveredRovers, setDiscoveredRovers] = useState<DiscoveredRover[]>([]);
  const [networkDevices, setNetworkDevices] = useState<JetsonDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('http://');
  const [testingManualUrl, setTestingManualUrl] = useState(false);
  const [connectingRoverId, setConnectingRoverId] = useState<string | null>(null);

  // Pulse animation for the beacon ring
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulse2Anim = useRef(new Animated.Value(0)).current;

  // Start pulsing rings
  useEffect(() => {
    const runPulse = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    runPulse(pulseAnim, 0);
    runPulse(pulse2Anim, 1000);
  }, []);

  // Start beacon listener
  useEffect(() => {
    if (beaconListener.isAvailable) {
      beaconListener.start((rovers) => setDiscoveredRovers(rovers));
    }

    const dotTimer = setInterval(() => setNow(Date.now()), 2000);

    return () => {
      if (beaconListener.isAvailable) beaconListener.stop();
      clearInterval(dotTimer);
    };
  }, []);

  const handleRefresh = () => {
    if (beaconListener.isAvailable) {
      beaconListener.stop();
      setDiscoveredRovers([]);
      setNetworkDevices([]);
      beaconListener.start((rovers) => setDiscoveredRovers(rovers));
    }
  };

  const runNetworkScan = async () => {
    setScanning(true);
    setNetworkDevices([]);
    try {
      const found = await quickScanForJetsonDevices();
      setNetworkDevices(found);
      if (found.length === 0) {
        Alert.alert('No Rovers Found', 'Network scan found no rovers. Try manual entry or continue offline.');
      }
    } catch {
      Alert.alert('Scan Error', 'Failed to scan network. Check WiFi connection.');
    } finally {
      setScanning(false);
    }
  };

  const handleSelectBeaconRover = async (rover: DiscoveredRover) => {
    setConnectingRoverId(rover.roverId);
    try {
      const device: JetsonDevice = {
        id: rover.roverId,
        name: rover.roverName,
        ip: rover.ip,
        port: rover.port,
        url: rover.url,
        responseTime: 0,
      };
      await saveBackendURL(device.url, device.ip, device.port);
      onRoverSelected(device);
    } catch {
      Alert.alert('Error', 'Failed to connect to rover');
      setConnectingRoverId(null);
    }
  };

  const handleSelectNetworkDevice = async (device: JetsonDevice) => {
    setConnectingRoverId(device.id);
    try {
      await saveBackendURL(device.url, device.ip, device.port);
      onRoverSelected(device);
    } catch {
      Alert.alert('Error', 'Failed to connect to rover');
      setConnectingRoverId(null);
    }
  };

  const handleConnectManualUrl = async () => {
    if (!manualUrl || manualUrl === 'http://') {
      Alert.alert('Invalid URL', 'Please enter a valid backend URL');
      return;
    }
    setTestingManualUrl(true);
    try {
      const urlObj = new URL(manualUrl);
      const ip = urlObj.hostname;
      const port = urlObj.port ? parseInt(urlObj.port) : 5001;

      const response = await axios.get(`${manualUrl}/api/status`, {
        timeout: 10000,
        validateStatus: () => true,
      });

      if (response.status < 500) {
        const device: JetsonDevice = {
          id: 'custom-' + ip,
          name: `Custom Rover (${ip})`,
          ip,
          port,
          url: manualUrl,
          responseTime: 0,
        };
        await saveBackendURL(manualUrl, ip, port);
        setShowManualInput(false);
        onRoverSelected(device);
      } else {
        Alert.alert('Connection Failed', `Server responded with status ${response.status}`);
      }
    } catch (error: any) {
      let msg = 'Could not reach the server.\n\n';
      if (error.message?.includes('Invalid URL')) {
        msg += 'Invalid URL format. Use: http://IP:PORT';
      } else if (error.code === 'ECONNREFUSED') {
        msg += 'Connection refused. Check backend is running.';
      } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        msg += 'Timeout. Check IP address and network.';
      } else {
        msg += error.message || 'Unknown error';
      }
      Alert.alert('Connection Error', msg);
    } finally {
      setTestingManualUrl(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Continue Offline',
      'Some features will be limited without a rover connection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue Offline',
          onPress: async () => {
            const offline: JetsonDevice = {
              id: 'offline',
              name: 'Offline Mode',
              ip: 'localhost',
              port: 8000,
              url: 'http://localhost:8000',
              responseTime: 0,
            };
            await saveBackendURL(offline.url, offline.ip, offline.port);
            await markSessionSkipped();
            onRoverSelected(offline);
          },
        },
      ]
    );
  };

  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    }
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.4, 0] });
  const pulse2Scale = pulse2Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const pulse2Opacity = pulse2Anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.35, 0] });

  const allRovers = discoveredRovers;
  const hasBeacons = allRovers.length > 0;
  const hasNetwork = networkDevices.length > 0;
  const totalCount = allRovers.length + networkDevices.length;

  // ── LEFT PANEL ───────────────────────────────────────────────────────────────
  const renderLeftPanel = () => (
    <View style={styles.leftPanel}>
      {/* App Branding */}
      <View style={styles.branding}>
        <View style={styles.logoBox}>
          <Ionicons name="radio" size={28} color="#4CAF50" />
        </View>
        <Text style={styles.appTitle}>DYX GCS</Text>
        <Text style={styles.appSubtitle}>Ground Control Station</Text>
      </View>

      {/* Animated Beacon Indicator */}
      <View style={styles.beaconWrapper}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
        <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulse2Scale }], opacity: pulse2Opacity }]} />
        <View style={styles.beaconCore}>
          <Ionicons name="wifi" size={36} color="#4CAF50" />
        </View>
      </View>

      {/* Status */}
      <View style={styles.statusBlock}>
        <View style={styles.statusRow}>
          <View style={styles.statusDotGreen} />
          <Text style={styles.statusText}>
            {beaconListener.isAvailable ? 'Listening for beacons' : 'Web mode'}
          </Text>
        </View>
        <Text style={styles.statusDetail}>UDP Port 5002</Text>
        {totalCount > 0 && (
          <Text style={styles.statusFound}>{totalCount} rover{totalCount !== 1 ? 's' : ''} found</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.leftActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRefresh}>
          <Ionicons name="refresh" size={16} color="white" />
          <Text style={styles.actionBtnText}>Refresh</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnBlue]}
          onPress={runNetworkScan}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="scan" size={16} color="white" />
          )}
          <Text style={styles.actionBtnText}>{scanning ? 'Scanning...' : 'Network Scan'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOrange]} onPress={() => setShowManualInput(true)}>
          <Ionicons name="link" size={16} color="white" />
          <Text style={styles.actionBtnText}>Manual URL</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipBtnText}>Continue Offline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── RIGHT PANEL ──────────────────────────────────────────────────────────────
  const renderRoverCard = (rover: DiscoveredRover) => {
    const isStale = now - rover.lastSeen > 5000;
    const dotColor = isStale ? '#FF9800' : '#4CAF50';
    const isConnecting = connectingRoverId === rover.roverId;

    return (
      <TouchableOpacity
        key={rover.roverId}
        style={styles.roverCard}
        onPress={() => handleSelectBeaconRover(rover)}
        disabled={isConnecting}
        activeOpacity={0.75}
      >
        {/* Left accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: dotColor }]} />

        {/* Icon */}
        <View style={[styles.cardIconWrap, { borderColor: dotColor + '40' }]}>
          <Ionicons name="hardware-chip" size={30} color={dotColor} />
        </View>

        {/* Info */}
        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text style={styles.cardName}>{rover.roverName}</Text>
            <View style={[styles.cardBadge, { backgroundColor: dotColor + '22', borderColor: dotColor }]}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              <Text style={[styles.cardBadgeText, { color: dotColor }]}>
                {isStale ? 'STALE' : 'LIVE'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardId}>{rover.roverId}</Text>
          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="globe-outline" size={12} color="#4CAF50" />
              <Text style={styles.metaText}>{rover.ip}:{rover.port}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={12} color="#888" />
              <Text style={styles.metaTextGray}>Up {formatUptime(rover.uptime)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="code-slash-outline" size={12} color="#888" />
              <Text style={styles.metaTextGray}>v{rover.version}</Text>
            </View>
          </View>
        </View>

        {/* Connect indicator */}
        <View style={styles.cardArrow}>
          {isConnecting ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <>
              <Text style={styles.connectLabel}>CONNECT</Text>
              <Ionicons name="arrow-forward" size={20} color="#4CAF50" />
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderNetworkCard = (device: JetsonDevice) => {
    const isConnecting = connectingRoverId === device.id;
    return (
      <TouchableOpacity
        key={device.id}
        style={[styles.roverCard, styles.networkCard]}
        onPress={() => handleSelectNetworkDevice(device)}
        disabled={isConnecting}
        activeOpacity={0.75}
      >
        <View style={[styles.cardAccent, { backgroundColor: '#2196F3' }]} />
        <View style={[styles.cardIconWrap, { borderColor: '#2196F340' }]}>
          <Ionicons name="wifi" size={30} color="#2196F3" />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text style={styles.cardName}>{device.name}</Text>
            <View style={[styles.cardBadge, { backgroundColor: '#2196F322', borderColor: '#2196F3' }]}>
              <Text style={[styles.cardBadgeText, { color: '#2196F3' }]}>SCAN</Text>
            </View>
          </View>
          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="globe-outline" size={12} color="#2196F3" />
              <Text style={[styles.metaText, { color: '#2196F3' }]}>{device.ip}:{device.port}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="speedometer-outline" size={12} color="#888" />
              <Text style={styles.metaTextGray}>{device.responseTime}ms</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardArrow}>
          {isConnecting ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <>
              <Text style={[styles.connectLabel, { color: '#2196F3' }]}>CONNECT</Text>
              <Ionicons name="arrow-forward" size={20} color="#2196F3" />
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRightPanel = () => (
    <View style={styles.rightPanel}>
      {/* Header */}
      <View style={styles.rightHeader}>
        <Text style={styles.rightTitle}>
          {totalCount > 0 ? `NEARBY ROVERS` : 'SCANNING...'}
        </Text>
        {totalCount > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{totalCount}</Text>
          </View>
        )}
      </View>

      {/* Beacon Rovers */}
      {hasBeacons && (
        <>
          {networkDevices.length > 0 && (
            <Text style={styles.sectionLabel}>BEACON DISCOVERY</Text>
          )}
          {allRovers.map(renderRoverCard)}
        </>
      )}

      {/* Network Scan Rovers */}
      {hasNetwork && (
        <>
          <Text style={styles.sectionLabel}>NETWORK SCAN</Text>
          {networkDevices.map(renderNetworkCard)}
        </>
      )}

      {/* Empty State */}
      {!hasBeacons && !hasNetwork && !scanning && (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4CAF5044" style={{ marginBottom: 20 }} />
          <Text style={styles.emptyTitle}>Waiting for rovers...</Text>
          <Text style={styles.emptyHint}>
            Make sure the rover is powered on{'\n'}and connected to the same WiFi network
          </Text>
          <View style={styles.emptyTips}>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
              <Text style={styles.tipText}>Rover broadcasts on UDP port 5002</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
              <Text style={styles.tipText}>Beacon interval: every 2 seconds</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
              <Text style={styles.tipText}>Use Network Scan or Manual URL as fallback</Text>
            </View>
          </View>
        </View>
      )}

      {/* Scanning indicator */}
      {scanning && (
        <View style={styles.scanningRow}>
          <ActivityIndicator size="small" color="#2196F3" />
          <Text style={styles.scanningText}>Scanning network for rovers...</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {renderLeftPanel()}
      <View style={styles.divider} />
      {renderRightPanel()}

      {/* Manual URL Modal */}
      <Modal
        visible={showManualInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="link" size={24} color="#FF9800" />
              <Text style={styles.modalTitle}>Manual Backend URL</Text>
            </View>
            <Text style={styles.modalHint}>
              Connects to /api/status{'\n'}Example: http://192.168.1.242:5001
            </Text>
            <TextInput
              style={styles.urlInput}
              placeholder="http://192.168.1.x:5001"
              placeholderTextColor="#555"
              value={manualUrl}
              onChangeText={setManualUrl}
              editable={!testingManualUrl}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowManualInput(false)}
                disabled={testingManualUrl}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConnect]}
                onPress={handleConnectManualUrl}
                disabled={testingManualUrl}
              >
                {testingManualUrl ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalBtnText}>Connect</Text>
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
    flexDirection: 'row',
    backgroundColor: '#0D1B2A',
  },

  // ── LEFT PANEL ──────────────────────────────────────────────────────────────
  leftPanel: {
    width: 260,
    backgroundColor: '#0A1628',
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderRightColor: '#1e3a5f',
  },
  branding: {
    alignItems: 'center',
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#4CAF5015',
    borderWidth: 1,
    borderColor: '#4CAF5040',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 3,
  },
  appSubtitle: {
    fontSize: 11,
    color: '#4CAF50',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  // Beacon animation
  beaconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  pulseRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  beaconCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF5015',
    borderWidth: 1.5,
    borderColor: '#4CAF5060',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Status block
  statusBlock: {
    alignItems: 'center',
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  statusText: {
    fontSize: 13,
    color: '#ccc',
    fontWeight: '500',
  },
  statusDetail: {
    fontSize: 11,
    color: '#555',
    letterSpacing: 1,
  },
  statusFound: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },

  // Left action buttons
  leftActions: {
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnBlue: {
    backgroundColor: '#2196F3',
  },
  actionBtnOrange: {
    backgroundColor: '#FF9800',
  },
  actionBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    color: '#445',
    fontSize: 12,
  },

  // ── DIVIDER ─────────────────────────────────────────────────────────────────
  divider: {
    width: 1,
    backgroundColor: '#1e3a5f',
  },

  // ── RIGHT PANEL ─────────────────────────────────────────────────────────────
  rightPanel: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  rightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4CAF50',
    letterSpacing: 2,
  },
  countBadge: {
    backgroundColor: '#4CAF5022',
    borderWidth: 1,
    borderColor: '#4CAF5060',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 10,
    color: '#445',
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 4,
  },

  // ── ROVER CARD ───────────────────────────────────────────────────────────────
  roverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111d2e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  networkCard: {
    borderColor: '#1a2f4a',
  },
  cardAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 14,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 14,
    gap: 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.3,
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  cardBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardId: {
    fontSize: 12,
    color: '#556',
    fontFamily: undefined,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
  },
  metaTextGray: {
    fontSize: 12,
    color: '#667',
  },
  cardArrow: {
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 2,
  },
  connectLabel: {
    fontSize: 9,
    color: '#4CAF50',
    letterSpacing: 1,
    fontWeight: '700',
  },

  // ── EMPTY STATE ──────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#445',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: '#334',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  emptyTips: {
    gap: 8,
    alignSelf: 'flex-start',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#445',
  },

  // Scanning
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  scanningText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },

  // ── MODAL ────────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#111d2e',
    borderRadius: 16,
    padding: 28,
    width: 420,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  modalHint: {
    fontSize: 13,
    color: '#556',
    marginBottom: 18,
    lineHeight: 20,
  },
  urlInput: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#2a4a6a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: 'white',
    fontSize: 15,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#1e3a5f',
  },
  modalBtnConnect: {
    backgroundColor: '#FF9800',
  },
  modalBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});
