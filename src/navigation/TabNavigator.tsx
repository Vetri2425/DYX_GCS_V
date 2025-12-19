import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import DashboardScreen from '../screens/DashboardScreen';
import PathPlanScreen from '../screens/PathPlanScreen';
import MissionReportScreen from '../screens/MissionReportScreen';
import MissionAnalyticsDashboard from '../screens/MissionAnalyticsDashboard';
import { AppHeader } from '../components/shared/AppHeader';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { colors } from '../theme/colors';
import PersistentStorage from '../services/PersistentStorage';
import { useRover } from '../context/RoverContext';

export default function TabNavigator() {
  const { missionMode } = useRover();
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Marking Plan' | 'Mission Progress' | 'Analytics'>('Mission Progress');
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['Mission Progress']));
  const [isLoadingTab, setIsLoadingTab] = useState(true);
  const previousTabRef = useRef<string>('Mission Progress');
  const mountedRef = useRef(true);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load last active tab on mount - restore where user left off
  useEffect(() => {
    const loadLastActiveTab = async () => {
      try {
        const lastTab = await PersistentStorage.loadActiveTab();
        if (lastTab && (lastTab === 'Dashboard' || lastTab === 'Marking Plan' || lastTab === 'Mission Progress' || lastTab === 'Analytics')) {
          console.log('[TabNavigator] 📂 Restoring last active tab:', lastTab);
          setActiveTab(lastTab as 'Dashboard' | 'Marking Plan' | 'Mission Progress' | 'Analytics');
          setMountedTabs(new Set([lastTab]));
          previousTabRef.current = lastTab;
        } else {
          console.log('[TabNavigator] No saved tab found, defaulting to Mission Progress');
        }
      } catch (error) {
        console.error('[TabNavigator] Failed to load last active tab:', error);
      } finally {
        setIsLoadingTab(false);
      }
    };

    loadLastActiveTab();
  }, []);

  // Handle tab changes with cleanup delay to prevent memory spikes
  const handleTabChange = useCallback((newTab: 'Dashboard' | 'Marking Plan' | 'Mission Progress' | 'Analytics') => {
    if (!mountedRef.current) {
      console.warn('[TabNavigator] Component unmounted, ignoring tab change');
      return;
    }

    if (activeTab === newTab) {
      return;
    }

    console.log(`[TabNavigator] Switching from "${previousTabRef.current}" to "${newTab}"`);

    // Clear any pending unmount timer
    if (unmountTimerRef.current) {
      clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }

    // Mark new tab as mounted
    setMountedTabs(prev => new Set(prev).add(newTab));
    setActiveTab(newTab);

    // Save active tab for restoration after crash/restart
    PersistentStorage.saveActiveTab(newTab).catch(error => {
      console.error('[TabNavigator] Failed to save active tab:', error);
    });

    // Unmount previous tab after a delay to allow smooth transition
    const previousTab = previousTabRef.current;
    previousTabRef.current = newTab;

    // Keep only current tab mounted to save memory
    unmountTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setMountedTabs(new Set([newTab]));
        console.log(`[TabNavigator] Unmounted "${previousTab}" to free memory`);
      }
      unmountTimerRef.current = null;
    }, 500);
  }, [activeTab]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      // Clear unmount timer
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }

      console.log('[TabNavigator] Component unmounting, cleaning up all tabs');
      setMountedTabs(new Set());
    };
  }, []);

  const renderScreen = () => {
    // Only render mounted tabs to prevent memory issues and ensure fresh mounts
    return (
      <>
        {mountedTabs.has('Dashboard') && (
          <View style={{ flex: 1, display: activeTab === 'Dashboard' ? 'flex' : 'none' }}>
            <ErrorBoundary componentName="Dashboard Screen">
              <DashboardScreen />
            </ErrorBoundary>
          </View>
        )}
        {mountedTabs.has('Marking Plan') && (
          <View style={{ flex: 1, display: activeTab === 'Marking Plan' ? 'flex' : 'none' }}>
            <ErrorBoundary componentName="Marking Plan Screen">
              <PathPlanScreen />
            </ErrorBoundary>
          </View>
        )}
        {mountedTabs.has('Mission Progress') && (
          <View style={{ flex: 1, display: activeTab === 'Mission Progress' ? 'flex' : 'none' }}>
            <ErrorBoundary componentName="Mission Progress Screen">
              <MissionReportScreen />
            </ErrorBoundary>
          </View>
        )}
        {mountedTabs.has('Analytics') && (
          <View style={{ flex: 1, display: activeTab === 'Analytics' ? 'flex' : 'none' }}>
            <ErrorBoundary componentName="Analytics Screen">
              <MissionAnalyticsDashboard />
            </ErrorBoundary>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      {/* Custom Header with Integrated Tabs */}
      <AppHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        missionMode={missionMode}
      />

      {/* Screen Content */}
      {renderScreen()}
    </View>
  );
}
