import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors } from '../../theme/colors';
import { TTSToggleButton } from './TTSToggleButton';
import { FailsafeModeSelector } from '../pathplan/FailsafeModeSelector';
import { useRover } from '../../context/RoverContext';

interface Props {
  activeTab: 'Dashboard' | 'Marking Plan' | 'Mission Progress' | 'Analytics';
  onTabChange: (tab: 'Dashboard' | 'Marking Plan' | 'Mission Progress' | 'Analytics') => void;
  missionMode?: string;
}

export const AppHeader: React.FC<Props> = ({
  activeTab,
  onTabChange,
  missionMode = 'DGPS Mark',
}) => {
  const [showFailsafeModeSelector, setShowFailsafeModeSelector] = useState(false);
  const { gpsFailsafeMode, setGpsFailsafeMode, telemetry } = useRover();
  
  // Determine if mission is active
  // Mission is considered inactive if:
  // 1. Status is IDLE/STANDBY/empty
  // 2. OR mission is completed (current_wp >= total_wp AND total_wp > 0)
  const missionStatus = (telemetry.mission.status || 'IDLE').toUpperCase();
  const isMissionCompleted = telemetry.mission.total_wp > 0 && 
                             telemetry.mission.current_wp >= telemetry.mission.total_wp &&
                             telemetry.mission.progress_pct >= 100;
  const isMissionActive = !['IDLE', 'STANDBY', ''].includes(missionStatus) && !isMissionCompleted;
  
  // Log mission status changes only (for debugging)
  React.useEffect(() => {
    // Only log on significant changes to avoid console spam
    if (isMissionActive || isMissionCompleted) {
      console.log('[AppHeader] Mission:', missionStatus, 
                  '| WP:', telemetry.mission.current_wp + '/' + telemetry.mission.total_wp,
                  '| Completed:', isMissionCompleted ? 'Yes' : 'No',
                  '| Failsafe locked:', isMissionActive ? 'Yes' : 'No');
    }
  }, [isMissionActive, isMissionCompleted]);
  
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
      {/* Left: Logo and Title */}
      <View style={styles.leftSection}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/rover-icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <View>
          <Text style={styles.title}>DYX Autonomous</Text>
          <Text style={styles.subtitle}>Way To Mark Robot </Text>
        </View>
      </View>

      {/* Center: Tab Navigation */}
      <View style={styles.centerSection}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Dashboard' && styles.tabActive]}
            onPress={() => onTabChange('Dashboard')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'Dashboard' && styles.tabTextActive]}>
              Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'Marking Plan' && styles.tabActive]}
            onPress={() => onTabChange('Marking Plan')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'Marking Plan' && styles.tabTextActive]}>
              Marking Plan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'Mission Progress' && styles.tabActive]}
            onPress={() => onTabChange('Mission Progress')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'Mission Progress' && styles.tabTextActive]}>
              Mission Progress
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'Analytics' && styles.tabActive]}
            onPress={() => onTabChange('Analytics')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'Analytics' && styles.tabTextActive]}>
              Analytics
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Right: Mission Mode and TTS Control */}
      <View style={styles.rightSection}>
        <TTSToggleButton />
        <TouchableOpacity
          onPress={() => setShowFailsafeModeSelector(true)}
          style={styles.gearButton}
          accessibilityLabel="Open GPS failsafe settings"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>
        <View style={styles.modeBox}>
          <Text style={styles.modeIcon}>{getModeIcon(missionMode)}</Text>
          <View>
            <Text style={styles.modeLabel}>MODE</Text>
            <Text style={styles.modeValue}>{missionMode}</Text>
          </View>
        </View>
      </View>
      <FailsafeModeSelector
        visible={showFailsafeModeSelector}
        currentMode={gpsFailsafeMode}
        onModeChange={setGpsFailsafeMode}
        onClose={() => setShowFailsafeModeSelector(false)}
        disabled={isMissionActive}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: '#002244',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(103, 232, 249, 0.3)',
    position: 'relative',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  centerSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#002244',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.3)',
    padding: 4,
    pointerEvents: 'auto',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#06B6D4',
    borderRadius: 6,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: colors.text,
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.3)',
  },
  modeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  modeLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modeValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
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
    minWidth: 44,
    minHeight: 44,
  },
  gearIcon: {
    fontSize: 20,
    color: '#ffffff',
  },
});
