# QuickTune Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 6-step full-screen wizard modal on the Dashboard that replaces Mission Planner for the ArduRover QuickTune PID tuning workflow.

**Architecture:** A `QuickTuneScreen` full-screen modal hosts `QuickTuneWizard` which manages 6 sequential step components. All new API calls go through `quickTuneService.ts` which returns mocked responses — real backend endpoints are defined by contract in the spec at `docs/superpowers/specs/2026-04-04-quicktune-design.md`. Steps share state via wizard-level props.

**Tech Stack:** React Native 0.81, Expo 54, TypeScript, Socket.IO client v4, `@expo/vector-icons`, `expo-document-picker`, `expo-file-system`, existing `useRover()` context for telemetry + services.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/quicktune.ts` | Create | All types for the feature |
| `src/assets/scripts/roverQuicktuneScript.ts` | Create | Embedded Lua script as string constant |
| `src/services/quickTuneService.ts` | Create | Mocked API contract for all new endpoints |
| `src/config.ts` | Modify | Add `QUICKTUNE_*` API endpoint constants |
| `src/components/quicktune/steps/Step1_ParamCheck.tsx` | Create | Show/edit pre-tune params |
| `src/components/quicktune/steps/Step2_ScriptCheck.tsx` | Create | Check + upload rover-quicktune.lua |
| `src/components/quicktune/steps/Step3_ArmCircle.tsx` | Create | Arm rover + set CIRCLE mode |
| `src/components/quicktune/steps/Step4_TuneControl.tsx` | Create | Snapshot params + start tune |
| `src/components/quicktune/steps/Step5_Monitor.tsx` | Create | Live STATUSTEXT log + progress |
| `src/components/quicktune/steps/Step6_Results.tsx` | Create | Before/after PID comparison + save |
| `src/components/quicktune/QuickTuneWizard.tsx` | Create | Step state machine, shared wizard state |
| `src/screens/QuickTuneScreen.tsx` | Create | Full-screen modal wrapper |
| `src/screens/DashboardScreen.tsx` | Modify | Add QuickTune card button |

---

## Task 1: TypeScript Types

**Files:**
- Create: `src/types/quicktune.ts`
- Create: `src/types/__tests__/quicktune.test.ts`

- [ ] **Step 1: Write the type tests**

```typescript
// src/types/__tests__/quicktune.test.ts
import {
  WizardStep,
  TuneState,
  QuickTuneParam,
  ScriptCheckResult,
  AuxFunctionPayload,
  QuickTuneLogEntry,
  ParamSnapshot,
  TuneResult,
  WizardSharedState,
  PRETUNE_PARAMS,
  TUNED_PARAMS,
} from '../quicktune';

describe('quicktune types', () => {
  it('PRETUNE_PARAMS contains all 18 required params', () => {
    const required = [
      'SCR_ENABLE', 'RTUN_ENABLE', 'RTUN_AXES', 'RTUN_AUTO_FILTER',
      'RTUN_AUTO_SAVE', 'RTUN_RC_FUNC', 'RTUN_STR_FFRATIO', 'RTUN_STR_P_RATIO',
      'RTUN_STR_I_RATIO', 'RTUN_SPD_FFRATIO', 'RTUN_SPD_P_RATIO', 'RTUN_SPD_I_RATIO',
      'CIRC_SPEED', 'CIRC_RADIUS', 'CIRC_DIR', 'ATC_STR_ACC_MAX',
      'ATC_STR_RAT_MAX', 'ATC_BRAKE',
    ];
    const names = PRETUNE_PARAMS.map(p => p.name);
    required.forEach(r => expect(names).toContain(r));
  });

  it('TUNED_PARAMS contains all 11 params updated by the script', () => {
    const required = [
      'ATC_STR_RAT_FF', 'ATC_STR_RAT_P', 'ATC_STR_RAT_I', 'ATC_STR_RAT_D',
      'ATC_STR_RAT_FLTD', 'ATC_STR_RAT_FLTT',
      'ATC_SPEED_P', 'ATC_SPEED_I', 'ATC_SPEED_D',
      'CRUISE_SPEED', 'CRUISE_THROTTLE',
    ];
    required.forEach(r => expect(TUNED_PARAMS).toContain(r));
  });

  it('AuxFunctionPayload pos is constrained to 0|1|2', () => {
    const low: AuxFunctionPayload = { func_id: 300, pos: 0 };
    const mid: AuxFunctionPayload = { func_id: 300, pos: 1 };
    const high: AuxFunctionPayload = { func_id: 300, pos: 2 };
    expect(low.pos).toBe(0);
    expect(mid.pos).toBe(1);
    expect(high.pos).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd D:/Final/DYX-GCS-Mobile
npx jest src/types/__tests__/quicktune.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../quicktune'`

- [ ] **Step 3: Create the types file**

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

export type ParamSnapshot = Record<string, number>;

export interface TuneResult {
  paramName: string;
  before: number;
  after: number;
  changePct: number;
}

export interface WizardSharedState {
  paramSnapshot: ParamSnapshot;
  tuneResults: TuneResult[];
}

// Pre-tune parameters that must be verified/set before starting
export const PRETUNE_PARAMS: QuickTuneParam[] = [
  { name: 'SCR_ENABLE',        expectedValue: 1,   description: 'Enable Lua scripting', requiresReboot: true },
  { name: 'RTUN_ENABLE',       expectedValue: 1,   description: 'Enable QuickTune script' },
  { name: 'RTUN_AXES',         expectedValue: 3,   description: 'Tune both steering + speed (bitmask)' },
  { name: 'RTUN_AUTO_FILTER',  expectedValue: 1,   description: 'Auto-set PID filters from INS_GYRO' },
  { name: 'RTUN_AUTO_SAVE',    expectedValue: 5,   description: 'Auto-save gains after 5s of completion' },
  { name: 'RTUN_RC_FUNC',      expectedValue: 300, description: 'RC function: Scripting1' },
  { name: 'RTUN_STR_FFRATIO',  expectedValue: 0.9, description: 'Steering FF ratio (0.9 = 90% of measured)' },
  { name: 'RTUN_STR_P_RATIO',  expectedValue: 0.5, description: 'Steering P = FF × 0.5' },
  { name: 'RTUN_STR_I_RATIO',  expectedValue: 0.5, description: 'Steering I = FF × 0.5' },
  { name: 'RTUN_SPD_FFRATIO',  expectedValue: 1.0, description: 'Speed FF ratio' },
  { name: 'RTUN_SPD_P_RATIO',  expectedValue: 1.0, description: 'Speed P = FF × 1.0' },
  { name: 'RTUN_SPD_I_RATIO',  expectedValue: 1.0, description: 'Speed I = FF × 1.0' },
  { name: 'CIRC_SPEED',        expectedValue: 1.0, description: 'Circle mode speed (m/s)' },
  { name: 'CIRC_RADIUS',       expectedValue: 4.0, description: 'Circle radius (meters, min 4m)' },
  { name: 'CIRC_DIR',          expectedValue: 0,   description: 'Circle direction: 0=clockwise' },
  { name: 'ATC_STR_ACC_MAX',   expectedValue: 90,  description: 'Max steering angular acceleration (deg/s²)' },
  { name: 'ATC_STR_RAT_MAX',   expectedValue: 90,  description: 'Max steering rate (deg/s)' },
  { name: 'ATC_BRAKE',         expectedValue: 1,   description: 'Enable speed control braking' },
];

// Parameters automatically updated by the QuickTune Lua script
export const TUNED_PARAMS: string[] = [
  'ATC_STR_RAT_FF', 'ATC_STR_RAT_P', 'ATC_STR_RAT_I', 'ATC_STR_RAT_D',
  'ATC_STR_RAT_FLTD', 'ATC_STR_RAT_FLTT',
  'ATC_SPEED_P', 'ATC_SPEED_I', 'ATC_SPEED_D',
  'CRUISE_SPEED', 'CRUISE_THROTTLE',
];
```

- [ ] **Step 4: Run tests — confirm passing**

```bash
npx jest src/types/__tests__/quicktune.test.ts --no-coverage
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/types/quicktune.ts src/types/__tests__/quicktune.test.ts
git commit -m "feat(quicktune): add TypeScript types and param constants"
```

---

## Task 2: Embedded Script Asset + Service + Config

**Files:**
- Create: `src/assets/scripts/roverQuicktuneScript.ts`
- Create: `src/services/quickTuneService.ts`
- Create: `src/services/__tests__/quickTuneService.test.ts`
- Modify: `src/config.ts`

- [ ] **Step 1: Write service tests**

```typescript
// src/services/__tests__/quickTuneService.test.ts
import { quickTuneService } from '../quickTuneService';

describe('quickTuneService (mocked)', () => {
  it('checkScript returns { exists, path }', async () => {
    const result = await quickTuneService.checkScript();
    expect(typeof result.exists).toBe('boolean');
    expect(typeof result.path).toBe('string');
  });

  it('uploadScript returns { success }', async () => {
    const result = await quickTuneService.uploadScript('-- lua content');
    expect(typeof result.success).toBe('boolean');
  });

  it('sendAuxFunction returns { success } for pos 0', async () => {
    const result = await quickTuneService.sendAuxFunction(0);
    expect(typeof result.success).toBe('boolean');
  });

  it('sendAuxFunction returns { success } for pos 1', async () => {
    const result = await quickTuneService.sendAuxFunction(1);
    expect(typeof result.success).toBe('boolean');
  });

  it('sendAuxFunction returns { success } for pos 2', async () => {
    const result = await quickTuneService.sendAuxFunction(2);
    expect(typeof result.success).toBe('boolean');
  });

  it('setFlightMode returns { success }', async () => {
    const result = await quickTuneService.setFlightMode('CIRCLE');
    expect(typeof result.success).toBe('boolean');
  });

  it('armRover returns { success }', async () => {
    const result = await quickTuneService.armRover();
    expect(typeof result.success).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run tests — confirm fail**

```bash
npx jest src/services/__tests__/quickTuneService.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../quickTuneService'`

- [ ] **Step 3: Create the script asset**

Copy the actual lua file as a string constant. Run this shell command to embed it:

```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('temp/ardurover-4.5.6/libraries/AP_Scripting/applets/rover-quicktune.lua', 'utf8');
const escaped = content.replace(/\`/g, '\\\`').replace(/\\\$/g, '\\\\\$');
const output = '// Auto-generated from temp/ardurover-4.5.6/libraries/AP_Scripting/applets/rover-quicktune.lua\n// ArduPilot 4.5.6 — do not edit manually\nexport const ROVER_QUICKTUNE_SCRIPT = \`' + escaped + '\`;\n';
fs.writeFileSync('src/assets/scripts/roverQuicktuneScript.ts', output);
console.log('Written:', output.length, 'bytes');
"
```

- [ ] **Step 4: Add endpoints to config.ts**

Open `src/config.ts`. After the `PARAMS_GROUPS` line (line ~188), add inside `API_ENDPOINTS`:

```typescript
  // QuickTune (frontend contract — backend implements these)
  QUICKTUNE_SCRIPT_CHECK: '/api/quicktune/script/check',
  QUICKTUNE_SCRIPT_UPLOAD: '/api/quicktune/script/upload',
  QUICKTUNE_AUX_FUNCTION: '/api/quicktune/aux_function',
  QUICKTUNE_SET_FLIGHT_MODE: '/api/set_mode',
  QUICKTUNE_ARM: '/api/arm',
```

Also add to `SOCKET_EVENTS` (after the last entry):
```typescript
  QUICKTUNE_LOG: 'quicktune_log',
```

- [ ] **Step 5: Create quickTuneService.ts**

```typescript
// src/services/quickTuneService.ts
import { getBackendURL } from '../config';
import { ScriptCheckResult } from '../types/quicktune';
import { ROVER_QUICKTUNE_SCRIPT } from '../assets/scripts/roverQuicktuneScript';

const getBase = () => getBackendURL().replace(/\/$/, '');

// ─── MOCK FLAG ─────────────────────────────────────────────────────────────
// Set to false once backend implements these endpoints
const USE_MOCK = true;
// ───────────────────────────────────────────────────────────────────────────

export const quickTuneService = {
  /**
   * Check if rover-quicktune.lua exists on the flight controller's SD card.
   * Backend: GET /api/quicktune/script/check
   * Response: { exists: boolean, path: string }
   */
  checkScript: async (): Promise<ScriptCheckResult> => {
    if (USE_MOCK) {
      // MOCK: simulate script not found — change to true to test "found" path
      return { exists: false, path: '' };
    }
    const res = await fetch(`${getBase()}/api/quicktune/script/check`);
    return res.json();
  },

  /**
   * Upload rover-quicktune.lua to the flight controller via MAVFtp.
   * Backend: POST /api/quicktune/script/upload
   * Body: { filename: string, content: string }
   * Response: { success: boolean, message: string }
   */
  uploadScript: async (content: string = ROVER_QUICKTUNE_SCRIPT): Promise<{ success: boolean; message?: string }> => {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 1500)); // simulate upload delay
      return { success: true, message: 'Script uploaded to APM/scripts/rover-quicktune.lua' };
    }
    const res = await fetch(`${getBase()}/api/quicktune/script/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'rover-quicktune.lua', content }),
    });
    return res.json();
  },

  /**
   * Send DO_AUX_FUNCTION MAVLink command (ID 519) to control the QuickTune script.
   * pos: 0 = LOW (abort/revert), 1 = MID (start/resume), 2 = HIGH (save gains)
   * Backend: POST /api/quicktune/aux_function
   * Body: { func_id: 300, pos: 0|1|2 }
   * Response: { success: boolean }
   */
  sendAuxFunction: async (pos: 0 | 1 | 2): Promise<{ success: boolean }> => {
    if (USE_MOCK) {
      return { success: true };
    }
    const res = await fetch(`${getBase()}/api/quicktune/aux_function`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ func_id: 300, pos }),
    });
    return res.json();
  },

  /**
   * Set rover flight mode (CIRCLE, HOLD, AUTO, etc.)
   * Backend: POST /api/set_mode
   * Body: { mode: string }
   * Response: { success: boolean }
   */
  setFlightMode: async (mode: string): Promise<{ success: boolean }> => {
    if (USE_MOCK) {
      return { success: true };
    }
    const res = await fetch(`${getBase()}/api/set_mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    return res.json();
  },

  /**
   * Arm the rover.
   * Backend: POST /api/arm
   * Body: { value: true }
   * Response: { success: boolean }
   */
  armRover: async (): Promise<{ success: boolean }> => {
    if (USE_MOCK) {
      return { success: true };
    }
    const res = await fetch(`${getBase()}/api/arm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: true }),
    });
    return res.json();
  },
};
```

- [ ] **Step 6: Run tests — confirm passing**

```bash
npx jest src/services/__tests__/quickTuneService.test.ts --no-coverage
```
Expected: PASS (7 tests)

- [ ] **Step 7: Commit**

```bash
git add src/assets/scripts/roverQuicktuneScript.ts src/services/quickTuneService.ts src/services/__tests__/quickTuneService.test.ts src/config.ts
git commit -m "feat(quicktune): add service layer, script asset, and config endpoints"
```

---

## Task 3: Step 1 — Parameter Check

**Files:**
- Create: `src/components/quicktune/steps/Step1_ParamCheck.tsx`

> Note: Tests for React Native components require `testEnvironment: react-native` which is not configured in this project. Verify this step visually when running the app. Focus tests remain on the service layer.

- [ ] **Step 1: Create Step1_ParamCheck.tsx**

```typescript
// src/components/quicktune/steps/Step1_ParamCheck.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { useRover } from '../../../context/RoverContext';
import { PRETUNE_PARAMS, QuickTuneParam } from '../../../types/quicktune';

interface ParamStatus {
  param: QuickTuneParam;
  currentValue: number | null;
  editValue: string;
  saving: boolean;
  ok: boolean;
}

interface Props {
  onComplete: () => void;
}

const TOLERANCE = 0.001; // float comparison tolerance

function isOk(current: number | null, expected: number): boolean {
  if (current === null) return false;
  return Math.abs(current - expected) <= TOLERANCE;
}

export function Step1_ParamCheck({ onComplete }: Props) {
  const { services } = useRover();
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<ParamStatus[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [rebootNeeded, setRebootNeeded] = useState(false);

  const loadParams = useCallback(async () => {
    setLoading(true);
    try {
      const result = await services.getParams();
      const paramMap: Record<string, number> = {};
      if (result.success && result.params) {
        result.params.forEach((p: any) => { paramMap[p.name] = p.value; });
      }
      const built: ParamStatus[] = PRETUNE_PARAMS.map(param => {
        const current = paramMap[param.name] ?? null;
        return {
          param,
          currentValue: current,
          editValue: current !== null ? String(current) : '',
          saving: false,
          ok: isOk(current, param.expectedValue),
        };
      });
      setStatuses(built);
    } finally {
      setLoading(false);
    }
  }, [services]);

  useEffect(() => { loadParams(); }, [loadParams]);

  const handleSave = async (index: number) => {
    const s = statuses[index];
    const newVal = parseFloat(s.editValue);
    if (isNaN(newVal)) return;

    setSaving(prev => ({ ...prev, [s.param.name]: true }));
    try {
      const res = await services.setParam(s.param.name, newVal);
      if (res.success) {
        setStatuses(prev => prev.map((item, i) =>
          i === index
            ? { ...item, currentValue: newVal, ok: isOk(newVal, item.param.expectedValue) }
            : item
        ));
        if (s.param.requiresReboot) setRebootNeeded(true);
      }
    } finally {
      setSaving(prev => ({ ...prev, [s.param.name]: false }));
    }
  };

  const handleEditChange = (index: number, value: string) => {
    setStatuses(prev => prev.map((item, i) => i === index ? { ...item, editValue: value } : item));
  };

  const allOk = statuses.length > 0 && statuses.every(s => s.ok);

  const handleNext = () => {
    if (rebootNeeded) {
      Alert.alert(
        'Reboot Required',
        'SCR_ENABLE was changed. Please reboot the flight controller before continuing.',
        [{ text: 'OK', onPress: onComplete }]
      );
    } else {
      onComplete();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Reading parameters...</Text>
      </View>
    );
  }

  const problemCount = statuses.filter(s => !s.ok).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Parameter Check</Text>
        <Text style={styles.subtitle}>
          {problemCount === 0
            ? 'All parameters correct'
            : `${problemCount} parameter${problemCount > 1 ? 's' : ''} need adjustment`}
        </Text>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {statuses.map((s, i) => (
          <View key={s.param.name} style={[styles.row, !s.ok && styles.rowWarn]}>
            <View style={styles.rowLeft}>
              <Ionicons
                name={s.ok ? 'checkmark-circle' : 'warning'}
                size={18}
                color={s.ok ? colors.success : colors.warning}
                style={styles.rowIcon}
              />
              <View>
                <Text style={styles.paramName}>{s.param.name}</Text>
                <Text style={styles.paramDesc} numberOfLines={1}>{s.param.description}</Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              {s.ok ? (
                <Text style={[styles.valueText, { color: colors.success }]}>
                  {s.currentValue}
                </Text>
              ) : (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.input}
                    value={s.editValue}
                    onChangeText={v => handleEditChange(i, v)}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={() => handleSave(i)}
                    disabled={saving[s.param.name]}
                  >
                    {saving[s.param.name]
                      ? <ActivityIndicator size="small" color={colors.text} />
                      : <Text style={styles.applyText}>Set</Text>
                    }
                  </TouchableOpacity>
                  <Text style={styles.expectedText}>exp: {s.param.expectedValue}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.nextBtn, !allOk && styles.nextBtnDisabled]}
        onPress={handleNext}
        disabled={!allOk}
      >
        <Text style={styles.nextText}>
          {allOk ? 'Parameters OK — Next' : `Fix ${problemCount} param${problemCount > 1 ? 's' : ''} to continue`}
        </Text>
        <Ionicons name="arrow-forward" size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  list: { flex: 1, paddingHorizontal: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.cardBg, borderRadius: 8, marginBottom: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  rowWarn: { borderColor: colors.warning + '66' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowIcon: { marginRight: 8 },
  paramName: { fontSize: 13, fontWeight: '700', color: colors.text },
  paramDesc: { fontSize: 11, color: colors.textMuted, maxWidth: 180 },
  rowRight: { alignItems: 'flex-end', minWidth: 100 },
  valueText: { fontSize: 14, fontWeight: '700' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: {
    backgroundColor: colors.panelBg, borderRadius: 6,
    borderWidth: 1, borderColor: colors.accent,
    color: colors.text, fontSize: 13, paddingHorizontal: 8,
    paddingVertical: 4, width: 70, textAlign: 'center',
  },
  applyBtn: {
    backgroundColor: colors.accent, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6, minWidth: 36, alignItems: 'center',
  },
  applyText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  expectedText: { fontSize: 10, color: colors.textMuted },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: 16, paddingVertical: 14, borderRadius: 10,
    backgroundColor: colors.accent,
  },
  nextBtnDisabled: { backgroundColor: colors.textMuted + '44' },
  nextText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/quicktune/steps/Step1_ParamCheck.tsx
git commit -m "feat(quicktune): add Step1 param check component"
```

---

## Task 4: Step 2 — Script Check / Upload

**Files:**
- Create: `src/components/quicktune/steps/Step2_ScriptCheck.tsx`

- [ ] **Step 1: Create Step2_ScriptCheck.tsx**

```typescript
// src/components/quicktune/steps/Step2_ScriptCheck.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { quickTuneService } from '../../../services/quickTuneService';
import { ROVER_QUICKTUNE_SCRIPT } from '../../../assets/scripts/roverQuicktuneScript';

interface Props {
  onComplete: () => void;
}

type CheckState = 'checking' | 'found' | 'not_found' | 'uploading' | 'uploaded' | 'error';

export function Step2_ScriptCheck({ onComplete }: Props) {
  const [state, setState] = useState<CheckState>('checking');
  const [scriptPath, setScriptPath] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await quickTuneService.checkScript();
        if (cancelled) return;
        if (result.exists) {
          setScriptPath(result.path);
          setState('found');
        } else {
          setState('not_found');
        }
      } catch {
        if (!cancelled) {
          setErrorMsg('Could not reach backend to check script');
          setState('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleUpload = async () => {
    setState('uploading');
    try {
      const result = await quickTuneService.uploadScript(ROVER_QUICKTUNE_SCRIPT);
      if (result.success) {
        setScriptPath('APM/scripts/rover-quicktune.lua');
        setState('uploaded');
      } else {
        setErrorMsg(result.message || 'Upload failed');
        setState('error');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Upload error');
      setState('error');
    }
  };

  const handleRetry = () => setState('checking');

  const canProceed = state === 'found' || state === 'uploaded';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Script Check</Text>
        <Text style={styles.subtitle}>Verifying rover-quicktune.lua on flight controller</Text>
      </View>

      <View style={styles.card}>
        {state === 'checking' && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.statusText}>Checking flight controller SD card...</Text>
          </View>
        )}

        {state === 'found' && (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text style={[styles.statusText, { color: colors.success }]}>Script found</Text>
            <Text style={styles.pathText}>{scriptPath}</Text>
          </View>
        )}

        {state === 'uploaded' && (
          <View style={styles.statusRow}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text style={[styles.statusText, { color: colors.success }]}>Upload successful</Text>
            <Text style={styles.pathText}>{scriptPath}</Text>
          </View>
        )}

        {state === 'not_found' && (
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="file-question" size={48} color={colors.warning} />
            <Text style={[styles.statusText, { color: colors.warning }]}>Script not found on rover</Text>
            <Text style={styles.helpText}>
              The bundled rover-quicktune.lua will be uploaded to APM/scripts/ via MAVFtp.
            </Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
              <Ionicons name="cloud-upload" size={18} color={colors.text} />
              <Text style={styles.uploadText}>Upload Bundled Script</Text>
            </TouchableOpacity>
          </View>
        )}

        {state === 'uploading' && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.statusText}>Uploading rover-quicktune.lua...</Text>
            <Text style={styles.helpText}>This may take 5–15 seconds via MAVFtp</Text>
          </View>
        )}

        {state === 'error' && (
          <View style={styles.statusRow}>
            <Ionicons name="close-circle" size={48} color={colors.danger} />
            <Text style={[styles.statusText, { color: colors.danger }]}>Error</Text>
            <Text style={styles.helpText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Ionicons name="refresh" size={16} color={colors.text} />
              <Text style={styles.uploadText}>Retry Check</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
        onPress={onComplete}
        disabled={!canProceed}
      >
        <Text style={styles.nextText}>Script Ready — Next</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  card: {
    margin: 16, backgroundColor: colors.cardBg, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 24, flex: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  statusRow: { alignItems: 'center', gap: 12 },
  statusText: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  pathText: { fontSize: 12, color: colors.textMuted, fontFamily: 'monospace' },
  helpText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accent, borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.warning + 'AA', borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  uploadText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: 16, paddingVertical: 14, borderRadius: 10,
    backgroundColor: colors.accent,
  },
  nextBtnDisabled: { backgroundColor: colors.textMuted + '44' },
  nextText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/quicktune/steps/Step2_ScriptCheck.tsx
git commit -m "feat(quicktune): add Step2 script check and upload component"
```

---

## Task 5: Step 3 — Arm + Circle Mode

**Files:**
- Create: `src/components/quicktune/steps/Step3_ArmCircle.tsx`

- [ ] **Step 1: Create Step3_ArmCircle.tsx**

```typescript
// src/components/quicktune/steps/Step3_ArmCircle.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { useRover } from '../../../context/RoverContext';
import { quickTuneService } from '../../../services/quickTuneService';

interface Props {
  onComplete: () => void;
  onAbort: () => void;
}

export function Step3_ArmCircle({ onComplete, onAbort }: Props) {
  const { telemetry } = useRover();
  const [armingInProgress, setArmingInProgress] = useState(false);
  const [modeInProgress, setModeInProgress] = useState(false);

  const isArmed = telemetry.state.armed;
  const currentMode = telemetry.state.mode;
  const isCircleMode = currentMode === 'CIRCLE';
  const groundSpeed = telemetry.global.vel;
  const isMoving = groundSpeed > 0.1;
  const roverCircling = isArmed && isCircleMode && isMoving;

  const handleArm = async () => {
    setArmingInProgress(true);
    try {
      const result = await quickTuneService.armRover();
      if (!result.success) {
        Alert.alert('Arm Failed', 'Could not arm rover. Check pre-arm conditions.');
      }
    } catch {
      Alert.alert('Error', 'Failed to send arm command');
    } finally {
      setArmingInProgress(false);
    }
  };

  const handleSetCircle = async () => {
    setModeInProgress(true);
    try {
      const result = await quickTuneService.setFlightMode('CIRCLE');
      if (!result.success) {
        Alert.alert('Mode Change Failed', 'Could not switch to CIRCLE mode');
      }
    } catch {
      Alert.alert('Error', 'Failed to send mode command');
    } finally {
      setModeInProgress(false);
    }
  };

  const handleAbort = () => {
    Alert.alert('Abort QuickTune', 'Set rover to HOLD mode and cancel tuning?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Abort', style: 'destructive', onPress: onAbort },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Arm & Circle Mode</Text>
        <Text style={styles.subtitle}>Rover must be armed and circling before tuning</Text>
      </View>

      {/* Step A: Arm */}
      <View style={[styles.stepCard, isArmed && styles.stepCardDone]}>
        <View style={styles.stepHeader}>
          <Ionicons
            name={isArmed ? 'checkmark-circle' : 'ellipse-outline'}
            size={22} color={isArmed ? colors.success : colors.textMuted}
          />
          <Text style={styles.stepLabel}>Step A — Arm Rover</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={[styles.badge, { backgroundColor: (isArmed ? colors.success : colors.danger) + '22' }]}>
            <Text style={[styles.badgeText, { color: isArmed ? colors.success : colors.danger }]}>
              {isArmed ? 'ARMED' : 'DISARMED'}
            </Text>
          </View>
          {!isArmed && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleArm} disabled={armingInProgress}>
              {armingInProgress
                ? <ActivityIndicator size="small" color={colors.text} />
                : <Text style={styles.actionText}>Arm Rover</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Step B: Circle Mode */}
      <View style={[styles.stepCard, isCircleMode && styles.stepCardDone]}>
        <View style={styles.stepHeader}>
          <Ionicons
            name={isCircleMode ? 'checkmark-circle' : 'ellipse-outline'}
            size={22} color={isCircleMode ? colors.success : colors.textMuted}
          />
          <Text style={styles.stepLabel}>Step B — Set CIRCLE Mode</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={[styles.badge, { backgroundColor: colors.accent + '22' }]}>
            <Text style={[styles.badgeText, { color: colors.accentLight }]}>
              MODE: {currentMode}
            </Text>
          </View>
          {!isCircleMode && isArmed && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleSetCircle} disabled={modeInProgress}>
              {modeInProgress
                ? <ActivityIndicator size="small" color={colors.text} />
                : <Text style={styles.actionText}>Set CIRCLE</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Step C: Confirm Moving */}
      <View style={[styles.stepCard, roverCircling && styles.stepCardDone]}>
        <View style={styles.stepHeader}>
          <MaterialCommunityIcons
            name="sync-circle"
            size={22} color={roverCircling ? colors.success : colors.textMuted}
          />
          <Text style={styles.stepLabel}>Step C — Rover Circling</Text>
        </View>
        <View style={styles.stepRow}>
          <Text style={styles.speedText}>Speed: {groundSpeed.toFixed(1)} m/s</Text>
          {roverCircling && (
            <Text style={[styles.confirmText, { color: colors.success }]}>✓ Circling confirmed</Text>
          )}
          {isCircleMode && !isMoving && (
            <Text style={[styles.confirmText, { color: colors.warning }]}>Waiting for rover to move...</Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.abortBtn} onPress={handleAbort}>
          <Ionicons name="stop-circle" size={16} color={colors.danger} />
          <Text style={styles.abortText}>Abort</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextBtn, !roverCircling && styles.nextBtnDisabled]}
          onPress={onComplete}
          disabled={!roverCircling}
        >
          <Text style={styles.nextText}>Rover Circling — Start Tune</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  stepCard: {
    marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.cardBg,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 14,
  },
  stepCardDone: { borderColor: colors.success + '66' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stepLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  actionBtn: {
    backgroundColor: colors.accent, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8, minWidth: 80, alignItems: 'center',
  },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  speedText: { fontSize: 14, color: colors.textSecondary },
  confirmText: { fontSize: 13, fontWeight: '600' },
  footer: {
    flexDirection: 'row', gap: 10, padding: 16,
    marginTop: 'auto',
  },
  abortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.danger, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  abortText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  nextBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 10, backgroundColor: colors.accent,
  },
  nextBtnDisabled: { backgroundColor: colors.textMuted + '44' },
  nextText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/quicktune/steps/Step3_ArmCircle.tsx
git commit -m "feat(quicktune): add Step3 arm and circle mode component"
```

---

## Task 6: Step 4 — Start Tune

**Files:**
- Create: `src/components/quicktune/steps/Step4_TuneControl.tsx`

- [ ] **Step 1: Create Step4_TuneControl.tsx**

```typescript
// src/components/quicktune/steps/Step4_TuneControl.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { useRover } from '../../../context/RoverContext';
import { quickTuneService } from '../../../services/quickTuneService';
import { ParamSnapshot, TUNED_PARAMS } from '../../../types/quicktune';

interface Props {
  onComplete: (snapshot: ParamSnapshot) => void;
  onAbort: () => void;
}

export function Step4_TuneControl({ onComplete, onAbort }: Props) {
  const { services } = useRover();
  const [starting, setStarting] = useState(false);

  const handleStartTune = async () => {
    setStarting(true);
    try {
      // Snapshot current PID values for before/after comparison in Step 6
      const snapshot: ParamSnapshot = {};
      const paramsResult = await services.getParams();
      if (paramsResult.success && paramsResult.params) {
        paramsResult.params.forEach((p: any) => {
          if (TUNED_PARAMS.includes(p.name)) {
            snapshot[p.name] = p.value;
          }
        });
      }

      // Send DO_AUX_FUNCTION(300, pos=1) — switch MID — starts the tune
      const result = await quickTuneService.sendAuxFunction(1);
      if (!result.success) {
        Alert.alert('Error', 'Failed to start QuickTune. Check rover connection.');
        return;
      }

      onComplete(snapshot);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start tune');
    } finally {
      setStarting(false);
    }
  };

  const handleAbort = () => {
    Alert.alert('Abort QuickTune', 'Cancel tuning and set rover to HOLD mode?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Abort', style: 'destructive', onPress: onAbort },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Start QuickTune</Text>
        <Text style={styles.subtitle}>
          This sends the Scripting1 MID signal to begin PID tuning
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={22} color={colors.accent} />
        <View style={styles.infoBody}>
          <Text style={styles.infoTitle}>What happens next</Text>
          <Text style={styles.infoItem}>• Steering FF/P/I tuning (~10–20 seconds)</Text>
          <Text style={styles.infoItem}>• Speed FF/P/I tuning (~10–20 seconds)</Text>
          <Text style={styles.infoItem}>• Progress shown on next screen</Text>
          <Text style={styles.infoItem}>• Do not touch RC sticks during tuning</Text>
        </View>
      </View>

      <View style={styles.paramsCard}>
        <Text style={styles.paramsTitle}>Parameters to be tuned:</Text>
        {TUNED_PARAMS.map(p => (
          <Text key={p} style={styles.paramItem}>• {p}</Text>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.abortBtn} onPress={handleAbort}>
          <Ionicons name="stop-circle" size={16} color={colors.danger} />
          <Text style={styles.abortText}>Abort</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.startBtn, starting && styles.startBtnDisabled]}
          onPress={handleStartTune}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              <Ionicons name="play-circle" size={20} color={colors.text} />
              <Text style={styles.startText}>Start QuickTune</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  infoCard: {
    flexDirection: 'row', gap: 12, margin: 16,
    backgroundColor: colors.accent + '18', borderRadius: 10,
    borderWidth: 1, borderColor: colors.accent + '55',
    padding: 14,
  },
  infoBody: { flex: 1, gap: 4 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.accentLight, marginBottom: 4 },
  infoItem: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  paramsCard: {
    marginHorizontal: 16, backgroundColor: colors.cardBg, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4,
  },
  paramsTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
  paramItem: { fontSize: 12, color: colors.textMuted, fontFamily: 'monospace' },
  footer: { flexDirection: 'row', gap: 10, padding: 16, marginTop: 'auto' },
  abortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.danger, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  abortText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  startBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 10, backgroundColor: colors.success,
  },
  startBtnDisabled: { backgroundColor: colors.textMuted + '44' },
  startText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/quicktune/steps/Step4_TuneControl.tsx
git commit -m "feat(quicktune): add Step4 tune control component"
```

---

## Task 7: Step 5 — Live Monitor

**Files:**
- Create: `src/components/quicktune/steps/Step5_Monitor.tsx`

- [ ] **Step 1: Create Step5_Monitor.tsx**

```typescript
// src/components/quicktune/steps/Step5_Monitor.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { useRover } from '../../../context/RoverContext';
import { quickTuneService } from '../../../services/quickTuneService';
import { QuickTuneLogEntry } from '../../../types/quicktune';

interface Props {
  onComplete: () => void;
  onAbort: () => void;
}

const PROGRESS_REGEX = /RTun: .+ (\d+)% complete/;
const DONE_STRINGS = ['RTun: Tuning DONE', 'RTun: tuning gains saved'];
const STEERING_STRING = 'starting ATC_STR_RAT tune';
const SPEED_STRING = 'starting ATC_SPEED tune';

function getSeverityColor(severity: QuickTuneLogEntry['severity']): string {
  switch (severity) {
    case 'CRITICAL': return colors.danger;
    case 'WARNING':  return colors.warning;
    case 'NOTICE':   return colors.accentLight;
    default:         return colors.textSecondary;
  }
}

export function Step5_Monitor({ onComplete, onAbort }: Props) {
  const { socket } = useRover();
  const [logs, setLogs] = useState<QuickTuneLogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'steering' | 'speed' | 'idle'>('idle');
  const [isDone, setIsDone] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const processLog = useCallback((entry: QuickTuneLogEntry) => {
    setLogs(prev => [...prev, entry]);

    const m = entry.message.match(PROGRESS_REGEX);
    if (m) setProgress(parseInt(m[1], 10));

    if (entry.message.includes(STEERING_STRING)) setPhase('steering');
    if (entry.message.includes(SPEED_STRING)) setPhase('speed');

    if (DONE_STRINGS.some(s => entry.message.includes(s))) {
      setIsDone(true);
      setProgress(100);
    }

    // Auto-scroll
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // Subscribe to Socket.IO quicktune_log events
  useEffect(() => {
    if (!socket) return;

    const handler = (data: QuickTuneLogEntry) => processLog(data);
    socket.on('quicktune_log', handler);

    // In mock mode: inject demo messages after 2s delay
    const isMock = true; // flip to false when backend is ready
    let timer: ReturnType<typeof setTimeout>;
    if (isMock) {
      const demoMessages: QuickTuneLogEntry[] = [
        { message: 'Rover quiktune loaded', severity: 'INFO', ts: Date.now() },
        { message: 'RTun: starting ATC_STR_RAT tune', severity: 'NOTICE', ts: Date.now() + 1000 },
        { message: 'RTun: ATC_STR_RAT_FF 20% complete', severity: 'INFO', ts: Date.now() + 6000 },
        { message: 'RTun: ATC_STR_RAT_FF 60% complete', severity: 'INFO', ts: Date.now() + 11000 },
        { message: 'RTun: ATC_STR_RAT_FF 100% complete', severity: 'INFO', ts: Date.now() + 16000 },
        { message: 'RTun: adjusted ATC_STR_RAT_FF 0.200 -> 0.342', severity: 'INFO', ts: Date.now() + 16500 },
        { message: 'RTun: ATC_STR_RAT_FF tuning done', severity: 'NOTICE', ts: Date.now() + 17000 },
        { message: 'RTun: starting ATC_SPEED tune', severity: 'NOTICE', ts: Date.now() + 21000 },
        { message: 'RTun: ATC_SPEED_FF 50% complete', severity: 'INFO', ts: Date.now() + 26000 },
        { message: 'RTun: ATC_SPEED_FF 100% complete', severity: 'INFO', ts: Date.now() + 31000 },
        { message: 'RTun: Tuning DONE', severity: 'NOTICE', ts: Date.now() + 32000 },
      ];
      let i = 0;
      const inject = () => {
        if (i < demoMessages.length) {
          processLog(demoMessages[i]);
          i++;
          timer = setTimeout(inject, 5000);
        }
      };
      timer = setTimeout(inject, 2000);
    }

    return () => {
      socket.off('quicktune_log', handler);
      clearTimeout(timer);
    };
  }, [socket, processLog]);

  const handleAbort = async () => {
    Alert.alert('Abort Tune', 'This will revert all PID gains to original values.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Abort & Revert',
        style: 'destructive',
        onPress: async () => {
          await quickTuneService.sendAuxFunction(0); // switch LOW = revert
          onAbort();
        },
      },
    ]);
  };

  const phaseLabel = phase === 'steering' ? 'Steering Tune' : phase === 'speed' ? 'Speed Tune' : 'Initialising';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>QuickTune Running</Text>
        <View style={styles.phaseRow}>
          <View style={[styles.phaseBadge, isDone && styles.phaseBadgeDone]}>
            <Text style={[styles.phaseText, isDone && { color: colors.success }]}>
              {isDone ? 'COMPLETE' : phaseLabel.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
      </View>

      {/* Log panel */}
      <ScrollView
        ref={scrollRef}
        style={styles.logPanel}
        showsVerticalScrollIndicator={false}
      >
        {logs.map((entry, i) => (
          <View key={i} style={styles.logRow}>
            <Text style={[styles.logTime, { color: colors.textMuted }]}>
              {new Date(entry.ts).toLocaleTimeString()}
            </Text>
            <Text style={[styles.logMsg, { color: getSeverityColor(entry.severity) }]}>
              {entry.message}
            </Text>
          </View>
        ))}
        {logs.length === 0 && (
          <Text style={styles.waitText}>Waiting for QuickTune messages from rover...</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.abortBtn} onPress={handleAbort}>
          <Ionicons name="stop-circle" size={16} color={colors.danger} />
          <Text style={styles.abortText}>Abort & Revert</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, !isDone && styles.saveBtnDisabled]}
          onPress={onComplete}
          disabled={!isDone}
        >
          <Ionicons name="save" size={18} color={colors.text} />
          <Text style={styles.saveText}>Save Gains</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  phaseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  phaseBadge: {
    backgroundColor: colors.accent + '22', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  phaseBadgeDone: { backgroundColor: colors.success + '22' },
  phaseText: { fontSize: 12, fontWeight: '700', color: colors.accentLight },
  progressText: { fontSize: 14, fontWeight: '700', color: colors.text },
  progressTrack: {
    height: 4, backgroundColor: colors.border,
    marginHorizontal: 16, borderRadius: 2,
  },
  progressFill: {
    height: 4, backgroundColor: colors.accent, borderRadius: 2,
  },
  logPanel: {
    flex: 1, margin: 16, backgroundColor: colors.panelBg,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 12,
  },
  logRow: { flexDirection: 'row', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  logTime: { fontSize: 11, fontFamily: 'monospace', minWidth: 70 },
  logMsg: { fontSize: 12, fontFamily: 'monospace', flex: 1, flexWrap: 'wrap' },
  waitText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 20 },
  footer: { flexDirection: 'row', gap: 10, padding: 16 },
  abortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.danger, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  abortText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 10, backgroundColor: colors.success,
  },
  saveBtnDisabled: { backgroundColor: colors.textMuted + '44' },
  saveText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/quicktune/steps/Step5_Monitor.tsx
git commit -m "feat(quicktune): add Step5 live monitor component"
```

---

## Task 8: Step 6 — Save + Results

**Files:**
- Create: `src/components/quicktune/steps/Step6_Results.tsx`
- Create: `src/components/quicktune/__tests__/tuneResults.test.ts`

- [ ] **Step 1: Write test for result calculation**

```typescript
// src/components/quicktune/__tests__/tuneResults.test.ts
import { computeTuneResults } from '../Step6_Results';
import { ParamSnapshot, TuneResult } from '../../../types/quicktune';

describe('computeTuneResults', () => {
  it('calculates changePct correctly', () => {
    const before: ParamSnapshot = { ATC_STR_RAT_FF: 0.2, ATC_SPEED_P: 0.2 };
    const after: ParamSnapshot  = { ATC_STR_RAT_FF: 0.342, ATC_SPEED_P: 0.2 };
    const results = computeTuneResults(before, after);
    const ffResult = results.find(r => r.paramName === 'ATC_STR_RAT_FF')!;
    expect(ffResult.before).toBeCloseTo(0.2);
    expect(ffResult.after).toBeCloseTo(0.342);
    expect(ffResult.changePct).toBeCloseTo(71, 0);
  });

  it('reports 0% change for unchanged params', () => {
    const before: ParamSnapshot = { ATC_SPEED_P: 0.2 };
    const after: ParamSnapshot  = { ATC_SPEED_P: 0.2 };
    const results = computeTuneResults(before, after);
    expect(results[0].changePct).toBe(0);
  });

  it('only includes params present in before snapshot', () => {
    const before: ParamSnapshot = { ATC_STR_RAT_FF: 0.2 };
    const after: ParamSnapshot  = { ATC_STR_RAT_FF: 0.342, ATC_SPEED_P: 0.5 };
    const results = computeTuneResults(before, after);
    expect(results.length).toBe(1);
    expect(results[0].paramName).toBe('ATC_STR_RAT_FF');
  });
});
```

- [ ] **Step 2: Run test to confirm fail**

```bash
npx jest src/components/quicktune/__tests__/tuneResults.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../Step6_Results'`

- [ ] **Step 3: Create Step6_Results.tsx**

```typescript
// src/components/quicktune/steps/Step6_Results.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { useRover } from '../../../context/RoverContext';
import { quickTuneService } from '../../../services/quickTuneService';
import { ParamSnapshot, TuneResult, TUNED_PARAMS } from '../../../types/quicktune';

// Exported for unit testing
export function computeTuneResults(before: ParamSnapshot, after: ParamSnapshot): TuneResult[] {
  return Object.keys(before).map(paramName => {
    const beforeVal = before[paramName];
    const afterVal = after[paramName] ?? beforeVal;
    const changePct = beforeVal !== 0
      ? Math.round(((afterVal - beforeVal) / Math.abs(beforeVal)) * 100)
      : 0;
    return { paramName, before: beforeVal, after: afterVal, changePct };
  });
}

interface Props {
  paramSnapshot: ParamSnapshot;   // values before tuning (taken in Step 4)
  onComplete: () => void;         // close wizard, return to Dashboard
}

export function Step6_Results({ paramSnapshot, onComplete }: Props) {
  const { services } = useRover();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [results, setResults] = useState<TuneResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSaveGains = async () => {
    setSaving(true);
    try {
      // DO_AUX_FUNCTION(300, pos=2) = switch HIGH = save gains
      const res = await quickTuneService.sendAuxFunction(2);
      if (!res.success) {
        Alert.alert('Save Failed', 'Could not save gains. Try again.');
        return;
      }
      setSaved(true);

      // Load updated param values for comparison
      setLoading(true);
      const paramsResult = await services.getParams();
      if (paramsResult.success && paramsResult.params) {
        const afterSnapshot: ParamSnapshot = {};
        paramsResult.params.forEach((p: any) => {
          if (TUNED_PARAMS.includes(p.name)) afterSnapshot[p.name] = p.value;
        });
        setResults(computeTuneResults(paramSnapshot, afterSnapshot));
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Save failed');
    } finally {
      setSaving(false);
      setLoading(false);
    }
  };

  const getChangeColor = (pct: number) => {
    if (Math.abs(pct) < 1) return colors.textMuted;
    return colors.success;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="checkmark-circle" size={28} color={colors.success} />
        <View>
          <Text style={styles.title}>Tuning Complete!</Text>
          <Text style={styles.subtitle}>
            {saved ? 'Gains saved to flight controller' : 'Press Save to commit new gains'}
          </Text>
        </View>
      </View>

      {!saved ? (
        <View style={styles.saveCard}>
          <Text style={styles.saveInfo}>
            The QuickTune script has calculated new PID gains. Press Save to write them permanently
            to the flight controller (DO_AUX_FUNCTION HIGH).
          </Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveGains}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <>
                <Ionicons name="save" size={20} color={colors.text} />
                <Text style={styles.saveBtnText}>Save Gains to Rover</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Reading updated parameters...</Text>
            </View>
          ) : (
            <ScrollView style={styles.table} showsVerticalScrollIndicator={false}>
              <View style={styles.tableHeader}>
                <Text style={[styles.col, styles.colParam, styles.headerText]}>Parameter</Text>
                <Text style={[styles.col, styles.colVal, styles.headerText]}>Before</Text>
                <Text style={[styles.col, styles.colVal, styles.headerText]}>After</Text>
                <Text style={[styles.col, styles.colChange, styles.headerText]}>Change</Text>
              </View>
              {results.map(r => (
                <View key={r.paramName} style={styles.tableRow}>
                  <Text style={[styles.col, styles.colParam, styles.cellText]} numberOfLines={1}>
                    {r.paramName.replace('ATC_STR_RAT_', '').replace('ATC_SPEED_', 'SPD_')}
                  </Text>
                  <Text style={[styles.col, styles.colVal, styles.cellText]}>
                    {r.before.toFixed(3)}
                  </Text>
                  <Text style={[styles.col, styles.colVal, { color: colors.success }]}>
                    {r.after.toFixed(3)}
                  </Text>
                  <Text style={[styles.col, styles.colChange, { color: getChangeColor(r.changePct) }]}>
                    {r.changePct > 0 ? '+' : ''}{r.changePct}%
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}

      {saved && !loading && (
        <TouchableOpacity style={styles.doneBtn} onPress={onComplete}>
          <Ionicons name="checkmark-done" size={18} color={colors.text} />
          <Text style={styles.doneBtnText}>Done — Return to Dashboard</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary },
  saveCard: {
    margin: 16, backgroundColor: colors.cardBg, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 20, gap: 16,
  },
  saveInfo: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 10, backgroundColor: colors.success,
  },
  saveBtnDisabled: { backgroundColor: colors.textMuted + '44' },
  saveBtnText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  table: { flex: 1, marginHorizontal: 16 },
  tableHeader: {
    flexDirection: 'row', backgroundColor: colors.panelBg,
    borderRadius: 8, padding: 10, marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row', backgroundColor: colors.cardBg,
    borderRadius: 6, padding: 10, marginBottom: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  headerText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  cellText: { fontSize: 12, color: colors.text },
  col: { flex: 1 },
  colParam: { flex: 2, fontFamily: 'monospace', fontSize: 11 },
  colVal: { flex: 1, textAlign: 'right' },
  colChange: { flex: 1, textAlign: 'right', fontWeight: '700' },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: 16, paddingVertical: 14, borderRadius: 10,
    backgroundColor: colors.accent,
  },
  doneBtnText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
```

- [ ] **Step 4: Run tests — confirm passing**

```bash
npx jest src/components/quicktune/__tests__/tuneResults.test.ts --no-coverage
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/quicktune/steps/Step6_Results.tsx src/components/quicktune/__tests__/tuneResults.test.ts
git commit -m "feat(quicktune): add Step6 results and save component"
```

---

## Task 9: QuickTuneWizard — Step State Machine

**Files:**
- Create: `src/components/quicktune/QuickTuneWizard.tsx`

- [ ] **Step 1: Create QuickTuneWizard.tsx**

```typescript
// src/components/quicktune/QuickTuneWizard.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { WizardStep, ParamSnapshot } from '../../types/quicktune';
import { quickTuneService } from '../../services/quickTuneService';
import { Step1_ParamCheck } from './steps/Step1_ParamCheck';
import { Step2_ScriptCheck } from './steps/Step2_ScriptCheck';
import { Step3_ArmCircle } from './steps/Step3_ArmCircle';
import { Step4_TuneControl } from './steps/Step4_TuneControl';
import { Step5_Monitor } from './steps/Step5_Monitor';
import { Step6_Results } from './steps/Step6_Results';

interface Props {
  onClose: () => void;
}

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Params',
  2: 'Script',
  3: 'Arm',
  4: 'Tune',
  5: 'Monitor',
  6: 'Results',
};

export function QuickTuneWizard({ onClose }: Props) {
  const [step, setStep] = useState<WizardStep>(1);
  const [paramSnapshot, setParamSnapshot] = useState<ParamSnapshot>({});

  const goNext = useCallback(() => {
    setStep(prev => Math.min(prev + 1, 6) as WizardStep);
  }, []);

  // Called when Step4 completes — carries the param snapshot for comparison in Step6
  const handleStep4Complete = useCallback((snapshot: ParamSnapshot) => {
    setParamSnapshot(snapshot);
    setStep(5);
  }, []);

  // Abort at any step: send LOW switch, set HOLD mode, close wizard
  const handleAbort = useCallback(async () => {
    try {
      await quickTuneService.sendAuxFunction(0);   // revert all params
      await quickTuneService.setFlightMode('HOLD');
    } catch {
      // best effort — close regardless
    }
    onClose();
  }, [onClose]);

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {([1, 2, 3, 4, 5, 6] as WizardStep[]).map(s => (
          <View key={s} style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              s < step && styles.progressDotDone,
              s === step && styles.progressDotActive,
            ]}>
              {s < step
                ? <Ionicons name="checkmark" size={12} color={colors.text} />
                : <Text style={styles.progressDotText}>{s}</Text>
              }
            </View>
            <Text style={[
              styles.progressLabel,
              s === step && styles.progressLabelActive,
            ]}>
              {STEP_LABELS[s]}
            </Text>
            {s < 6 && <View style={[styles.progressLine, s < step && styles.progressLineDone]} />}
          </View>
        ))}
      </View>

      {/* Step content */}
      <View style={styles.content}>
        {step === 1 && <Step1_ParamCheck onComplete={goNext} />}
        {step === 2 && <Step2_ScriptCheck onComplete={goNext} />}
        {step === 3 && <Step3_ArmCircle onComplete={goNext} onAbort={handleAbort} />}
        {step === 4 && <Step4_TuneControl onComplete={handleStep4Complete} onAbort={handleAbort} />}
        {step === 5 && <Step5_Monitor onComplete={goNext} onAbort={handleAbort} />}
        {step === 6 && <Step6_Results paramSnapshot={paramSnapshot} onComplete={onClose} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  progressBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.panelBg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  progressStep: { alignItems: 'center', flex: 1, position: 'relative' },
  progressDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  progressDotActive: { backgroundColor: colors.accent },
  progressDotDone: { backgroundColor: colors.success },
  progressDotText: { fontSize: 11, color: colors.text, fontWeight: '700' },
  progressLabel: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
  progressLabelActive: { color: colors.accentLight, fontWeight: '700' },
  progressLine: {
    position: 'absolute', top: 12, left: '75%',
    width: '50%', height: 2, backgroundColor: colors.border,
  },
  progressLineDone: { backgroundColor: colors.success },
  content: { flex: 1 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/quicktune/QuickTuneWizard.tsx
git commit -m "feat(quicktune): add QuickTuneWizard step state machine"
```

---

## Task 10: QuickTuneScreen — Full-Screen Modal

**Files:**
- Create: `src/screens/QuickTuneScreen.tsx`

- [ ] **Step 1: Create QuickTuneScreen.tsx**

```typescript
// src/screens/QuickTuneScreen.tsx
import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { QuickTuneWizard } from '../components/quicktune/QuickTuneWizard';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function QuickTuneScreen({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Screen header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="settings" size={16} color={colors.accent} />
            </View>
            <View>
              <Text style={styles.headerTitle}>QUICK TUNE</Text>
              <Text style={styles.headerSub}>ArduRover Auto-PID Tuning</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Wizard content */}
        <QuickTuneWizard onClose={onClose} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.panelBg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: colors.accent + '20', borderWidth: 1,
    borderColor: colors.accent + '40', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  headerSub: { fontSize: 10, color: colors.textMuted },
  closeBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: colors.cardBg, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/QuickTuneScreen.tsx
git commit -m "feat(quicktune): add QuickTuneScreen full-screen modal"
```

---

## Task 11: Dashboard Integration

**Files:**
- Modify: `src/screens/DashboardScreen.tsx`

- [ ] **Step 1: Add QuickTuneScreen import and state**

Open `src/screens/DashboardScreen.tsx`. Add to imports (after existing imports):

```typescript
import { QuickTuneScreen } from './QuickTuneScreen';
```

Add to the `useState` declarations inside `DashboardScreen()` (after `showRobotSettings`):

```typescript
const [showQuickTune, setShowQuickTune] = useState(false);
```

- [ ] **Step 2: Add the QuickTune card to the Dashboard scroll view**

Find the location in the JSX after the Robot Status hero card (around line 137 after `</View>` closing the hero card). Add this card:

```typescript
        {/* ── QUICK TUNE CARD ── */}
        <TouchableOpacity
          style={[styles.card, styles.quickTuneCard]}
          onPress={() => setShowQuickTune(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.cardAccent, { backgroundColor: colors.warning }]} />
          <View style={styles.cardBody}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.cardIconWrap, { borderColor: colors.warning + '40' }]}>
                  <Ionicons name="settings" size={18} color={colors.warning} />
                </View>
                <Text style={styles.cardLabel}>QUICK TUNE</Text>
              </View>
              <View style={[styles.statusBadge, {
                backgroundColor: colors.warning + '20',
                borderColor: colors.warning,
              }]}>
                <Ionicons name="arrow-forward" size={12} color={colors.warning} />
                <Text style={[styles.statusBadgeText, { color: colors.warning }]}>START</Text>
              </View>
            </View>
            <Text style={styles.quickTuneDesc}>
              Auto-tune steering and speed PID gains{'\n'}using Circle mode — replaces Mission Planner
            </Text>
          </View>
        </TouchableOpacity>
```

- [ ] **Step 3: Add QuickTuneScreen modal and styles**

Before the closing `</View>` of the main return, add:

```typescript
        {/* QuickTune Modal */}
        <QuickTuneScreen
          visible={showQuickTune}
          onClose={() => setShowQuickTune(false)}
        />
```

Add to the `styles` object in DashboardScreen:

```typescript
  quickTuneCard: {
    // slightly taller than normal cards
  },
  quickTuneDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
```

- [ ] **Step 4: Run full test suite to verify no regressions**

```bash
npx jest --no-coverage
```
Expected: All existing tests PASS + new quicktune tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/screens/DashboardScreen.tsx
git commit -m "feat(quicktune): add QuickTune card and modal to Dashboard"
```

---

## Task 12: Backend Guide Document

**Files:**
- Create: `docs/QUICKTUNE_BACKEND_GUIDE.md`

- [ ] **Step 1: Create the backend implementation guide**

Use the Write tool (not shell) to create `docs/QUICKTUNE_BACKEND_GUIDE.md` with this content:

```markdown
# QuickTune Backend Implementation Guide

This document defines the exact API contract the frontend expects.
All endpoints are currently mocked in `src/services/quickTuneService.ts`.
Set `USE_MOCK = false` in that file once these endpoints are live.

## New Endpoints Required

### 1. GET /api/quicktune/script/check

Check if rover-quicktune.lua exists on the flight controller SD card.

**Implementation:** Use pymavlink FTP (FILE_TRANSFER_PROTOCOL message 110)
to list `APM/scripts/` directory. Return exists=true if filename is found.

**Response:**
```json
{ "exists": true, "path": "APM/scripts/rover-quicktune.lua" }
{ "exists": false, "path": "" }
```

### 2. POST /api/quicktune/script/upload

Upload rover-quicktune.lua to the flight controller via MAVFtp.

**Request body:**
```json
{ "filename": "rover-quicktune.lua", "content": "-- lua script content here" }
```

**Implementation:** Write content to a temp file, then use pymavlink FTP
PUT to upload to `APM/scripts/rover-quicktune.lua` on the FC SD card.

**Response:**
```json
{ "success": true, "message": "Script uploaded to APM/scripts/rover-quicktune.lua" }
{ "success": false, "message": "MAVFtp upload failed: <error>" }
```

### 3. POST /api/quicktune/aux_function

Send MAV_CMD_DO_AUX_FUNCTION (command ID 519) via MAVLink.

**Request body:**
```json
{ "func_id": 300, "pos": 1 }
```
- `func_id`: always 300 (Scripting1, matches RTUN_RC_FUNC)
- `pos`: 0=LOW (abort+revert), 1=MID (start), 2=HIGH (save)

**Implementation:** Send via pymavlink:
```python
conn.mav.command_long_send(
    conn.target_system,
    conn.target_component,
    519,           # MAV_CMD_DO_AUX_FUNCTION
    0,             # confirmation
    float(func_id), float(pos), 0, 0, 0, 0, 0
)
```

**Response:**
```json
{ "success": true }
{ "success": false, "message": "MAVLink command failed" }
```

### 4. Socket.IO Event: quicktune_log

Stream MAVLink STATUSTEXT messages from the QuickTune script.

**Implementation:** Subscribe to STATUSTEXT (message ID 253) from pymavlink.
Filter messages where text starts with "RTun:" or "Rover quiktune".
Emit as Socket.IO event to all connected clients.

**Payload:**
```json
{
  "message": "RTun: ATC_STR_RAT_FF 45% complete",
  "severity": "INFO",
  "ts": 1743800000000
}
```

**Severity mapping from MAV_SEVERITY:**
- 0 (EMERGENCY) → "CRITICAL"
- 1 (ALERT) → "CRITICAL"
- 2 (CRITICAL) → "CRITICAL"
- 3 (ERROR) → "WARNING"
- 4 (WARNING) → "WARNING"
- 5 (NOTICE) → "NOTICE"
- 6 (INFO) → "INFO"
- 7 (DEBUG) → "INFO"

## Existing Endpoints Used (no changes needed)

- `GET /api/params` — fetch all parameters
- `POST /api/params/{name}` — set single parameter value
- `POST /api/arm` — arm/disarm rover (`{ value: true/false }`)
- `POST /api/set_mode` — change flight mode (`{ mode: "CIRCLE" }`)

## Frontend Mock Switch

Once all endpoints are live, open `src/services/quickTuneService.ts`
and change:
```typescript
const USE_MOCK = true;  // ← change to false
```

- [ ] **Step 2: Commit**

```bash
git add docs/QUICKTUNE_BACKEND_GUIDE.md
git commit -m "docs(quicktune): add backend implementation guide for handoff"
```

---

## Final Check

Run all tests:
```bash
npx jest --no-coverage --verbose
```

Expected passing tests:
- `src/types/__tests__/quicktune.test.ts` — 3 tests
- `src/services/__tests__/quickTuneService.test.ts` — 7 tests
- `src/components/quicktune/__tests__/tuneResults.test.ts` — 3 tests

Launch the app and manually verify:
1. Dashboard shows "QUICK TUNE" card
2. Tapping opens full-screen modal
3. Step 1 loads params (will show WARN badges in mock mode since no real backend)
4. Step 2 shows "Script not found" with upload button (mock returns exists=false)
5. Step 5 shows demo log messages after ~2 seconds and progress bar fills
6. Step 6 shows save button and results table after mock save
