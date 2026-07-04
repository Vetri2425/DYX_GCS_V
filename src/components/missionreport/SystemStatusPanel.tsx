import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { Mode, Waypoint } from './types';
import MissionControlCard from './MissionControlCard';
import { useRover } from '../../context/RoverContext';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  mode: Mode;
  onSetMode: (m: Mode) => void;
  onStart?: () => Promise<any>;
  onStop?: () => Promise<any>;
  onPause?: () => Promise<any>;
  onResume?: () => Promise<any>;
  onNext?: () => Promise<any>;
  onSkip?: () => Promise<any>;
  waypoints?: Waypoint[];
  missionMode?: string; // Backend mission mode
  isMissionActive?: boolean;
  waitingForManual?: boolean; // MANUAL mode: waiting for user to press NEXT
}

export const SystemStatusPanel: React.FC<Props> = ({
  mode,
  onSetMode,
  onStart,
  onStop,
  onPause,
  onResume,
  onNext,
  onSkip,
  waypoints = [],
  missionMode = 'DGPS Mark',
  isMissionActive = false,
  waitingForManual = false,
}) => {
  const { telemetry, connectionState, services } = useRover();

  const handleStart = async () => {
    try {
      if (!onStart) return { success: false, message: 'No start handler' };
      const res = await onStart();
      return res;
    } catch (error) {
      console.error('[SystemStatusPanel] Start Error:', error);
      return { success: false, message: String(error) };
    }
  };

  const handleStop = async () => {
    try {
      console.log('[SystemStatusPanel] Stopping mission...');
      const response = await services.pauseMission();
      if (response.success) {
        console.log('[SystemStatusPanel] Mission stopped');
      }
    } catch (error) {
      console.error('[SystemStatusPanel] Stop Error:', error);
    }
  };

  const handleResume = async () => {
    try {
      console.log('[SystemStatusPanel] Resuming mission...');
      const response = await services.resumeMission();
      if (response.success) {
        console.log('[SystemStatusPanel] Mission resumed');
        return response;
      }
      return response;
    } catch (error) {
      console.error('[SystemStatusPanel] Resume Error:', error);
      return { success: false, message: String(error) };
    }
  };

  // Helper function to get WiFi signal bars
  const getWiFiSignalBars = (signal: number, connected: boolean): string => {
    if (!connected) return 'wifi-outline'; // No connection
    if (signal >= 4) return 'wifi'; // Full signal
    if (signal === 3) return 'wifi'; // 3/4 bars
    if (signal === 2) return 'wifi'; // 2/4 bars
    return 'wifi'; // 1/4 bars - all use wifi icon, color indicates strength
  };

  // Memoize status calculations
  const systemStatus = useMemo(() => {
    const connectionType = telemetry.network.connection_type || 'none';
    const wifiConnected = telemetry.network.wifi_connected || false;
    const wifiSignal = telemetry.network.wifi_signal_strength || 0;
    const loraConnected = telemetry.network.lora_connected || false;
    const batteryPct = telemetry.battery.percentage;
    const backendConnected = connectionState === 'connected';

    return {
      // Network/Jetson Status - WiFi signal bars or Ethernet
      networkIcon: connectionType === 'ethernet' ? 'hardware-chip' : getWiFiSignalBars(wifiSignal, wifiConnected),
      networkColor: connectionType === 'ethernet'
        ? (loraConnected ? '#00FF00' : '#FF0000')
        : (wifiConnected ? '#00FF00' : '#FF0000'),
      networkOpacity: connectionType === 'ethernet'
        ? 1
        : wifiConnected
          ? (wifiSignal >= 4 ? 1 : wifiSignal >= 3 ? 0.8 : wifiSignal >= 2 ? 0.6 : 0.4)
          : 0.7,

      // LoRa Status
      loraIcon: 'radio-outline',
      loraColor: loraConnected ? '#00FF00' : '#666666',
      loraOpacity: loraConnected ? 1 : 0.7,

      // Backend/RC Status
      rcIcon: 'bluetooth',
      rcColor: backendConnected ? '#00FF00' : '#FF0000',
      rcOpacity: backendConnected ? 1 : 0.7,

      // Battery Status
      batteryIcon: batteryPct > 50 ? 'battery-charging' : batteryPct > 20 ? 'battery-half' : 'battery-dead',
      batteryColor: batteryPct > 50 ? '#00FF00' : batteryPct > 20 ? '#FFAA00' : '#FF0000',
      batteryPct: batteryPct.toFixed(0),
    };
  }, [telemetry, connectionState]);

  return (
    <View style={styles.container}>
      {/* System Status Card */}
      <View style={styles.statusCard}>
        {/* Header */}
        <View style={styles.statusHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="pulse" size={14} color={colors.accent} />
            </View>
            <Text style={styles.statusTitle}>SYSTEM STATUS</Text>
          </View>
        </View>
        <View style={styles.statusPad}>
          <View style={styles.iconRow}>
            {/* Network/Jetson */}
            <View style={[styles.iconWrapper, { opacity: systemStatus.networkOpacity, borderColor: `${systemStatus.networkColor}40` }]}>
              <Ionicons
                name={systemStatus.networkIcon as any}
                size={18}
                color={systemStatus.networkColor}
              />
            </View>

            {/* LoRa */}
            <View style={[styles.iconWrapper, { opacity: systemStatus.loraOpacity, borderColor: `${systemStatus.loraColor}40` }]}>
              <Ionicons
                name={systemStatus.loraIcon as any}
                size={18}
                color={systemStatus.loraColor}
              />
            </View>

            {/* RC/Backend */}
            <View style={[styles.iconWrapper, { opacity: systemStatus.rcOpacity, borderColor: `${systemStatus.rcColor}40` }]}>
              <Ionicons
                name={systemStatus.rcIcon as any}
                size={18}
                color={systemStatus.rcColor}
              />
            </View>

            {/* Battery */}
            <View style={[styles.iconWrapper, { borderColor: `${systemStatus.batteryColor}40` }]}>
              <Ionicons
                name={systemStatus.batteryIcon as any}
                size={18}
                color={systemStatus.batteryColor}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Mission Control Card */}
      <MissionControlCard
        waypoints={waypoints}
        mode={mode}
        onSetMode={onSetMode}
        onStart={handleStart}
        onStop={onStop || handleStop}
        onPause={onPause}
        onResume={onResume || handleResume}
        onNext={onNext}
        onSkip={onSkip}
        missionMode={missionMode}
        isMissionActive={isMissionActive}
        waitingForManual={waitingForManual}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: colors.panelBg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6.12,
    gap: 6.12,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6.12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 2.5,
  },
  statusPad: {
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    paddingVertical: 6.12,
    paddingHorizontal: 12.24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30.6,
    height: 30.6,
    borderRadius: 15.3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconLabel: {
    fontSize: 15,
    opacity: 1,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 50,
  },
});
