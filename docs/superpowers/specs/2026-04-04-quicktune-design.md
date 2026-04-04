# QuickTune Feature — Design Spec
**Date:** 2026-04-04
**Branch:** v2-new-ui
**Status:** Approved — ready for implementation

---

## Overview

Replace Mission Planner for the ArduRover QuickTune workflow. A button on the Dashboard opens a full-screen modal wizard that guides the operator through all 6 steps: parameter verification → script check/upload → arm & circle mode → start tune → live monitoring → save & results comparison.

The feature is **frontend-first**: all new API calls are mocked in `quickTuneService.ts` with a clearly typed contract. The backend team implements the contract after the frontend is complete.

---

## Background

The rover-quicktune Lua script (ArduPilot 4.5.6 source) auto-tunes steering and speed PID gains while the rover drives in Circle mode. It is controlled by a 3-position RC switch mapped to `RTUN_RC_FUNC` (default 300 = Scripting1):

| Switch Position | MAVLink Value | Action |
|---|---|---|
| LOW | 0 | Abort — revert all params |
| MID | 1 | Start / resume tuning |
| HIGH | 2 | Save gains |

The app sends these via **`MAV_CMD_DO_AUX_FUNCTION`** (command ID 519): `param1=300, param2=0/1/2`.

Progress is reported via MAVLink **STATUSTEXT** messages (message ID 253) streamed from the flight controller through the backend as Socket.IO events.

### Parameters Tuned by the Script
```
ATC_STR_RAT_FF, ATC_STR_RAT_P, ATC_STR_RAT_I, ATC_STR_RAT_D
ATC_STR_RAT_FLTD, ATC_STR_RAT_FLTT
ATC_SPEED_P, ATC_SPEED_I, ATC_SPEED_D
CRUISE_SPEED, CRUISE_THROTTLE
```

### Pre-Tune Parameters (must be correct before starting)
```
SCR_ENABLE = 1
RTUN_ENABLE = 1
RTUN_AXES = 3
RTUN_AUTO_FILTER = 1
RTUN_AUTO_SAVE = 5
RTUN_RC_FUNC = 300
RTUN_STR_FFRATIO = 0.9
RTUN_STR_P_RATIO = 0.5
RTUN_STR_I_RATIO = 0.5
RTUN_SPD_FFRATIO = 1.0
RTUN_SPD_P_RATIO = 1.0
RTUN_SPD_I_RATIO = 1.0
CIRC_SPEED = 1.0
CIRC_RADIUS = 4.0
CIRC_DIR = 0
ATC_STR_ACC_MAX = 90
ATC_STR_RAT_MAX = 90
ATC_BRAKE = 1
```

---

## User Flow

```
Dashboard
  └─ "Quick Tune" button
       └─ QuickTuneScreen (full-screen modal)
            └─ QuickTuneWizard (step state machine)
                 ├─ Step 1: Param Check
                 ├─ Step 2: Script Check / Upload
                 ├─ Step 3: Arm + Circle Mode
                 ├─ Step 4: Start Tune
                 ├─ Step 5: Live Monitor
                 └─ Step 6: Save + Results
```

---

## Step Details

### Step 1 — Parameter Check
- Fetch all params via existing `GET /api/params`
- Display each pre-tune param in a list: name | current value | expected value | OK/WARN badge
- Inline editable field for params that are wrong — uses existing `services.setParam()`
- "Apply & Next" enabled only when all required params match expected values
- SCR_ENABLE requires reboot warning if changed (show alert)

### Step 2 — Script Check / Upload
- `GET /api/quicktune/script/check` → `{ exists: boolean, path: string }`
- If `exists = true`: show green checkmark, enable Next
- If `exists = false`: show upload UI
  - The `rover-quicktune.lua` script is **bundled as a static asset** in `src/assets/scripts/rover-quicktune.lua` (copied from `temp/ardurover-4.5.6/libraries/AP_Scripting/applets/`)
  - "Upload Script" button → `POST /api/quicktune/script/upload` (multipart, sends bundled file)
  - Show upload progress spinner
  - On success: show checkmark, enable Next
- Also allow: "Choose custom file" from device storage (for updated scripts)

### Step 3 — Arm + Circle Mode
- Show current arm state from telemetry (live)
- If disarmed: "Arm Rover" button → `POST /api/arm`
- Once armed: "Set Circle Mode" button → `POST /api/set_mode { mode: "CIRCLE" }`
- Wait for telemetry `state.mode === "CIRCLE"` AND `global.vel > 0.1`
- Show live ground speed while waiting
- "Rover is circling ✓" confirmation → enable Next
- Emergency "Abort" button always visible → sets HOLD mode + disarms

### Step 4 — Start Tune
- Snapshot current values of all 11 tuned params (for before/after comparison in Step 6)
- "Start QuickTune" button → `POST /api/quicktune/aux_function { func_id: 300, pos: 1 }`
- On success: show brief confirmation ("Tune started — monitoring progress...") then auto-advance to Step 5

### Step 5 — Live Monitor
- Subscribe to Socket.IO event `quicktune_log`
  - Payload: `{ message: string, severity: "INFO"|"WARNING"|"NOTICE"|"CRITICAL", ts: number }`
- Scrolling log panel (auto-scroll to bottom, most recent at bottom)
- Progress bar: parsed from messages matching `"RTun: .* (\d+)% complete"`
- Phase indicator: "Steering Tune" or "Speed Tune" based on log content
- Completion detection: message contains `"RTun: Tuning DONE"` → show "Save Gains" button
- "Abort Tune" button (always visible) → `POST /api/quicktune/aux_function { func_id: 300, pos: 0 }` → go back to Step 3

### Step 6 — Save + Results
- "Save Gains" button → `POST /api/quicktune/aux_function { func_id: 300, pos: 2 }`
- Fetch new param values via `GET /api/params`
- Render side-by-side comparison table:
  ```
  Parameter           | Before    | After     | Change
  ATC_STR_RAT_FF      | 0.200     | 0.342     | +71%
  ATC_STR_RAT_P       | 0.200     | 0.171     | -14%
  ...
  ```
- Color code: green = improved, yellow = changed, grey = unchanged
- "Done" button → `POST /api/set_mode { mode: "HOLD" }` → close modal → return to Dashboard

---

## File Structure

### New Files
```
src/
  screens/
    QuickTuneScreen.tsx                 ← Full-screen modal, mounts wizard
  components/quicktune/
    QuickTuneWizard.tsx                 ← Step state machine, step navigation
    steps/
      Step1_ParamCheck.tsx
      Step2_ScriptCheck.tsx
      Step3_ArmCircle.tsx
      Step4_TuneControl.tsx
      Step5_Monitor.tsx
      Step6_Results.tsx
  services/
    quickTuneService.ts                 ← All API calls (mocked)
  types/
    quicktune.ts                        ← TypeScript types for entire feature
  assets/
    scripts/
      rover-quicktune.lua               ← Bundled script asset
```

### Modified Files
```
src/screens/DashboardScreen.tsx         ← Add "Quick Tune" card button
```

---

## TypeScript Types

```typescript
// src/types/quicktune.ts

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export type TuneState =
  | 'idle'
  | 'checking_params'
  | 'checking_script'
  | 'arming'
  | 'circling'
  | 'starting'
  | 'tuning'
  | 'done'
  | 'saving'
  | 'complete'
  | 'aborted';

export interface QuickTuneParam {
  name: string;
  expectedValue: number;
  currentValue: number;
  description: string;
  requiresReboot?: boolean;
}

export interface ScriptCheckResult {
  exists: boolean;
  path: string;
}

export interface AuxFunctionPayload {
  func_id: 300;
  pos: 0 | 1 | 2;
}

export interface QuickTuneLogEntry {
  message: string;
  severity: 'INFO' | 'WARNING' | 'NOTICE' | 'CRITICAL';
  ts: number;
}

export interface ParamSnapshot {
  [paramName: string]: number;
}

export interface TuneResult {
  paramName: string;
  before: number;
  after: number;
  changePct: number;
}
```

---

## Backend API Contract

All new endpoints to be implemented by backend team after frontend is complete.

### GET `/api/quicktune/script/check`
```json
Response: { "exists": true, "path": "APM/scripts/rover-quicktune.lua" }
```
Implementation: Use MAVFtp to list `APM/scripts/` directory on flight controller.

### POST `/api/quicktune/script/upload`
```
Request: multipart/form-data with field "file" = rover-quicktune.lua contents
Response: { "success": true, "message": "Script uploaded to APM/scripts/rover-quicktune.lua" }
```
Implementation: Use MAVFtp PUT to upload file to `APM/scripts/rover-quicktune.lua`.

### POST `/api/quicktune/aux_function`
```json
Request:  { "func_id": 300, "pos": 1 }
Response: { "success": true }
```
Implementation: Send `MAV_CMD_DO_AUX_FUNCTION` (519) via MAVROS/pymavlink with `param1=func_id, param2=pos`.

### Socket.IO Event: `quicktune_log`
```json
{ "message": "RTun: ATC_STR_RAT_FF 45% complete", "severity": "INFO", "ts": 1743800000000 }
```
Implementation: Subscribe to MAVROS `/mavros/statustext/recv` topic (or pymavlink STATUSTEXT), filter messages starting with `"RTun:"`, emit as `quicktune_log` Socket.IO event.

### Existing Endpoints Used
- `GET /api/params` — fetch all params (Step 1 + Step 6)
- `POST /api/params/{name}` — set single param (Step 1 inline edit)
- `POST /api/arm` — arm rover (Step 3)
- `POST /api/set_mode` — change flight mode (Step 3 + Step 6)

---

## Mock Service Implementation Pattern

```typescript
// src/services/quickTuneService.ts

export const quickTuneService = {
  checkScript: async (): Promise<ScriptCheckResult> => {
    // MOCK — replace with: fetch(`${getBackendURL()}/api/quicktune/script/check`)
    return { exists: false, path: '' };
  },

  uploadScript: async (fileContent: string): Promise<{ success: boolean }> => {
    // MOCK — replace with: fetch POST multipart to /api/quicktune/script/upload
    return { success: true };
  },

  sendAuxFunction: async (pos: 0 | 1 | 2): Promise<{ success: boolean }> => {
    // MOCK — replace with: fetch POST to /api/quicktune/aux_function
    return { success: true };
  },
};
```

---

## STATUSTEXT Message Reference

Messages emitted by rover-quicktune.lua (from actual source):

| Message | Meaning |
|---|---|
| `"Rover quiktune loaded"` | Script running on FC |
| `"RTun: starting ATC_STR_RAT tune"` | Steering phase started |
| `"RTun: ATC_STR_RAT_FF 45% complete"` | Progress (every 5s) |
| `"RTun: increase steering (8% < 10%)"` | Needs more steering |
| `"RTun: adjusted ATC_STR_RAT_FF 0.200 -> 0.342"` | Gain updated |
| `"RTun: ATC_STR_RAT_FF tuning done"` | Steering done |
| `"RTun: starting ATC_SPEED tune"` | Speed phase started |
| `"RTun: Tuning DONE"` | All axes complete |
| `"RTun: tuning gains saved"` | After HIGH switch |
| `"RTun: gains reverted"` | After LOW switch (abort) |
| `"RTun: must be armed and moving to tune"` | Pre-condition failed |

---

## Design Constraints

- **No backend changes during frontend build** — all new endpoints mocked
- **Existing param infrastructure reused** — Step 1 and Step 6 use `services.getParams()` / `services.setParam()` already implemented
- **Bundled script** — `rover-quicktune.lua` copied from `temp/ardurover-4.5.6/libraries/AP_Scripting/applets/rover-quicktune.lua` into `src/assets/scripts/` — no user download needed
- **Abort always accessible** — Steps 3–5 always show abort/emergency stop
- **Follows existing UI patterns** — same card/pill/badge components as Dashboard and Settings screens
