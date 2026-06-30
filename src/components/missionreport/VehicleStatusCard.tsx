import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { VehicleStatus } from './types';
import { RoverTelemetry } from '../../types/telemetry';
import {
  getRobotStatusDebug,
  isRobotStatusDebugEnabled,
  subscribeRobotStatusDebug,
  type RobotStatusDebugSnapshot,
} from '../../utils/robotStatusDebug';

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

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={debugStyles.line} numberOfLines={2}>
      <Text style={debugStyles.label}>{label}: </Text>
      {value}
    </Text>
  );
}

function RobotStatusDebugPanel({ snap }: { snap: RobotStatusDebugSnapshot }) {
  const raw = snap.rawPayload;
  const adapted = snap.adapted;
  const ui = snap.uiStatus;

  return (
    <View style={debugStyles.panel}>
      <Text style={debugStyles.title}>DEBUG — SOCKET vs UI</Text>
      <DebugLine label="Source" value={`${snap.lastSource} · tel#${snap.telemetryEventCount} · rej#${snap.rejectedEventCount}`} />
      <DebugLine label="Socket" value={`${snap.connectionState} · sock=${snap.socketConnected ? 'up' : 'down'} · px4=${snap.px4Detected ? 'yes' : 'no'}`} />
      {snap.rejectReason ? <DebugLine label="Reject" value={snap.rejectReason} /> : null}
      <Text style={debugStyles.section}>RAW (socket/REST)</Text>
      <DebugLine label="battery" value={`pct=${String(raw?.battery_pct ?? '—')} v=${String(raw?.battery_v ?? '—')}`} />
      <DebugLine label="gps" value={`fix=${String(raw?.gps_fix ?? '—')} name=${String(raw?.gps_fix_name ?? '—')} sats=${String(raw?.gps_sat ?? '—')}`} />
      <DebugLine label="pos" value={`lat=${String(raw?.lat ?? '—')} lon=${String(raw?.lon ?? '—')} fcu=${String(raw?.connected ?? '—')}`} />
      <Text style={debugStyles.section}>ADAPTED</Text>
      <DebugLine label="battery" value={`${adapted.battery_pct ?? '—'}% · ${adapted.battery_v ?? '—'}V`} />
      <DebugLine label="gps" value={`fix=${adapted.gps_fix ?? '—'} · ${adapted.gps_fix_name ?? '—'} · sats=${adapted.gps_sat ?? '—'}`} />
      <DebugLine label="accuracy" value={`hrms=${adapted.hrms ?? '—'} vrms=${adapted.vrms ?? '—'}`} />
      <DebugLine label="vehicle" value={`mode=${adapted.mode ?? '—'} rpp=${adapted.rpp_state_name ?? '—'}`} />
      <Text style={debugStyles.section}>UI (VehicleStatusCard)</Text>
      <DebugLine label="shown" value={`bat=${ui?.battery ?? '—'} · gps=${ui?.gps ?? '—'} · sats=${ui?.satellites ?? '—'}`} />
      <DebugLine label="shown2" value={`hrms=${ui?.hrms ?? '—'} · vrms=${ui?.vrms ?? '—'} · imu=${ui?.imu ?? '—'}`} />
      <DebugLine label="online" value={snap.uiConnected ? 'YES' : 'NO'} />
      <DebugLine label="lastMsg" value={snap.lastMessageTs ? new Date(snap.lastMessageTs).toLocaleTimeString() : 'never'} />
    </View>
  );
}

export const VehicleStatusCard: React.FC<Props> = ({ status, telemetry, isConnected }) => {
  const connectionColor = isConnected ? colors.success : colors.danger;
  const showDebug = isRobotStatusDebugEnabled();
  const [debugSnap, setDebugSnap] = useState(getRobotStatusDebug());

  useEffect(() => {
    if (!showDebug) return undefined;
    return subscribeRobotStatusDebug(() => setDebugSnap(getRobotStatusDebug()));
  }, [showDebug]);

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
        {showDebug ? <RobotStatusDebugPanel snap={debugSnap} /> : null}
      </ScrollView>
    </View>
  );
};

const debugStyles = StyleSheet.create({
  panel: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  title: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  section: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 6,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  line: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontFamily: 'monospace',
    lineHeight: 13,
  },
  label: {
    color: 'rgba(103,232,249,0.9)',
  },
});

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
