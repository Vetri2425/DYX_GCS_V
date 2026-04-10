/**
 * QuickTune Service Unit Tests
 *
 * Tests QuickTune service methods against real HTTP endpoints (mocked via axios).
 */

import axios from 'axios';
import { quickTuneService } from '../quickTuneService';

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
  };
  return {
    create: jest.fn(() => mockAxiosInstance),
    __mockInstance: mockAxiosInstance,
  };
});

const mockAxios = (axios as any).__mockInstance;

describe('QuickTuneService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkScript()', () => {
    it('should call GET endpoint and return script check response', async () => {
      const mockResponse = {
        data: {
          exists: true,
          name: 'rover-quicktune.lua',
          size: 1234,
          lastModified: '2026-04-06T00:00:00Z',
        },
      };
      mockAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await quickTuneService.checkScript();

      expect(mockAxios.get).toHaveBeenCalledWith('/api/quicktune/script');
      expect(result.exists).toBe(true);
      expect(result.name).toBe('rover-quicktune.lua');
    });
  });

  describe('uploadScript()', () => {
    it('should call POST endpoint with script content', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'QuickTune script uploaded successfully',
          scriptName: 'rover-quicktune.lua',
        },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await quickTuneService.uploadScript();

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/quicktune/script/upload',
        expect.objectContaining({
          name: 'rover-quicktune.lua',
          script: expect.any(String),
        }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('sendAuxFunction()', () => {
    it('should send start action with default channel 300', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: "AUX function 'start' sent on channel 300",
          auxChannel: 300,
          position: 1,
        },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await quickTuneService.sendAuxFunction('start');

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/quicktune/aux_function',
        { action: 'start', aux_function_id: 300, position: undefined },
      );
      expect(result.success).toBe(true);
      expect(result.auxChannel).toBe(300);
    });

    it('should send stop action with explicit position 0', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: "AUX function 'stop' sent",
          auxChannel: 300,
          position: 0,
        },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await quickTuneService.sendAuxFunction('stop', 300, 0);

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/quicktune/aux_function',
        { action: 'stop', aux_function_id: 300, position: 0 },
      );
      expect(result.success).toBe(true);
    });
  });

  describe('setFlightMode()', () => {
    it('should set flight mode to CIRCLE', async () => {
      const mockResponse = {
        data: { success: true, message: "Flight mode set to 'CIRCLE'", mode: 'CIRCLE' },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await quickTuneService.setFlightMode('CIRCLE');

      expect(mockAxios.post).toHaveBeenCalledWith('/api/set_mode', { mode: 'CIRCLE' });
      expect(result.mode).toBe('CIRCLE');
    });
  });

  describe('armRover()', () => {
    it('should arm the rover', async () => {
      const mockResponse = {
        data: { success: true, message: 'Rover armed successfully', armed: true },
      };
      mockAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await quickTuneService.armRover(true);

      expect(mockAxios.post).toHaveBeenCalledWith('/api/arm', { arm: true });
      expect(result.armed).toBe(true);
    });
  });
});
