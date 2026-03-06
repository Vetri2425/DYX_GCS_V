/**
 * React Native Hook: useRoverTelemetry
 * 
 * Handles Socket.IO connection to backend and real-time telemetry streaming
 * Adapted from web app's useRoverROS for React Native
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import io from 'socket.io-client';
import type { Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import {
  getBackendURL,
  SOCKET_CONFIG,
  API_ENDPOINTS,
  SOCKET_EVENTS,
} from '../config';
import {
  RoverTelemetry,
  TelemetryEnvelope,
  TelemetryState,
  TelemetryGlobal,
  TelemetryBattery,
  TelemetryRtk,
  TelemetryMission,
  ServoStatus,
  NetworkData,
  ServiceResponse,
  ConnectionState,
  MissionEventData,
  Waypoint,
} from '../types/telemetry';
import { LoraRTKStatus } from '../types/rtk';

// Default constants
const THROTTLE_MS = 50; // ~20 Hz - Faster updates for better responsiveness
const MAX_BACKOFF_MS = 8000;
const INITIAL_BACKOFF_MS = 1000;

// Helper to get current backend URL (dynamic)
const getHttpBase = () => getBackendURL().replace(/\/$/, '');

// Toggle verbose telemetry logging (ENABLED for debugging)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TELEMETRY_LOGS_ENABLED = true;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const telemLog = (...args: any[]) => console.log('[TELEMETRY]', ...args);

// Default values for telemetry
const DEFAULT_STATE: TelemetryState = {
  armed: false,
  mode: 'UNKNOWN',
  system_status: 'STANDBY',
  heartbeat_ts: 0,
};

const DEFAULT_GLOBAL: TelemetryGlobal = {
  lat: 0,
  lon: 0,
  alt_rel: 0,
  vel: 0,
  satellites_visible: 0,
};

const DEFAULT_BATTERY: TelemetryBattery = {
  voltage: 0,
  current: 0,
  percentage: 0,
};

const DEFAULT_RTK: TelemetryRtk = {
  fix_type: 0,
  baseline_age: 0,
  base_linked: false,
};

const DEFAULT_MISSION: TelemetryMission = {
  total_wp: 0,
  current_wp: 0,
  status: 'IDLE',
  progress_pct: 0,
};

const DEFAULT_SERVO: ServoStatus = {
  servo_id: 0,
  active: false,
  last_command_ts: 0,
};

const DEFAULT_NETWORK: NetworkData = {
  connection_type: 'none',
  wifi_signal_strength: 0,
  wifi_rssi: -100,
  interface: '',
  wifi_connected: false,
  lora_connected: false,
};

const createDefaultTelemetry = (): RoverTelemetry => ({
  state: { ...DEFAULT_STATE },
  global: { ...DEFAULT_GLOBAL },
  battery: { ...DEFAULT_BATTERY },
  rtk: { ...DEFAULT_RTK },
  mission: { ...DEFAULT_MISSION },
  servo: { ...DEFAULT_SERVO },
  network: { ...DEFAULT_NETWORK },
  hrms: 0,
  vrms: 0,
  imu_status: 'UNKNOWN',
  lastMessageTs: null,
  // New fields from Pixhawk NTUN
  wp_dist_cm: undefined,
  xtrack_cm: undefined,
  wp_brg: undefined,
  position_error_cm: undefined, // Total position error = sqrt(wp_dist² + xtrack²)
});

// Helper: Fetch JSON with proper error handling
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Request failed (${response.status}): ${text}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error('[fetchJson] Error:', error);
    throw error;
  }
}

// Helper: POST to service endpoint
async function postService(path: string, body?: Record<string, unknown>): Promise<ServiceResponse> {
  return fetchJson<ServiceResponse>(`${getHttpBase()}${path}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Helper: GET from service endpoint
async function getService<T extends ServiceResponse = ServiceResponse>(path: string): Promise<T> {
  return fetchJson<T>(`${getHttpBase()}${path}`);
}

// Map RTK status to fix type number
const mapRtkStatusToFixType = (status?: string | null): number => {
  const normalized = (status ?? '').toUpperCase();
  switch (normalized) {
    case 'NO GPS':
    case 'NOGPS':
    case 'NO_SIGNAL':
      return 0;
    case 'NO FIX':
    case 'NOFIX':
      return 1;
    case '2D FIX':
    case '2D':
      return 2;
    case '3D FIX':
    case '3D':
    case 'GPS FIX':
    case 'GPS':
      return 3;
    case 'DGPS':
      return 4;
    case 'RTK FLOAT':
    case 'FLOAT':
      return 5;
    case 'RTK FIXED':
    case 'FIX':
      return 6;
    default:
      return 0;
  }
};

// Convert rover data to telemetry envelope
const toTelemetryEnvelopeFromRoverData = (data: any): TelemetryEnvelope | null => {
  if (!data || typeof data !== 'object') {
    // console.log('[ROVER_DATA] ❌ Invalid data received:', data);
    return null;
  }

  // console.log('[ROVER_DATA] 🔍 Raw data received:', JSON.stringify(data, null, 2));

  const envelope: Partial<TelemetryEnvelope> = {
    timestamp: Date.now(),
  };
  let touched = false;

  // State
  if (data.mode || data.status || data.last_heartbeat != null) {
    const status = typeof data.status === 'string' ? data.status : 'UNKNOWN';
    envelope.state = {
      armed: String(status).toLowerCase() === 'armed',
      mode: typeof data.mode === 'string' ? data.mode : 'UNKNOWN',
      system_status: status.toUpperCase(),
      heartbeat_ts:
        typeof data.last_heartbeat === 'number'
          ? Math.floor(data.last_heartbeat * 1000)
          : Date.now(),
    };
    touched = true;
  }

  // Global position
  if (data.position && typeof data.position === 'object') {
    let { lat, lng } = data.position as { lat?: number | string; lng?: number | string };
    const latNum = typeof lat === 'string' ? parseFloat(lat) : lat;
    const lngNum = typeof lng === 'string' ? parseFloat(lng) : lng;
    const hasValidLat = typeof latNum === 'number' && isFinite(latNum) && latNum !== 0;
    const hasValidLng = typeof lngNum === 'number' && isFinite(lngNum) && lngNum !== 0;

    if (hasValidLat && hasValidLng) {
      let velCandidate: number | undefined;
      if (typeof data.vel === 'number') velCandidate = data.vel;
      else if (typeof data.velocity === 'number') velCandidate = data.velocity;
      else if (typeof data.speed === 'number') velCandidate = data.speed;
      else if (typeof data.groundspeed === 'number') velCandidate = data.groundspeed;

      // Extract satellites from multiple possible field names - only update if data exists
      let satelliteCount: number | undefined;

      if (typeof data.satellites_visible === 'number') satelliteCount = data.satellites_visible;
      else if (typeof data.satellites === 'number') satelliteCount = data.satellites;
      else if (typeof data.numSatellites === 'number') satelliteCount = data.numSatellites;
      else if (typeof data.gps_satellites === 'number') satelliteCount = data.gps_satellites;
      else if (typeof data.num_satellites === 'number') satelliteCount = data.num_satellites;
      else if (typeof data.sats === 'number') satelliteCount = data.sats;

      envelope.global = {
        lat: latNum,
        lon: lngNum,
        alt_rel: 0,
        vel: typeof velCandidate === 'number' && isFinite(velCandidate) ? velCandidate : 0,
        ...(satelliteCount !== undefined && { satellites_visible: satelliteCount }),
      };
      touched = true;
    }
  }

  // Battery
  // console.log('[ROVER_DATA] 🔋 Battery fields check:', {
  //   battery: data.battery,
  //   voltage: data.voltage,
  //   current: data.current,
  //   battery_percentage: data.battery_percentage,
  //   // Backend might send nested battery data
  //   battery_data: data.battery_data,
  //   pct: data.pct,  // Backend sends 'pct' for percentage
  //   volt: data.volt  // Backend sends 'volt' for voltage
  // });

  // Handle multiple battery data formats
  let batteryPercentage = 0;
  let batteryVoltage = 0;
  let batteryCurrent = 0;

  if (typeof data.battery === 'number') batteryPercentage = data.battery;
  else if (typeof data.pct === 'number') batteryPercentage = data.pct;  // Backend sends 'pct'
  else if (typeof data.battery_percentage === 'number') batteryPercentage = data.battery_percentage;

  if (typeof data.voltage === 'number') batteryVoltage = data.voltage;
  else if (typeof data.volt === 'number') batteryVoltage = data.volt;  // Backend might send 'volt'

  if (typeof data.current === 'number') batteryCurrent = data.current;

  if (batteryPercentage > 0 || batteryVoltage > 0 || batteryCurrent !== 0) {
    envelope.battery = {
      percentage: batteryPercentage,
      voltage: batteryVoltage,
      current: batteryCurrent,
    };
    // console.log('[ROVER_DATA] ✅ Battery parsed:', envelope.battery);
    touched = true;
  } else {
    // console.log('[ROVER_DATA] ❌ No battery data found');
  }

  // HRMS / VRMS / IMU
  if (data.hrms != null) {
    envelope.hrms = typeof data.hrms === 'number' ? data.hrms : parseFloat(data.hrms) || 0;
    touched = true;
  }
  if (data.vrms != null) {
    envelope.vrms = typeof data.vrms === 'number' ? data.vrms : parseFloat(data.vrms) || 0;
    touched = true;
  }
  if (data.imu_status != null || data.imuStatus != null) {
    const s = data.imu_status ?? data.imuStatus;
    envelope.imu_status = typeof s === 'string' ? s : String(s);
    touched = true;
  }

  // RTK
  // console.log('[ROVER_DATA] 📡 RTK fields check:', {
  //   rtk_status: data.rtk_status,
  //   fix_type: data.fix_type,
  //   rtk_fix_type: data.rtk_fix_type,
  //   gps_fix_type: data.gps_fix_type
  // });

  if (data.rtk_status || data.fix_type != null || data.rtk_fix_type != null) {
    let fixType = 0;
    if (typeof data.rtk_fix_type === 'number') {
      fixType = data.rtk_fix_type;
    } else if (typeof data.fix_type === 'number') {
      fixType = data.fix_type;
    } else if (typeof data.gps_fix_type === 'number') {
      fixType = data.gps_fix_type;
    } else if (data.rtk_status) {
      fixType = mapRtkStatusToFixType(data.rtk_status);
    }

    envelope.rtk = {
      fix_type: fixType,
      baseline_age:
        typeof data.rtk_baseline_age === 'number'
          ? data.rtk_baseline_age
          : typeof data.baseline_age === 'number'
            ? data.baseline_age
            : 0,
      base_linked:
        typeof data.rtk_base_linked === 'boolean'
          ? data.rtk_base_linked
          : typeof data.base_linked === 'boolean'
            ? data.base_linked
            : fixType >= 5,
    };
    // console.log('[ROVER_DATA] ✅ RTK parsed:', envelope.rtk);
    touched = true;
  } else {
    // console.log('[ROVER_DATA] ❌ No RTK data found');
  }

  // Mission
  const activeIndex =
    typeof data.activeWaypointIndex === 'number' && data.activeWaypointIndex >= 0
      ? data.activeWaypointIndex
      : null;
  const completedCount = Array.isArray(data.completedWaypointIds)
    ? data.completedWaypointIds.length
    : 0;
  const currentWp = activeIndex != null ? activeIndex + 1 : 0;
  const inferredTotal = Math.max(
    currentWp,
    completedCount,
    typeof data.current_waypoint_id === 'number' ? data.current_waypoint_id : 0,
  );

  if (activeIndex != null || completedCount > 0) {
    const total = inferredTotal || (currentWp > 0 ? currentWp : completedCount);
    const progress = total > 0 ? (currentWp / total) * 100 : 0;
    envelope.mission = {
      total_wp: total,
      current_wp: currentWp,
      status: currentWp > 0 ? 'ACTIVE' : 'IDLE',
      progress_pct: progress,
    };
    touched = true;
  }

  // Servo output
  if (data.servo_output && typeof data.servo_output === 'object') {
    const servoOutput = data.servo_output;
    const servoPwmValues: Partial<ServoStatus> = {
      servo_id: 0,
      active: false,
      last_command_ts: 0,
    };

    if (Array.isArray(servoOutput.channels)) {
      servoPwmValues.pwm_values = servoOutput.channels;
      for (let i = 1; i <= 16; i++) {
        const key = `servo${i}_pwm` as keyof ServoStatus;
        if (servoOutput[key] !== undefined) {
          (servoPwmValues as any)[key] = servoOutput[key];
        }
      }
    }

    envelope.servo = servoPwmValues as ServoStatus;
    touched = true;
  }

  // Network
  if (data.network && typeof data.network === 'object') {
    const network = data.network;
    envelope.network = {
      connection_type: network.connection_type || 'none',
      wifi_signal_strength:
        typeof network.wifi_signal_strength === 'number' ? network.wifi_signal_strength : 0,
      wifi_rssi: typeof network.wifi_rssi === 'number' ? network.wifi_rssi : -100,
      interface: network.interface || '',
      wifi_connected: Boolean(network.wifi_connected),
      lora_connected: Boolean(network.lora_connected),
    };
    touched = true;
  }

  // Heading
  if (typeof data.heading === 'number' && isFinite(data.heading)) {
    const yaw = ((data.heading % 360) + 360) % 360;
    (envelope as any).attitude = { yaw_deg: yaw };
    touched = true;
  }

  return touched ? (envelope as TelemetryEnvelope) : null;
};

// Convert bridge telemetry to envelope
const toTelemetryEnvelopeFromBridge = (data: any): TelemetryEnvelope | null => {
  if (!data || typeof data !== 'object') {
    // console.log('[BRIDGE_DATA] ❌ Invalid data received:', data);
    return null;
  }

  // console.log('[BRIDGE_DATA] 🔍 Raw data received:', JSON.stringify(data, null, 2));

  const envelope: Partial<TelemetryEnvelope> = {
    timestamp: Date.now(),
  };
  let touched = false;

  // Handle mission_status events (this is where the actual GPS data is!)
  if (data.current_position || data.pixhawk_state) {
    // console.log('[BRIDGE_DATA] 🎯 Found mission_status with GPS data!');

    // Position data
    if (data.current_position && typeof data.current_position === 'object') {
      envelope.global = {
        lat: typeof data.current_position.lat === 'number' ? data.current_position.lat : 0,
        lon: typeof data.current_position.lng === 'number' ? data.current_position.lng : 0,
        alt_rel: typeof data.current_position.alt === 'number' ? data.current_position.alt : 0,
        vel: 0,
        // ✅ FIX: Do NOT default satellites_visible to 0; omit it so applyEnvelope preserves the existing count
      };
      // console.log('[BRIDGE_DATA] ✅ Position parsed from mission_status:', envelope.global);
      touched = true;
    }

    // Update satellites count if we have satellite data and position already exists
    if (typeof data.satellites === 'number' && envelope.global) {
      envelope.global.satellites_visible = data.satellites;
      touched = true;
    }

    // Pixhawk state data
    if (data.pixhawk_state && typeof data.pixhawk_state === 'object') {
      envelope.state = {
        armed: Boolean(data.pixhawk_state.armed),
        mode: typeof data.pixhawk_state.mode === 'string' ? data.pixhawk_state.mode : 'UNKNOWN',
        system_status: typeof data.pixhawk_state.system_status === 'string' ? data.pixhawk_state.system_status.toUpperCase() : 'UNKNOWN',
        heartbeat_ts: Date.now(),
      };
      touched = true;
    }

    // 🔍 DEBUG: Check if mission_status has battery or satellite data
    // console.log('[BRIDGE_DATA] 🔍 Checking for battery/satellite data in mission_status:', {
    //   battery: data.battery,
    //   voltage: data.voltage,
    //   current: data.current,
    //   satellites: data.satellites,
    //   sats: data.sats,
    //   fix_type: data.fix_type,
    //   rtk_fix_type: data.rtk_fix_type
    // });

    // 🔧 TEMPORARY FIX: Add dynamic mock battery/satellite data for testing
    // This should be removed when rover_data events start working
    // TEMPORARILY DISABLED TO TEST REAL rover_data EVENTS
    if (false && !data.battery && !data.voltage && !data.satellites) {
      // console.log('[BRIDGE_DATA] 🔧 Adding dynamic mock battery/satellite data for testing');

      // Generate dynamic values that change over time
      const now = Date.now();
      const batteryPercentage = 75 + Math.sin(now / 10000) * 15; // 60-90%
      const voltage = 12.0 + batteryPercentage / 100; // 12.0-12.9V
      const current = 1.5 + Math.sin(now / 8000) * 0.8; // 0.7-2.3A
      const satellites = Math.floor(6 + Math.abs(Math.sin(now / 5000)) * 6); // 6-12 satellites
      const fixType = Math.floor(Math.abs(Math.sin(now / 12000)) * 4) + 2; // 2-6 (2D fix to RTK fixed)

      // Ensure envelope.global exists before accessing it
      if (!envelope.global) {
        envelope.global = { ...DEFAULT_GLOBAL };
      }

      envelope.battery = {
        voltage: parseFloat(voltage.toFixed(1)),
        current: parseFloat(current.toFixed(1)),
        percentage: Math.floor(batteryPercentage)
      };
      envelope.global!.satellites_visible = satellites;
      envelope.rtk = {
        fix_type: fixType,
        baseline_age: 0,
        base_linked: fixType >= 5
      };
      touched = true;

      // console.log('[BRIDGE_DATA] 🔄 Dynamic mock data applied:', {
      //   battery: envelope.battery,
      //   satellites: envelope.global.satellites_visible,
      //   rtk: envelope.rtk
      // });
    }
  }

  if (data.position && typeof data.position === 'object') {
    envelope.global = {
      lat: typeof data.position.latitude === 'number' ? data.position.latitude : 0,
      lon: typeof data.position.longitude === 'number' ? data.position.longitude : 0,
      alt_rel: typeof data.position.altitude === 'number' ? data.position.altitude : 0,
      vel: 0,
      // ✅ FIX: Do NOT default satellites_visible to 0; omit it so applyEnvelope preserves the existing count
    };
    touched = true;
  }

  if (data.global && typeof data.global === 'object') {
    // ✅ FIX: Only include satellites_visible when satellite data actually exists in the message
    let satelliteCount: number | undefined;
    if (typeof data.global.satellites_visible === 'number') satelliteCount = data.global.satellites_visible;
    else if (typeof data.global.satellites === 'number') satelliteCount = data.global.satellites;
    else if (typeof data.global.numSatellites === 'number') satelliteCount = data.global.numSatellites;

    envelope.global = {
      lat: typeof data.global.latitude === 'number' ? data.global.latitude : envelope.global?.lat ?? 0,
      lon: typeof data.global.longitude === 'number' ? data.global.longitude : envelope.global?.lon ?? 0,
      alt_rel:
        typeof data.global.altitude === 'number' ? data.global.altitude : envelope.global?.alt_rel ?? 0,
      vel: typeof data.global.vel === 'number' ? data.global.vel : 0,
      ...(satelliteCount !== undefined && { satellites_visible: satelliteCount }),
    };
    touched = true;
  }

  if (data.rtk && typeof data.rtk === 'object') {
    envelope.rtk = {
      fix_type: typeof data.rtk.fix_type === 'number' ? data.rtk.fix_type : 0,
      baseline_age: typeof data.rtk.baseline_age === 'number' ? data.rtk.baseline_age : 0,
      base_linked: Boolean(data.rtk.base_linked),
    };
    touched = true;
  }

  if (data.battery && typeof data.battery === 'object') {
    envelope.battery = {
      voltage: typeof data.battery.voltage === 'number' ? data.battery.voltage : 0,
      current: typeof data.battery.current === 'number' ? data.battery.current : 0,
      percentage: typeof data.battery.percentage === 'number' ? data.battery.percentage : 0,
    };
    touched = true;
  }

  if (typeof data.hrms === 'number' || typeof data.hrms === 'string') {
    envelope.hrms = typeof data.hrms === 'number' ? data.hrms : parseFloat(data.hrms) || 0;
    touched = true;
  }
  if (typeof data.vrms === 'number' || typeof data.vrms === 'string') {
    envelope.vrms = typeof data.vrms === 'number' ? data.vrms : parseFloat(data.vrms) || 0;
    touched = true;
  }
  if (data.imu_status || data.imuStatus) {
    envelope.imu_status = data.imu_status ?? data.imuStatus;
    touched = true;
  }

  // New fields from Pixhawk NTUN (CurrentState) - top level telemetry
  if (typeof data.wp_dist_cm === 'number') {
    envelope.wp_dist_cm = data.wp_dist_cm;
    touched = true;
  }
  if (typeof data.xtrack_cm === 'number') {
    envelope.xtrack_cm = data.xtrack_cm;
    touched = true;
  }
  if (typeof data.wp_brg === 'number') {
    envelope.wp_brg = data.wp_brg;
    touched = true;
  }
  if (typeof data.position_error_cm === 'number') {
    envelope.position_error_cm = data.position_error_cm;
    touched = true;
  }

  if (data.mission && typeof data.mission === 'object') {
    envelope.mission = {
      total_wp: typeof data.mission.total_wp === 'number' ? data.mission.total_wp : 0,
      current_wp: typeof data.mission.current_wp === 'number' ? data.mission.current_wp : 0,
      status: typeof data.mission.status === 'string' ? data.mission.status : 'IDLE',
      progress_pct: typeof data.mission.progress_pct === 'number' ? data.mission.progress_pct : 0,
    };
    touched = true;
  }

  // GPS Failsafe data parsing - handle both nested object and flat fields
  if (data.gps_failsafe && typeof data.gps_failsafe === 'object') {
    // Nested object format with new fields: wp_dist_cm, xtrack_cm, wp_brg, etc.
    (envelope as any).gps_failsafe = {
      mode: data.gps_failsafe.mode || 'disable',
      triggered: Boolean(data.gps_failsafe.triggered),
      reason: data.gps_failsafe.reason,
      fix_type: typeof data.gps_failsafe.fix_type === 'number' ? data.gps_failsafe.fix_type : undefined,
      wp_dist_cm: typeof data.gps_failsafe.wp_dist_cm === 'number' ? data.gps_failsafe.wp_dist_cm : 0,
      xtrack_cm: typeof data.gps_failsafe.xtrack_cm === 'number' ? data.gps_failsafe.xtrack_cm : undefined,
      wp_brg: typeof data.gps_failsafe.wp_brg === 'number' ? data.gps_failsafe.wp_brg : undefined,
      requires_ack: Boolean(data.gps_failsafe.requires_ack),
      servo_suppressed: Boolean(data.gps_failsafe.servo_suppressed),
      action: data.gps_failsafe.action,
      timestamp: data.gps_failsafe.timestamp,
    };
    touched = true;
    // console.log('[useRoverTelemetry] 🛡️ GPS Failsafe data parsed (nested):', (envelope as any).gps_failsafe);
  } else if (data.gps_failsafe_mode !== undefined || data.wp_dist_cm !== undefined) {
    // Flat fields format with new fields
    (envelope as any).gps_failsafe = {
      mode: data.gps_failsafe_mode || 'disable',
      triggered: Boolean(data.gps_failsafe_triggered),
      reason: data.gps_failsafe_reason,
      fix_type: typeof data.fix_type === 'number' ? data.fix_type : undefined,
      wp_dist_cm: typeof data.wp_dist_cm === 'number' ? data.wp_dist_cm : 0,
      xtrack_cm: typeof data.xtrack_cm === 'number' ? data.xtrack_cm : undefined,
      wp_brg: typeof data.wp_brg === 'number' ? data.wp_brg : undefined,
      requires_ack: Boolean(data.gps_failsafe_requires_ack),
      servo_suppressed: Boolean(data.gps_failsafe_servo_suppressed),
      action: data.gps_failsafe_action,
      timestamp: data.gps_failsafe_timestamp,
    };
    touched = true;
    // console.log('[useRoverTelemetry] 🛡️ GPS Failsafe data parsed (flat fields):', (envelope as any).gps_failsafe);
  }

  return touched ? (envelope as TelemetryEnvelope) : null;
};

interface MutableTelemetry {
  telemetry: RoverTelemetry;
  lastEnvelopeTs: number | null;
}

export interface RoverServices {
  armVehicle: () => Promise<ServiceResponse>;
  disarmVehicle: () => Promise<ServiceResponse>;
  setMode: (mode: string) => Promise<ServiceResponse>;
  uploadMission: (waypoints: Waypoint[]) => Promise<ServiceResponse>;
  loadMissionToController: (waypoints: Waypoint[], servoConfig?: any) => Promise<ServiceResponse>;
  downloadMission: () => Promise<ServiceResponse & { waypoints?: Waypoint[] }>;
  clearMission: () => Promise<ServiceResponse>;
  setCurrentWaypoint: (wpSeq: number) => Promise<ServiceResponse>;
  pauseMission: () => Promise<ServiceResponse>;
  resumeMission: () => Promise<ServiceResponse>;
  startMission: () => Promise<ServiceResponse>;
  stopMission: () => Promise<ServiceResponse>;
  restartMission: () => Promise<ServiceResponse>;
  nextMission: () => Promise<ServiceResponse>;
  skipMission: () => Promise<ServiceResponse>;
  bulkSkipRange: (skipFrom: number, skipTo: number) => Promise<ServiceResponse>;
  getMissionStatus: () => Promise<ServiceResponse>;
  resumeFailsafeMission: () => Promise<ServiceResponse>;
  restartFailsafeMission: () => Promise<ServiceResponse>;
  requestMissionLogs: () => Promise<ServiceResponse>;
  updateMissionParameters: (params: {
    mission_timeout?: number;
    accuracy_threshold_mm?: number;
    fallback_zone_timeout_seconds?: number;
  }) => Promise<ServiceResponse>;
  updateObstacleZones: (zones: {
    warning_min_mm?: number;
    warning_max_mm?: number;
    danger_min_mm?: number;
    danger_max_mm?: number;
  }) => Promise<ServiceResponse>;
  setObstacleDetection: (enabled: boolean) => Promise<ServiceResponse>;

  // Emergency & Manual Control
  emergencyStop: () => Promise<ServiceResponse>;
  sendManualControl: (command: any) => Promise<ServiceResponse>;
  stopManualControl: () => Promise<ServiceResponse>;

  // Activity & Logging
  getActivityLogs: () => Promise<ServiceResponse>;
  getActivityTypes: () => Promise<ServiceResponse>;
  downloadActivityLogs: () => Promise<ServiceResponse>;

  // System Status
  getNodes: () => Promise<ServiceResponse>;
  getNodeDetails: (nodeName: string) => Promise<ServiceResponse>;
  getServoStatus: () => Promise<ServiceResponse>;

  // Legacy RTK methods (deprecated)
  injectRTK: (ntripUrl: string) => Promise<ServiceResponse>;
  stopRTK: () => Promise<ServiceResponse>;

  // New RTK methods per documentation
  startNTRIPStream: (params: import('../types/rtk').NTRIPStartParams) => Promise<import('../types/rtk').NTRIPStartResponse>;
  stopNTRIPStream: () => Promise<import('../types/rtk').NTRIPStopResponse>;
  startLoRaStream: () => Promise<import('../types/rtk').LoRaStartResponse>;
  stopLoRaStream: () => Promise<import('../types/rtk').LoRaStopResponse>;
  stopAllRTKStreams: () => Promise<import('../types/rtk').RTKStopAllResponse>;
  getRTKStatus: () => Promise<import('../types/rtk').RTKStatusResponse>;

  // Legacy LoRa Socket.IO methods (keeping for compatibility)
  startLoraRTKStream: () => Promise<ServiceResponse>;
  stopLoraRTKStream: () => Promise<ServiceResponse>;
  getLoraRTKStatus: () => Promise<ServiceResponse>;
  onLoraRTKStatus: (cb: (status: LoraRTKStatus) => void) => () => void;
  onUploadProgress: (cb: (progress: { percent: number; message?: string }) => void) => () => void;
  onDownloadProgress: (cb: (progress: { percent: number; message?: string }) => void) => () => void;
  controlServo: (servoId: number, angle: number) => Promise<ServiceResponse>;
  getTTSStatus: () => Promise<ServiceResponse & { enabled?: boolean; engine?: string; language?: string }>;
  controlTTS: (enabled: boolean) => Promise<ServiceResponse & { enabled?: boolean }>;
  testTTS: (message?: string) => Promise<ServiceResponse>;
  setTTSLanguage: (language: string) => Promise<ServiceResponse>;
  getTTSGender: () => Promise<ServiceResponse & { gender?: string }>;
  setTTSGender: (gender: 'male' | 'female') => Promise<ServiceResponse>;
  getMissionServoConfig: () => Promise<ServiceResponse & {
    servo_channel?: number;
    servo_pwm_on?: number;
    servo_pwm_off?: number;
    servo_delay_before?: number;
    servo_spray_duration?: number;
    servo_delay_after?: number;
    servo_enabled?: boolean;
  }>;
  updateMissionServoConfig: (config: any) => Promise<ServiceResponse>;
  testMissionServoConfig: (config: any) => Promise<ServiceResponse & { status?: string }>;

  // LED Controller
  setLEDController: (enabled: boolean) => Promise<ServiceResponse>;
  getLEDControllerStatus: () => Promise<ServiceResponse & { enabled?: boolean; state?: string; hardware_available?: boolean }>;
}

export interface UseRoverTelemetryResult {
  telemetry: RoverTelemetry;
  roverPosition: { lat: number; lng: number; timestamp: number } | null;
  connectionState: ConnectionState;
  reconnect: () => void;
  services: RoverServices;
  onMissionEvent: (callback: (event: MissionEventData) => void) => () => void;
  /** Raw Socket.IO client for real-time control/diagnostics */
  socket: Socket | null;
}

/**
 * Main Hook: useRoverTelemetry
 * 
 * Manages Socket.IO connection and telemetry updates
 */
export function useRoverTelemetry(): UseRoverTelemetryResult {
  const [telemetrySnapshot, setTelemetrySnapshot] = useState<RoverTelemetry>(
    createDefaultTelemetry,
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');

  const socketRef = useRef<Socket | null>(null);
  const manualDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef<number>(INITIAL_BACKOFF_MS);
  const connectDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missionEventCallbackRef = useRef<((event: MissionEventData) => void)[]>([]);
  const loraStatusCallbackRef = useRef<((status: LoraRTKStatus) => void)[]>([]);
  const uploadProgressCallbackRef = useRef<((progress: { percent: number; message?: string }) => void)[]>([]);
  const downloadProgressCallbackRef = useRef<((progress: { percent: number; message?: string }) => void)[]>([]);
  const mutableRef = useRef<MutableTelemetry>({
    telemetry: createDefaultTelemetry(),
    lastEnvelopeTs: null,
  });
  const lastDispatchRef = useRef<number>(0);
  const lastMissionStatusRef = useRef<string>('');
  const pendingDispatchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missionStatusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gpsFixTypeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStableFixTypeRef = useRef<number>(0);
  const hrmsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStableHrmsRef = useRef<number>(0);
  const vrmsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStableVrmsRef = useRef<number>(0);
  const satellitesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStableSatellitesRef = useRef<number>(0);
  const connectSocketRef = useRef<() => void>(() => { });
  const mountedRef = useRef(true);

  // Reset telemetry to default
  const resetTelemetry = useCallback(() => {
    const defaultTelemetry = createDefaultTelemetry();
    mutableRef.current.telemetry = defaultTelemetry;
    mutableRef.current.lastEnvelopeTs = null;
    setTelemetrySnapshot(defaultTelemetry);
    console.log('[useRoverTelemetry] Telemetry reset to default');
  }, []);

  // Apply telemetry envelope
  const applyEnvelope = useCallback((envelope: TelemetryEnvelope) => {
    if (!mountedRef.current) return;

    const mutable = mutableRef.current;
    const next = { ...mutable.telemetry };

    if (envelope.state) {
      next.state = { ...next.state, ...envelope.state };
    }
    if (envelope.global) {
      // Only update satellites if data is present in this message
      if (envelope.global.satellites_visible !== undefined) {
        next.global = { ...next.global, ...envelope.global };
      } else {
        // Preserve existing satellite count when no satellite data in message
        const { satellites_visible, ...globalWithoutSats } = envelope.global;
        next.global = { ...next.global, ...globalWithoutSats };
      }
    }
    if (envelope.battery) {
      next.battery = { ...next.battery, ...envelope.battery };
    }
    if (envelope.rtk) {
      // ✅ TEMPORARILY DISABLED DEBOUNCING: For debugging, update immediately
      const newFixType = envelope.rtk.fix_type;
      // console.log('[TELEMETRY] 📡 Processing RTK fix_type update:', newFixType);

      // Update immediately for debugging
      next.rtk = { ...next.rtk, ...envelope.rtk };
      // console.log('[TELEMETRY] ✅ RTK fix_type updated immediately:', next.rtk.fix_type);
    }
    if (envelope.mission) {
      next.mission = { ...next.mission, ...envelope.mission };
    }
    if (envelope.servo) {
      next.servo = { ...next.servo, ...envelope.servo };
    }
    if (envelope.network) {
      next.network = { ...next.network, ...envelope.network };
    }
    // ✅ HRMS DEBOUNCING: Prevent color flickering on accuracy changes
    // Only debounce flicker between two non-zero values; apply 0→nonzero immediately
    if ((envelope as any).hrms !== undefined) {
      const newHrms = (envelope as any).hrms;
      const currentHrms = (mutable.telemetry as any).hrms;

      if (newHrms !== currentHrms) {
        // If current value is 0 (initial/stale), apply new real value immediately
        if (currentHrms === 0 || newHrms === 0) {
          if (hrmsDebounceRef.current) {
            clearTimeout(hrmsDebounceRef.current);
            hrmsDebounceRef.current = null;
          }
          (next as any).hrms = newHrms;
          lastStableHrmsRef.current = newHrms;
        } else {
          // Both values are non-zero: debounce to avoid flickering
          if (hrmsDebounceRef.current) {
            clearTimeout(hrmsDebounceRef.current);
          }
          hrmsDebounceRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            lastStableHrmsRef.current = newHrms;
            const debouncedNext = { ...mutableRef.current.telemetry };
            (debouncedNext as any).hrms = newHrms;
            mutableRef.current.telemetry = debouncedNext;
            mutableRef.current.lastEnvelopeTs = Date.now();
            setTelemetrySnapshot(debouncedNext);
            hrmsDebounceRef.current = null;
          }, 500); // 500ms debounce
          // Keep current stable value until debounce completes
          (next as any).hrms = currentHrms;
        }
      } else {
        (next as any).hrms = newHrms;
      }
    }

    // ✅ VRMS DEBOUNCING: Prevent color flickering on accuracy changes
    // Only debounce flicker between two non-zero values; apply 0→nonzero immediately
    if ((envelope as any).vrms !== undefined) {
      const newVrms = (envelope as any).vrms;
      const currentVrms = (mutable.telemetry as any).vrms;

      if (newVrms !== currentVrms) {
        // If current value is 0 (initial/stale), apply new real value immediately
        if (currentVrms === 0 || newVrms === 0) {
          if (vrmsDebounceRef.current) {
            clearTimeout(vrmsDebounceRef.current);
            vrmsDebounceRef.current = null;
          }
          (next as any).vrms = newVrms;
          lastStableVrmsRef.current = newVrms;
        } else {
          // Both values are non-zero: debounce to avoid flickering
          if (vrmsDebounceRef.current) {
            clearTimeout(vrmsDebounceRef.current);
          }
          vrmsDebounceRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            lastStableVrmsRef.current = newVrms;
            const debouncedNext = { ...mutableRef.current.telemetry };
            (debouncedNext as any).vrms = newVrms;
            mutableRef.current.telemetry = debouncedNext;
            mutableRef.current.lastEnvelopeTs = Date.now();
            setTelemetrySnapshot(debouncedNext);
            vrmsDebounceRef.current = null;
          }, 500); // 500ms debounce
          // Keep current stable value until debounce completes
          (next as any).vrms = currentVrms;
        }
      } else {
        (next as any).vrms = newVrms;
      }
    }
    if ((envelope as any).imu_status !== undefined) {
      (next as any).imu_status = (envelope as any).imu_status;
    }
    if ((envelope as any).attitude) {
      next.attitude = { ...(next.attitude || {}), ...(envelope as any).attitude } as any;
    }
    // New fields from Pixhawk NTUN (CurrentState)
    if (envelope.wp_dist_cm !== undefined) {
      next.wp_dist_cm = envelope.wp_dist_cm;
    }
    if (envelope.xtrack_cm !== undefined) {
      next.xtrack_cm = envelope.xtrack_cm;
    }
    if (envelope.wp_brg !== undefined) {
      next.wp_brg = envelope.wp_brg;
    }
    if (envelope.position_error_cm !== undefined) {
      next.position_error_cm = envelope.position_error_cm;
    }

    next.lastMessageTs = envelope.timestamp ?? Date.now();

    // Shallow equality check to detect actual changes
    const prev = mutable.telemetry;
    let changed = false;
    const shallowEqual = (a: any, b: any): boolean => {
      if (a === b) return true;
      if (!a || !b) return false;
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length) return false;
      for (const k of aKeys) {
        if (a[k] !== b[k]) return false;
      }
      return true;
    };

    if (envelope.state) changed = changed || !shallowEqual(prev.state, next.state);
    if (envelope.global) changed = changed || !shallowEqual(prev.global, next.global);
    if (envelope.battery) changed = changed || !shallowEqual(prev.battery, next.battery);
    if (envelope.rtk) changed = changed || !shallowEqual(prev.rtk, next.rtk);
    if (envelope.mission) changed = changed || !shallowEqual(prev.mission, next.mission);
    if (envelope.servo) changed = changed || !shallowEqual(prev.servo, next.servo);
    if (envelope.network) changed = changed || !shallowEqual(prev.network, next.network);
    if ((envelope as any).hrms !== undefined) changed = changed || (prev as any).hrms !== (next as any).hrms;
    if ((envelope as any).vrms !== undefined) changed = changed || (prev as any).vrms !== (next as any).vrms;
    if ((envelope as any).imu_status !== undefined) changed = changed || (prev as any).imu_status !== (next as any).imu_status;
    if ((envelope as any).attitude) changed = changed || !shallowEqual((prev as any).attitude, (next as any).attitude);
    // New fields from Pixhawk NTUN
    if (envelope.wp_dist_cm !== undefined) changed = changed || prev.wp_dist_cm !== next.wp_dist_cm;
    if (envelope.xtrack_cm !== undefined) changed = changed || prev.xtrack_cm !== next.xtrack_cm;
    if (envelope.wp_brg !== undefined) changed = changed || prev.wp_brg !== next.wp_brg;
    if (envelope.position_error_cm !== undefined) changed = changed || prev.position_error_cm !== next.position_error_cm;

    if (!changed) {
      // No meaningful change; update timestamps but skip dispatch to prevent loops
      // Reduced logging - only log occasionally
      if (TELEMETRY_LOGS_ENABLED && Math.random() < 0.05) telemLog('[TELEMETRY] No change detected');
      mutable.lastEnvelopeTs = Date.now();
      return;
    }

    // ✅ CRITICAL FIX: Update mutable ref immediately
    // telemLog('[TELEMETRY] ✅ Change detected, updating UI');
    mutable.telemetry = next;
    mutable.lastEnvelopeTs = Date.now();

    const now = performance.now();
    const elapsed = now - lastDispatchRef.current;

    // ✅ CRITICAL FIX: Check if we already have a pending dispatch to prevent accumulation
    if (pendingDispatchRef.current) {
      // Already have a pending update scheduled, just update the ref
      // The pending timeout will pick up the latest data when it fires
      return;
    }

    // ✅ Throttle UI updates to prevent excessive re-renders
    if (elapsed >= THROTTLE_MS) {
      lastDispatchRef.current = now;
      // Only update if component is still mounted
      if (mountedRef.current) {
        // Deep copy to ensure React sees a new reference at all levels
        const snapshot = JSON.parse(JSON.stringify(next));
        // telemLog('[TELEMETRY] UI updated immediately', snapshot);
        setTelemetrySnapshot(snapshot);
      }
    } else {
      // Schedule update only if not already scheduled (using a flag to prevent re-entry)
      const delay = THROTTLE_MS - elapsed;
      // telemLog(`[TELEMETRY] UI update scheduled in ${delay}ms`);
      const timeoutId = setTimeout(() => {
        // Double-check the timeout hasn't been cleared
        if (pendingDispatchRef.current === timeoutId) {
          pendingDispatchRef.current = null; // Clear FIRST to prevent race conditions
          if (mountedRef.current) {
            lastDispatchRef.current = performance.now();
            // Deep copy to ensure React sees a new reference at all levels
            const snapshot = JSON.parse(JSON.stringify(mutableRef.current.telemetry));
            // telemLog('[TELEMETRY] UI updated (scheduled)', snapshot);
            setTelemetrySnapshot(snapshot);
          }
        }
      }, delay);
      pendingDispatchRef.current = timeoutId;
    }
  }, []); // ✅ Empty dependency array - this function is stable and uses refs for all external values

  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const teardownSocket = useCallback(() => {
    clearReconnectTimer();

    if (connectDelayRef.current) {
      clearTimeout(connectDelayRef.current);
      connectDelayRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (socketRef.current) {
      manualDisconnectRef.current = true;
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      setTimeout(() => {
        manualDisconnectRef.current = false;
      }, 0);
      socketRef.current = null;
    }

    if (pendingDispatchRef.current) {
      clearTimeout(pendingDispatchRef.current);
      pendingDispatchRef.current = null;
    }

    const defaultTelemetry = createDefaultTelemetry();
    mutableRef.current.telemetry = defaultTelemetry;
    mutableRef.current.lastEnvelopeTs = null;
    setTelemetrySnapshot(defaultTelemetry);
  }, [clearReconnectTimer]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      return;
    }
    const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      backoffRef.current = Math.min(Math.floor(backoffRef.current * 1.5), MAX_BACKOFF_MS);
      connectSocketRef.current();
    }, delay);
  }, []);

  const applyEnvelopeRef = useRef(applyEnvelope);

  useEffect(() => {
    applyEnvelopeRef.current = applyEnvelope;
  }, [applyEnvelope]);

  // ✅ CRITICAL FIX: Use refs for socket handlers to prevent infinite loops
  // These handlers are defined ONCE and use refs internally to access latest state
  const handleBridgeTelemetry = useRef((payload: any) => {
    // console.log('[BRIDGE_DATA] 📡 RAW PAYLOAD RECEIVED:', JSON.stringify(payload, null, 2));
    // Reduced logging - only log periodically (10% of the time)
    // if (TELEMETRY_LOGS_ENABLED && Math.random() < 0.1) telemLog('[TELEMETRY] Receiving bridge data...');
    const envelope = toTelemetryEnvelopeFromBridge(payload);
    if (envelope) {
      applyEnvelopeRef.current(envelope);
    }
  });

  const handleRoverData = useRef((payload: any) => {
    // console.log('[ROVER_DATA] 🚨 handleRoverData CALLED!');
    // console.log('[ROVER_DATA] 📡 RAW PAYLOAD RECEIVED:', JSON.stringify(payload, null, 2));
    // Reduced logging - only log periodically (10% of the time)
    // if (TELEMETRY_LOGS_ENABLED && Math.random() < 0.1) telemLog('[ROVER_DATA] Receiving data...');
    const envelope = toTelemetryEnvelopeFromRoverData(payload);
    if (envelope) {
      applyEnvelopeRef.current(envelope);
    }
  });

  const handleLoraRTKStatus = useRef((payload: LoraRTKStatus) => {
    try {
      loraStatusCallbackRef.current.forEach((cb) => cb(payload));

      // Update network lora_connected flag when provided
      if (payload && typeof payload.is_connected === 'boolean') {
        const envelope: TelemetryEnvelope = {
          timestamp: Date.now(),
          network: {
            ...(mutableRef.current.telemetry.network || DEFAULT_NETWORK),
            lora_connected: Boolean(payload.is_connected),
          },
        } as any;
        applyEnvelopeRef.current(envelope);
      }
    } catch (err) {
      console.error('[LORA_RTK_STATUS] Error:', err);
    }
  });

  const connectSocket = useCallback(() => {
    teardownSocket();

    if (connectDelayRef.current) {
      clearTimeout(connectDelayRef.current);
    }

    setConnectionState('connecting');

    connectDelayRef.current = setTimeout(() => {
      connectDelayRef.current = null;

      if (!mountedRef.current) {
        return;
      }

      try {
        const backendUrl = getHttpBase();
        // console.log('[SOCKET] Connecting to:', backendUrl);
        // console.log('[SOCKET] Config:', SOCKET_CONFIG);

        const socket = io(backendUrl, SOCKET_CONFIG as Partial<ManagerOptions & SocketOptions>);
        socketRef.current = socket;

        socket.on('connect', () => {
          // console.log('[SOCKET] ✅ Connected - ID:', socket.id);
          // console.log('[SOCKET] Backend URL:', backendUrl);
          // console.log('[SOCKET] Transport:', socket.io.engine?.transport?.name || 'unknown');
          clearReconnectTimer();
          backoffRef.current = INITIAL_BACKOFF_MS;
          setConnectionState('connected');

          // 🔴 CRITICAL FIX: Subscribe to mission status updates on connect
          // console.log('[MISSION_STATUS] 📡 Subscribing to mission status updates');
          socket.emit('subscribe_mission_status');

          // 🔍 DEBUG: Request telemetry subscription 
          // console.log('[TELEMETRY] 📡 Requesting telemetry subscription');
          socket.emit('subscribe_telemetry');
          socket.emit('subscribe_rover_data');

          // 🔍 CRITICAL: Try different subscription patterns that backend might expect
          // console.log('[TELEMETRY] 🔍 Trying alternative subscription patterns');
          socket.emit('subscribe', { event: 'rover_data' });
          socket.emit('join', { room: 'telemetry' });
          socket.emit('join', { room: 'rover_data' });
          socket.emit('subscribe_to_telemetry');
          socket.emit('subscribe_to_rover_data');

          // 🔍 CRITICAL: Try HTTP API fallback for missing data
          // console.log('[TELEMETRY] 🌐 Trying HTTP API fallback for missing telemetry');
          setTimeout(async () => {
            try {
              // console.log('[TELEMETRY] 🌐 Making HTTP request to:', `${getHttpBase()}/api/telemetry`);
              const response = await fetch(`${getHttpBase()}/api/telemetry`);
              // console.log('[TELEMETRY] 🌐 HTTP response status:', response.status);

              if (response.ok) {
                const data = await response.json();
                // console.log('[TELEMETRY] 🌐 HTTP API fallback data received:', data);
                const envelope = toTelemetryEnvelopeFromBridge(data);
                if (envelope) {
                  // console.log('[TELEMETRY] 🌐 HTTP API telemetry parsed, applying to UI');
                  applyEnvelopeRef.current(envelope);
                }
              } else {
                // console.log('[TELEMETRY] 🌐 HTTP API response not OK:', response.status);
              }
            } catch (err) {
              // console.log('[TELEMETRY] 🌐 HTTP API fallback failed:', err);
            }

            // 🔍 Try alternative endpoints
            try {
              // console.log('[TELEMETRY] 🔍 Trying alternative endpoints');
              const endpoints = ['/api/rover/data', '/api/vehicle/telemetry', '/api/status', '/api/gps'];

              for (const endpoint of endpoints) {
                try {
                  const response = await fetch(`${getHttpBase()}${endpoint}`);
                  if (response.ok) {
                    const data = await response.json();
                    // console.log(`[TELEMETRY] 🔍 Alternative endpoint ${endpoint} data:`, data);
                    const envelope = toTelemetryEnvelopeFromBridge(data);
                    if (envelope) {
                      // console.log(`[TELEMETRY] 🔍 Alternative endpoint ${endpoint} worked!`);
                      applyEnvelopeRef.current(envelope);
                      break;
                    }
                  }
                } catch (err) {
                  // console.log(`[TELEMETRY] 🔍 Alternative endpoint ${endpoint} failed:`, err);
                }
              }
            } catch (err) {
              // console.log('[TELEMETRY] 🔍 Alternative endpoints check failed:', err);
            }
          }, 2000); // Try after 2 seconds

          // 🔍 DEBUG: Log ALL incoming events to see what backend is actually sending
          // socket.onAny((eventName, ...args) => {
          //   console.log('[SOCKET] 📨 ANY EVENT RECEIVED:', eventName, args);
          // });

          socket.emit('ping');
        });

        socket.on('pong', () => {
          // Pong received - connection alive
        });

        // 🔴 CRITICAL FIX: Handle mission status subscription confirmation
        socket.on('mission_status_subscribed', (data: any) => {
          console.log('[MISSION_STATUS] ✅ Subscription confirmed by backend', data);
        });

        socket.on('connect_error', (error: any) => {
          const backendUrl = getHttpBase();
          console.error('[SOCKET] Connection error:', error.message || error);
          console.error('[SOCKET] Backend URL:', backendUrl);
          console.error('[SOCKET] Error details:', {
            code: error.code,
            type: error.type,
            data: error.data,
            description: error.description,
          });

          // Provide user-friendly error messages
          if (error.code === 'ECONNREFUSED') {
            console.error('[SOCKET] ❌ Backend server is not running or not accessible');
          } else if (error.code === 'ETIMEDOUT') {
            console.error('[SOCKET] ❌ Connection timed out - backend may be overloaded or network issues');
          } else if (error.code === 'ENOTFOUND') {
            console.error('[SOCKET] ❌ DNS resolution failed - check IP address');
          } else {
            console.error('[SOCKET] ❌ Unknown connection error');
          }

          resetTelemetry();
          setConnectionState('error');
          scheduleReconnect();
        });

        socket.on('disconnect', (reason: any) => {
          console.warn('[SOCKET] Disconnected:', reason);
          if (manualDisconnectRef.current) {
            manualDisconnectRef.current = false;
            return;
          }
          resetTelemetry();
          setConnectionState('disconnected');
          if (reason === 'io server disconnect') {
            socket.connect();
          } else {
            scheduleReconnect();
          }
        });

        socket.on('error', (error: any) => {
          console.error('[SOCKET] Error:', error);
          setConnectionState('error');
        });

        socket.io.on('reconnect', (attempt: any) => {
          console.log('[SOCKET] Reconnected after', attempt, 'attempts');
          clearReconnectTimer();
          backoffRef.current = INITIAL_BACKOFF_MS;
          setConnectionState('connected');
        });

        socket.io.on('reconnect_attempt', () => {
          console.log('[SOCKET] Reconnecting...');
          setConnectionState('connecting');
        });

        socket.io.on('reconnect_error', (error: any) => {
          console.error('[SOCKET] Reconnect error:', error);
          setConnectionState('error');
        });

        socket.io.on('reconnect_failed', () => {
          console.error('[SOCKET] Reconnect failed');
          clearReconnectTimer();
          setConnectionState('error');
        });

        // ✅ CRITICAL: Register listeners using .current to prevent re-registration loops
        // console.log('[SOCKET] 🔌 Registering event listeners:', {
        //   TELEMETRY: SOCKET_EVENTS.TELEMETRY,
        //   ROVER_DATA: SOCKET_EVENTS.ROVER_DATA
        // });
        socket.on(SOCKET_EVENTS.TELEMETRY, handleBridgeTelemetry.current);
        socket.on(SOCKET_EVENTS.ROVER_DATA, handleRoverData.current);
        socket.on('lora_rtk_status', handleLoraRTKStatus.current);

        // 🔍 DEBUG: Add listeners for alternative event names
        // console.log('[SOCKET] 🔍 Adding listeners for alternative event names');
        socket.on('rover_data_telemetry', handleRoverData.current);
        socket.on('telemetry_data', handleBridgeTelemetry.current);
        socket.on('gps_data', handleRoverData.current);
        socket.on('battery_data', handleBridgeTelemetry.current);
        socket.on('satellite_data', handleBridgeTelemetry.current);
        socket.on('rtk_data', handleRoverData.current);
        socket.on('vehicle_telemetry', handleBridgeTelemetry.current);

        // console.log('[SOCKET] ✅ Event listeners registered successfully');

        // 🔍 DEBUG: Add catch-all listener to see all events
        // socket.onAny((eventName, ...args) => {
        //   console.log('[SOCKET] 📨 ANY EVENT RECEIVED:', eventName, args);
        //   if (eventName === 'rover_data') {
        //     console.log('[SOCKET] 🚨 rover_data event detected by onAny!');
        //   }
        // });

        // Mission events
        socket.on(SOCKET_EVENTS.MISSION_EVENT, (data: MissionEventData) => {
          console.log('[MISSION_EVENT]', data);
          missionEventCallbackRef.current.forEach((cb) => cb(data));
        });

        socket.on(SOCKET_EVENTS.MISSION_LOGS_SNAPSHOT, (data: any) => {
          console.log('[MISSION_LOGS_SNAPSHOT]', data);
          missionEventCallbackRef.current.forEach((cb) => cb(data as MissionEventData));
        });

        socket.on(SOCKET_EVENTS.SERVER_ACTIVITY, (activity: any) => {
          try {
            if (!activity) return;

            // 🔍 DEBUG: Check if server_activity contains telemetry data
            if (activity.message && activity.message.includes('rover_data')) {
              // console.log('[SERVER_ACTIVITY] 🔍 Found rover_data mention in activity:', activity);
            }

            // 🔍 DEBUG: Parse telemetry from server_activity if it contains nested data
            if (activity.telemetry || activity.data || activity.rover_data) {
              // console.log('[SERVER_ACTIVITY] 🎯 Found telemetry data in server_activity!');
              const telemetryData = activity.telemetry || activity.data || activity.rover_data;
              const envelope = toTelemetryEnvelopeFromBridge(telemetryData);
              if (envelope) {
                // console.log('[SERVER_ACTIVITY] ✅ Telemetry parsed from server_activity, applying to UI');
                applyEnvelopeRef.current(envelope);
              }
            }

            if (activity.event === 'mission' || activity.event === 'servo') {
              console.log('[SERVER_ACTIVITY]', activity);
              missionEventCallbackRef.current.forEach((cb) => cb(activity as MissionEventData));
            }
          } catch (err) {
            console.error('[SERVER_ACTIVITY] Error:', err);
          }
        });

        socket.on(SOCKET_EVENTS.MISSION_STATUS, (data: any) => {
          // Only log important events, skip routine telemetry updates
          const isImportantEvent = data.event_type || data.level === 'error' || data.level === 'warning' || data.level === 'success';

          if (isImportantEvent) {
            console.log('[MISSION_STATUS] Backend event:', {
              mission_state: data.mission_state,
              event_type: data.event_type,
              level: data.level,
              message: data.message,
            });
          }

          // 🔍 CRITICAL FIX: Parse GPS telemetry data from mission_status events!
          if (data.current_position || data.pixhawk_state) {
            // console.log('[MISSION_STATUS] 🎯 Parsing GPS data from mission_status event!');
            const envelope = toTelemetryEnvelopeFromBridge(data);
            if (envelope) {
              // console.log('[MISSION_STATUS] ✅ GPS telemetry parsed, applying to UI');
              applyEnvelopeRef.current(envelope);
            }
          }

          // Only log and update when mission status actually changes
          const statusKey = `${data.mission_state || data.mission_mode}-${data.current_waypoint}-${data.total_waypoints}`;
          if (statusKey !== lastMissionStatusRef.current) {
            // console.log('[MISSION_STATUS] State changed:', statusKey);
            lastMissionStatusRef.current = statusKey;

            // ✅ CRITICAL: Route through applyEnvelopeRef to respect throttling
            // This prevents render → effect → state → render loops
            const envelope: TelemetryEnvelope = {
              timestamp: Date.now(),
              mission: {
                total_wp: data.total_waypoints ?? 0,
                current_wp: data.current_waypoint ?? 0,
                status: data.mission_state || data.mission_mode || 'IDLE',
                progress_pct:
                  data.total_waypoints > 0
                    ? Math.round((data.current_waypoint / data.total_waypoints) * 100)
                    : 0,
              },
            };
            // Debounce rapid mission status updates to avoid cascades
            if (missionStatusDebounceRef.current) {
              clearTimeout(missionStatusDebounceRef.current);
            }
            missionStatusDebounceRef.current = setTimeout(() => {
              applyEnvelopeRef.current(envelope);
              missionStatusDebounceRef.current = null;
            }, 250);
          }

          try {
            missionEventCallbackRef.current.forEach((cb) => cb(data as any));
          } catch (err) {
            console.error('[MISSION_STATUS] Error:', err);
          }
        });

        socket.on(SOCKET_EVENTS.MISSION_ERROR, (data: { error: string }) => {
          console.error('[MISSION_ERROR]', data.error);
          missionEventCallbackRef.current.forEach((cb) =>
            cb({
              type: 'mission_error',
              message: data.error,
              timestamp: Date.now(),
            } as any),
          );
        });

        socket.on(SOCKET_EVENTS.MISSION_COMMAND_ACK, (data: { status: string; command: string }) => {
          console.log('[MISSION_COMMAND_ACK]', data);
          missionEventCallbackRef.current.forEach((cb) =>
            cb({
              type: 'mission_command_ack',
              message: `Command ${data.command} ${data.status}`,
              timestamp: Date.now(),
            } as any),
          );
        });

        socket.on(SOCKET_EVENTS.MISSION_CONTROLLER_STATUS, (data: { running: boolean; error?: string }) => {
          console.log('[MISSION_CONTROLLER_STATUS]', data);
          if (data.error) {
            console.error('[MISSION_CONTROLLER_ERROR]', data.error);
          }
        });

        // Mission progress events
        socket.on(SOCKET_EVENTS.MISSION_UPLOAD_PROGRESS, (data: { percent: number; message?: string }) => {
          console.log('[MISSION_UPLOAD_PROGRESS]', data);
          uploadProgressCallbackRef.current.forEach((cb) => cb(data));
        });

        socket.on(SOCKET_EVENTS.MISSION_DOWNLOAD_PROGRESS, (data: { percent: number; message?: string }) => {
          console.log('[MISSION_DOWNLOAD_PROGRESS]', data);
          downloadProgressCallbackRef.current.forEach((cb) => cb(data));
        });

        // Failsafe recovery events
        socket.on(SOCKET_EVENTS.FAILSAFE_RESUMED, (data: { message?: string; timestamp?: string }) => {
          console.log('[FAILSAFE_RESUMED]', data);
          missionEventCallbackRef.current.forEach((cb) =>
            cb({
              type: 'failsafe_resumed',
              message: data.message || 'Mission resumed after GPS failsafe',
              timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
              data: data,
            } as any),
          );
        });

        socket.on(SOCKET_EVENTS.FAILSAFE_RESTARTED, (data: { message?: string; timestamp?: string }) => {
          console.log('[FAILSAFE_RESTARTED]', data);
          missionEventCallbackRef.current.forEach((cb) =>
            cb({
              type: 'failsafe_restarted',
              message: data.message || 'Mission restarted after GPS failsafe',
              timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
              data: data,
            } as any),
          );
        });

        // 🚫 OBSTACLE DETECTION HANDLERS
        socket.on('obstacle_detection_changed', (data: { enabled: boolean }) => {
          console.log('[OBSTACLE_DETECTION] Detection toggled:', data.enabled ? 'ON' : 'OFF');
          missionEventCallbackRef.current.forEach((cb) =>
            cb({
              type: 'obstacle_detection_changed',
              message: `Obstacle detection ${data.enabled ? 'enabled' : 'disabled'}`,
              timestamp: Date.now(),
              data: data,
            } as any),
          );
        });

        socket.on('obstacle_error', (data: { error: string }) => {
          console.error('[OBSTACLE_ERROR]', data.error);
          missionEventCallbackRef.current.forEach((cb) =>
            cb({
              type: 'obstacle_error',
              message: `Obstacle detection error: ${data.error}`,
              timestamp: Date.now(),
              error: data.error,
            } as any),
          );
        });

        // 💡 LED CONTROLLER HANDLERS
        socket.on('led_controller_changed', (data: { enabled: boolean; timestamp: number }) => {
          console.log('[LED_CONTROLLER] State toggled:', data.enabled ? 'ON' : 'OFF');
          missionEventCallbackRef.current.forEach((cb) =>
            cb({
              type: 'led_controller_changed',
              message: `LED controller ${data.enabled ? 'enabled' : 'disabled'}`,
              timestamp: Date.now(),
              data: data,
            } as any),
          );
        });

        socket.on('led_error', (data: { message: string; timestamp: number }) => {
          console.error('[LED_ERROR]', data.message);
          missionEventCallbackRef.current.forEach((cb) =>
            cb({
              type: 'led_error',
              message: data.message || 'LED controller error',
              timestamp: Date.now(),
              data: data,
            } as any),
          );
        });

        // 🚨 EMERGENCY & MANUAL CONTROL HANDLERS
        socket.on('emergency_stop_ack', (data: any) => {
          console.log('[EMERGENCY_STOP] ✅ Acknowledged:', data);
          missionEventCallbackRef.current.forEach((cb) =>
            cb({
              type: 'emergency_stop',
              message: 'Emergency stop acknowledged',
              timestamp: Date.now(),
              data: data,
            } as any),
          );
        });

        socket.on('manual_control_error', (data: { error: string }) => {
          console.error('[MANUAL_CONTROL_ERROR]', data.error);
          missionEventCallbackRef.current.forEach((cb) =>
            cb({
              type: 'manual_control_error',
              message: `Manual control error: ${data.error}`,
              timestamp: Date.now(),
              error: data.error,
            } as any),
          );
        });

        socket.connect();

        const pingInterval = setInterval(() => {
          if (socket.connected) {
            socket.emit('ping');
          }
        }, 5000);

        pingIntervalRef.current = pingInterval;
      } catch (error) {
        console.error('[SOCKET] Initialization failed:', error);
        setConnectionState('error');
        scheduleReconnect();
      }
    }, 100);
    // ✅ CRITICAL: Removed handleBridgeTelemetry and handleRoverData from dependencies
    // They are now refs and won't cause re-registrations
  }, [clearReconnectTimer, resetTelemetry, scheduleReconnect, teardownSocket]);

  const reconnect = useCallback(() => {
    clearReconnectTimer();
    backoffRef.current = INITIAL_BACKOFF_MS;
    connectSocketRef.current();
  }, [clearReconnectTimer]);

  useEffect(() => {
    connectSocketRef.current = connectSocket;
  }, [connectSocket]);

  // Single initialization effect - no dependencies to prevent infinite loops
  useEffect(() => {
    mountedRef.current = true;
    connectSocketRef.current();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (connectDelayRef.current) {
        clearTimeout(connectDelayRef.current);
        connectDelayRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (gpsFixTypeDebounceRef.current) {
        clearTimeout(gpsFixTypeDebounceRef.current);
        gpsFixTypeDebounceRef.current = null;
      }
      if (hrmsDebounceRef.current) {
        clearTimeout(hrmsDebounceRef.current);
        hrmsDebounceRef.current = null;
      }
      if (vrmsDebounceRef.current) {
        clearTimeout(vrmsDebounceRef.current);
        vrmsDebounceRef.current = null;
      }
      if (satellitesDebounceRef.current) {
        clearTimeout(satellitesDebounceRef.current);
        satellitesDebounceRef.current = null;
      }
      if (missionStatusDebounceRef.current) {
        clearTimeout(missionStatusDebounceRef.current);
        missionStatusDebounceRef.current = null;
      }
      if (socketRef.current) {
        manualDisconnectRef.current = true;
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (pendingDispatchRef.current) {
        clearTimeout(pendingDispatchRef.current);
        pendingDispatchRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushStatePatch = useCallback(
    (patch: Partial<TelemetryState>) => {
      const baseState = mutableRef.current.telemetry.state;
      const envelope: TelemetryEnvelope = {
        timestamp: Date.now(),
        state: {
          ...baseState,
          ...patch,
          heartbeat_ts: patch.heartbeat_ts ?? Date.now(),
        },
      };
      applyEnvelopeRef.current(envelope);
    },
    [],
  );

  const services = useMemo<RoverServices>(
    () => ({
      armVehicle: async () => {
        const response = await postService(API_ENDPOINTS.ARM, { value: true });
        if (response.success) {
          pushStatePatch({ armed: true, system_status: 'ARMED' });
        }
        return response;
      },
      disarmVehicle: async () => {
        const response = await postService(API_ENDPOINTS.ARM, { value: false });
        if (response.success) {
          pushStatePatch({ armed: false, system_status: 'DISARMED' });
        }
        return response;
      },
      setMode: (mode: string) => postService(API_ENDPOINTS.SET_MODE, { mode }),
      uploadMission: (waypoints: Waypoint[]) => {
        const formattedWaypoints = waypoints.map((wp) => ({
          ...wp,
          lat: parseFloat(Number(wp.lat).toFixed(9)),
          lng: parseFloat(Number(wp.lng).toFixed(9)),
        }));
        console.log('[MISSION_UPLOAD] Waypoints:', formattedWaypoints);
        return postService(API_ENDPOINTS.MISSION_UPLOAD, { waypoints: formattedWaypoints });
      },
      loadMissionToController: (waypoints: Waypoint[], servoConfig?: any) => {
        const formattedWaypoints = waypoints.map((wp) => ({
          ...wp,
          lat: parseFloat(Number(wp.lat).toFixed(9)),
          lng: parseFloat(Number(wp.lng).toFixed(9)),
        }));
        console.log('[MISSION_LOAD] Loading waypoints to controller:', formattedWaypoints);

        // Use new endpoint with full mission config support
        const payload: any = { waypoints: formattedWaypoints };

        // Add servo config if provided
        if (servoConfig) {
          payload.servoConfig = servoConfig;
        }

        // Add mission configuration parameters with sensible defaults
        payload.config = {
          waypoint_threshold: 0.5,      // 50cm threshold for waypoint reached
          hold_duration: 5.0,            // 5 seconds hold time at waypoint
          mission_timeout: 3600.0,       // 1 hour per waypoint timeout
          accuracy_threshold_mm: 100.0,  // 10cm GPS accuracy threshold
          fallback_zone_timeout_seconds: 60.0,  // 60s to wait in threshold zone
        };

        console.log('[MISSION_LOAD] Using /api/mission/load endpoint with config:', payload.config);
        return postService(API_ENDPOINTS.MISSION_LOAD, payload);
      },
      downloadMission: () => getService(API_ENDPOINTS.MISSION_DOWNLOAD),
      clearMission: () => postService(API_ENDPOINTS.MISSION_CLEAR),
      setCurrentWaypoint: (wpSeq: number) =>
        postService(API_ENDPOINTS.MISSION_SET_CURRENT, { wp_seq: wpSeq }),
      startMission: () => postService(API_ENDPOINTS.MISSION_START),
      stopMission: () => postService(API_ENDPOINTS.MISSION_STOP),
      restartMission: () => postService(API_ENDPOINTS.MISSION_RESTART),
      nextMission: () => postService(API_ENDPOINTS.MISSION_NEXT),
      skipMission: async () => {
        // Try configured skip endpoint first; fall back to /api/mission/skip for compatibility
        try {
          return await postService(API_ENDPOINTS.MISSION_SKIP);
        } catch (err) {
          console.warn('[skipMission] primary endpoint failed, attempting fallback /api/mission/skip', err);
          try {
            return await postService('/api/mission/skip');
          } catch (err2) {
            console.error('[skipMission] both endpoints failed', err2);
            // Re-throw last error so callers can handle it
            throw err2;
          }
        }
      },
      // Bulk skip range of waypoints (requires mission to be PAUSED per backend rules)
      // Body: { command: 'bulk_skip', skip_from: number, skip_to: number }
      // Returns ServiceResponse from backend with details
      // Example: { success: true, next_waypoint: 8, skipped_count: 2 }
      // Caller should handle UI confirmation and validation before calling
      bulkSkipRange: async (skipFrom: number, skipTo: number) => {
        try {
          return await postService(API_ENDPOINTS.MISSION_COMMAND, {
            command: 'bulk_skip',
            skip_from: skipFrom,
            skip_to: skipTo,
          });
        } catch (err) {
          console.error('[bulkSkipRange] error calling bulk skip', err);
          throw err;
        }
      },

      pauseMission: () => postService(API_ENDPOINTS.MISSION_PAUSE),
      resumeMission: () => postService(API_ENDPOINTS.MISSION_RESUME),
      getMissionStatus: () => getService(API_ENDPOINTS.MISSION_STATUS),
      requestMissionLogs: async () => {
        if (!socketRef.current || !socketRef.current.connected) {
          return { success: false, message: 'Socket not connected' } as ServiceResponse;
        }
        console.log('[MISSION_LOGS] Requesting mission logs');
        socketRef.current.emit('request_mission_logs');
        return { success: true, message: 'Mission logs requested' } as ServiceResponse;
      },
      resumeFailsafeMission: async () => {
        if (!socketRef.current || !socketRef.current.connected) {
          return { success: false, message: 'Socket not connected' } as ServiceResponse;
        }
        console.log('[FAILSAFE_RECOVERY] Resuming mission after failsafe');
        socketRef.current.emit(SOCKET_EVENTS.FAILSAFE_RESUME_MISSION);
        return { success: true, message: 'Failsafe mission resume requested' } as ServiceResponse;
      },
      restartFailsafeMission: async () => {
        if (!socketRef.current || !socketRef.current.connected) {
          return { success: false, message: 'Socket not connected' } as ServiceResponse;
        }
        console.log('[FAILSAFE_RECOVERY] Restarting mission after failsafe');
        socketRef.current.emit(SOCKET_EVENTS.FAILSAFE_RESTART_MISSION);
        return { success: true, message: 'Failsafe mission restart requested' } as ServiceResponse;
      },
      injectRTK: async (ntripUrl: string) => {
        console.log('[RTK DEBUG] Sending RTK inject request', { endpoint: API_ENDPOINTS.RTK_INJECT, ntripUrl });
        try {
          const res = await postService(API_ENDPOINTS.RTK_INJECT, { ntrip_url: ntripUrl });
          console.log('[RTK DEBUG] RTK inject response', res);
          return res;
        } catch (err) {
          console.error('[RTK DEBUG] RTK inject error', err);
          throw err;
        }
      },
      stopRTK: async () => {
        console.log('[RTK DEBUG] Sending RTK stop request', { endpoint: API_ENDPOINTS.RTK_STOP });
        try {
          const res = await postService(API_ENDPOINTS.RTK_STOP);
          console.log('[RTK DEBUG] RTK stop response', res);
          return res;
        } catch (err) {
          console.error('[RTK DEBUG] RTK stop error', err);
          throw err;
        }
      },
      getRTKStatus: () => getService(API_ENDPOINTS.RTK_STATUS),

      // New RTK methods per documentation
      startNTRIPStream: async (params) => {
        console.log('[RTK DEBUG] Starting NTRIP stream with params', params);
        try {
          const res = await postService(API_ENDPOINTS.RTK_NTRIP_START, params);
          console.log('[RTK DEBUG] NTRIP start response', res);
          return res as import('../types/rtk').NTRIPStartResponse;
        } catch (err) {
          console.error('[RTK DEBUG] NTRIP start error', err);
          throw err;
        }
      },

      stopNTRIPStream: async () => {
        console.log('[RTK DEBUG] Stopping NTRIP stream');
        try {
          const res = await postService(API_ENDPOINTS.RTK_NTRIP_STOP);
          console.log('[RTK DEBUG] NTRIP stop response', res);
          return res as import('../types/rtk').NTRIPStopResponse;
        } catch (err) {
          console.error('[RTK DEBUG] NTRIP stop error', err);
          throw err;
        }
      },

      startLoRaStream: async () => {
        console.log('[RTK DEBUG] Starting LoRa stream via REST');
        try {
          const res = await postService(API_ENDPOINTS.RTK_LORA_START);
          console.log('[RTK DEBUG] LoRa start response', res);
          return res as import('../types/rtk').LoRaStartResponse;
        } catch (err) {
          console.error('[RTK DEBUG] LoRa start error', err);
          throw err;
        }
      },

      stopLoRaStream: async () => {
        console.log('[RTK DEBUG] Stopping LoRa stream via REST');
        try {
          const res = await postService(API_ENDPOINTS.RTK_LORA_STOP);
          console.log('[RTK DEBUG] LoRa stop response', res);
          return res as import('../types/rtk').LoRaStopResponse;
        } catch (err) {
          console.error('[RTK DEBUG] LoRa stop error', err);
          throw err;
        }
      },

      stopAllRTKStreams: async () => {
        console.log('[RTK DEBUG] Stopping all RTK streams');
        try {
          const res = await postService(API_ENDPOINTS.RTK_STOP_ALL);
          console.log('[RTK DEBUG] Stop all response', res);
          return res as import('../types/rtk').RTKStopAllResponse;
        } catch (err) {
          console.error('[RTK DEBUG] Stop all error', err);
          throw err;
        }
      },

      // Legacy LoRa Socket.IO methods (keeping for compatibility)
      startLoraRTKStream: async () => {
        if (!socketRef.current || !socketRef.current.connected) {
          console.warn('[LORA DEBUG] Socket not connected - cannot start LoRa stream');
          return { success: false, message: 'Socket not connected' } as ServiceResponse;
        }
        console.log('[LORA DEBUG] Emitting start_lora_rtk_stream');
        try {
          // Attempt to use an acknowledgement callback if the server supports it
          let ackReceived = false;
          socketRef.current.emit('start_lora_rtk_stream', {}, (ack?: any) => {
            ackReceived = true;
            console.log('[LORA DEBUG] start_lora_rtk_stream ack:', ack);
          });
          // Small timeout to indicate whether ack was received (non-blocking)
          setTimeout(() => {
            if (!ackReceived) console.log('[LORA DEBUG] No ack received for start_lora_rtk_stream (server may not ack)');
          }, 500);
          return { success: true, message: 'LoRa RTK start requested' } as ServiceResponse;
        } catch (err) {
          console.error('[LORA DEBUG] Error emitting start_lora_rtk_stream', err);
          throw err;
        }
      },
      stopLoraRTKStream: async () => {
        if (!socketRef.current || !socketRef.current.connected) {
          console.warn('[LORA DEBUG] Socket not connected - cannot stop LoRa stream');
          return { success: false, message: 'Socket not connected' } as ServiceResponse;
        }
        console.log('[LORA DEBUG] Emitting stop_lora_rtk_stream');
        try {
          let ackReceived = false;
          socketRef.current.emit('stop_lora_rtk_stream', {}, (ack?: any) => {
            ackReceived = true;
            console.log('[LORA DEBUG] stop_lora_rtk_stream ack:', ack);
          });
          setTimeout(() => {
            if (!ackReceived) console.log('[LORA DEBUG] No ack received for stop_lora_rtk_stream (server may not ack)');
          }, 500);
          return { success: true, message: 'LoRa RTK stop requested' } as ServiceResponse;
        } catch (err) {
          console.error('[LORA DEBUG] Error emitting stop_lora_rtk_stream', err);
          throw err;
        }
      },
      getLoraRTKStatus: async () => {
        if (!socketRef.current || !socketRef.current.connected) {
          return { success: false, message: 'Socket not connected' } as ServiceResponse;
        }
        socketRef.current.emit('get_lora_rtk_status', {});
        return { success: true, message: 'LoRa RTK status requested' } as ServiceResponse;
      },
      onLoraRTKStatus: (cb: (status: LoraRTKStatus) => void) => {
        loraStatusCallbackRef.current.push(cb);
        return () => {
          const idx = loraStatusCallbackRef.current.indexOf(cb);
          if (idx >= 0) {
            loraStatusCallbackRef.current.splice(idx, 1);
          }
        };
      },
      onUploadProgress: (cb: (progress: { percent: number; message?: string }) => void) => {
        uploadProgressCallbackRef.current.push(cb);
        return () => {
          const idx = uploadProgressCallbackRef.current.indexOf(cb);
          if (idx >= 0) {
            uploadProgressCallbackRef.current.splice(idx, 1);
          }
        };
      },
      onDownloadProgress: (cb: (progress: { percent: number; message?: string }) => void) => {
        downloadProgressCallbackRef.current.push(cb);
        return () => {
          const idx = downloadProgressCallbackRef.current.indexOf(cb);
          if (idx >= 0) {
            downloadProgressCallbackRef.current.splice(idx, 1);
          }
        };
      },
      controlServo: (servoId: number, angle: number) =>
        postService(API_ENDPOINTS.SERVO_CONTROL, { servo_id: servoId, angle }),
      getTTSStatus: () => getService(API_ENDPOINTS.TTS_STATUS),
      controlTTS: (enabled: boolean) =>
        postService(API_ENDPOINTS.TTS_CONTROL, { enabled }),
      testTTS: (message?: string) =>
        postService(API_ENDPOINTS.TTS_TEST, { message: message || 'TTS voice test' }),
      setTTSLanguage: (language: string) =>
        postService(API_ENDPOINTS.TTS_SET_LANGUAGE, { language }),
      getTTSGender: () => getService(API_ENDPOINTS.TTS_GET_GENDER),
      setTTSGender: (gender: 'male' | 'female') =>
        postService(API_ENDPOINTS.TTS_SET_GENDER, { gender }),

      // Mission Parameters Configuration
      updateMissionParameters: async (params) => {
        console.log('[MISSION_CONFIG] Updating mission parameters:', params);
        try {
          const res = await postService(API_ENDPOINTS.MISSION_CONFIG, params);
          console.log('[MISSION_CONFIG] Update response:', res);
          return res;
        } catch (err) {
          console.error('[MISSION_CONFIG] Error updating mission parameters:', err);
          throw err;
        }
      },

      // Obstacle Detection Zones Configuration
      updateObstacleZones: async (zones) => {
        console.log('[OBSTACLE_CONFIG] Updating obstacle detection zones:', zones);
        try {
          const res = await postService(API_ENDPOINTS.MISSION_CONFIG, zones);
          console.log('[OBSTACLE_CONFIG] Update response:', res);
          return res;
        } catch (err) {
          console.error('[OBSTACLE_CONFIG] Error updating obstacle zones:', err);
          throw err;
        }
      },

      // Obstacle Detection Toggle (via WebSocket)
      setObstacleDetection: async (enabled) => {
        if (!socketRef.current || !socketRef.current.connected) {
          return { success: false, message: 'Socket not connected' } as ServiceResponse;
        }
        console.log('[OBSTACLE] Sending set_obstacle_detection:', enabled);
        try {
          let ackReceived = false;
          socketRef.current.emit('set_obstacle_detection', { enabled }, (ack?: any) => {
            ackReceived = true;
            console.log('[OBSTACLE] set_obstacle_detection ack:', ack);
          });
          setTimeout(() => {
            if (!ackReceived) console.log('[OBSTACLE] No ack received for set_obstacle_detection');
          }, 500);
          return { success: true, message: `Obstacle detection ${enabled ? 'enabled' : 'disabled'}` } as ServiceResponse;
        } catch (err) {
          console.error('[OBSTACLE] Error setting obstacle detection:', err);
          throw err;
        }
      },

      // LED Controller Toggle (via WebSocket)
      setLEDController: async (enabled) => {
        if (!socketRef.current || !socketRef.current.connected) {
          return { success: false, message: 'Socket not connected' } as ServiceResponse;
        }
        console.log('[LED] Sending set_led_controller:', enabled);
        try {
          let ackReceived = false;
          socketRef.current.emit('set_led_controller', { enabled }, (ack?: any) => {
            ackReceived = true;
            console.log('[LED] set_led_controller ack:', ack);
          });
          setTimeout(() => {
            if (!ackReceived) console.log('[LED] No ack received for set_led_controller');
          }, 500);
          return { success: true, message: `LED controller ${enabled ? 'enabled' : 'disabled'}` } as ServiceResponse;
        } catch (err) {
          console.error('[LED] Error setting LED controller:', err);
          throw err;
        }
      },

      // LED Controller Status (via HTTP GET)
      getLEDControllerStatus: () => getService(API_ENDPOINTS.LED_STATUS),

      // Emergency Stop
      emergencyStop: async () => {
        if (!socketRef.current || !socketRef.current.connected) {
          console.warn('[EMERGENCY_STOP] Socket not connected, trying REST API');
          try {
            return await postService(API_ENDPOINTS.SERVO_EMERGENCY_STOP);
          } catch (err) {
            console.error('[EMERGENCY_STOP] REST API failed:', err);
            return { success: false, message: 'Emergency stop failed - socket disconnected' } as ServiceResponse;
          }
        }
        console.log('[EMERGENCY_STOP] 🚨 Sending emergency stop command');
        socketRef.current.emit('emergency_stop');
        return { success: true, message: 'Emergency stop sent' } as ServiceResponse;
      },

      // Manual Control
      sendManualControl: async (command) => {
        if (!socketRef.current || !socketRef.current.connected) {
          return { success: false, message: 'Socket not connected' } as ServiceResponse;
        }
        console.log('[MANUAL_CONTROL] Sending command:', command);
        socketRef.current.emit('manual_control', command);
        return { success: true, message: 'Manual control command sent' } as ServiceResponse;
      },

      stopManualControl: async () => {
        if (!socketRef.current || !socketRef.current.connected) {
          return { success: false, message: 'Socket not connected' } as ServiceResponse;
        }
        console.log('[MANUAL_CONTROL] Stopping manual control');
        socketRef.current.emit('stop_manual_control');
        return { success: true, message: 'Manual control stopped' } as ServiceResponse;
      },

      // Activity Logging
      getActivityLogs: () => getService(API_ENDPOINTS.ACTIVITY_LOGS),
      getActivityTypes: () => getService(API_ENDPOINTS.ACTIVITY_TYPES),
      downloadActivityLogs: () => postService(API_ENDPOINTS.ACTIVITY_DOWNLOAD),

      // System Status
      getNodes: () => getService(API_ENDPOINTS.NODES_LIST),
      getNodeDetails: (nodeName: string) => {
        const endpoint = API_ENDPOINTS.NODE_DETAILS.replace('{name}', nodeName);
        return getService(endpoint);
      },
      getServoStatus: () => getService(API_ENDPOINTS.SERVO_STATUS),
      getMissionServoConfig: () => getService(API_ENDPOINTS.MISSION_SERVO_CONFIG),
      updateMissionServoConfig: (config: any) => postService(API_ENDPOINTS.MISSION_SERVO_CONFIG, config),
      testMissionServoConfig: (config: any) => postService(API_ENDPOINTS.MISSION_SERVO_CONFIG_TEST, config),
    }),
    [pushStatePatch],
  );

  const onMissionEvent = useCallback((callback: (event: MissionEventData) => void) => {
    missionEventCallbackRef.current.push(callback);
    return () => {
      const index = missionEventCallbackRef.current.indexOf(callback);
      if (index > -1) {
        missionEventCallbackRef.current.splice(index, 1);
      }
    };
  }, []);

  // ✅ CRITICAL FIX: Use ref to track previous position and only create new object when values actually change
  // This prevents infinite loops caused by creating new object references on every render
  const lastPositionRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);

  const roverPosition = useMemo(() => {
    const lat = telemetrySnapshot.global?.lat ?? 0;
    const lng = telemetrySnapshot.global?.lon ?? 0;
    const timestamp = telemetrySnapshot.lastMessageTs || Date.now();

    if (lat === 0 && lng === 0) {
      lastPositionRef.current = null;
      return null;
    }

    // ✅ Only create new object if values actually changed
    const prev = lastPositionRef.current;
    if (prev && prev.lat === lat && prev.lng === lng && prev.timestamp === timestamp) {
      return prev; // Return same reference - prevents unnecessary re-renders
    }

    // Values changed, create new object
    const newPosition = { lat, lng, timestamp };
    lastPositionRef.current = newPosition;
    return newPosition;
  }, [telemetrySnapshot.global?.lat, telemetrySnapshot.global?.lon, telemetrySnapshot.lastMessageTs]);

  return {
    telemetry: telemetrySnapshot,
    roverPosition,
    connectionState,
    reconnect,
    services,
    onMissionEvent,
    socket: socketRef.current,
  };
}

export default useRoverTelemetry;
