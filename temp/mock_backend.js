// Mock backend server for development
// Simulates the real backend at 192.168.0.212:5001
// Transparent to frontend - uses same API endpoints and WebSocket events

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuration - matches real backend
const BACKEND_HOST = '192.168.0.212';
const BACKEND_PORT = 5001;
const MOCK_PORT = 5002; // Port this mock server will listen on

// Store mock data
const mockTelemetry = {
  state: { armed: false, mode: 'UNKNOWN', system_status: 'STANDBY' },
  global: { lat: 0, lon: 0, alt_rel: 0, vel: 0, satellites_visible: 0 },
  battery: { voltage: 0, current: 0, percentage: 0 },
  rtk: { fix_type: 0, baseline_age: 0, base_linked: false },
  mission: { total_wp: 0, current_wp: 0, status: 'IDLE', progress_pct: 0 },
  servo: { servo_id: 0, active: false, last_command_ts: 0 },
  network: { connection_type: 'none', wifi_signal_strength: 0, wifi_rssi: -100, interface: '', wifi_connected: false, lora_connected: false },
  hrms: 0, vrms: 0, imu_status: 'UNKNOWN',
  attitude: { yaw_deg: 0 },
  wp_dist_cm: 0, xtrack_cm: 0, wp_brg: 0, position_error_cm: 0,
  mission_log_history: [],
};

const mockEvents = new Set();

// Generate realistic mock telemetry values
function generateMockTelemetry() {
  const now = Date.now();

  // Simulate movement
  const lat = 35.6895 + Math.sin(now / 10000) * 0.001;
  const lng = 139.6917 + Math.cos(now / 12000) * 0.001;
  const satellites = 8 + Math.floor(Math.abs(Math.sin(now / 5000)) * 6);
  const fixType = Math.floor(Math.abs(Math.sin(now / 12000)) * 4) + 2;
  const batteryPct = 75 + Math.sin(now / 15000) * 15;
  const voltage = 12.0 + batteryPct / 100;
  const current = 1.5 + Math.sin(now / 8000) * 0.8;

  // Update telemetry state
  mockTelemetry.global = {
    ...mockTelemetry.global,
    lat,
    lon,
    satellites_visible: satellites,
    vel: 5.0 + Math.abs(Math.sin(now / 3000)) * 2.0,
  };

  mockTelemetry.battery = {
    ...mockTelemetry.battery,
    percentage: Math.floor(batteryPct),
    voltage: parseFloat(voltage.toFixed(1)),
    current: parseFloat(current.toFixed(1)),
  };

  mockTelemetry.rtk = {
    ...mockTelemetry.rtk,
    fix_type: fixType,
    baseline_age: Math.random() * 100,
    base_linked: fixType >= 5,
  };

  // Randomly emit telemetry events
  if (Math.random() < 0.3) {
    io.emit('telemetry', mockTelemetry);
    io.emit('rover_data', mockTelemetry);
  }

  // Periodically emit mission status
  if (Math.random() < 0.1) {
    io.emit('mission_status', {
      mission_state: 'ACTIVE',
      mission_mode: 'AUTO',
      current_waypoint: Math.floor(Math.random() * 10) + 1,
      total_waypoints: 15,
      progress_pct: Math.random() * 100,
      timestamp: Date.now(),
    });
  }
}

// Initialize mock server
generateMockTelemetry();
setInterval(generateMockTelemetry, 1000);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected');
  mockEvents.add(socket.id);

  // Handle backend API calls
  socket.on('arm_vehicle', () => {
    console.log('ARM command received');
    io.to(socket.id).emit('arm_ack', { success: true });
  });

  socket.on('disarm_vehicle', () => {
    console.log('DISARM command received');
    io.to(socket.id).emit('disarm_ack', { success: true });
  });

  socket.on('set_mode', (data) => {
    console.log(`SET_MODE: ${data.mode}`);
    io.to(socket.id).emit('set_mode_ack', { success: true, mode: data.mode });
  });

  socket.on('mission_upload', (data) => {
    console.log(`MISSION_UPLOAD: ${JSON.stringify(data)}`);
    io.to(socket.id).emit('mission_upload_ack', { success: true });
  });

  socket.on('request_mission_logs', () => {
    console.log('MISSION_LOGS requested');
    io.to(socket.id).emit('mission_logs_response', { logs: [] });
  });

  // Handle failsafe events
  socket.on('failsafe_acknowledge', () => {
    console.log('FAILSAFE ack received');
    io.to(socket.id).emit('failsafe_resumed', { message: 'Mission resumed' });
  });

  socket.on('failsafe_restart_mission', () => {
    console.log('FAILSAFE restart received');
    io.to(socket.id).emit('failsafe_restarted', { message: 'Mission restarted' });
  });

  // Keep connection alive
  socket.emit('connected', { status: 'connected' });
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    mockEvents.delete(socket.id);
  });
});

// Serve static files if needed
app.use(express.static('public'));

// Start server
server.listen(MOCK_PORT, '0.0.0.0', () => {
  console.log(`Mock backend server running on http://0.0.0.0:${MOCK_PORT}`);
  console.log(`Mock WebSocket signaling at ws://0.0.0.0:${MOCK_PORT}/socket.io`);
  console.log('Frontend can connect to this URL instead of 192.168.0.212:5001');
});

// Export server for testing
module.exports = { server, io };