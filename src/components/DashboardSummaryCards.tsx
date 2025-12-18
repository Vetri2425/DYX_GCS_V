import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const summaryData = [
  { title: 'Mission Completed', value: '42', icon: 'check-circle', subtext: 'Updated now' },
  { title: 'Total Distance Covered', value: '1,250 km', icon: 'straighten', subtext: 'Updated now' },
  { title: 'Marking Points Processed', value: '8,500', icon: 'location-on', subtext: 'Updated now' },
  { title: 'Spray Time', value: '12:45', icon: 'timer', subtext: 'Updated now' },
  { title: 'Rover Utilization %', value: '87%', icon: 'battery-full', subtext: 'Updated now' },
  { title: 'Success Rate %', value: '95%', icon: 'trending-up', subtext: 'Updated now' },
];

const DashboardSummaryCards: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Summary</Text>
      <View style={styles.grid}>
        {summaryData.map((item, index) => (
          <View key={`summary-${item.title}`} style={styles.card}>
            <MaterialIcons name={item.icon as any} size={30} color="#0047AB" />
            <Text style={styles.value}>{item.value}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtext}>{item.subtext}</Text>
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
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0047AB',
    marginTop: 8,
  },
  title: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  subtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});

export default DashboardSummaryCards;