import React, { useMemo, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useRover } from '../context/RoverContext';
import { RobotSettingsModal } from '../components/dashboard/RobotSettingsModal';
import QuickTuneScreen from './QuickTuneScreen';
import { saveParamsToFile, loadParamsFromFile } from '../services/paramFileService';

function getFixTypeLabel(fixType: number): string {
  const labels: { [key: number]: string } = {
    0: 'No GPS', 1: 'No Fix', 2: '2D Fix',
    3: '3D Fix', 4: 'DGPS', 5: 'RTK Float', 6: 'RTK Fixed',
  };
  return labels[fixType] || 'Unknown';
}

const getStatusColor = (level: 'healthy' | 'warning' | 'critical' | 'neutral') => {
  switch (level) {
    case 'healthy':  return colors.success;
    case 'warning':  return colors.warning;
    case 'critical': return colors.danger;
    default:         return colors.textMuted;
  }
};

export default function DashboardScreen() {
  const { telemetry, connectionState, roverPosition, services } = useRover();
  const { width } = useWindowDimensions();
  const mountedRef = useRef(true);
  const [showRobotSettings, setShowRobotSettings] = useState(false);
  const [showQuickTune, setShowQuickTune] = useState(false);
  const [paramSaving, setParamSaving] = useState(false);
  const [paramLoading, setParamLoading] = useState(false);

  const isTablet = width > 600;
  const columnWidth = isTablet ? (width - 24 - 12) / 2 : ('100%' as any);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleSaveParams = async () => {
    if (paramSaving) return;
    setParamSaving(true);
    try {
      await saveParamsToFile(services);
    } finally {
      if (mountedRef.current) setParamSaving(false);
    }
  };

  const handleLoadParams = async () => {
    if (paramLoading) return;
    setParamLoading(true);
    try {
      await loadParamsFromFile(services);
    } finally {
      if (mountedRef.current) setParamLoading(false);
    }
  };

  const vehicleStatus = useMemo(() => {
    const isConnected = connectionState === 'connected';
    const isArmed = telemetry.state.armed;
    let statusLevel: 'healthy' | 'warning' | 'critical' | 'neutral' = 'neutral';
    if (!isConnected) statusLevel = 'critical';
    else if (isArmed && telemetry.state.system_status === 'ACTIVE') statusLevel = 'healthy';
    else if (isArmed) statusLevel = 'warning';
    
    return {
      isConnected,
      armStatus: isArmed ? 'ARMED' : 'DISARMED',
      statusLevel,
      fixTypeLabel: getFixTypeLabel(telemetry.rtk.fix_type),
      mode: telemetry.state.mode || 'UNKNOWN',
      systemStatus: isArmed ? 'ARMED' : 'DISARMED', // Same logic as pills
    };
  }, [telemetry.state.armed, telemetry.state.mode, telemetry.state.system_status, telemetry.rtk.fix_type, connectionState]);

  const batteryLevel: 'healthy' | 'warning' | 'critical' =
    telemetry.battery.percentage > 30 ? 'healthy' : telemetry.battery.percentage > 15 ? 'warning' : 'critical';
  const rtkLevel: 'healthy' | 'warning' | 'critical' =
    telemetry.rtk.fix_type >= 5 ? 'healthy' : telemetry.rtk.fix_type >= 2 ? 'warning' : 'critical';
  const networkLevel: 'healthy' | 'warning' | 'critical' =
    telemetry.network.connection_type !== 'none' && telemetry.network.wifi_rssi > -70 ? 'healthy'
    : telemetry.network.connection_type !== 'none' ? 'warning' : 'critical';

  const connColor = vehicleStatus.isConnected ? colors.success : colors.danger;
  const armColor  = vehicleStatus.armStatus === 'ARMED' ? colors.danger : colors.textMuted;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <MaterialCommunityIcons name="view-dashboard-outline" size={16} color={colors.accent} />
            </View>
            <Text style={styles.headerTitle}>DASHBOARD</Text>
          </View>
          <View style={[styles.headerBadge, { backgroundColor: connColor + '18', borderColor: connColor + '55' }]}>
            <View style={[styles.headerBadgeDot, { backgroundColor: connColor }]} />
            <Text style={[styles.headerBadgeText, { color: connColor }]}>
              {connectionState.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ── HERO CARD: ROBOT STATUS ── */}
        <View style={[styles.card, styles.heroCard]}>
          <View style={[styles.cardAccent, { backgroundColor: getStatusColor(vehicleStatus.statusLevel) }]} />
          <View style={styles.cardBody}>
            {/* Card header row */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardIconWrap, { borderColor: getStatusColor(vehicleStatus.statusLevel) + '40' }]}>
                  <MaterialCommunityIcons name="robot-outline" size={18} color={getStatusColor(vehicleStatus.statusLevel)} />
                </View>
                <Text style={styles.cardLabel}>ROBOT STATUS</Text>
              </View>
              <View style={[styles.statusBadge, {
                backgroundColor: getStatusColor(vehicleStatus.statusLevel) + '20',
                borderColor: getStatusColor(vehicleStatus.statusLevel),
              }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: getStatusColor(vehicleStatus.statusLevel) }]} />
                <Text style={[styles.statusBadgeText, { color: getStatusColor(vehicleStatus.statusLevel) }]}>
                  {vehicleStatus.statusLevel.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Arm + Mode pills */}
            <View style={styles.pillRow}>
              <View style={[styles.pill, { backgroundColor: armColor + '20', borderColor: armColor + '55' }]}>
                <View style={[styles.pillDot, { backgroundColor: armColor }]} />
                <Text style={[styles.pillText, { color: armColor }]}>{vehicleStatus.armStatus}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: colors.accent + '20', borderColor: colors.accent + '55' }]}>
                <Text style={[styles.pillText, { color: colors.accentLight }]}>MODE: {vehicleStatus.mode}</Text>
              </View>
            </View>

            {/* Metrics */}
            <View style={styles.heroMetrics}>
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>System State</Text>
                <Text style={styles.metricValue}>{vehicleStatus.systemStatus}</Text>
              </View>
              <View style={[styles.metricDivider]} />
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>Ground Speed</Text>
                <Text style={[styles.metricValue, { color: colors.accentLight }]}>
                  {telemetry.global.vel.toFixed(1)}{' '}
                  <Text style={styles.metricUnit}>m/s</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── QUICK TUNE CARD ── */}
        <View style={styles.card}>
          <View style={[styles.cardAccent, { backgroundColor: colors.warning }]} />
          <TouchableOpacity
            style={styles.cardBody}
            onPress={() => setShowQuickTune(true)}
            disabled={connectionState !== 'connected'}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardIconWrap, { borderColor: colors.warning + '40' }]}>
                  <Ionicons name="settings-outline" size={18} color={colors.warning} />
                </View>
                <Text style={styles.cardLabel}>QUICK TUNE</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: colors.warning }]} />
                <Text style={[styles.statusBadgeText, { color: colors.warning }]}>
                  AUTO
                </Text>
              </View>
            </View>
            <Text style={styles.quickTuneDesc}>
              Auto-tune steering and speed PID gains using Circle mode
            </Text>
            <View style={styles.quickTuneFooter}>
              <View style={styles.quickTuneChip}>
                <MaterialCommunityIcons name="steering" size={12} color={colors.accent} />
                <Text style={styles.quickTuneChipText}>Steering PID</Text>
              </View>
              <View style={styles.quickTuneChip}>
                <MaterialCommunityIcons name="speedometer" size={12} color={colors.success} />
                <Text style={styles.quickTuneChipText}>Speed Gains</Text>
              </View>
              {connectionState !== 'connected' && (
                <Text style={styles.disconnectedText}>Connect to configure</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* ── MISSION PROGRESS ── */}
        {telemetry.mission.total_wp > 0 && (
          <View style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: colors.accent }]} />
            <View style={styles.cardBody}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.cardIconWrap, { borderColor: colors.accent + '40' }]}>
                    <MaterialCommunityIcons name="map-marker-path" size={18} color={colors.accent} />
                  </View>
                  <Text style={styles.cardLabel}>MISSION PROGRESS</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}>
                  <View style={[styles.statusBadgeDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.statusBadgeText, { color: colors.accentLight }]}>
                    {telemetry.mission.status?.toUpperCase() || 'ACTIVE'}
                  </Text>
                </View>
              </View>

              <View style={styles.missionRow}>
                <View style={styles.missionStats}>
                  <Text style={styles.metricLabel}>Current Waypoint</Text>
                  <Text style={styles.metricValue}>
                    {telemetry.mission.current_wp}
                    <Text style={styles.metricUnit}> / {telemetry.mission.total_wp}</Text>
                  </Text>
                </View>
                <View style={styles.progressRingOuter}>
                  <View style={styles.progressRingInner}>
                    <Text style={styles.progressPct}>{telemetry.mission.progress_pct.toFixed(0)}%</Text>
                  </View>
                </View>
              </View>

              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${telemetry.mission.progress_pct}%` as any }]} />
              </View>
            </View>
          </View>
        )}

        {/* ── 2-COLUMN GRID ── */}
        <View style={styles.grid}>

          {/* COLUMN 1 */}
          <View style={[styles.gridCol, { width: columnWidth, maxWidth: columnWidth }]}>

            {/* Battery */}
            <View style={styles.card}>
              <View style={[styles.cardAccent, { backgroundColor: getStatusColor(batteryLevel) }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardLabel}>BATTERY</Text>
                  <View style={[styles.cardIconWrap, { borderColor: getStatusColor(batteryLevel) + '40' }]}>
                    <MaterialCommunityIcons name="battery-charging" size={18} color={getStatusColor(batteryLevel)} />
                  </View>
                </View>
                <Text style={[styles.giantValue, { color: getStatusColor(batteryLevel) }]}>
                  {telemetry.battery.percentage.toFixed(0)}<Text style={styles.giantUnit}>%</Text>
                </Text>
                <View style={styles.tileFooter}>
                  <Text style={styles.footerChip}>{telemetry.battery.voltage.toFixed(1)} V</Text>
                  <Text style={styles.footerChip}>{telemetry.battery.current.toFixed(1)} A</Text>
                </View>
              </View>
            </View>

            {/* Network */}
            {telemetry.network.connection_type !== 'none' && (
              <View style={styles.card}>
                <View style={[styles.cardAccent, { backgroundColor: getStatusColor(networkLevel) }]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardLabel}>NETWORK</Text>
                    <View style={[styles.cardIconWrap, { borderColor: getStatusColor(networkLevel) + '40' }]}>
                      <MaterialCommunityIcons name="wifi" size={18} color={getStatusColor(networkLevel)} />
                    </View>
                  </View>
                  <Text style={[styles.tileMainText, { color: getStatusColor(networkLevel) }]}>
                    {telemetry.network.connection_type.toUpperCase()}
                  </Text>
                  {telemetry.network.wifi_connected && (
                    <View style={styles.tileFooter}>
                      <Text style={styles.footerChip}>{telemetry.network.wifi_rssi} dBm</Text>
                      <Text style={styles.footerChip}>{telemetry.network.wifi_signal_strength}%</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* COLUMN 2 */}
          <View style={[styles.gridCol, { width: columnWidth, maxWidth: columnWidth }]}>

            {/* RTK / GPS */}
            <View style={styles.card}>
              <View style={[styles.cardAccent, { backgroundColor: getStatusColor(rtkLevel) }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardLabel}>RTK / GPS</Text>
                  <View style={[styles.cardIconWrap, { borderColor: getStatusColor(rtkLevel) + '40' }]}>
                    <Ionicons name="cellular" size={18} color={getStatusColor(rtkLevel)} />
                  </View>
                </View>
                <Text style={[styles.tileMainText, { color: getStatusColor(rtkLevel) }]}>
                  {vehicleStatus.fixTypeLabel}
                </Text>
                <View style={styles.tileFooter}>
                  <Text style={styles.footerChip}>{telemetry.global.satellites_visible} Sats</Text>
                  <View style={[styles.baseBadge, {
                    backgroundColor: telemetry.rtk.base_linked ? colors.success + '20' : colors.danger + '20',
                    borderColor: telemetry.rtk.base_linked ? colors.success + '55' : colors.danger + '55',
                  }]}>
                    <Text style={[styles.baseBadgeText, { color: telemetry.rtk.base_linked ? colors.success : colors.danger }]}>
                      BASE {telemetry.rtk.base_linked ? 'LINKED' : 'LOST'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Position */}
            <View style={styles.card}>
              <View style={[styles.cardAccent, { backgroundColor: colors.accent }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardLabel}>POSITION</Text>
                  <View style={[styles.cardIconWrap, { borderColor: colors.accent + '40' }]}>
                    <Ionicons name="location-outline" size={18} color={colors.accent} />
                  </View>
                </View>
                {roverPosition ? (
                  <View style={styles.posGrid}>
                    <View style={styles.posRow}>
                      <Text style={styles.posLabel}>LAT</Text>
                      <Text style={styles.posValue}>{roverPosition.lat.toFixed(7)}</Text>
                    </View>
                    <View style={[styles.divider]} />
                    <View style={styles.posRow}>
                      <Text style={styles.posLabel}>LNG</Text>
                      <Text style={styles.posValue}>{roverPosition.lng.toFixed(7)}</Text>
                    </View>
                    <View style={[styles.divider]} />
                    <View style={styles.posRow}>
                      <Text style={styles.posLabel}>ALT</Text>
                      <Text style={styles.posValue}>{telemetry.global.alt_rel.toFixed(2)} m</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noData}>Awaiting Position...</Text>
                )}
              </View>
            </View>

          </View>
        </View>

        {/* ── PARAMETER FILE CARD ── */}
        <View style={styles.card}>
          <View style={[styles.cardAccent, { backgroundColor: '#8B5CF6' }]} />
          <View style={styles.cardBody}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardIconWrap, { borderColor: 'rgba(139, 92, 246, 0.4)' }]}>
                  <MaterialCommunityIcons name="file-cog-outline" size={18} color="#8B5CF6" />
                </View>
                <Text style={styles.cardLabel}>PARAMETER FILE</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(139, 92, 246, 0.2)', borderColor: '#8B5CF6' }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.statusBadgeText, { color: '#A78BFA' }]}>.PARAM</Text>
              </View>
            </View>
            <Text style={styles.paramFileDesc}>
              Save or load all vehicle parameters as Mission Planner .param file
            </Text>
            <View style={styles.paramFileBtnRow}>
              <TouchableOpacity
                style={[styles.paramFileBtn, styles.paramFileSaveBtn, (connectionState !== 'connected' || paramSaving) && styles.paramFileBtnDisabled]}
                onPress={handleSaveParams}
                disabled={connectionState !== 'connected' || paramSaving}
              >
                {paramSaving ? (
                  <ActivityIndicator size={16} color="#4ade80" />
                ) : (
                  <Ionicons name="download-outline" size={16} color="#4ade80" />
                )}
                <Text style={[styles.paramFileBtnText, { color: '#4ade80' }]}>
                  {paramSaving ? 'SAVING...' : 'SAVE TO FILE'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paramFileBtn, styles.paramFileLoadBtn, (connectionState !== 'connected' || paramLoading) && styles.paramFileBtnDisabled]}
                onPress={handleLoadParams}
                disabled={connectionState !== 'connected' || paramLoading}
              >
                {paramLoading ? (
                  <ActivityIndicator size={16} color="#60A5FA" />
                ) : (
                  <Ionicons name="push-outline" size={16} color="#60A5FA" />
                )}
                <Text style={[styles.paramFileBtnText, { color: '#60A5FA' }]}>
                  {paramLoading ? 'LOADING...' : 'LOAD FROM FILE'}
                </Text>
              </TouchableOpacity>
            </View>
            {connectionState !== 'connected' && (
              <Text style={styles.disconnectedText}>Connect to vehicle first</Text>
            )}
          </View>
        </View>

        {/* ── ROBOT SETTINGS CARD ── */}
        <View style={styles.card}>
          <View style={[styles.cardAccent, { backgroundColor: colors.accent }]} />
          <TouchableOpacity
            style={styles.cardBody}
            onPress={() => setShowRobotSettings(true)}
            disabled={connectionState !== 'connected'}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardIconWrap, { borderColor: colors.accent + '40' }]}>
                  <Ionicons name="settings-outline" size={18} color={colors.accent} />
                </View>
                <Text style={styles.cardLabel}>ROBOT SETTINGS</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.statusBadgeText, { color: colors.accentLight }]}>
                  CONFIG
                </Text>
              </View>
            </View>
            <Text style={styles.robotSettingsText}>
              Configure GPS, Serial, Motor Drive, WP Navigation
            </Text>
            <View style={styles.robotSettingsFooter}>
              <View style={styles.robotTypeChip}>
                <Ionicons name="options-outline" size={12} color={colors.success} />
                <Text style={styles.robotTypeChipText}>22 Parameters</Text>
              </View>
              <View style={styles.robotTypeChip}>
                <Ionicons name="grid-outline" size={12} color={colors.accent} />
                <Text style={styles.robotTypeChipText}>4 Categories</Text>
              </View>
              {connectionState !== 'connected' && (
                <Text style={styles.disconnectedText}>Connect to configure</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* ── FOOTER ── */}
        {roverPosition && (
          <View style={styles.footerRow}>
            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textMuted} />
            <Text style={styles.footerText}>
              Last Update: {new Date(roverPosition.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Robot Settings Modal */}
      <RobotSettingsModal
        visible={showRobotSettings}
        onClose={() => setShowRobotSettings(false)}
      />

      {/* QuickTune Modal */}
      <QuickTuneScreen
        visible={showQuickTune}
        onClose={() => setShowQuickTune(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: 12,
  },

  // ── HEADER ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  headerBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // ── CARD BASE ──
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  heroCard: {
    // no extra overrides needed
  },
  cardAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardLabel: {
    color: 'rgba(103, 232, 249, 0.8)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // ── STATUS BADGE ──
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusBadgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ── HERO CARD INTERNALS ──
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    backgroundColor: colors.panelBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  metricBlock: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricUnit: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // ── MISSION PROGRESS ──
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionStats: {
    flex: 1,
    gap: 4,
  },
  progressRingOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: colors.accent + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRingInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.panelBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPct: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.accent,
  },
  progressBarBg: {
    height: 5,
    backgroundColor: colors.accent + '20',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },

  // ── GRID ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  gridCol: {
    flexDirection: 'column',
  },

  // ── TILE INTERNALS ──
  giantValue: {
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 4,
  },
  giantUnit: {
    fontSize: 18,
    fontWeight: '600',
  },
  tileMainText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 6,
  },
  tileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerChip: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  baseBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  baseBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ── POSITION TILE ──
  posGrid: {
    gap: 2,
  },
  posRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  posLabel: {
    fontSize: 10,
    color: 'rgba(103, 232, 249, 0.8)',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  posValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  noData: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },

  // ── PARAMETER FILE CARD ──
  paramFileDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  paramFileBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  paramFileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  paramFileSaveBtn: {
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  paramFileLoadBtn: {
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  paramFileBtnDisabled: {
    backgroundColor: colors.cardBg,
    opacity: 0.4,
  },
  paramFileBtnText: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },

  // ── ROBOT SETTINGS CARD ──
  robotSettingsText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  robotSettingsFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  robotTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.panelBg,
    borderRadius: 6,
  },
  robotTypeChipText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '500',
  },

  // ── QUICK TUNE CARD ──
  quickTuneDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  quickTuneFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  quickTuneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.panelBg,
    borderRadius: 6,
  },
  quickTuneChipText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '500',
  },
  disconnectedText: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: '500',
    fontStyle: 'italic',
  },

  // ── FOOTER ──
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
});
