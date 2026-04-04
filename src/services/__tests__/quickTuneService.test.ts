/**
 * QuickTune Service Unit Tests
 *
 * Tests all mocked QuickTune service methods.
 */

import { quickTuneService, USE_MOCK } from '../quickTuneService';
import { ROVER_QUICKTUNE_SCRIPT } from '../../assets/scripts/roverQuicktuneScript';

describe('QuickTuneService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('USE_MOCK flag', () => {
    it('should have USE_MOCK set to true for easy backend switch', () => {
      expect(USE_MOCK).toBe(true);
    });
  });

  describe('checkScript()', () => {
    it('should return script check response with exists=false and script metadata', async () => {
      const promise = quickTuneService.checkScript();
      await jest.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result).toHaveProperty('exists', false);
      expect(result).toHaveProperty('name', 'rover-quicktune.lua');
      expect(result).toHaveProperty('size');
      expect(result.size).toBe(ROVER_QUICKTUNE_SCRIPT.length);
      expect(result).toHaveProperty('lastModified');
    });
  });

  describe('uploadScript()', () => {
    it('should return success response with uploaded script name', async () => {
      const promise = quickTuneService.uploadScript();
      await jest.advanceTimersByTimeAsync(1500);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.message).toBe('QuickTune script uploaded successfully');
      expect(result.scriptName).toBe('rover-quicktune.lua');
    });
  });

  describe('sendAuxFunction()', () => {
    it('should send AUX start command with default channel 9', async () => {
      const promise = quickTuneService.sendAuxFunction('start');
      await jest.advanceTimersByTimeAsync(300);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.message).toContain('start');
      expect(result.auxChannel).toBe(9);
    });

    it('should send AUX stop command with custom channel', async () => {
      const customChannel = 12;
      const promise = quickTuneService.sendAuxFunction('stop', customChannel);
      await jest.advanceTimersByTimeAsync(300);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.message).toContain('stop');
      expect(result.auxChannel).toBe(customChannel);
    });
  });

  describe('setFlightMode()', () => {
    it('should set flight mode to CIRCLE for QuickTune', async () => {
      const promise = quickTuneService.setFlightMode('CIRCLE');
      await jest.advanceTimersByTimeAsync(400);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.mode).toBe('CIRCLE');
      expect(result.message).toContain('CIRCLE');
    });
  });

  describe('armRover()', () => {
    it('should arm the rover by default', async () => {
      const promise = quickTuneService.armRover(true);
      await jest.advanceTimersByTimeAsync(350);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.armed).toBe(true);
      expect(result.message).toContain('armed');
    });
  });
});
