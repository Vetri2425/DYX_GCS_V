/**
 * 4WD_SERVER Joystick V2 types — lease protocol.
 *
 * Backend: 4WD_SERVER/server/joystick_controller.py
 */

// ── Lease states ──────────────────────────────────────────────────────────────

export type JoystickLeaseState =
  | 'inactive'
  | 'acquiring'
  | 'active'
  | 'releasing'
  | 'error';

// ── Socket payloads ───────────────────────────────────────────────────────────

/** Client → Server: request joystick lease. */
export interface JoystickAcquirePayload {
  session_id: string;
  client_monotonic_ms?: number;
}

/** Server → Client: lease granted. */
export interface JoystickAcquiredPayload {
  type?: 'joystick_acquired';
  lease_id: string;
  command_rate_hz: number;
  max_throttle: number;
  max_steering: number;
  server_stop_timeout_ms: number;
  gateway_stop_timeout_ms?: number;
}

/** Client → Server: control command (sent ≤ command_rate_hz). */
export interface JoystickCommandPayload {
  session_id: string;
  lease_id: string;
  sequence: number;
  client_monotonic_ms: number;
  throttle: number;     // normalized [-1, 1]
  steering: number;     // normalized [-1, 1]
  deadman: boolean;     // must be true to actuate
}

/** Client → Server: release lease. */
export interface JoystickReleasePayload {
  session_id: string;
  lease_id: string;
}

// ── Error types ───────────────────────────────────────────────────────────────

export type JoystickErrorCode =
  | 'manual_control_disabled'
  | 'malformed'
  | 'mode_unavailable'
  | 'fcu_disconnected'
  | 'not_armed'
  | 'not_owner'
  | 'mission_active'
  | 'joystick_active'
  | 'acquire_cancelled'
  | 'unavailable'
  | 'lease_inactive'
  | 'transport_unavailable'
  | 'out_of_order'
  | 'replay'
  | 'rate_exceeded'
  | 'nan_value'
  | 'out_of_range'
  | 'auth_failed'
  | 'unknown';

export interface JoystickErrorPayload {
  type: string;
  code: JoystickErrorCode;
  message: string;
}

// ── Hook state ────────────────────────────────────────────────────────────────

export interface JoystickLeaseInfo {
  leaseId: string;
  commandRateHz: number;
  maxThrottle: number;
  maxSteering: number;
  serverStopTimeoutMs: number;
  gatewayStopTimeoutMs?: number;
}
