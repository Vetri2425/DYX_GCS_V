/**
 * Backend Configuration for React Native Mobile App
 * 
 * Environment variables:
 * - VITE_ROS_HTTP_BASE: Backend HTTP base URL (e.g., http://192.168.1.102:5001)
 * - VITE_ROS_WS_URL: WebSocket URL (e.g., ws://192.168.1.102:5001/ws/telemetry)
 */

// Try to read from environment first, fallback to defaults
// Jetson backend defaults (override via env for other targets)
// IMPORTANT: Replace with your actual backend server IP address
const BACKEND_FROM_ENV = process.env.REACT_APP_ROS_HTTP_BASE || 'http://192.168.1.102:5001';
const WS_FROM_ENV = process.env.REACT_APP_ROS_WS_URL || 'ws://192.168.1.102:5001/socket.io';

/**
 * The full URL for the backend API (Socket.IO and HTTP endpoints)
 * Change this default IP if needed, or set environment variables
 */
export const BACKEND_URL = BACKEND_FROM_ENV;

/**
 * WebSocket URL for real-time telemetry
 */
export const WS_URL = WS_FROM_ENV;

/**
 * Socket.IO configuration options
 */
export const SOCKET_CONFIG = {
  // Use websocket as primary transport, fallback to polling
  transports: ['websocket', 'polling'],
  // Reconnect settings
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  // Request timeout
  timeout: 20000,
  // Don't auto-connect, we'll control it
  autoConnect: false,
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
  MISSION_LOAD: '/api/mission/load',
  MISSION_DOWNLOAD: '/api/mission/download',
  MISSION_CLEAR: '/api/mission/clear',
  MISSION_START: '/api/mission/start',
  MISSION_STOP: '/api/mission/stop',
  MISSION_NEXT: '/api/mission/next',
  MISSION_SKIP: '/api/mission/skip',
  MISSION_PAUSE: '/api/mission/pause',
  MISSION_RESUME: '/api/mission/resume',
  MISSION_SET_CURRENT: '/api/mission/set_current',
  
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
  
  // TTS Voice Control
  TTS_STATUS: '/api/tts/status',
  TTS_CONTROL: '/api/tts/control',
  TTS_TEST: '/api/tts/test',
  TTS_SET_LANGUAGE: '/api/tts/language',
  TTS_LANGUAGES: '/api/tts/languages',
  
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
