import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { useRover } from '../context/RoverContext';

export default function DashboardScreen() {
  const { telemetry, connectionState, roverPosition } = useRover();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    console.log('[DashboardScreen] Component mounted');
    return () => {
      mountedRef.current = false;
      console.log('[DashboardScreen] Component unmounting');
    };
  }, []);

  // Memoize calculations with explicit dependencies for proper re-rendering
  const vehicleStatus = useMemo(() => ({
    isConnected: connectionState === 'connected',
    armStatus: telemetry.state.armed ? 'ARMED' : 'DISARMED',
    armColor: telemetry.state.armed ? '#00FF00' : '#FF0000',
    fixTypeLabel: getFixTypeLabel(telemetry.rtk.fix_type),
    mode: telemetry.state.mode || 'UNKNOWN',
    systemStatus: telemetry.state.system_status || 'UNKNOWN',
  }), [
    // Explicit nested property dependencies ensure re-renders on telemetry changes
    telemetry.state.armed,
    telemetry.state.mode,
    telemetry.state.system_status,
    telemetry.rtk.fix_type,
    connectionState
  ]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <View style={[styles.connectionBadge, { 
            backgroundColor: vehicleStatus.isConnected ? '#00FF0033' : '#FF000033' 
          }]}>
            <View style={[styles.connectionDot, { 
              backgroundColor: vehicleStatus.isConnected ? '#00FF00' : '#FF0000' 
            }]} />
            <Text style={[styles.badgeText, {
              color: vehicleStatus.isConnected ? '#00FF00' : '#FF0000'
            }]}>
              {connectionState.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Vehicle Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🤖 VEHICLE STATUS</Text>
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <Text style={styles.label}>Armed:</Text>
            <Text style={[styles.value, { color: vehicleStatus.armColor }]}>
              {vehicleStatus.armStatus}
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Mode:</Text>
            <Text style={styles.value}>{vehicleStatus.mode}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>System Status:</Text>
            <Text style={styles.value}>{vehicleStatus.systemStatus}</Text>
          </View>
        </View>

        {/* Position Card */}
        {roverPosition ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📍 POSITION & ALTITUDE</Text>
            <View style={styles.divider} />
            
            <View style={styles.row}>
              <Text style={styles.label}>Latitude:</Text>
              <Text style={styles.value}>{roverPosition.lat.toFixed(7)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Longitude:</Text>
              <Text style={styles.value}>{roverPosition.lng.toFixed(7)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Altitude (Rel):</Text>
              <Text style={styles.value}>{telemetry.global.alt_rel.toFixed(2)} m</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Ground Speed:</Text>
              <Text style={styles.value}>{telemetry.global.vel.toFixed(2)} m/s</Text>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📍 POSITION & ALTITUDE</Text>
            <View style={styles.divider} />
            <Text style={styles.noData}>Waiting for position data...</Text>
          </View>
        )}

        {/* Battery Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔋 BATTERY STATUS</Text>
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <Text style={styles.label}>Percentage:</Text>
            <Text style={[styles.value, {
              color: telemetry.battery.percentage > 30 ? '#00FF00' : '#FF0000'
            }]}>
              {telemetry.battery.percentage.toFixed(1)}%
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Voltage:</Text>
            <Text style={styles.value}>{telemetry.battery.voltage.toFixed(2)} V</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Current:</Text>
            <Text style={styles.value}>{telemetry.battery.current.toFixed(2)} A</Text>
          </View>
        </View>

        {/* RTK Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛰️ RTK / GPS STATUS</Text>
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <Text style={styles.label}>Fix Type:</Text>
            <Text style={[styles.value, {
              color: telemetry.rtk.fix_type >= 5 ? '#00FF00' : '#FFAA00'
            }]}>
              {vehicleStatus.fixTypeLabel}
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Satellites:</Text>
            <Text style={styles.value}>{telemetry.global.satellites_visible}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Base Linked:</Text>
            <Text style={[styles.value, {
              color: telemetry.rtk.base_linked ? '#00FF00' : '#FF0000'
            }]}>
              {telemetry.rtk.base_linked ? 'YES' : 'NO'}
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Baseline Age:</Text>
            <Text style={styles.value}>{telemetry.rtk.baseline_age} ms</Text>
          </View>
        </View>

        {/* Mission Progress Card */}
        {telemetry.mission.total_wp > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎯 MISSION PROGRESS</Text>
            <View style={styles.divider} />
            
            <View style={styles.row}>
              <Text style={styles.label}>Current Waypoint:</Text>
              <Text style={styles.value}>
                {telemetry.mission.current_wp}/{telemetry.mission.total_wp}
              </Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Status:</Text>
              <Text style={styles.value}>{telemetry.mission.status}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Progress:</Text>
              <Text style={styles.value}>{telemetry.mission.progress_pct.toFixed(1)}%</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={[
                styles.progressBar,
                { width: `${telemetry.mission.progress_pct}%` }
              ]} />
            </View>
          </View>
        )}

        {/* Network Info Card */}
        {telemetry.network.connection_type !== 'none' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📡 NETWORK INFO</Text>
            <View style={styles.divider} />
            
            <View style={styles.row}>
              <Text style={styles.label}>Connection:</Text>
              <Text style={styles.value}>{telemetry.network.connection_type}</Text>
            </View>
            
            {telemetry.network.wifi_connected && (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>WiFi RSSI:</Text>
                  <Text style={styles.value}>{telemetry.network.wifi_rssi} dBm</Text>
                </View>
                
                <View style={styles.row}>
                  <Text style={styles.label}>Signal Strength:</Text>
                  <Text style={styles.value}>{telemetry.network.wifi_signal_strength}%</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Last Update */}
        {roverPosition && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Last Update: {new Date(roverPosition.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Helper: Get RTK fix type label
 */
function getFixTypeLabel(fixType: number): string {
  const labels: { [key: number]: string } = {
    0: 'No GPS',
    1: 'No Fix',
    2: '2D Fix',
    3: '3D Fix',
    4: 'DGPS',
    5: 'RTK Float',
    6: 'RTK Fixed',
  };
  return labels[fixType] || 'Unknown';
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.3)',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.cardBg,
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00FFFF',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    fontSize: 13,
    color: '#88CCFF',
    flex: 1,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00FF00',
    textAlign: 'right',
    flex: 1,
  },
  noData: {
    color: '#888888',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00FF00',
    borderRadius: 3,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    color: '#666666',
    fontSize: 11,
  },
});