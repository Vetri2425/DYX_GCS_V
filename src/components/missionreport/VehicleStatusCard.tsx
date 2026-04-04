import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { VehicleStatus } from './types';
import { RoverTelemetry } from '../../types/telemetry';

interface Props {
  status: VehicleStatus;
  telemetry?: RoverTelemetry;
  isConnected: boolean;
}

// Layout constants — DO NOT change these, they control the fit in the parent layout
const VEHICLE_CARD_LAYOUT: { height?: number | string; minHeight?: number; width?: number | string; flex?: number } = {
  height: 345,
  minHeight: 120,
  width: '100%',
};

// ── Color helpers (pure, no side effects) ──────────────────────────────────
const getRtkColor = (telemetry: any): string => {
  if (!telemetry) return colors.danger;
  const fixType = telemetry.rtk.fix_type;
  if (fixType >= 5) return colors.success;
  if (fixType >= 3) return colors.warning;
  return colors.danger;
};

const getBatteryColor = (telemetry: any): string => {
  if (!telemetry) return colors.danger;
  const pct = telemetry.battery.percentage;
  if (pct > 50) return colors.success;
  if (pct > 20) return colors.warning;
  return colors.danger;
};

const getAccuracyColor = (value: number): string => {
  if (value < 0.1) return colors.success;
  if (value < 5) return colors.warning;
  if (value < 10) return colors.accent;
  return colors.danger;
};

const getSatelliteColor = (telemetry: any): string => {
  if (!telemetry) return colors.danger;
  const satCount = telemetry.global.satellites_visible;
  if (satCount >= 14) return colors.success;
  if (satCount >= 6) return colors.warning;
  if (satCount >= 2) return colors.accent;
  return colors.danger;
};

// Debounce color changes to prevent rapid flickering
function useDebouncedColor(computeColor: () => string, dep: any, delay = 350): string {
  const [color, setColor] = useState(computeColor);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const next = computeColor();
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setColor(next);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setColor(next), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [dep]);

  return color;
}

// Row config type
type StatusRowItem = {
  key: string;
  label: string;
  value: string | number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const VehicleStatusCard: React.FC<Props> = ({ status, telemetry, isConnected }) => {
  const connectionColor = isConnected ? colors.success : colors.danger;

  const rtkColor      = useDebouncedColor(() => getRtkColor(telemetry),      telemetry?.rtk?.fix_type);
  const batteryColor  = useDebouncedColor(() => getBatteryColor(telemetry),  telemetry?.battery?.percentage);
  const hrmsColor     = useDebouncedColor(() => getAccuracyColor((telemetry as any)?.hrms ?? 0), (telemetry as any)?.hrms);
  const vrmsColor     = useDebouncedColor(() => getAccuracyColor((telemetry as any)?.vrms ?? 0), (telemetry as any)?.vrms);
  const satColor      = useDebouncedColor(() => getSatelliteColor(telemetry), telemetry?.global?.satellites_visible);

  const rows: StatusRowItem[] = [
    { key: 'battery',    label: 'Battery',    value: status.battery,    color: batteryColor,  icon: 'battery-charging' },
    { key: 'gps',        label: 'GPS / RTK',  value: status.gps,        color: rtkColor,      icon: 'cellular' },
    { key: 'satellites', label: 'Satellites', value: status.satellites,  color: satColor,      icon: 'radio' },
    { key: 'hrms',       label: 'HRMS',       value: status.hrms,       color: hrmsColor,     icon: 'analytics' },
    { key: 'vrms',       label: 'VRMS',       value: status.vrms,       color: vrmsColor,     icon: 'analytics-outline' },
    { key: 'imu',        label: 'IMU',        value: status.imu,        color: colors.accent, icon: 'compass' },
    ...(status.mode ? [{ key: 'mode', label: 'Mode', value: status.mode, color: colors.accent, icon: 'settings-sharp' as keyof typeof Ionicons.glyphMap }] : []),
  ];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="hardware-chip" size={16} color={colors.accent} />
          </View>
          <Text style={styles.headerTitle}>ROBOT STATUS</Text>
        </View>
        <View style={[styles.headerBadge, { backgroundColor: isConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderColor: isConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }]}>
          <View style={[styles.headerBadgeDot, { backgroundColor: connectionColor }]} />
          <Text style={[styles.headerBadgeText, { color: connectionColor }]}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* Status rows */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {rows.map((row, idx) => (
          <View
            key={row.key}
            style={[styles.row, idx === rows.length - 1 && styles.rowLast]}
          >
            {/* Left: icon + label */}
            <View style={styles.rowLeft}>
              <View style={[styles.rowIconWrap, { borderColor: `${row.color}40` }]}>
                <Ionicons name={row.icon} size={13} color={row.color} />
              </View>
              <Text style={styles.rowLabel}>{row.label}</Text>
            </View>

            {/* Right: colored value badge */}
            <View style={[styles.valueBadge, { backgroundColor: `${row.color}20`, borderColor: `${row.color}50` }]}>
              <View style={[styles.valueDot, { backgroundColor: row.color }]} />
              <Text style={[styles.valueText, { color: row.color }]} numberOfLines={1}>
                {String(row.value)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    ...(VEHICLE_CARD_LAYOUT as any),
    backgroundColor: colors.panelBg,
    borderRadius: 12,
    padding: 12,
    paddingBottom: 20,
    marginBottom: 6.12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // ── HEADER ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  headerBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  headerBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // ── LIST ──
  list: {
    flex: 1.2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    overflow: 'hidden',
  },

  // ── ROW — 5 visible, 2 scroll ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 53,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: {
    color: 'rgba(103,232,249,0.8)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ── VALUE BADGE ──
  valueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
    maxWidth: '55%',
  },
  valueDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    flexShrink: 0,
  },
  valueText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
});
