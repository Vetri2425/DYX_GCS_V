import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { PATH_PLAN_GLASS, PATH_PLAN_HEADER } from '../../constants/pathPlanGlass';
import { useRover } from '../../context/RoverContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  dragGesture?: any;
  isDraggingActive?: boolean;
  onClose?: () => void;
}

export const SystemStatusPanel: React.FC<Props> = ({
  dragGesture,
  isDraggingActive,
  onClose,
}) => {
  const { telemetry, connectionState } = useRover();

  const getWiFiSignalBars = (signal: number, connected: boolean): string => {
    if (!connected) return 'wifi-outline';
    return 'wifi';
  };

  const systemStatus = useMemo(() => {
    const connectionType = telemetry.network.connection_type || 'none';
    const wifiConnected = telemetry.network.wifi_connected || false;
    const wifiSignal = telemetry.network.wifi_signal_strength || 0;
    const rtkStreamActive =
      telemetry.rtk_stream_active ?? telemetry.network.lora_connected ?? false;
    const fcuConnected = telemetry.fcu_connected ?? false;
    const batteryPct = telemetry.battery.percentage;
    const backendConnected = connectionState === 'connected';

    return {
      networkIcon: connectionType === 'ethernet' ? 'hardware-chip' : getWiFiSignalBars(wifiSignal, wifiConnected),
      networkColor: connectionType === 'ethernet'
        ? (wifiConnected || connectionType === 'ethernet' ? '#00FF00' : '#FF0000')
        : (wifiConnected ? '#00FF00' : '#FF0000'),
      networkOpacity: connectionType === 'ethernet'
        ? 1
        : wifiConnected
          ? (wifiSignal >= 4 ? 1 : wifiSignal >= 3 ? 0.8 : wifiSignal >= 2 ? 0.6 : 0.4)
          : 0.7,
      loraIcon: 'radio-outline',
      loraColor: rtkStreamActive ? '#00FF00' : '#666666',
      loraOpacity: rtkStreamActive ? 1 : 0.7,
      rcIcon: 'bluetooth',
      rcColor: backendConnected ? '#00FF00' : '#FF0000',
      rcOpacity: backendConnected ? 1 : 0.7,
      fcuIcon: 'airplane',
      fcuColor: fcuConnected ? '#00FF00' : '#FF0000',
      fcuOpacity: fcuConnected ? 1 : 0.7,
      batteryIcon: batteryPct > 50 ? 'battery-charging' : batteryPct > 20 ? 'battery-half' : 'battery-dead',
      batteryColor: batteryPct > 50 ? '#00FF00' : batteryPct > 20 ? '#FFAA00' : '#FF0000',
      batteryPct: batteryPct.toFixed(0),
    };
  }, [telemetry, connectionState, telemetry.fcu_connected, telemetry.rtk_stream_active]);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={dragGesture}>
        <View style={[styles.header, isDraggingActive && styles.headerDragging]}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="pulse" size={14} color={PATH_PLAN_GLASS.cyan} />
            </View>
            <Text style={styles.headerTitle}>SYSTEM STATUS</Text>
          </View>
          <View style={styles.headerRight}>
            {onClose && (
              <TouchableOpacity style={styles.headerCloseBtn} onPress={onClose} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={14} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GestureDetector>

      <View style={styles.statusPad}>
        <View style={styles.iconRow}>
          <View style={[styles.iconWrapper, { opacity: systemStatus.networkOpacity, borderColor: `${systemStatus.networkColor}40` }]}>
            <Ionicons name={systemStatus.networkIcon as any} size={18} color={systemStatus.networkColor} />
          </View>
          <View style={[styles.iconWrapper, { opacity: systemStatus.loraOpacity, borderColor: `${systemStatus.loraColor}40` }]}>
            <Ionicons name={systemStatus.loraIcon as any} size={18} color={systemStatus.loraColor} />
          </View>
          <View style={[styles.iconWrapper, { opacity: systemStatus.rcOpacity, borderColor: `${systemStatus.rcColor}40` }]}>
            <Ionicons name={systemStatus.rcIcon as any} size={18} color={systemStatus.rcColor} />
          </View>
          <View style={[styles.iconWrapper, { opacity: systemStatus.fcuOpacity, borderColor: `${systemStatus.fcuColor}40` }]}>
            <Ionicons name={systemStatus.fcuIcon as any} size={18} color={systemStatus.fcuColor} />
          </View>
          <View style={[styles.iconWrapper, { borderColor: `${systemStatus.batteryColor}40` }]}>
            <Ionicons name={systemStatus.batteryIcon as any} size={18} color={systemStatus.batteryColor} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: PATH_PLAN_GLASS.panelBg,
    borderRadius: PATH_PLAN_GLASS.borderRadius,
    borderWidth: 1,
    borderColor: PATH_PLAN_GLASS.border,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: PATH_PLAN_GLASS.borderSubtle,
  },
  headerDragging: {
    borderBottomColor: PATH_PLAN_GLASS.dragBorder,
    backgroundColor: PATH_PLAN_GLASS.dragBg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCloseBtn: PATH_PLAN_HEADER.closeBtn,
  headerIconWrap: PATH_PLAN_HEADER.iconWrap,
  headerTitle: PATH_PLAN_HEADER.title,
  statusPad: {
    backgroundColor: PATH_PLAN_GLASS.innerBg,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: PATH_PLAN_GLASS.borderSubtle,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: PATH_PLAN_GLASS.borderSubtle,
  },
});
