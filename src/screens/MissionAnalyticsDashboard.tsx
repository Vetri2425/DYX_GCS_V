import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, SafeAreaView } from 'react-native';
import * as Animatable from 'react-native-animatable';
import DashboardSummaryCards from '../components/DashboardSummaryCards';
import MissionCharts from '../components/MissionCharts';
import MissionFlow from '../components/MissionFlow';
import LatestMission from '../components/LatestMission';
import SystemHealth from '../components/SystemHealth';

const MissionAnalyticsDashboard: React.FC = () => {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    console.log('[MissionAnalyticsDashboard] Component mounted');

    return () => {
      mountedRef.current = false;
      console.log('[MissionAnalyticsDashboard] Component unmounting');
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View>
          <DashboardSummaryCards />
        </View>
        <View>
          <MissionCharts />
        </View>
        <View>
          <MissionFlow />
        </View>
        <View>
          <LatestMission />
        </View>
        <View>
          <SystemHealth />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 16,
  },
});

export default MissionAnalyticsDashboard;