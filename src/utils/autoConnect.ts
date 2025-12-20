/**
 * Auto-Connect Utility
 * Attempts to connect to configured IP on app launch
 */

import axios from 'axios';
import { JetsonDevice } from './jetsonDiscovery';

const DEFAULT_IP = '192.168.1.102';
const CONNECTION_TIMEOUT = 5000; // 5 seconds

/**
 * Priority order of IPs to try
 */
const PRIORITY_ORDER = [
  // Highest priority
  '192.168.1.102',
  '192.168.1.212',
  '192.168.1.213',

  // Remaining allowed in desired blocks
  '192.168.1.100',
  '192.168.1.101',
  '192.168.1.103',
  '192.168.1.104',
  '192.168.1.105',

  '192.168.1.210',
  '192.168.1.211',
  '192.168.1.214',
  '192.168.1.215',

  '192.168.1.25',
  '192.168.1.26',
  '192.168.1.27',
  '192.168.1.28',
  '192.168.1.29',
  '192.168.1.30',
  '192.168.1.31',
  '192.168.1.32',
  '192.168.1.33',
  '192.168.1.34',
  '192.168.1.35',
];

/**
 * Test connection to a specific IP
 */
async function testConnection(ip: string, port: number = 5001): Promise<JetsonDevice | null> {
  const url = `http://${ip}:${port}`;
  const startTime = Date.now();

  try {
    const endpoints = ['/api/ping', '/api/rtk/status', '/'];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${url}${endpoint}`, {
          timeout: CONNECTION_TIMEOUT,
          validateStatus: (status) => status < 500,
        });

        const responseTime = Date.now() - startTime;

        if (response.status < 500) {
          return {
            id: ip.replace(/\./g, '-'),
            name: `Rover ${ip.split('.').pop()}`,
            ip,
            port,
            url,
            responseTime,
          };
        }
      } catch (endpointError) {
        continue;
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

/**
 * Attempt auto-connect on app launch
 * Tries DEFAULT_IP first, then priority backends
 */
export async function attemptAutoConnect(
  onProgress?: (message: string) => void
): Promise<JetsonDevice | null> {
  // Step 1: Try default IP first (192.168.1.102)
  if (onProgress) onProgress(`Connecting to ${DEFAULT_IP}...`);

  const defaultConnection = await testConnection(DEFAULT_IP);
  if (defaultConnection) {
    if (onProgress) onProgress(`Connected to ${DEFAULT_IP}`);
    return defaultConnection;
  }

  // Step 2: Try priority backends in order
  for (const ip of PRIORITY_ORDER) {
    // Skip the default IP since we already tried it
    if (ip === DEFAULT_IP) continue;

    if (onProgress) onProgress(`Trying ${ip}...`);

    const connection = await testConnection(ip, 5001);
    if (connection) {
      if (onProgress) onProgress(`Connected to ${ip}`);
      return connection;
    }
  }

  // No connection found
  if (onProgress) onProgress('No rover found');
  return null;
}
