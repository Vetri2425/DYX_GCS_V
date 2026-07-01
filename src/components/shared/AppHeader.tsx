import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, TouchableWithoutFeedback } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { useRover } from '../../context/RoverContext';
import { ModeSelectionDialog } from '../pathplan/ModeSelectionDialog';
import { DashConfigDialog } from '../pathplan/DashConfigDialog';
import { setMissionMode as setBackendMissionMode } from '../../services/missionModeService';
import { LayerControlsPanel } from '../pathplan/LayerControlsPanel';
import { useMissionProgressOverlayOptional } from '../../context/MissionProgressOverlayContext';

interface Props {
  activeTab: 'Dashboard' | 'Marking Plan' | 'Mission Progress';
  onTabChange: (tab: 'Dashboard' | 'Marking Plan' | 'Mission Progress') => void;
}

const AppHeaderInner: React.FC<Props> = ({
  activeTab,
  onTabChange,
}) => {
  // Only destructure what AppHeader actually uses — not telemetry.
  // Note: useRover() still triggers re-renders on every telemetry tick because
  // it subscribes to the full context. Phase 2 (context split) will fix this.
  const { missionMode, setMissionMode } = useRover();
  const mpOverlay = useMissionProgressOverlayOptional();
  const showMissionProgressWidget = activeTab === 'Mission Progress' && mpOverlay != null;

  const [showSettings, setShowSettings] = useState(false);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [showDashConfigDialog, setShowDashConfigDialog] = useState(false);

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
        console.error('[AppHeader] Failed to set dash mode config:', result.error);
      }
    } catch (error) {
      console.error('[AppHeader] Error setting dash mode config:', error);
    }
  };

  const handleDashConfigCancel = () => {
    setMissionMode('DGPS Mark');
    setShowDashConfigDialog(false);
  };

  const renderTab = (tab: 'Dashboard' | 'Marking Plan' | 'Mission Progress') => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={[styles.tab, isActive && styles.tabActive]}
        onPress={() => onTabChange(tab)}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
          {tab}
        </Text>
        {isActive && (
          <View style={styles.activeIndicatorContainer}>
            <View style={styles.activeUnderline} />
          </View>
        )}
      </TouchableOpacity>
    );
  };
  return (
    <View style={styles.header} pointerEvents="box-none">
      {/* Left: branding + Mission Progress widget controller */}
      <View style={styles.headerLeftCluster}>
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
            <Text style={styles.subtitle}>Way To Mark Robot</Text>
          </View>
        </View>

        {showMissionProgressWidget && (
          <>
            <LayerControlsPanel
              headerAligned
              onToggleWidget={mpOverlay.toggleWidgetMenu}
              isWidgetOpen={mpOverlay.isWidgetMenuOpen}
            />
            {mpOverlay.isWidgetMenuOpen && (
              <View style={styles.widgetDropdownMenu}>
                <Text style={styles.widgetDropdownTitle}>WIDGET LAYERS</Text>

                <TouchableOpacity
                  style={styles.widgetMenuItem}
                  onPress={() => mpOverlay.togglePanel('robotStatus')}
                  activeOpacity={0.7}
                >
                  <View style={styles.widgetMenuItemContent}>
                    <MaterialCommunityIcons name="robot" size={13} color="#67E8F9" style={{ marginRight: 8 }} />
                    <Text style={styles.widgetMenuItemLabel}>Robot Status</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={mpOverlay.panelVisibility.robotStatus ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={14}
                    color={mpOverlay.panelVisibility.robotStatus ? '#67E8F9' : '#94A3B8'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.widgetMenuItem}
                  onPress={() => mpOverlay.togglePanel('missionProgress')}
                  activeOpacity={0.7}
                >
                  <View style={styles.widgetMenuItemContent}>
                    <MaterialCommunityIcons name="chart-donut" size={13} color="#67E8F9" style={{ marginRight: 8 }} />
                    <Text style={styles.widgetMenuItemLabel}>Mission Progress</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={mpOverlay.panelVisibility.missionProgress ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={14}
                    color={mpOverlay.panelVisibility.missionProgress ? '#67E8F9' : '#94A3B8'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.widgetMenuItem}
                  onPress={() => mpOverlay.togglePanel('distanceToTarget')}
                  activeOpacity={0.7}
                >
                  <View style={styles.widgetMenuItemContent}>
                    <MaterialCommunityIcons name="crosshairs-gps" size={13} color="#67E8F9" style={{ marginRight: 8 }} />
                    <Text style={styles.widgetMenuItemLabel}>Distance to Target</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={mpOverlay.panelVisibility.distanceToTarget ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={14}
                    color={mpOverlay.panelVisibility.distanceToTarget ? '#67E8F9' : '#94A3B8'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.widgetMenuItem}
                  onPress={() => mpOverlay.togglePanel('systemStatus')}
                  activeOpacity={0.7}
                >
                  <View style={styles.widgetMenuItemContent}>
                    <MaterialCommunityIcons name="pulse" size={13} color="#67E8F9" style={{ marginRight: 8 }} />
                    <Text style={styles.widgetMenuItemLabel}>System Status</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={mpOverlay.panelVisibility.systemStatus ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={14}
                    color={mpOverlay.panelVisibility.systemStatus ? '#67E8F9' : '#94A3B8'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.widgetMenuItem}
                  onPress={() => mpOverlay.togglePanel('missionControls')}
                  activeOpacity={0.7}
                >
                  <View style={styles.widgetMenuItemContent}>
                    <MaterialCommunityIcons name="rocket-launch" size={13} color="#67E8F9" style={{ marginRight: 8 }} />
                    <Text style={styles.widgetMenuItemLabel}>Mission Controls</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={mpOverlay.panelVisibility.missionControls ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={14}
                    color={mpOverlay.panelVisibility.missionControls ? '#67E8F9' : '#94A3B8'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.widgetMenuItem}
                  onPress={() => mpOverlay.togglePanel('bottom')}
                  activeOpacity={0.7}
                >
                  <View style={styles.widgetMenuItemContent}>
                    <MaterialCommunityIcons name="table-large" size={13} color="#67E8F9" style={{ marginRight: 8 }} />
                    <Text style={styles.widgetMenuItemLabel}>Mission Points Table</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={mpOverlay.panelVisibility.bottom ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={14}
                    color={mpOverlay.panelVisibility.bottom ? '#67E8F9' : '#94A3B8'}
                  />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Center: Tab Navigation Capsule */}
      <View style={styles.centerSection} pointerEvents="box-none">
        <View style={styles.tabContainer}>
          {renderTab('Dashboard')}
          {renderTab('Marking Plan')}
          {renderTab('Mission Progress')}
        </View>
      </View>

      {/* Right: Settings and Mode Unified Capsule */}
      <View style={styles.rightSection}>
        {/* Mode Selector Button */}
        <TouchableOpacity
          onPress={() => setShowModeDialog(true)}
          style={styles.modeCapsuleBtn}
          activeOpacity={0.7}
          accessibilityLabel="Change mission mode"
          accessibilityRole="button"
        >
          <Text style={styles.modeCapsuleLabel}>MODE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <MaterialCommunityIcons name="near-me" size={12} color="#67E8F9" />
            <Text style={styles.modeCapsuleValue}>{missionMode}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.rightDivider} />

        {/* Settings Button */}
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          style={styles.settingsCapsuleBtn}
          accessibilityLabel="Open settings"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="cog-outline" size={18} color="#E5F1FF" />
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
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    height: 58,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1000,
  },
  headerLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    zIndex: 1002,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07111be6',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  logoContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  title: {
    color: '#E5F1FF',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9FBEE3',
    fontSize: 8,
    fontWeight: '500',
    marginTop: 0,
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
    backgroundColor: '#07111be6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.15)',
    padding: 2,
    pointerEvents: 'auto',
    height: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  tab: {
    paddingHorizontal: 20,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(103, 232, 249, 0.08)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#67E8F9',
  },
  activeIndicatorContainer: {
    position: 'absolute',
    bottom: 3,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  activeUnderline: {
    width: 14,
    height: 2.5,
    backgroundColor: '#67E8F9',
    borderRadius: 1.25,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07111be6',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  modeCapsuleBtn: {
    justifyContent: 'center',
    paddingRight: 8,
  },
  modeCapsuleLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modeCapsuleValue: {
    color: '#E5F1FF',
    fontSize: 11,
    fontWeight: '700',
  },
  rightDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(103, 232, 249, 0.15)',
    marginHorizontal: 4,
  },
  settingsCapsuleBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  widgetDropdownMenu: {
    position: 'absolute',
    top: 56,
    right: 0,
    width: 220,
    zIndex: 1002,
    backgroundColor: '#07111be6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.15)',
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  widgetDropdownTitle: {
    color: '#67E8F9',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  widgetMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  widgetMenuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  widgetMenuItemLabel: {
    color: '#E5F1FF',
    fontSize: 11,
  },
});

// Memoize AppHeader to prevent unnecessary re-renders from parent.
// Note: This cannot prevent context-driven re-renders from useRover().
// Phase 2 (context split) is needed to fully isolate AppHeader from 20Hz telemetry.
export const AppHeader = React.memo(AppHeaderInner);
