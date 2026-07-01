/**
 * useJoystickLease — React hook for joystick V2 lease lifecycle.
 *
 * Acquires on mount (when `enabled` is true), releases on unmount.
 * Also releases when app goes to background (AppState change).
 *
 * Usage:
 *   const { leaseState, leaseError, setCommand } = useJoystickLease({ enabled: panelOpen });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  acquire,
  release,
  setCommand,
  onStateChange,
  getLeaseInfo,
} from '../services/joystickLeaseService';
import type {
  JoystickLeaseState,
  JoystickLeaseInfo,
  JoystickErrorPayload,
} from '../types/px4/joystick';
import { JOYSTICK_V2_ENABLED } from '../config/featureFlags';

// ── Generate stable session ID ────────────────────────────────────────────────

let _sessionId: string | null = null;

function getSessionId(): string {
  if (!_sessionId) {
    // Generate once per app process. In production this could be a UUID.
    _sessionId = `gcs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }
  return _sessionId;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseJoystickLeaseOptions {
  /** Set to true when the manual control panel is open. */
  enabled: boolean;
}

export interface UseJoystickLeaseResult {
  /** Current lease state machine state. */
  leaseState: JoystickLeaseState;
  /** Current lease info (available when state is 'active'). */
  leaseInfo: JoystickLeaseInfo | null;
  /** Last joystick error, if any. */
  leaseError: JoystickErrorPayload | null;
  /** Whether the lease is fully active and accepting commands. */
  isActive: boolean;
  /** Whether manual control is not available (joystick disabled on server). */
  isDisabled: boolean;
  /**
   * Update the current drive command.
   * @param throttle Normalized [-1, 1]
   * @param steering Normalized [-1, 1]
   * @param deadman  Must be true to actuate vehicle
   */
  sendCommand: (throttle: number, steering: number, deadman: boolean) => void;
}

export function useJoystickLease(
  options: UseJoystickLeaseOptions,
): UseJoystickLeaseResult {
  const { enabled } = options;

  const [leaseState, setLeaseState] = useState<JoystickLeaseState>('inactive');
  const [leaseError, setLeaseError] = useState<JoystickErrorPayload | null>(null);
  const sessionId = getSessionId();
  const appStateRef = useRef<AppStateStatus>('active');

  // Subscribe to lease state changes
  useEffect(() => {
    const unsub = onStateChange((state, err) => {
      setLeaseState(state);
      if (err) setLeaseError(err);
      else if (state === 'active') setLeaseError(null);
    });
    return unsub;
  }, []);

  // Acquire / release based on `enabled` prop + app state
  useEffect(() => {
    if (!JOYSTICK_V2_ENABLED) return;

    if (enabled && appStateRef.current === 'active') {
      setLeaseError(null);
      acquire(sessionId);
    } else {
      release(sessionId);
    }
  }, [enabled, sessionId]);

  // Release when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      appStateRef.current = nextState;
      if (nextState !== 'active' && enabled) {
        release(sessionId);
      }
    });
    return () => sub.remove();
  }, [enabled, sessionId]);

  // Ensure release on unmount
  useEffect(() => {
    return () => {
      release(sessionId);
    };
  }, [sessionId]);

  const sendCommand = useCallback(
    (throttle: number, steering: number, deadman: boolean) => {
      setCommand(throttle, steering, deadman);
    },
    [],
  );

  const leaseInfo = leaseState === 'active' ? getLeaseInfo() : null;
  const isDisabled =
    leaseError?.code === 'manual_control_disabled' || !JOYSTICK_V2_ENABLED;

  return {
    leaseState,
    leaseInfo,
    leaseError,
    isActive: leaseState === 'active',
    isDisabled,
    sendCommand,
  };
}

export default useJoystickLease;
