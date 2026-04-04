/**
 * QuickTune Service Layer
 *
 * Provides mocked API calls for Rover QuickTune functionality.
 * Set USE_MOCK = false to switch to real backend endpoints.
 */

import axios, { AxiosInstance } from 'axios';
import { getBackendURL, API_ENDPOINTS } from '../config';
import { ROVER_QUICKTUNE_SCRIPT } from '../assets/scripts/roverQuicktuneScript';

// Set to false to use real backend endpoints
export const USE_MOCK = true;

export interface ScriptCheckResponse {
  exists: boolean;
  name: string;
  size?: number;
  lastModified?: string;
}

export interface ScriptUploadResponse {
  success: boolean;
  message: string;
  scriptName: string;
}

export interface AuxFunctionResponse {
  success: boolean;
  message: string;
  auxChannel: number;
  position?: number;
}

export interface FlightModeResponse {
  success: boolean;
  message: string;
  mode: string;
}

export interface ArmResponse {
  success: boolean;
  message: string;
  armed: boolean;
}

class QuickTuneService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: getBackendURL(),
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check if the QuickTune script exists on the vehicle
   */
  async checkScript(): Promise<ScriptCheckResponse> {
    if (USE_MOCK) {
      await this._simulateDelay(500);
      return {
        exists: false,
        name: 'rover-quicktune.lua',
        size: ROVER_QUICKTUNE_SCRIPT.length,
        lastModified: new Date().toISOString(),
      };
    }

    const response = await this.api.get(API_ENDPOINTS.QUICKTUNE_SCRIPT_CHECK);
    return response.data;
  }

  /**
   * Upload the QuickTune Lua script to the vehicle
   */
  async uploadScript(): Promise<ScriptUploadResponse> {
    if (USE_MOCK) {
      await this._simulateDelay(1500);
      return {
        success: true,
        message: 'QuickTune script uploaded successfully',
        scriptName: 'rover-quicktune.lua',
      };
    }

    const response = await this.api.post(API_ENDPOINTS.QUICKTUNE_SCRIPT_UPLOAD, {
      script: ROVER_QUICKTUNE_SCRIPT,
      name: 'rover-quicktune.lua',
    });
    return response.data;
  }

  /**
   * Send an AUX function command to control QuickTune (start/stop/save)
   * @param action - 'start', 'stop', or 'save'
   * @param channel - RC AUX channel number (default: 9)
   * @param position - Optional position/value for the AUX function (e.g., 0 for abort, 1 for start)
   */
  async sendAuxFunction(
    action: 'start' | 'stop' | 'save',
    channel: number = 9,
    position?: number,
  ): Promise<AuxFunctionResponse> {
    if (USE_MOCK) {
      await this._simulateDelay(300);
      return {
        success: true,
        message: `AUX function '${action}' sent on channel ${channel}${position !== undefined ? ` with position ${position}` : ''}`,
        auxChannel: channel,
        position,
      };
    }

    const response = await this.api.post(API_ENDPOINTS.QUICKTUNE_AUX_FUNCTION, {
      action,
      channel,
      position,
    });
    return response.data;
  }

  /**
   * Set the rover flight mode (typically to 'CIRCLE' for QuickTune)
   * @param mode - Flight mode name (e.g., 'CIRCLE', 'AUTO', 'MANUAL')
   */
  async setFlightMode(mode: string): Promise<FlightModeResponse> {
    if (USE_MOCK) {
      await this._simulateDelay(400);
      return {
        success: true,
        message: `Flight mode set to '${mode}'`,
        mode,
      };
    }

    const response = await this.api.post(API_ENDPOINTS.SET_MODE, { mode });
    return response.data;
  }

  /**
   * Arm or disarm the rover
   * @param arm - true to arm, false to disarm
   */
  async armRover(arm: boolean = true): Promise<ArmResponse> {
    if (USE_MOCK) {
      await this._simulateDelay(350);
      return {
        success: true,
        message: arm ? 'Rover armed successfully' : 'Rover disarmed',
        armed: arm,
      };
    }

    const response = await this.api.post(API_ENDPOINTS.ARM, { arm });
    return response.data;
  }

  /**
   * Simulate network delay for mock responses
   */
  private _simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const quickTuneService = new QuickTuneService();
export default quickTuneService;
