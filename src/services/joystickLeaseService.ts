/**
 * joystickLeaseService — 4WD_SERVER Joystick V2 lease state machine.
 *
 * State machine: inactive → acquiring → active → releasing → inactive
 *
 * Usage pattern:
 *   1. Call acquire(sessionId) when manual control panel opens
 *   2. Poll commandLoop with latest throttle/steering + deadman flag
 *   3. Call release() when panel closes or app backgrounds
 *
 * Backend reference: 4WD_SERVER/server/joystick_controller.py
 * Prerequisite: ROVER_JOYSTICK_MANUAL_ENABLED=1 on server
 */

import { emit as socketEmit, on as socketOn, off as socketOff } from './socketClient';
import { PX4_SOCKET_EVENTS } from '../config/px4Endpoints';
import type {
  JoystickLeaseState,
  JoystickLeaseInfo,
  JoystickAcquirePayload,
  JoystickAcquiredPayload,
  JoystickCommandPayload,
  JoystickReleasePayload,
  JoystickErrorPayload,
} from '../types/px4/joystick';

// ── State ─────────────────────────────────────────────────────────────────────

let _state: JoystickLeaseState = 'inactive';
let _lease: JoystickLeaseInfo | null = null;
let _sequence = 0;
let _commandIntervalId: ReturnType<typeof setInterval> | null = null;
let _currentThrottle = 0;
let _currentSteering = 0;
let _deadman = false;

type StateChangeFn = (state: JoystickLeaseState, error?: JoystickErrorPayload) => void;
const _stateListeners = new Set<StateChangeFn>();

// ── Listeners ─────────────────────────────────────────────────────────────────

function notifyStateChange(error?: JoystickErrorPayload): void {
  _stateListeners.forEach((fn) => fn(_state, error));
}

function attachSocketListeners(): void {
  socketOn(PX4_SOCKET_EVENTS.JOYSTICK_ACQUIRED, handleAcquired, 'jls-acquired');
  socketOn(PX4_SOCKET_EVENTS.JOYSTICK_RELEASED, handleReleased, 'jls-released');
  socketOn(PX4_SOCKET_EVENTS.JOYSTICK_ERROR, handleError, 'jls-error');
}

function detachSocketListeners(): void {
  socketOff(PX4_SOCKET_EVENTS.JOYSTICK_ACQUIRED, 'jls-acquired');
  socketOff(PX4_SOCKET_EVENTS.JOYSTICK_RELEASED, 'jls-released');
  socketOff(PX4_SOCKET_EVENTS.JOYSTICK_ERROR, 'jls-error');
}

function handleAcquired(raw: unknown): void {
  const data = raw as JoystickAcquiredPayload;
  _lease = {
    leaseId: data.lease_id,
    commandRateHz: data.command_rate_hz,
    maxThrottle: data.max_throttle,
    maxSteering: data.max_steering,
    serverStopTimeoutMs: data.server_stop_timeout_ms,
  };
  _state = 'active';
  startCommandLoop(_lease.commandRateHz);
  notifyStateChange();
}

function handleReleased(_raw: unknown): void {
  stopCommandLoop();
  _lease = null;
  _sequence = 0;
  _state = 'inactive';
  notifyStateChange();
  detachSocketListeners();
}

function handleError(raw: unknown): void {
  const err = raw as JoystickErrorPayload;
  console.warn('[joystickLease] Error:', err.code, err.message);
  stopCommandLoop();
  _lease = null;
  _sequence = 0;
  _state = 'error';
  notifyStateChange(err);
  detachSocketListeners();
}

// ── Command loop ──────────────────────────────────────────────────────────────

function startCommandLoop(rateHz: number): void {
  stopCommandLoop();
  const intervalMs = Math.max(50, Math.round(1000 / rateHz)); // min 50ms → max 20Hz
  _commandIntervalId = setInterval(sendCommand, intervalMs);
}

function stopCommandLoop(): void {
  if (_commandIntervalId !== null) {
    clearInterval(_commandIntervalId);
    _commandIntervalId = null;
  }
}

function sendCommand(): void {
  if (_state !== 'active' || !_lease) return;

  // Clamp to lease limits
  const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

  const payload: JoystickCommandPayload = {
    session_id: _sessionId,
    lease_id: _lease.leaseId,
    sequence: _sequence++,
    client_monotonic_ms: Date.now(),
    throttle: clamp(_currentThrottle, _lease.maxThrottle),
    steering: clamp(_currentSteering, _lease.maxSteering),
    deadman: _deadman,
  };

  socketEmit(PX4_SOCKET_EVENTS.JOYSTICK_COMMAND, payload);
}

// ── Public API ────────────────────────────────────────────────────────────────

let _sessionId = '';

/**
 * Acquire a joystick lease.
 * @param sessionId Stable app session ID (generate once with Math.random().toString(36)).
 */
export function acquire(sessionId: string): void {
  if (_state === 'acquiring' || _state === 'active') {
    console.warn('[joystickLease] Already acquiring/active — ignoring acquire()');
    return;
  }

  _sessionId = sessionId;
  _state = 'acquiring';
  _sequence = 0;
  attachSocketListeners();
  notifyStateChange();

  const payload: JoystickAcquirePayload = {
    session_id: sessionId,
    client_monotonic_ms: Date.now(),
  };
  socketEmit(PX4_SOCKET_EVENTS.JOYSTICK_ACQUIRE, payload);
}

/** Release the current lease. Safe to call in any state. */
export function release(sessionId: string): void {
  if (_state === 'inactive') return;

  stopCommandLoop();
  _state = 'releasing';
  notifyStateChange();

  if (_lease) {
    const payload: JoystickReleasePayload = {
      session_id: sessionId,
      lease_id: _lease.leaseId,
    };
    socketEmit(PX4_SOCKET_EVENTS.JOYSTICK_RELEASE, payload);
  } else {
    // No lease — transition to inactive immediately
    _state = 'inactive';
    notifyStateChange();
    detachSocketListeners();
  }
}

/**
 * Update the current drive commands. Called by the UI at render rate.
 * The command loop sends these values to the server at `command_rate_hz`.
 *
 * @param throttle Normalized [-1, 1] forward/backward
 * @param steering Normalized [-1, 1] left/right
 * @param deadman  Safety button — if false, vehicle stops
 */
export function setCommand(
  throttle: number,
  steering: number,
  deadman: boolean,
): void {
  _currentThrottle = throttle;
  _currentSteering = steering;
  _deadman = deadman;
}

/** Get current lease state. */
export function getState(): JoystickLeaseState {
  return _state;
}

/** Get current lease info (null unless active). */
export function getLeaseInfo(): JoystickLeaseInfo | null {
  return _lease;
}

/**
 * Subscribe to state changes.
 * Returns unsubscribe function.
 */
export function onStateChange(fn: StateChangeFn): () => void {
  _stateListeners.add(fn);
  fn(_state); // Immediately notify with current state
  return () => _stateListeners.delete(fn);
}

export const joystickLeaseService = {
  acquire,
  release,
  setCommand,
  getState,
  getLeaseInfo,
  onStateChange,
};

export default joystickLeaseService;
