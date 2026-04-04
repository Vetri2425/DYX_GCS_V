/**
 * QuickTune Feature Type Definitions
 *
 * Used for the QuickTune wizard flow that guides users through
 * pretune and tuned parameter configuration for robot optimization.
 */

// ============================================================================
// Parameter Constants
// ============================================================================

/**
 * Pretune parameters (18 total) - baseline settings before tuning
 */
export const PRETUNE_PARAMS: string[] = [
  'ATC_ACC_MAX',
  'ATC_DECEL_MAX',
  'ATC_SPEED_UP',
  'ATC_SPEED_DN',
  'ATC_TURN_MAX',
  'ATC_STR_RAT_P',
  'ATC_STR_RAT_I',
  'ATC_STR_RAT_D',
  'ATC_STR_RAT_IMAX',
  'WHEEL_RADIUS',
  'WHEEL_BASE',
  'WHEEL_TRACK',
  'MOT_THST_HOVER',
  'MOT_THST_MAX',
  'NAVL1_PERIOD',
  'NAVL1_DAMPING',
  'SCHED_SPEED_MAX',
  'SCHED_TURN_MAX',
];

/**
 * Tuned parameters (11 total) - optimized settings after tuning
 */
export const TUNED_PARAMS: string[] = [
  'ATC_STR_RAT_P',
  'ATC_STR_RAT_I',
  'ATC_STR_RAT_D',
  'ATC_SPEED_UP',
  'ATC_SPEED_DN',
  'ATC_ACC_MAX',
  'ATC_DECEL_MAX',
  'NAVL1_PERIOD',
  'NAVL1_DAMPING',
  'SCHED_SPEED_MAX',
  'SCHED_TURN_MAX',
];

// ============================================================================
// Wizard Step & State Types
// ============================================================================

/**
 * Wizard step identifiers
 */
export enum WizardStep {
  Overview = 'overview',
  PretuneCheck = 'pretune_check',
  ApplyPretune = 'apply_pretune',
  RunTuning = 'run_tuning',
  ApplyTuned = 'apply_tuned',
  Complete = 'complete',
}

/**
 * Tune state machine states
 */
export enum TuneState {
  Idle = 'idle',
  Checking = 'checking',
  ApplyingPretune = 'applying_pretune',
  Tuning = 'tuning',
  ApplyingTuned = 'applying_tuned',
  Success = 'success',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

// ============================================================================
// Core Types
// ============================================================================

/**
 * QuickTune parameter with metadata
 */
export interface QuickTuneParam {
  name: string;
  currentValue: number;
  recommendedValue: number;
  min: number;
  max: number;
  units?: string;
  description?: string;
}

/**
 * Script check result from validation phase
 */
export interface ScriptCheckResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
  paramSnapshots: ParamSnapshot[];
}

/**
 * Parameter snapshot for before/after comparison
 */
export interface ParamSnapshot {
  name: string;
  before: number;
  after?: number;
}

/**
 * Auxiliary function payload for tuning operations
 */
export interface AuxFunctionPayload {
  functionName: string;
  params: Record<string, unknown>;
  timeoutMs?: number;
}

/**
 * QuickTune log entry for audit trail
 */
export interface QuickTuneLogEntry {
  timestamp: string;
  step: WizardStep;
  state: TuneState;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Tune result after completion
 */
export interface TuneResult {
  success: boolean;
  durationMs: number;
  appliedParams: Record<string, number>;
  previousParams: Record<string, number>;
  logs: QuickTuneLogEntry[];
  error?: string;
}

/**
 * Wizard shared state persisted across steps
 */
export interface WizardSharedState {
  currentStep: WizardStep;
  tuneState: TuneState;
  pretuneParams: Record<string, number>;
  tunedParams: Record<string, number>;
  checkResult: ScriptCheckResult | null;
  tuneResult: TuneResult | null;
  logs: QuickTuneLogEntry[];
  startedAt?: string;
  completedAt?: string;
}
