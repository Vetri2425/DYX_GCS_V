import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import VoiceSettingsModal from './VoiceSettingsModal';
import { FailsafeModeSelector } from '../pathplan/FailsafeModeSelector';
import { colors } from '../../theme/colors';
import { useRover } from '../../context/RoverContext';

export function HeaderBar({ missionMode = 'DGPS Mark' }: { missionMode?: string }) {
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const { gpsFailsafeMode, setGpsFailsafeMode, telemetry } = useRover();
  const [showFailsafeModeSelector, setShowFailsafeModeSelector] = useState(false);
  const getModeIcon = (mode: string): string => {
    switch (mode.toLowerCase()) {
      case 'dgps mark':
        return '📍';
      case 'interval spray':
        return '💧';
      case 'survey':
        return '🗺️';
      case 'manual control':
        return '🎮';
      case 'custom':
        return '⚙️';
      default:
        return '🎯';
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>⚙️</Text>
        </View>
        <View style={styles.brandingSection}>
          <Text style={styles.title}>DYX Autonomous</Text>
          <Text style={styles.subtitle}>Way To Mark</Text>
        </View>
      </View>

      <View style={styles.menuItems}>
        <Text style={styles.menuText}>Dashboard</Text>
        <Text style={styles.menuText}>Path Plan</Text>
        <Text style={[styles.menuText, styles.active]}>Mission Report</Text>
      </View>

      <View style={styles.rightSection}>
        <View style={styles.modeBox}>
          <Text style={styles.modeIcon}>{getModeIcon(missionMode)}</Text>
          <View>
            <Text style={styles.modeLabel}>MODE</Text>
            <Text style={styles.modeValue}>{missionMode}</Text>
          </View>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Connecting...</Text>
        </View>
        <View style={styles.reconnectButton}>
          <Text style={styles.reconnectIcon}>🔄</Text>
          <Text style={styles.reconnectText}>Reconnect</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            console.log('🔊 Voice button pressed - opening modal');
            setShowVoiceModal(true);
          }}
          style={styles.voiceButton}
          accessibilityLabel="Open voice settings"
          accessibilityRole="button"
        >
          <Text style={styles.voiceIcon}>🔊</Text>
          <Text style={styles.voiceText}>Voice</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowFailsafeModeSelector(true)}
          style={styles.gearButton}
          accessibilityLabel="Open GPS failsafe settings"
          accessibilityRole="button"
        >
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>
        <Text style={styles.expandIcon}>⛶</Text>
        <VoiceSettingsModal visible={showVoiceModal} onClose={() => setShowVoiceModal(false)} />
        <FailsafeModeSelector
          visible={showFailsafeModeSelector}
          currentMode={gpsFailsafeMode}
          onModeChange={setGpsFailsafeMode}
          onClose={() => setShowFailsafeModeSelector(false)}
          disabled={telemetry.mission.status !== 'IDLE'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.headerBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    backgroundColor: '#1a5d99',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  brandingSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#88b4ff',
    fontSize: 12,
    marginLeft: 10,
  },
  menuItems: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
  },
  menuText: {
    color: '#c6d7ff',
    marginHorizontal: 16,
    fontSize: 14,
  },
  active: {
    color: '#fff',
    fontWeight: '600',
    backgroundColor: '#1a75d2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#059669',
    marginRight: 4,
    minWidth: 85,
  },
  voiceIcon: {
    fontSize: 18,
    marginRight: 6,
    color: '#ffffff'
  },
  voiceText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  gearButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a75d2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#059669',
  },
  gearIcon: {
    fontSize: 18,
    color: '#ffffff'
  },
  modeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d2740',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a75d2',
  },
  modeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  modeLabel: {
    color: '#88b4ff',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modeValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d2740',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
    marginRight: 8,
  },
  statusText: {
    color: '#c6d7ff',
    fontSize: 13,
  },
  reconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  reconnectIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  reconnectText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  expandIcon: {
    color: '#c6d7ff',
    fontSize: 18,
  },
});
