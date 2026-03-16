import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { useRover } from '../../context/RoverContext';
import { ModeSelectionDialog } from '../pathplan/ModeSelectionDialog';
import { DashConfigDialog } from '../pathplan/DashConfigDialog';
import { setMissionMode as setBackendMissionMode } from '../../services/missionModeService';

interface Props {
  activeTab: 'Dashboard' | 'Marking Plan' | 'Mission Progress';
  onTabChange: (tab: 'Dashboard' | 'Marking Plan' | 'Mission Progress') => void;
}

export const AppHeader: React.FC<Props> = ({
  activeTab,
  onTabChange,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [showDashConfigDialog, setShowDashConfigDialog] = useState(false);
  const { telemetry, missionMode, setMissionMode } = useRover();
  
  const getModeIcon = (mode: string): string => {
    switch (mode.toLowerCase()) {
      case 'dgps mark':
        return 'star-three-points-outline';
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

  const handleModeSelect = async (mode: string) => {
    setMissionMode(mode);
    setShowModeDialog(false);

    if (mode === 'Dash') {
      setShowDashConfigDialog(true);
      return;
    }

    let backendMode: 'auto' | 'continuous' | 'dash' = 'auto';
    if (mode === 'Continuous') {
      backendMode = 'continuous';
    }

    try {
      const result = await setBackendMissionMode({ mode: backendMode });
      if (!result.success) {
        console.error('[AppHeader] Failed to set mode:', result.error);
      }
    } catch (error) {
      console.error('[AppHeader] Error setting mode:', error);
    }
  };

  const handleDashConfigConfirm = async (onTime: number, offTime: number) => {
    setShowDashConfigDialog(false);
    try {
      const result = await setBackendMissionMode({
        mode: 'dash',
        dash_servo_on_time: onTime,
        dash_servo_off_time: offTime,
      });
      if (!result.success) {
        console.error('[AppHeader] Failed to set dash mode:', result.error);
      }
    } catch (error) {
      console.error('[AppHeader] Error setting dash mode:', error);
    }
  };

  const handleDashConfigCancel = () => {
    setMissionMode('DGPS Mark');
    setShowDashConfigDialog(false);
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

        </View>
      </View>

      {/* Right: Mission Mode and Settings */}
      <View style={styles.rightSection}>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          style={styles.gearButton}
          accessibilityLabel="Open settings"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowModeDialog(true)}
          style={styles.modeBox}
          activeOpacity={0.7}
          accessibilityLabel="Change mission mode"
          accessibilityRole="button"
        >
          {getModeIcon(missionMode) === 'star-three-points-outline' ? (
            <MaterialCommunityIcons
              name="star-three-points-outline"
              size={14}
              color="#67E8F9"
              style={styles.modeIconMdi}
            />
          ) : (
            <Text style={styles.modeIcon}>{getModeIcon(missionMode)}</Text>
          )}
          <View>
            <Text style={styles.modeLabel}>MODE</Text>
            <Text style={styles.modeValue}>{missionMode}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Settings Screen Modal */}
      <SettingsScreen visible={showSettings} onClose={() => setShowSettings(false)} />

      {/* Mode Selection Dialog */}
      <ModeSelectionDialog
        visible={showModeDialog}
        currentMode={missionMode}
        onSelectMode={handleModeSelect}
        onCancel={() => setShowModeDialog(false)}
      />

      {/* Dash Config Dialog */}
      <DashConfigDialog
        visible={showDashConfigDialog}
        initialDistance={5.0}
        initialGap={3.0}
        onConfirm={handleDashConfigConfirm}
        onCancel={handleDashConfigCancel}
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
  modeIconMdi: {
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
