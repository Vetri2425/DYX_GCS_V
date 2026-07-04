import { computeTuneResults } from '../../../utils/quicktuneResults';
import { TUNED_PARAMS } from '../../../types/quicktune';

describe('computeTuneResults', () => {
  it('should calculate correct percentage change for each parameter', () => {
    const before = {
      ATC_STR_RAT_P: 1.0,
      ATC_STR_RAT_I: 0.5,
      ATC_STR_RAT_D: 0.2,
      ATC_SPEED_UP: 2.0,
      ATC_SPEED_DN: 1.5,
      ATC_ACC_MAX: 3.0,
      ATC_DECEL_MAX: 2.5,
      NAVL1_PERIOD: 4.0,
      NAVL1_DAMPING: 0.8,
      SCHED_SPEED_MAX: 5.0,
      SCHED_TURN_MAX: 1.0,
    };

    const after = {
      ATC_STR_RAT_P: 1.2,    // +20%
      ATC_STR_RAT_I: 0.4,    // -20%
      ATC_STR_RAT_D: 0.2,    // 0%
      ATC_SPEED_UP: 2.5,     // +25%
      ATC_SPEED_DN: 1.2,     // -20%
      ATC_ACC_MAX: 3.6,      // +20%
      ATC_DECEL_MAX: 2.0,    // -20%
      NAVL1_PERIOD: 3.6,     // -10%
      NAVL1_DAMPING: 1.0,    // +25%
      SCHED_SPEED_MAX: 6.0,  // +20%
      SCHED_TURN_MAX: 1.3,   // +30%
    };

    const results = computeTuneResults(before, after);

    // Verify all 11 params are present
    expect(results).toHaveLength(11);

    // Check specific param calculations
    const strRatP = results.find((r) => r.name === 'ATC_STR_RAT_P')!;
    expect(strRatP.before).toBe(1.0);
    expect(strRatP.after).toBe(1.2);
    expect(strRatP.changePercent).toBeCloseTo(20, 1);

    const strRatI = results.find((r) => r.name === 'ATC_STR_RAT_I')!;
    expect(strRatI.before).toBe(0.5);
    expect(strRatI.after).toBe(0.4);
    expect(strRatI.changePercent).toBeCloseTo(-20, 1);

    const strRatD = results.find((r) => r.name === 'ATC_STR_RAT_D')!;
    expect(strRatD.changePercent).toBe(0);
  });

  it('should handle zero before values correctly', () => {
    const before = {
      ATC_STR_RAT_P: 0,
      ATC_STR_RAT_I: 0.5,
      ATC_STR_RAT_D: 0.2,
      ATC_SPEED_UP: 2.0,
      ATC_SPEED_DN: 1.5,
      ATC_ACC_MAX: 3.0,
      ATC_DECEL_MAX: 2.5,
      NAVL1_PERIOD: 4.0,
      NAVL1_DAMPING: 0.8,
      SCHED_SPEED_MAX: 5.0,
      SCHED_TURN_MAX: 1.0,
    };

    const after = {
      ATC_STR_RAT_P: 1.5,    // before was 0, should be 100%
      ATC_STR_RAT_I: 0.5,    // 0%
      ATC_STR_RAT_D: 0.2,    // 0%
      ATC_SPEED_UP: 2.0,     // 0%
      ATC_SPEED_DN: 1.5,     // 0%
      ATC_ACC_MAX: 3.0,      // 0%
      ATC_DECEL_MAX: 2.5,    // 0%
      NAVL1_PERIOD: 4.0,     // 0%
      NAVL1_DAMPING: 0.8,    // 0%
      SCHED_SPEED_MAX: 5.0,  // 0%
      SCHED_TURN_MAX: 1.0,   // 0%
    };

    const results = computeTuneResults(before, after);

    const strRatP = results.find((r) => r.name === 'ATC_STR_RAT_P')!;
    expect(strRatP.before).toBe(0);
    expect(strRatP.after).toBe(1.5);
    expect(strRatP.changePercent).toBe(100);
  });

  it('should sort results by absolute change percentage descending', () => {
    const before = {
      ATC_STR_RAT_P: 1.0,
      ATC_STR_RAT_I: 1.0,
      ATC_STR_RAT_D: 1.0,
      ATC_SPEED_UP: 1.0,
      ATC_SPEED_DN: 1.0,
      ATC_ACC_MAX: 1.0,
      ATC_DECEL_MAX: 1.0,
      NAVL1_PERIOD: 1.0,
      NAVL1_DAMPING: 1.0,
      SCHED_SPEED_MAX: 1.0,
      SCHED_TURN_MAX: 1.0,
    };

    const after = {
      ATC_STR_RAT_P: 1.5,     // +50%
      ATC_STR_RAT_I: 1.1,     // +10%
      ATC_STR_RAT_D: 1.05,    // +5%
      ATC_SPEED_UP: 2.0,      // +100%
      ATC_SPEED_DN: 1.0,      // 0%
      ATC_ACC_MAX: 1.3,       // +30%
      ATC_DECEL_MAX: 1.2,     // +20%
      NAVL1_PERIOD: 1.15,     // +15%
      NAVL1_DAMPING: 1.0,     // 0%
      SCHED_SPEED_MAX: 1.4,   // +40%
      SCHED_TURN_MAX: 0.8,    // -20%
    };

    const results = computeTuneResults(before, after);

    // Verify sorting: highest absolute change first
    expect(results[0].name).toBe('ATC_SPEED_UP');     // 100%
    expect(results[0].changePercent).toBeCloseTo(100, 1);

    expect(results[1].name).toBe('ATC_STR_RAT_P');    // 50%
    expect(results[1].changePercent).toBeCloseTo(50, 1);

    expect(results[2].name).toBe('SCHED_SPEED_MAX');  // 40%
    expect(results[2].changePercent).toBeCloseTo(40, 1);

    // Last items should be 0% changes
    const lastTwo = results.slice(-2);
    lastTwo.forEach((r) => {
      expect(r.changePercent).toBe(0);
    });
  });
});
