import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import TabNavigator from './src/navigation/TabNavigator';
import { StatusBar, View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { RoverProvider } from './src/context/RoverContext';
import { ComponentReadinessProvider } from './src/context/ComponentReadinessContext';
// SystemReadinessOverlay removed - too aggressive, blocks UI unnecessarily
import { ErrorBoundary } from './src/components/shared/ErrorBoundary';
import { useImmersiveMode } from './src/hooks/useImmersiveMode';
import GlobalCrashHandler from './src/services/GlobalCrashHandler';
import { initializeBackendURL, setBackendURL, getBackendURL } from './src/config';
import { saveBackendURL } from './src/utils/backendStorage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

// Initialize global crash handler ONCE at module load
GlobalCrashHandler.initialize();

// Fallback rover IPs in priority order
const FALLBACK_IPS = ['192.168.1.102', '192.168.1.212'];

/**
 * Test if a backend URL is reachable with graceful retry probing.
 * Ensures we wait up to `timeout` ms before declaring unreachable,
 * retrying every ~1s with a short per-request timeout.
 */
async function testBackendConnection(url: string, timeout: number = 10000): Promise<boolean> {
  const start = Date.now();
  const perAttemptTimeout = 2000; // 2s per request attempt
  const delayBetweenAttempts = 800; // ~0.8s between attempts

  console.log(`[testBackendConnection] 🔎 Probing ${url} for up to ${timeout}ms...`);

  while (Date.now() - start < timeout) {
    const attemptStart = Date.now();
    try {
      console.log(`[testBackendConnection] Attempting GET ${url}/api/tts/status with ${perAttemptTimeout}ms timeout`);
      const response = await axios.get(`${url}/api/tts/status`, {
        timeout: perAttemptTimeout,
        validateStatus: () => true,
      });
      const elapsed = Date.now() - start;
      console.log(`[testBackendConnection] ✅ Reachable (status ${response.status}) after ${elapsed}ms`, response.data);
      return response.status < 500;
    } catch (err: any) {
      const attemptElapsed = Date.now() - attemptStart;
      console.log(`[testBackendConnection] ❌ Attempt failed (${attemptElapsed}ms): ${err?.message ?? err}`);
      console.log(`[testBackendConnection] 🐛 Error details:`, {
        message: err?.message,
        code: err?.code,
        errno: err?.errno,
        isAxiosError: err?.isAxiosError,
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        url: err?.config?.url,
        data: err?.response?.data,
      });
      // Wait a bit before next attempt, respecting overall timeout
      const remaining = timeout - (Date.now() - start);
      if (remaining <= 0) break;
      const sleepMs = Math.min(delayBetweenAttempts, remaining);
      await new Promise((r) => setTimeout(r, sleepMs));
    }
  }

  console.log(`[testBackendConnection] ❌ Unreachable after ${Date.now() - start}ms`);
  return false;
}

/**
 * Probe a given backend URL with N attempts, each up to 10s.
 * Returns true on first success, false otherwise.
 */
async function probeWithAttempts(
  url: string,
  attempts: number,
  perAttemptMs: number,
  statusCb?: (msg: string) => void,
  label?: string,
): Promise<boolean> {
  for (let i = 1; i <= attempts; i++) {
    const attemptLabel = label ? `${label} ` : '';
    const message = `${attemptLabel}Attempt ${i}/${attempts} (up to ${Math.round(perAttemptMs / 1000)}s)`;
    console.log(`[probeWithAttempts] ${message} -> ${url}`);
    statusCb?.(message);
    const ok = await testBackendConnection(url, perAttemptMs);
    if (ok) return true;
  }
  return false;
}

function AppContent() {
  // Enable immersive mode (auto-hides status bar and navigation bar)
  useImmersiveMode();

  const [backendConfigured, setBackendConfigured] = useState<boolean | null>(null);
  const [backendUnreachable, setBackendUnreachable] = useState(false);
  const [showManualIPEntry, setShowManualIPEntry] = useState(false);
  const [manualIP, setManualIP] = useState('');
  const [manualPort, setManualPort] = useState('5001');
  const [retrying, setRetrying] = useState(false);
  const [testingIP, setTestingIP] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');

  const initBackend = async () => {
    setRetrying(true);
    setConnectionStatus('');
    setBackendUnreachable(false);
    
    // Initialize dynamic backend URL from storage if present, else use .env/default
    await initializeBackendURL();

    // Test 192.168.1.102 with 5 second timeout
    setConnectionStatus('Testing primary backend 192.168.1.102 (5s timeout)...');
    console.log('Testing primary backend: 192.168.1.102 (5s timeout)...');
    const primaryURL = 'http://192.168.1.102:5001';
    const perAttemptMs = 5000; // 5s per attempt
    const attemptsPerHost = 1;   // 1 attempt per host -> 5s

    // Primary host
    const primaryOk = await probeWithAttempts(
      primaryURL,
      attemptsPerHost,
      perAttemptMs,
      (msg) => setConnectionStatus(`Primary: ${msg}`),
      'Primary',
    );
    if (primaryOk) {
      console.log('✅ Primary backend connected: 192.168.1.102');
      setConnectionStatus('✅ Primary backend connected!');
      setBackendURL(primaryURL);
      setBackendConfigured(true);
      setRetrying(false);
      return;
    }

    // Fallback host
    const fallbackURL = 'http://192.168.1.212:5001';
    setConnectionStatus('Primary unreachable. Testing fallback backend (1×5s)...');
    console.log('Primary unreachable, testing fallback backend (1×5s): 192.168.1.212');
    const fallbackOk = await probeWithAttempts(
      fallbackURL,
      attemptsPerHost,
      perAttemptMs,
      (msg) => setConnectionStatus(`Fallback: ${msg}`),
      'Fallback',
    );
    if (fallbackOk) {
      console.log('✅ Fallback backend connected: 192.168.1.212');
      setConnectionStatus('✅ Fallback backend connected!');
      setBackendURL(fallbackURL);
      setBackendConfigured(true);
      setRetrying(false);
      return;
    }

    // Both unreachable
    console.warn('❌ No backend reachable after 1×5s on both hosts');
    setConnectionStatus('❌ No backend reachable after 10 seconds');
    setBackendUnreachable(true);
    setRetrying(false);
  };

  useEffect(() => {
    initBackend();
  }, []); // Empty deps - only run once on mount

  const handleRetry = () => {
    setBackendConfigured(null);
    initBackend();
  };

  const handleManualIPEntry = () => {
    setShowManualIPEntry(true);
  };

  const handleTestManualIP = async () => {
    if (!manualIP.trim()) {
      Alert.alert('Error', 'Please enter a backend IP address');
      return;
    }

    setTestingIP(true);
    try {
      const port = parseInt(manualPort) || 5001;
      const url = `http://${manualIP.trim()}:${port}`;
      
      console.log('[Manual IP] 🔧 Testing manual IP configuration');
      console.log('[Manual IP] URL:', url);
      console.log('[Manual IP] IP:', manualIP.trim());
      console.log('[Manual IP] Port:', port);
      
      const isReachable = await testBackendConnection(url, 10000);
      
      if (isReachable) {
        console.log('[Manual IP] ✅ Connected:', url);
        // Save the custom IP
        await saveBackendURL(url, manualIP.trim(), port);
        // Set it as the backend URL
        setBackendURL(url);
        setBackendConfigured(true);
        setBackendUnreachable(false); // Clear unreachable flag to allow app to load
        setShowManualIPEntry(false);
        setManualIP('');
        setManualPort('5001');
        Alert.alert('Success', `Connected to backend at ${url}`);
      } else {
        console.log('[Manual IP] ❌ Connection failed after 10s timeout:', url);
        Alert.alert('Connection Failed', `Cannot reach backend at ${url}. Please verify the IP address and port.`);
      }
    } catch (error) {
      console.error('[Manual IP] 💥 Error:', error);
      Alert.alert('Error', 'Failed to test IP connection');
    } finally {
      setTestingIP(false);
    }
  };

  const handleCancel = () => {
    setShowManualIPEntry(false);
    setManualIP('');
    setManualPort('5001');
  };

  // Show manual IP entry screen
  if (backendUnreachable && showManualIPEntry) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.manualIPContainer}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="#0A1628"
          translucent={false}
          animated={true}
          hidden={true}
        />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.manualIPContent}>
            <Ionicons name="settings" size={80} color="#2196F3" />
            <Text style={styles.manualIPTitle}>Manual Backend Configuration</Text>
            <Text style={styles.manualIPSubtitle}>
              Enter the IP address and port of your backend server
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Backend IP Address</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 192.168.1.102 or 10.23.61.50"
                placeholderTextColor="#999"
                value={manualIP}
                onChangeText={setManualIP}
                editable={!testingIP}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Port</Text>
              <TextInput
                style={styles.textInput}
                placeholder="5001"
                placeholderTextColor="#999"
                value={manualPort}
                onChangeText={setManualPort}
                editable={!testingIP}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Connection URL:</Text>
              <Text style={styles.previewURL}>
                {manualIP.trim() ? `http://${manualIP.trim()}:${manualPort || '5001'}` : 'http://[IP]:[PORT]'}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.connectButton, testingIP && styles.buttonDisabled]}
              onPress={handleTestManualIP}
              disabled={testingIP}
            >
              <Ionicons name="link" size={20} color="white" />
              <Text style={styles.buttonText}>
                {testingIP ? 'Testing Connection...' : 'Test & Connect'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={testingIP}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.helpText}>
              💡 Tip: Check your device WiFi network settings to find the correct IP address
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Show backend unreachable error screen
  if (backendUnreachable) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#0A1628"
          translucent={false}
          animated={true}
          hidden={true}
        />
        <Ionicons name="cloud-offline" size={80} color="#f44336" />
        <Text style={styles.errorTitle}>Backend Not Reachable</Text>
        <Text style={styles.errorMessage}>
          Could not connect to rover backend.{'\n'}
          Tried: 192.168.1.102 and 192.168.1.212
        </Text>
        <Text style={styles.errorHint}>
          • Check rover is powered on{'\n'}
          • Verify WiFi connection{'\n'}
          • Ensure backend server is running
        </Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={handleRetry}
          disabled={retrying}
        >
          <Ionicons name="refresh" size={20} color="white" />
          <Text style={styles.retryButtonText}>
            {retrying ? 'Retrying...' : 'Retry Connection'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.manualIPButton}
          onPress={handleManualIPEntry}
          disabled={retrying}
        >
          <Ionicons name="settings" size={20} color="white" />
          <Text style={styles.manualIPButtonText}>Manual IP Configuration</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show loading while checking backend configuration
  if (backendConfigured === null) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#0A1628"
          translucent={false}
          animated={true}
          hidden={true}
        />
        <Ionicons name="hourglass" size={60} color="#2196F3" />
        <Text style={styles.loadingText}>
          {connectionStatus || (retrying ? 'Connecting to backend...' : 'Initializing...')}
        </Text>
        <Text style={styles.loadingSubtext}>
          {retrying ? 'Please wait up to 20 seconds' : 'Starting up...'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0A1628"
        translucent={false}
        animated={true}
        hidden={true}
      />
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorHint: {
    fontSize: 14,
    color: '#888',
    textAlign: 'left',
    marginBottom: 30,
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    gap: 10,
    marginBottom: 15,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  manualIPButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    gap: 10,
  },
  manualIPButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  manualIPContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  manualIPContent: {
    alignItems: 'center',
  },
  manualIPTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
    marginBottom: 10,
  },
  manualIPSubtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  previewBox: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 15,
    width: '100%',
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 5,
  },
  previewURL: {
    fontSize: 14,
    color: '#2196F3',
    fontFamily: 'monospace',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    gap: 10,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    marginBottom: 20,
  },
  cancelButtonText: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#4CAF50',
    fontSize: 16,
    marginTop: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSubtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
});

export default function App() {
  // Global crash handler is already initialized at module load
  return (
    <ErrorBoundary componentName="App Root">
      <ComponentReadinessProvider minLoadingTime={3000}>
        <RoverProvider>
          <ErrorBoundary componentName="Main Content">
            <AppContent />
          </ErrorBoundary>
        </RoverProvider>
      </ComponentReadinessProvider>
    </ErrorBoundary>
  );
}
