import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import TabNavigator from './src/navigation/TabNavigator';
import { StatusBar } from 'react-native';
import { RoverProvider } from './src/context/RoverContext';
import { ComponentReadinessProvider } from './src/context/ComponentReadinessContext';
import { SystemReadinessOverlay } from './src/components/shared/SystemReadinessOverlay';
import { ErrorBoundary } from './src/components/shared/ErrorBoundary';
import { useImmersiveMode } from './src/hooks/useImmersiveMode';
import { useComponentLifecycle } from './src/hooks/useComponentReadiness';
import GlobalCrashHandler from './src/services/GlobalCrashHandler';

// Initialize global crash handler ONCE at module load
GlobalCrashHandler.initialize();

function AppContent() {
  // Enable immersive mode (auto-hides status bar and navigation bar)
  useImmersiveMode();

  // Track navigation readiness - call hook at top level only
  const navigationLifecycle = useComponentLifecycle(
    'navigation',
    'React Navigation',
    'navigation',
    true // critical
  );

  useEffect(() => {
    // Navigation is ready once mounted
    navigationLifecycle.setReady('Navigation ready');
  }, []); // Empty deps - only run once on mount

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

export default function App() {
  // Global crash handler is already initialized at module load
  return (
    <ErrorBoundary componentName="App Root">
      <ComponentReadinessProvider minLoadingTime={500}>
        <RoverProvider>
          <ErrorBoundary componentName="System Overlay">
            <SystemReadinessOverlay appName="DYX-GCS" showDetails={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Main Content">
            <AppContent />
          </ErrorBoundary>
        </RoverProvider>
      </ComponentReadinessProvider>
    </ErrorBoundary>
  );
}
