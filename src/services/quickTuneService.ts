/**
 * QuickTune Service Layer
 *
 * Provides API calls for Rover QuickTune functionality.
 * Communicates with the backend via HTTP endpoints.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { getBackendURL, API_ENDPOINTS } from '../config';
import { ROVER_QUICKTUNE_SCRIPT } from '../assets/scripts/roverQuicktuneScript';
import { QUICKTUNE_AUX_CHANNEL, QUICKTUNE_HTTP_TIMEOUT_MS } from '../constants/quicktune';

const TAG = '[QuickTune]';

/**
 * Retry a fallible async operation up to `maxAttempts` times with linear backoff.
 * Only retries on network/timeout errors (ECONNABORTED, ERR_NETWORK, no response).
 * Does NOT retry on 4xx/5xx responses — those are application errors, not transient failures.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Only retry on network-level failures (no response received)
      const isNetworkError = axios.isAxiosError(err) && !err.response;
      if (!isNetworkError || attempt === maxAttempts) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastErr;
}

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
  reboot_required?: boolean;
}

export interface AuxFunctionResponse {
  success: boolean;
  message: string;
  auxChannel: number;
  position?: number;
  auto_save_seconds?: number;
}

export interface QuickTuneStatusResponse {
  success: boolean;
  SCR_ENABLE: number | null;
  RTUN_ENABLE: number | null;
  RTUN_AUTO_SAVE: number | null;
  current_mode: string;
  reboot_required: boolean;
}

export interface RebootResponse {
  success: boolean;
  message: string;
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

/** Log axios error details — path and error code only, no URLs or response bodies in production */
function logError(method: string, endpoint: string, err: unknown): void {
  if (axios.isAxiosError(err)) {
    const ae = err as AxiosError;
    // Intentionally omit full URL (exposes backend IP) and responseData (may contain sensitive info).
    // Log only the endpoint path, HTTP status, and error code — enough to diagnose without leaking topology.
    console.error(TAG, method, endpoint, {
      code: ae.code,                 // e.g. ECONNABORTED, ERR_NETWORK
      status: ae.response?.status,   // e.g. 404, 500
      statusText: ae.response?.statusText,
      message: ae.message,
    });
  } else {
    console.error(TAG, method, endpoint, err instanceof Error ? err.message : err);
  }
}

class QuickTuneService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: getBackendURL(),
      timeout: QUICKTUNE_HTTP_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Refresh baseURL in case backend IP changed at runtime */
  private refreshBaseURL(): void {
    const url = getBackendURL();
    if (this.api.defaults.baseURL !== url) {
      this.api.defaults.baseURL = url;
    }
  }

  async checkScript(): Promise<ScriptCheckResponse> {
    this.refreshBaseURL();
    try {
      const response = await withRetry(() => this.api.get(API_ENDPOINTS.QUICKTUNE_SCRIPT_CHECK));
      return response.data;
    } catch (err) {
      logError('GET', API_ENDPOINTS.QUICKTUNE_SCRIPT_CHECK, err);
      throw err;
    }
  }

  async uploadScript(): Promise<ScriptUploadResponse> {
    this.refreshBaseURL();
    try {
      const response = await withRetry(() => this.api.post(API_ENDPOINTS.QUICKTUNE_SCRIPT_UPLOAD, {
        script: ROVER_QUICKTUNE_SCRIPT,
        name: 'rover-quicktune.lua',
      }));
      return response.data;
    } catch (err) {
      logError('POST', API_ENDPOINTS.QUICKTUNE_SCRIPT_UPLOAD, err);
      throw err;
    }
  }

  /** Upload a custom script content (from file picker) */
  async uploadScriptContent(content: string, name: string = 'rover-quicktune.lua'): Promise<ScriptUploadResponse> {
    this.refreshBaseURL();
    try {
      const response = await withRetry(() => this.api.post(API_ENDPOINTS.QUICKTUNE_SCRIPT_UPLOAD, {
        script: content,
        name,
      }));
      return response.data;
    } catch (err) {
      logError('POST', API_ENDPOINTS.QUICKTUNE_SCRIPT_UPLOAD, err);
      throw err;
    }
  }

  async sendAuxFunction(
    action: 'start' | 'stop' | 'save',
    auxFunctionId: number = QUICKTUNE_AUX_CHANNEL,
    position?: number,
  ): Promise<AuxFunctionResponse> {
    this.refreshBaseURL();
    const body = { action, aux_function_id: auxFunctionId, position };
    try {
      // sendAuxFunction is safety-critical — retry up to 3 times on transient failures
      const response = await withRetry(() => this.api.post(API_ENDPOINTS.QUICKTUNE_AUX_FUNCTION, body));
      return response.data;
    } catch (err) {
      logError('POST', API_ENDPOINTS.QUICKTUNE_AUX_FUNCTION, err);
      throw err;
    }
  }

  async setFlightMode(mode: string): Promise<FlightModeResponse> {
    this.refreshBaseURL();
    try {
      const response = await withRetry(() => this.api.post(API_ENDPOINTS.SET_MODE, { mode }));
      return response.data;
    } catch (err) {
      logError('POST', API_ENDPOINTS.SET_MODE, err);
      throw err;
    }
  }

  async armRover(arm: boolean = true): Promise<ArmResponse> {
    this.refreshBaseURL();
    try {
      const response = await withRetry(() => this.api.post(API_ENDPOINTS.ARM, { arm }));
      return response.data;
    } catch (err) {
      logError('POST', API_ENDPOINTS.ARM, err);
      throw err;
    }
  }

  /** Get QuickTune status (SCR_ENABLE, RTUN_ENABLE, current_mode, reboot_required) */
  async getStatus(): Promise<QuickTuneStatusResponse> {
    this.refreshBaseURL();
    try {
      const response = await withRetry(() => this.api.get(API_ENDPOINTS.QUICKTUNE_STATUS));
      return response.data;
    } catch (err) {
      logError('GET', API_ENDPOINTS.QUICKTUNE_STATUS, err);
      throw err;
    }
  }

  /** Reboot the flight controller (after script upload when SCR_ENABLE changed) */
  async rebootFC(): Promise<RebootResponse> {
    this.refreshBaseURL();
    try {
      const response = await withRetry(() => this.api.post(API_ENDPOINTS.QUICKTUNE_REBOOT));
      return response.data;
    } catch (err) {
      logError('POST', API_ENDPOINTS.QUICKTUNE_REBOOT, err);
      throw err;
    }
  }
}

export const quickTuneService = new QuickTuneService();
export default quickTuneService;
