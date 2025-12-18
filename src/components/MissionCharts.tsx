import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart, BarChart, LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');
const chartWidth = width - 64;

const pieData = [
  { name: 'Completed', population: 60, color: '#0047AB', legendFontColor: '#333', legendFontSize: 12 },
  { name: 'Aborted', population: 20, color: '#FF6B6B', legendFontColor: '#333', legendFontSize: 12 },
  { name: 'GPS Error', population: 10, color: '#FFD93D', legendFontColor: '#333', legendFontSize: 12 },
  { name: 'Battery Fail', population: 10, color: '#6BCF7F', legendFontColor: '#333', legendFontSize: 12 },
];

const barData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [{ data: [5, 8, 3, 7, 6, 4, 9] }],
};

const lineDataBattery = {
  labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
  datasets: [{ data: [100, 90, 80, 70, 60, 50] }],
};

const lineDataSatellite = {
  labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
  datasets: [{ data: [12, 15, 18, 20, 22, 25] }],
};

const MissionCharts: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Analytics Charts</Text>

      <View style={styles.card}>
        <Text style={styles.chartTitle}>Mission Status Breakdown</Text>
        <Text style={styles.chartSubtitle}>Distribution of mission outcomes</Text>
        <PieChart
          data={pieData}
          width={chartWidth}
          height={200}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.chartTitle}>Missions per Day</Text>
        <Text style={styles.chartSubtitle}>Last 7 days</Text>
        <BarChart
          data={barData}
          width={chartWidth}
          height={200}
          chartConfig={chartConfig}
          verticalLabelRotation={0}
          yAxisLabel=""
          yAxisSuffix=""
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.chartTitle}>Battery % vs Time</Text>
        <Text style={styles.chartSubtitle}>Battery level over time</Text>
        <LineChart
          data={lineDataBattery}
          width={chartWidth}
          height={200}
          chartConfig={chartConfig}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.chartTitle}>Satellite Count vs Time</Text>
        <Text style={styles.chartSubtitle}>GPS satellite visibility</Text>
        <LineChart
          data={lineDataSatellite}
          width={chartWidth}
          height={200}
          chartConfig={chartConfig}
        />
      </View>

      {/* Area Graph for Spray On/Off - using LineChart with fill */}
      <View style={styles.card}>
        <Text style={styles.chartTitle}>Spray On/Off Timeline</Text>
        <Text style={styles.chartSubtitle}>Spray activity over time</Text>
        <LineChart
          data={{
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
            datasets: [{ data: [0, 1, 0, 1, 0, 1] }],
          }}
          width={chartWidth}
          height={200}
          chartConfig={chartConfig}
          bezier
        />
      </View>
    </View>
  );
};

const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  color: (opacity = 1) => `rgba(0, 71, 171, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '6',
    strokeWidth: '2',
    stroke: '#0047AB',
  },
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
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
});

export default MissionCharts;