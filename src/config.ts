/**
 * Backend Configuration for React Native Mobile App
 *
 * Environment variables:
 * - VITE_ROS_HTTP_BASE: Backend HTTP base URL (e.g., http://192.168.1.102:5001)
 * - VITE_ROS_WS_URL: WebSocket URL (e.g., ws://192.168.1.102:5001/ws/telemetry)
 *
 * Dynamic URL Configuration:
 * - Backend URL can be set at runtime via setBackendURL()
 * - Saved URL is loaded from AsyncStorage on app start
 * - Falls back to environment variables or defaults
 */

import { getSavedBackendURL } from './utils/backendStorage';

// Default fallback values (supports multiple env variable names)
// FIXED: Use proper fallback - only ONE hardcoded URL here
// The App.tsx probeWithAttempts() will handle trying multiple IPs
const DEFAULT_BACKEND_URL =
  process.env.REACT_APP_ROS_HTTP_BASE ||
  process.env.EXPO_PUBLIC_ROS_HTTP_BASE ||
  process.env.VITE_ROS_HTTP_BASE ||
  'http://192.168.1.242:5001';

const DEFAULT_WS_URL =
  process.env.REACT_APP_ROS_WS_URL ||
  process.env.EXPO_PUBLIC_ROS_WS_URL ||
  process.env.VITE_ROS_WS_URL ||
  'ws://192.168.1.242:5001/socket.io';

// Dynamic backend URL (can be changed at runtime)
let dynamicBackendURL: string | null = null;
let dynamicWsURL: string | null = null;

/**
 * Initialize backend URL from storage
 * Should be called on app startup
 */
export async function initializeBackendURL(): Promise<void> {
  const savedURL = await getSavedBackendURL();
  if (savedURL) {
    dynamicBackendURL = savedURL;
    dynamicWsURL = savedURL.replace('http://', 'ws://').replace('https://', 'wss://') + '/socket.io';
  }
}

/**
 * Set backend URL dynamically (runtime configuration)
 * @param url - The backend URL (e.g., "http://192.168.1.100:5001")
 */
export function setBackendURL(url: string): void {
  dynamicBackendURL = url;
  dynamicWsURL = url.replace('http://', 'ws://').replace('https://', 'wss://') + '/socket.io';
}

/**
 * Get the current backend URL
 * Priority: Dynamic URL > Environment > Default
 */
export function getBackendURL(): string {
  return dynamicBackendURL || DEFAULT_BACKEND_URL;
}

/**
 * Get the current WebSocket URL
 * Priority: Dynamic URL > Environment > Default
 */
export function getWsURL(): string {
  return dynamicWsURL || DEFAULT_WS_URL;
}

/**
 * The full URL for the backend API (Socket.IO and HTTP endpoints)
 * @deprecated Use getBackendURL() instead for dynamic URL support
 */
export const BACKEND_URL = DEFAULT_BACKEND_URL;

/**
 * WebSocket URL for real-time telemetry
 * @deprecated Use getWsURL() instead for dynamic URL support
 */
export const WS_URL = DEFAULT_WS_URL;

/**
 * Socket.IO configuration options
 * Optimized for high-frequency telemetry data
 */
export const SOCKET_CONFIG = {
  // Use WebSocket first for real-time performance, fallback to polling
  transports: ['websocket', 'polling'],
  // Reconnect settings - reduced for faster recovery
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2000,
  // Fast timeout for quick WebSocket attempt, then fallback to polling
  timeout: 5000,
  // Don't auto-connect, we'll control it
  autoConnect: false,
  // Socket.IO path
  path: '/socket.io/',
  // Fast ping for real-time telemetry
  pingInterval: 5000,
  pingTimeout: 3000,
  // Force WebSocket upgrade
  upgrade: true,
  rememberUpgrade: true,
  // Force new connection to avoid stale state
  forceNew: false,
};

/**
 * API endpoints (paths only, full URL built by appending to BACKEND_URL)
 */
export const API_ENDPOINTS = {
  // Vehicle control
  ARM: '/api/arm',
  SET_MODE: '/api/mission/mode',

  // Mission management
  MISSION_UPLOAD: '/api/mission/upload',
  MISSION_LOAD: '/api/mission/load',                    // Legacy - for backward compatibility
  MISSION_LOAD_CONTROLLER: '/api/mission/load_controller',  // NEW - Recommended
  MISSION_DOWNLOAD: '/api/mission/download',
  MISSION_CLEAR: '/api/mission/clear',
  MISSION_START: '/api/mission/start',
  MISSION_STOP: '/api/mission/stop',
  MISSION_NEXT: '/api/mission/next',
  MISSION_SKIP: '/api/mission/skip',
  MISSION_PAUSE: '/api/mission/pause',
  MISSION_RESUME: '/api/mission/resume',
  MISSION_RESTART: '/api/mission/restart',              // Restart from beginning
  MISSION_SET_CURRENT: '/api/mission/set_current',
  MISSION_COMMAND: '/api/mission/command',
  MISSION_STATUS: '/api/mission/status',                // Get mission status

  // RTK - New endpoints per documentation
  RTK_NTRIP_START: '/api/rtk/ntrip_start',
  RTK_NTRIP_STOP: '/api/rtk/ntrip_stop',
  RTK_LORA_START: '/api/rtk/lora_start',
  RTK_LORA_STOP: '/api/rtk/lora_stop',
  RTK_STOP_ALL: '/api/rtk/stop',
  RTK_STATUS: '/api/rtk/status',

  // RTK - Legacy endpoints (deprecated, keeping for backward compatibility)
  RTK_INJECT: '/api/rtk/inject',
  RTK_STOP: '/api/rtk/stop',

  // Servo
  SERVO_CONTROL: '/api/servo/control',
  SERVO_EMERGENCY_STOP: '/servo/emergency_stop',
  SERVO_STATUS: '/servo/status',
  MISSION_SERVO_CONFIG: '/api/mission/servo_config',
  MISSION_SERVO_CONFIG_TEST: '/api/mission/servo_config/test',

  // Activity Logging
  ACTIVITY_LOGS: '/api/activity',
  ACTIVITY_TYPES: '/api/activity/types',
  ACTIVITY_DOWNLOAD: '/api/activity/download',

  // System Monitoring
  NODES_LIST: '/api/nodes',
  NODE_DETAILS: '/api/node/{name}',

  // TTS Voice Control
  TTS_STATUS: '/api/tts/status',
  TTS_CONTROL: '/api/tts/control',
  TTS_TEST: '/api/tts/test',
  TTS_SET_LANGUAGE: '/api/tts/language',
  TTS_LANGUAGES: '/api/tts/languages',
  TTS_GET_GENDER: '/api/tts/gender',
  TTS_SET_GENDER: '/api/tts/gender',

  // LED Controller
  LED_STATUS: '/api/led/status',

  // Configuration
  MISSION_CONFIG: '/api/mission/config',
  SPRAYER_CONFIG: '/api/config/sprayer',
};

/**
 * Socket.IO Event Names
 */
export const SOCKET_EVENTS = {
  // Telemetry
  TELEMETRY: 'telemetry',
  ROVER_DATA: 'rover_data',

  // Mission events
  MISSION_EVENT: 'mission_event',
  MISSION_STATUS: 'mission_status',
  MISSION_ERROR: 'mission_error',
  MISSION_COMMAND_ACK: 'mission_command_ack',
  MISSION_CONTROLLER_STATUS: 'mission_controller_status',
  MISSION_UPLOAD_PROGRESS: 'mission_upload_progress',
  MISSION_DOWNLOAD_PROGRESS: 'mission_download_progress',

  // Failsafe recovery
  FAILSAFE_RESUME_MISSION: 'failsafe_resume_mission',
  FAILSAFE_RESTART_MISSION: 'failsafe_restart_mission',
  FAILSAFE_RESUMED: 'failsafe_resumed',
  FAILSAFE_RESTARTED: 'failsafe_restarted',

  // Activity
  SERVER_ACTIVITY: 'server_activity',
  MISSION_LOGS_SNAPSHOT: 'mission_logs_snapshot',

  // Connection
  PING: 'ping',
  PONG: 'pong',
};

export default {
  BACKEND_URL,
  WS_URL,
  SOCKET_CONFIG,
  API_ENDPOINTS,
  SOCKET_EVENTS,
};
