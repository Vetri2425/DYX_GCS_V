import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { PathPlanMap } from './PathPlanMap';
import { PathPlanWaypoint } from '../../types/pathplan';

interface Props {
  visible: boolean;
  waypoints: PathPlanWaypoint[];
  onConnectionsComplete: (connectedWaypointIds: number[]) => void;
  onCancel: () => void;
  roverPosition?: { lat: number; lng: number; heading?: number } | null;
}

export const ManualMapConnection: React.FC<Props> = ({
  visible,
  waypoints,
  onConnectionsComplete,
  onCancel,
  roverPosition,
}) => {
  const [manualConnections, setManualConnections] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const mapRef = useRef<any>(null);

  // Reset connections when waypoints change
  useEffect(() => {
    if (visible) {
      setManualConnections([]);
    }
  }, [visible, waypoints]);

  const handleWaypointConnect = (fromId: number, toId: number) => {
    setManualConnections(prev => {
      // Add fromId if not already present
      let newConnections = [...prev];
      if (!newConnections.includes(fromId)) {
        newConnections.push(fromId);
      }
      // Add toId if not already present and different from fromId
      if (!newConnections.includes(toId) && fromId !== toId) {
        newConnections.push(toId);
      }
      return newConnections;
    });
  };

  const handleMapMessage = (event: any) => {
    const data = JSON.parse(event.nativeEvent.data);
    
    switch (data.type) {
      case 'waypointConnect':
        handleWaypointConnect(data.fromId, data.toId);
        break;
      case 'TOGGLE_FULLSCREEN':
        // Handle fullscreen if needed
        break;
    }
  };

  const handleFinish = () => {
    if (manualConnections.length < 2) {
      Alert.alert('Connection Required', 'Please connect at least 2 marking points by dragging between them');
      return;
    }
    onConnectionsComplete(manualConnections);
  };

  const handleClear = () => {
    setManualConnections([]);
  };

  const handleUndo = () => {
    setManualConnections(prev => prev.slice(0, -1));
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Map Connection Mode</Text>
        <Text style={styles.subtitle}>
          Drag from one waypoint to another to connect them in order
        </Text>
        <Text style={styles.info}>
          Connected: {manualConnections.length} / {waypoints.length} marking points
        </Text>
        <Text style={styles.hint}>
          💡 Drag between waypoints to create connections. The map preserves exact shapes and distances.
        </Text>
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        <PathPlanMap
          waypoints={waypoints}
          roverPosition={roverPosition ? {
            lat: roverPosition.lat,
            lon: roverPosition.lng,
          } : { lat: 13.0827, lon: 80.2707 }}
          isManualConnectionMode={true}
          manualConnections={manualConnections}
          onWaypointClick={() => {}} // Handled by map internally
          onToggleFullscreen={() => {}} // Can be implemented if needed
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>✕ Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleUndo}
          disabled={manualConnections.length === 0}
        >
          <Text style={[styles.secondaryButtonText, manualConnections.length === 0 && { opacity: 0.5 }]}>
            ↶ Undo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleClear}
          disabled={manualConnections.length === 0}
        >
          <Text style={[styles.secondaryButtonText, manualConnections.length === 0 && { opacity: 0.5 }]}>
            🗑️ Clear
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, manualConnections.length < 2 && { opacity: 0.5 }]}
          onPress={handleFinish}
          disabled={manualConnections.length < 2}
        >
          <Text style={styles.primaryButtonText}>✓ Finish ({manualConnections.length})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f5f5f5',
    zIndex: 3000,
  },
  header: {
    backgroundColor: '#1e40af',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#1e3a8a',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 4,
  },
  info: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  mapContainer: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    backgroundColor: '#e5e7eb',
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1.5,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default ManualMapConnection;
