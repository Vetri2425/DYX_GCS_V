import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const healthData = [
  { label: 'Jetson CPU Temp', value: '65°C', progress: 0.65 },
  { label: 'CPU Load %', value: '78%', progress: 0.78 },
  { label: 'RAM Usage %', value: '60%', progress: 0.6 },
  { label: 'Pixhawk Heartbeat', value: 'OK', progress: 1 },
  { label: 'ROS Nodes Active', value: '12', progress: 0.8 },
];

const SystemHealth: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>System Health Overview</Text>
      <View style={styles.grid}>
        {healthData.map((item, index) => (
          <View key={`health-${item.label}`} style={styles.card}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.value}>{item.value}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${item.progress * 100}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    width: (width - 48) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0047AB',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0047AB',
  },
});

export default SystemHealth;