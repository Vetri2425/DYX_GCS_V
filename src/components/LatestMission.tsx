import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const LatestMission: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Latest Mission Summary</Text>
      <View style={styles.card}>
        <Text style={styles.missionName}>Mission Alpha-42</Text>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Start Time:</Text>
          <Text style={styles.value}>2023-10-01 08:00</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>End Time:</Text>
          <Text style={styles.value}>2023-10-01 12:00</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Distance Covered:</Text>
          <Text style={styles.value}>150 km</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Points Reached:</Text>
          <Text style={styles.value}>1,200</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Spray Duration:</Text>
          <Text style={styles.value}>2:30</Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button}>
            <MaterialIcons name="visibility" size={16} color="#fff" />
            <Text style={styles.buttonText}>View Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button}>
            <MaterialIcons name="file-download" size={16} color="#fff" />
            <Text style={styles.buttonText}>Export CSV</Text>
          </TouchableOpacity>
        </View>
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  missionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0047AB',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  button: {
    backgroundColor: '#0047AB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
  },
});

export default LatestMission;