import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../../theme/colors';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  visible: boolean;
  type: ToastType;
  title?: string;
  message?: string;
  position?: 'top' | 'bottom';
  style?: any;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  type,
  title,
  message,
  position = 'bottom',
  style,
}) => {
  if (!visible) return null;

  const positionStyle = position === 'top' 
    ? { top: 24, left: 16, right: 16 }
    : { bottom: 24, left: 16, right: 16 };

  return (
    <View style={[styles.container, positionStyle, styles[type], style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: '#fff',
    textAlign: 'center',
  },
  success: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  error: {
    backgroundColor: '#dc2626',
    borderColor: '#991b1b',
  },
  info: {
    backgroundColor: '#0891b2',
    borderColor: '#0e7490',
  },
});
