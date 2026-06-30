/**
 * pointEventAdapter — Map PX4 point_mission_event types to legacy statusMap keys.
 *
 * MissionReportScreen uses a `statusMap: Record<number, WaypointStatus>` fed by
 * legacy `mission_event` socket messages. This adapter bridges the new
 * `point_mission_event` payloads to those same keys, so map components need
 * no changes.
 *
 * Event type reference: Phase 6 of the migration plan.
 */

import type { PointMissionEvent, PointEventType } from '../types/px4/mission';

// ── Legacy status key type ────────────────────────────────────────────────────

export type WaypointStatusKey =
  | 'pending'
  | 'active'
  | 'arrived'
  | 'marked'
  | 'completed'
  | 'skipped'
  | 'waiting'
  | 'paused'
  | 'failed'
  | 'aborted';

export interface WaypointStatusEntry {
  status: WaypointStatusKey;
  timestamp: string;
  lat?: number;
  lon?: number;
  reason?: string;
  message?: string;
  eventType: PointEventType;
}

// ── Mapping table ─────────────────────────────────────────────────────────────

const EVENT_TYPE_TO_STATUS: Record<PointEventType, WaypointStatusKey> = {
  point_leg_started:          'active',
  point_arrived:              'arrived',
  point_dwell_started:        'arrived',
  point_marked:               'marked',
  point_waiting_for_continue: 'waiting',
  point_paused:               'paused',
  point_resumed:              'active',
  point_skipped:              'skipped',
  point_completed:            'completed',
  point_failed:               'failed',
  point_aborted:              'aborted',
};

// ── Adapter function ──────────────────────────────────────────────────────────

/**
 * Convert a single `point_mission_event` payload to a statusMap entry.
 * Returns null for unknown event types (forward-compatibility).
 */
export function toStatusEntry(event: PointMissionEvent): WaypointStatusEntry | null {
  const status = EVENT_TYPE_TO_STATUS[event.event_type];
  if (!status) return null;

  return {
    status,
    timestamp: event.timestamp,
    lat: event.lat,
    lon: event.lon,
    reason: event.reason,
    message: event.message,
    eventType: event.event_type,
  };
}

/**
 * Apply a point event to a status map (keyed by point_index).
 * Returns a new map (immutable update).
 */
export function applyPointEvent(
  statusMap: Record<number, WaypointStatusEntry>,
  event: PointMissionEvent,
): Record<number, WaypointStatusEntry> {
  const entry = toStatusEntry(event);
  if (!entry) return statusMap;

  return {
    ...statusMap,
    [event.point_index]: entry,
  };
}

/**
 * Rebuild a status map from a batch of events (used for reconnect backfill).
 * Events are applied in order; later events overwrite earlier ones for same index.
 */
export function buildStatusMapFromEvents(
  events: PointMissionEvent[],
): Record<number, WaypointStatusEntry> {
  let map: Record<number, WaypointStatusEntry> = {};
  for (const event of events) {
    map = applyPointEvent(map, event);
  }
  return map;
}

/**
 * Determine if the "Next / Continue" button should be visible.
 * Only shown when any point is in `waiting` state.
 */
export function hasWaitingForContinue(
  statusMap: Record<number, WaypointStatusEntry>,
): boolean {
  return Object.values(statusMap).some((e) => e.status === 'waiting');
}

/**
 * Get the current active point index (most recent `active` or `arrived` entry).
 */
export function getCurrentPointIndex(
  statusMap: Record<number, WaypointStatusEntry>,
): number | null {
  const entries = Object.entries(statusMap);
  const active = entries
    .filter(([, e]) => e.status === 'active' || e.status === 'arrived' || e.status === 'waiting')
    .map(([idx]) => parseInt(idx, 10));
  if (active.length === 0) return null;
  return Math.max(...active);
}
