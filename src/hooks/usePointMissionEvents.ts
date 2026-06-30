/**
 * usePointMissionEvents — Live + backfill point mission event journal.
 *
 * Features:
 * - Subscribes to `point_mission_event` socket events
 * - On socket reconnect, fetches missed events since last event ID
 * - Builds and maintains a `statusMap` keyed by point_index
 * - Exposes `currentPointIndex`, `waitingForContinue` derived state
 *
 * Usage in MissionReportScreen:
 *   const { statusMap, waitingForContinue, currentPointIndex } = usePointMissionEvents(socket);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getPointEvents, getPointStatus } from '../services/missionLifecycleService';
import {
  applyPointEvent,
  buildStatusMapFromEvents,
  hasWaitingForContinue,
  getCurrentPointIndex,
} from '../adapters/pointEventAdapter';
import type { WaypointStatusEntry } from '../adapters/pointEventAdapter';
import type { PointMissionEvent } from '../types/px4/mission';
import { POINT_MISSION_ENABLED } from '../config/featureFlags';

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UsePointMissionEventsResult {
  /** Per-point status map: index → WaypointStatusEntry. */
  statusMap: Record<number, WaypointStatusEntry>;
  /** True when any point is waiting for operator continue. */
  waitingForContinue: boolean;
  /** Active or most recently active point index (null if no activity). */
  currentPointIndex: number | null;
  /** Last received event ID (used for backfill on reconnect). */
  lastEventId: number | null;
  /** Latest point mission generation (for skip/continue guards). */
  expectedGeneration: number | null;
  /** Reset the status map (call on mission clear/restart). */
  resetStatusMap: () => void;
}

export function usePointMissionEvents(
  socket: Socket | null,
  connectionState: string,
): UsePointMissionEventsResult {
  const [statusMap, setStatusMap] = useState<Record<number, WaypointStatusEntry>>({});
  const [lastEventId, setLastEventId] = useState<number | null>(null);
  const [expectedGeneration, setExpectedGeneration] = useState<number | null>(null);

  const lastEventIdRef = useRef<number | null>(null);

  const resetStatusMap = useCallback(() => {
    setStatusMap({});
    setLastEventId(null);
    setExpectedGeneration(null);
    lastEventIdRef.current = null;
  }, []);

  // ── Live event handler ────────────────────────────────────────────────────

  const handlePointEvent = useCallback((raw: unknown) => {
    if (!POINT_MISSION_ENABLED) return;
    const event = raw as PointMissionEvent;

    setStatusMap((prev) => applyPointEvent(prev, event));
    setLastEventId(event.event_id);
    lastEventIdRef.current = event.event_id;
    if (typeof event.generation === 'number') {
      setExpectedGeneration(event.generation);
    }
  }, []);

  // ── Backfill on reconnect ─────────────────────────────────────────────────

  const backfill = useCallback(async () => {
    if (!POINT_MISSION_ENABLED) return;
    try {
      const response = await getPointEvents(lastEventIdRef.current ?? undefined);
      if (response.events.length > 0) {
        const patchMap = buildStatusMapFromEvents(response.events);
        setStatusMap((prev) => ({ ...prev, ...patchMap }));
        const maxId = Math.max(...response.events.map((e) => e.event_id));
        setLastEventId(maxId);
        lastEventIdRef.current = maxId;
        const lastGen = response.events[response.events.length - 1]?.generation;
        if (typeof lastGen === 'number') {
          setExpectedGeneration(lastGen);
        }
      }
    } catch {
      // Silent — backfill is best-effort
    }
  }, []);

  // ── Register socket listeners ─────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !POINT_MISSION_ENABLED) return;

    socket.on('point_mission_event', handlePointEvent);

    // Register completion listeners
    const handleMissionCompleted = () => {
      // Keep status map as-is — let MissionReportScreen show completion dialog
    };

    socket.on('mission_completed', handleMissionCompleted);
    socket.on('mission_completion_degraded', handleMissionCompleted);

    return () => {
      socket.off('point_mission_event', handlePointEvent);
      socket.off('mission_completed', handleMissionCompleted);
      socket.off('mission_completion_degraded', handleMissionCompleted);
    };
  }, [socket, handlePointEvent]);

  // ── Backfill on reconnect ─────────────────────────────────────────────────

  useEffect(() => {
    if (connectionState !== 'connected' || !POINT_MISSION_ENABLED) return;
    void backfill();
    void getPointStatus()
      .then((st) => {
        if (typeof st.expected_generation === 'number') {
          setExpectedGeneration(st.expected_generation);
        }
      })
      .catch(() => {});
  }, [connectionState, backfill]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const waitingForContinue = hasWaitingForContinue(statusMap);
  const currentPointIndex = getCurrentPointIndex(statusMap);

  return {
    statusMap,
    waitingForContinue,
    currentPointIndex,
    lastEventId,
    expectedGeneration,
    resetStatusMap,
  };
}

export default usePointMissionEvents;
