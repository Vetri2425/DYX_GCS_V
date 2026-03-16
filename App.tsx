import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import TabNavigator from './src/navigation/TabNavigator';
import { LogBox, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RoverProvider } from './src/context/RoverContext';
import { ComponentReadinessProvider } from './src/context/ComponentReadinessContext';
import { ErrorBoundary } from './src/components/shared/ErrorBoundary';
import { useImmersiveMode } from './src/hooks/useImmersiveMode';
import GlobalCrashHandler from './src/services/GlobalCrashHandler';
import { setBackendURL } from './src/config';
import { saveBackendURL } from './src/utils/backendStorage';
import { JetsonDevice } from './src/utils/jetsonDiscovery';
import RoverDiscoveryScreen from './src/screens/RoverDiscoveryScreen';

GlobalCrashHandler.initialize();

// Suppress noisy network errors in LogBox when developing offline (no backend/rover)
LogBox.ignoreLogs([
  '[fetchJson] Error',
  'Network request failed',
  '[SOCKET]',
  'Socket not connected',
  'WebSocket',
  'connect ECONNREFUSED',
  'Failed to fetch',
]);

function AppContent() {
  useImmersiveMode();
  const [backendConfigured, setBackendConfigured] = useState(false);

  const handleRoverSelected = async (device: JetsonDevice) => {
    // MUST call setBackendURL synchronously BEFORE setBackendConfigured(true)
    // so that when RoverProvider mounts it reads the correct URL
    setBackendURL(device.url);
    await saveBackendURL(device.url, device.ip, device.port);
    setBackendConfigured(true);
  };

  // Discovery — RoverProvider is NOT mounted here, so no socket is created yet
  if (!backendConfigured) {
    return <RoverDiscoveryScreen onRoverSelected={handleRoverSelected} />;
  }

  // RoverProvider mounts fresh NOW — getBackendURL() already returns the rover URL
  return (
    <RoverProvider>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </RoverProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary componentName="App Root">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor="#0A1628" hidden={true} />
        <ComponentReadinessProvider>
          <ErrorBoundary componentName="Main Content">
            <AppContent />
          </ErrorBoundary>
        </ComponentReadinessProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
