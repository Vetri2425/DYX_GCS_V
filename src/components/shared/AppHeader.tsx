import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors } from '../../theme/colors';
import { TTSToggleButton } from './TTSToggleButton';

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
        <View style={styles.modeBox}>
          <Text style={styles.modeIcon}>{getModeIcon(missionMode)}</Text>
          <View>
            <Text style={styles.modeLabel}>MODE</Text>
            <Text style={styles.modeValue}>{missionMode}</Text>
          </View>
        </View>
      </View>
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
});
