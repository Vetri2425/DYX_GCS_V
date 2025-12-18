/**
 * Socket.IO Connection Diagnostic Tool
 * 
 * Run this to test if the backend is reachable and emitting events
 * Usage: node test-socket-connection.js
 */

const io = require('socket.io-client');

const BACKEND_URL = 'http://192.168.1.102:5001';

console.log('========================================');
console.log('Socket.IO Connection Diagnostic Tool');
console.log('========================================');
console.log('Backend URL:', BACKEND_URL);
console.log('Testing connection...\n');

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
});

// Connection events
socket.on('connect', () => {
  console.log('✅ CONNECTED successfully!');
  console.log('   Socket ID:', socket.id);
  console.log('   Transport:', socket.io.engine.transport.name);
  console.log('   Listening for events...\n');
  
  // Send a ping
  socket.emit('ping');
  console.log('📤 Sent ping to server');
});

socket.on('connect_error', (error) => {
  console.error('❌ CONNECTION ERROR:', error.message);
  console.error('   Details:', error);
});

socket.on('disconnect', (reason) => {
  console.warn('⚠️  DISCONNECTED:', reason);
});

socket.on('error', (error) => {
  console.error('❌ SOCKET ERROR:', error);
});

socket.on('pong', () => {
  console.log('✅ Received pong from server');
});

// Listen for specific events
const EVENTS_TO_MONITOR = [
  'telemetry',
  'rover_data',
  'mission_event',
  'mission_status',
  'mission_error',
  'mission_command_ack',
  'mission_controller_status',
  'server_activity',
  'mission_logs_snapshot',
];

EVENTS_TO_MONITOR.forEach(eventName => {
  socket.on(eventName, (data) => {
    console.log(`📡 [${eventName}]`, typeof data === 'object' ? Object.keys(data) : data);
  });
});

// Catch-all for any event
socket.onAny((eventName, ...args) => {
  if (!EVENTS_TO_MONITOR.includes(eventName) && eventName !== 'pong' && eventName !== 'ping') {
    console.log(`📡 [UNKNOWN EVENT: ${eventName}]`, args.length, 'args');
  }
});

// Keep alive and report status
let eventCount = 0;
socket.onAny(() => {
  eventCount++;
});

setInterval(() => {
  console.log(`\n📊 Status: Connected=${socket.connected}, Events received=${eventCount}, Transport=${socket.io.engine?.transport?.name || 'none'}`);
}, 10000);

// Exit after 60 seconds
setTimeout(() => {
  console.log('\n⏱️  Test complete after 60 seconds');
  console.log(`   Total events received: ${eventCount}`);
  socket.disconnect();
  process.exit(0);
}, 60000);

console.log('\nTest will run for 60 seconds...');
console.log('Press Ctrl+C to stop early\n');
