/**
 * Type definitions for Rover ROS Telemetry and Services
 * Matches the backend telemetry structure
 */

// State
export interface TelemetryState {
  armed: boolean;
  mode: string;
  system_status: string;
  heartbeat_ts: number;
}

// Global position
export interface TelemetryGlobal {
  lat: number;
  lon: number;
  alt_rel: number;
  vel: number;
  satellites_visible: number;
}

// Battery
export interface TelemetryBattery {
  voltage: number;
  current: number;
  percentage: number;
}

// RTK
export interface TelemetryRtk {
  fix_type: number;
  baseline_age: number;
  base_linked: boolean;
}

// Mission
export interface TelemetryMission {
  total_wp: number;
  current_wp: number;
  status: string;
  progress_pct: number;
}

// Servo
export interface ServoStatus {
  servo_id: number;
  active: boolean;
  last_command_ts: number;
  [key: string]: any;
}

// Network
export interface NetworkData {
  connection_type: string;
  wifi_signal_strength: number;
  wifi_rssi: number;
  interface: string;
  wifi_connected: boolean;
  lora_connected: boolean;
}

// Complete telemetry
export interface RoverTelemetry {
  state: TelemetryState;
  global: TelemetryGlobal;
  battery: TelemetryBattery;
  rtk: TelemetryRtk;
  mission: TelemetryMission;
  servo: ServoStatus;
  network: NetworkData;
  hrms: number;
  vrms: number;
  imu_status: string;
  lastMessageTs: number | null;
  attitude?: {
    yaw_deg: number;
  };
  // New fields from Pixhawk NTUN (CurrentState)
  wp_dist_cm?: number;    // Distance to waypoint in cm
  xtrack_cm?: number;     // Crosstrack error in cm (lateral deviation)
  wp_brg?: number;        // Bearing to waypoint in degrees
  position_error_cm?: number; // Total position error = sqrt(wp_dist² + xtrack²) in cm
  gps_failsafe?: GpsFailsafeStatus;
}

// Telemetry envelope from backend
export interface TelemetryEnvelope {
  timestamp?: number;
  state?: Partial<TelemetryState>;
  global?: Partial<TelemetryGlobal>;
  battery?: Partial<TelemetryBattery>;
  rtk?: Partial<TelemetryRtk>;
  mission?: Partial<TelemetryMission>;
  servo?: Partial<ServoStatus>;
  network?: Partial<NetworkData>;
  hrms?: number;
  vrms?: number;
  imu_status?: string;
  attitude?: {
    yaw_deg: number;
  };
  // New fields from Pixhawk NTUN (CurrentState)
  wp_dist_cm?: number;
  xtrack_cm?: number;
  wp_brg?: number;
  position_error_cm?: number; // Total position error = sqrt(wp_dist² + xtrack²) in cm
}

// Service response
export interface ServiceResponse {
  success: boolean;
  message?: string;
  error?: string;
  [key: string]: any;
}

// Waypoint
export interface Waypoint {
  id?: number;
  lat: number;
  lng: number;
  alt: number;
  command?: string;
  frame?: number;
  current?: number;
  autocontinue?: number;
  [key: string]: any;
}

// Mission event
export interface MissionEventData {
  timestamp?: string | number;
  message?: string;
  lat?: number | null;
  lng?: number | null;
  waypointId?: number | null;
  status?: string | null;
  servoAction?: string | null;
  [key: string]: any;
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';
// GPS Failsafe types
export type GpsFailsafeMode = 'disable' | 'strict' | 'relax';

export interface GpsFailsafeStatus {
  mode: GpsFailsafeMode;
  triggered: boolean;
  reason?: string;              // Human-readable trigger reason
  fix_type?: number;            // GPS fix type (0-6, need 6 for RTK Fixed)
  wp_dist_cm?: number;          // Distance to waypoint in cm (replaces accuracy_error_mm)
  xtrack_cm?: number;           // Crosstrack error in cm (lateral deviation)
  wp_brg?: number;              // Bearing to waypoint in degrees
  requires_ack?: boolean;       // True if user acknowledgement needed (strict mode)
  servo_suppressed: boolean;
  action?: string;              // "none", "pause_hold", "suppress_servo", or "recovered"
  timestamp?: string;           // ISO format timestamp
}

export interface GpsFailsafeEvent {
  wp_dist_cm: number;           // Distance to waypoint in cm (replaces accuracy_error_mm)
  threshold_cm: number;         // Threshold in cm (6.0 cm)
  timestamp: number;
}