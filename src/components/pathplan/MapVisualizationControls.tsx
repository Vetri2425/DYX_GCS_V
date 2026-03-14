import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, GestureResponderEvent, ViewProps } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export interface MapVisualization {
  distanceLabel: boolean;
  angleLabel: boolean;
  snapFeature: boolean;
  roverIcon: boolean;
  waypointPreview: boolean;
}

interface MapVisualizationControlsProps {
  visualization: MapVisualization;
  onToggle: (key: keyof MapVisualization) => void;
}

export const MapVisualizationControls: React.FC<MapVisualizationControlsProps> = ({
  visualization,
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));

  const toggleMenu = (e: GestureResponderEvent) => {
    // Prevent event propagation to map
    e.stopPropagation?.();
    
    const toValue = isOpen ? 0 : 1;
    Animated.timing(slideAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setIsOpen(!isOpen);
  };

  const handleToggle = (key: keyof MapVisualization, e: GestureResponderEvent) => {
    // Prevent event propagation to map
    e.stopPropagation?.();
    onToggle(key);
  };

  const menuHeight = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 280],
  });

  const menuOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  const toggleOptions = [
    {
      key: 'distanceLabel' as const,
      label: 'Distance Label',
      icon: 'ruler',
    },
    {
      key: 'angleLabel' as const,
      label: 'Angle Label',
      icon: 'angle-acute',
    },
    {
      key: 'snapFeature' as const,
      label: 'Snap Feature',
      icon: 'magnet',
    },
    {
      key: 'roverIcon' as const,
      label: 'Rover Icon',
      icon: 'robot',
    },
    {
      key: 'waypointPreview' as const,
      label: 'Waypoint Preview',
      icon: 'map-marker',
    },
  ];

  return (
    <>
      {/* Backdrop to block map touches when menu is open */}
      {isOpen && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            setIsOpen(false);
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: false,
            }).start();
          }}
        />
      )}

      <View style={styles.container} pointerEvents="box-none">
        {/* Settings Button */}
        <TouchableOpacity
          style={[styles.settingsButton, isOpen && styles.settingsButtonActive]}
          onPress={toggleMenu}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="cog" size={18} color="#67e8f9" />
        </TouchableOpacity>

        {/* Dropdown Menu */}
        {isOpen && (
          <Animated.View
            style={[
              styles.dropdownMenu,
              {
                height: menuHeight,
                opacity: menuOpacity,
              },
            ]}
          >
            <View>
              {toggleOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.menuItem}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleToggle(option.key, e);
                  }}
                  activeOpacity={0.6}
                >
                  <View style={styles.menuItemContent}>
                    <MaterialCommunityIcons
                      name={option.icon as any}
                      size={16}
                      color="#67e8f9"
                      style={styles.menuItemIcon}
                    />
                    <Text style={styles.menuItemLabel}>{option.label}</Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      visualization[option.key] && styles.checkboxChecked,
                    ]}
                  >
                    {visualization[option.key] && (
                      <MaterialCommunityIcons
                        name="check"
                        size={12}
                        color="#0a1628"
                      />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    right: 50,
    zIndex: 1000,
  },
  settingsButton: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButtonActive: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderColor: 'rgba(103, 232, 249, 0.6)',
  },
  dropdownMenu: {
    position: 'absolute',
    bottom: -280,
    right: 0,
    width: 220,
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.3)',
    borderRadius: 8,
    overflow: 'hidden',
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(103, 232, 249, 0.1)',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    marginRight: 10,
  },
  menuItemLabel: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '500',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#67e8f9',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#67e8f9',
  },
});
