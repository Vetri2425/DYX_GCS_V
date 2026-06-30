/**
 * 4WD_SERVER Telemetry types — mirror of server/models.py TelemetryData.
 *
 * All fields match the flat dict emitted by the backend telemetry socket
 * at ~10 Hz and returned by GET /api/telemetry/latest.
 */

// ── Flat telemetry payload ────────────────────────────────────────────────────

/** Flat telemetry dict from socket `telemetry` event and REST /api/telemetry/latest. */
export interface Px4TelemetryData {
  // NED position
  pos_n: number;
  pos_e: number;
  // Attitude
  heading_ned_deg: number;
  // Velocity
  speed_m_s: number;
  // Path tracking
  xtrack_m: number;
  dist_to_goal_m: number;
  // RPP state
  rpp_state: number;
  rpp_state_name: string;
  // Vehicle state
  armed: boolean;
  mode: string;          // 'MANUAL' | 'OFFBOARD'
  connected: boolean;
  // Battery
  battery_v: number;
  battery_pct: number;
  // GPS
  gps_fix: number;
  gps_fix_name?: string;
  gps_sat: number;
  lat: number;
  lon: number;
  alt: number;
  // Spray / marking
  spraying: boolean;
  marking_state: string;
  commanded_on: boolean;
  confirmed_off: boolean;
  dash_feasible: boolean;
  // Optional fields
  imu_status?: string;
  hrms?: number;
  vrms?: number;
  pose_age_ms?: number;
  rpp_debug_fresh?: boolean;
  timestamp?: number;
}

// ── Mission status (socket `mission_status` event) ───────────────────────────

export type MissionState =
  | 'idle'
  | 'loading'
  | 'arming'
  | 'switching_offboard'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'error'
  | string;

export interface Px4MissionStatus {
  state: MissionState;
  rpp_state: number;
  rpp_state_name: string;
  dist_to_goal: number;
  speed: number;
  xtrack: number;
  /** Present when a path is loaded. */
  path_name?: string;
  mission_id?: string;
  /** Point mode specific */
  point_index?: number;
  total_points?: number;
  expected_generation?: number;
  spray_mode?: string;
}

// ── Healthz response ──────────────────────────────────────────────────────────

export interface Px4HealthzResponse {
  ros_node?: boolean;
  fcu_connected: boolean;
  armed: boolean;
  mode: string;
  mission_state?: MissionState | string | null;
  rpp_state?: number | null;
  pose_age_ms?: number | null;
  uptime_s?: number;
}

// ── Loaded path response ──────────────────────────────────────────────────────

export interface LoadedPathResponse {
  path_name: string | null;
  mission_id: string | null;
  total_points?: number;
  spray_mode?: string;
  loaded_at?: string;
}
