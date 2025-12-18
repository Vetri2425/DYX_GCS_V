import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const steps = [
  { label: 'Upload', icon: 'cloud-upload', active: false },
  { label: 'Validate', icon: 'check-circle', active: false },
  { label: 'Execute', icon: 'play-arrow', active: true },
  { label: 'Marking', icon: 'brush', active: false },
  { label: 'Completed', icon: 'done', active: false },
  { label: 'Export', icon: 'file-download', active: false },
];

const MissionFlow: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Mission Flow</Text>
      <View style={styles.flowContainer}>
        {steps.map((step, index) => (
          <React.Fragment key={`step-${step.label}`}>
            <View style={[styles.step, step.active && styles.activeStep]}>
              <MaterialIcons name={step.icon as any} size={24} color={step.active ? '#fff' : '#0047AB'} />
              <Text style={[styles.stepText, step.active && styles.activeText]}>{step.label}</Text>
            </View>
            {index < steps.length - 1 && <View style={styles.arrow}><Text style={styles.arrowText}>→</Text></View>}
          </React.Fragment>
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
  flowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  step: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    width: 60,
    height: 60,
    justifyContent: 'center',
  },
  activeStep: {
    backgroundColor: '#0047AB',
  },
  stepText: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  activeText: {
    color: '#fff',
  },
  arrow: {
    marginHorizontal: 8,
  },
  arrowText: {
    fontSize: 18,
    color: '#666',
  },
});

export default MissionFlow;