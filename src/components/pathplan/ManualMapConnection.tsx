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
  const [connectionMode, setConnectionMode] = useState<'tap' | 'drag' | 'pan'>('tap');
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

  const handleWaypointTap = (waypointId: number) => {
    if (connectionMode === 'tap') {
      setManualConnections(prev => {
        if (!prev.includes(waypointId)) {
          return [...prev, waypointId];
        }
        return prev;
      });
    }
    // In pan mode, don't add to connections - just allow map interaction
  };

  const handleMapMessage = (event: any) => {
    const data = JSON.parse(event.nativeEvent.data);

    switch (data.type) {
      case 'waypointConnect':
        if (connectionMode === 'drag') {
          handleWaypointConnect(data.fromId, data.toId);
        }
        break;
      case 'waypointClick':
        // Only handle clicks in tap mode, ignore in pan mode
        if (connectionMode === 'tap') {
          handleWaypointTap(data.waypointId);
        }
        break;
      case 'waypointContextMenu':
        // Disable context menu in manual connection modes
        if (connectionMode === 'tap' || connectionMode === 'drag') {
          return; // Don't show context menu
        }
        break;
      case 'TOGGLE_FULLSCREEN':
        // Handle fullscreen if needed
        break;
    }
  };

  const handleFinish = () => {
    if (manualConnections.length < 2) {
      Alert.alert('Connection Required', `Please connect at least 2 marking points by ${connectionMode === 'tap' ? 'tapping' : 'dragging between'} them. Switch to Tap or Drag mode to create connections.`);
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
      {/* Compact Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>🗺️ Map Connection</Text>
            <Text style={styles.info}>
              {manualConnections.length}/{waypoints.length} connected
            </Text>
          </View>

          {/* Mode Toggle - Row layout */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={[
                styles.modeToggleButton,
                connectionMode === 'tap' && styles.modeToggleButtonActive
              ]}
              onPress={() => setConnectionMode('tap')}
            >
              <Text style={[
                styles.modeToggleText,
                connectionMode === 'tap' && styles.modeToggleTextActive
              ]}>👆 Tap</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeToggleButton,
                connectionMode === 'drag' && styles.modeToggleButtonActive
              ]}
              onPress={() => setConnectionMode('drag')}
            >
              <Text style={[
                styles.modeToggleText,
                connectionMode === 'drag' && styles.modeToggleTextActive
              ]}>✍️ Drag</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeToggleButton,
                connectionMode === 'pan' && styles.modeToggleButtonActive
              ]}
              onPress={() => setConnectionMode('pan')}
            >
              <Text style={[
                styles.modeToggleText,
                connectionMode === 'pan' && styles.modeToggleTextActive
              ]}>🤚 Pan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        <PathPlanMap
          waypoints={waypoints}
          roverPosition={roverPosition ? {
            lat: roverPosition.lat,
            lon: roverPosition.lng,
          } : { lat: 13.0827, lon: 80.2707 }}
          heading={roverPosition?.heading ?? null}
          isManualConnectionMode={true}
          manualConnections={manualConnections}
          manualConnectionMode={connectionMode}
          onWaypointClick={(waypointId: number) => {
            if (connectionMode === 'tap') {
              handleWaypointTap(waypointId);
            }
          }}
          onWaypointConnect={(fromId, toId) => {
            if (connectionMode === 'drag') {
              handleWaypointConnect(fromId, toId);
            }
          }}
        />
      </View>

      {/* Connection Sequence Display */}
      {manualConnections.length > 0 && (
        <View style={styles.sequenceBox}>
          <Text style={styles.sequenceTitle}>Connection Sequence:</Text>
          <View style={styles.sequenceList}>
            {manualConnections.map((id, index) => (
              <View key={`seq-${index}-${id}`} style={styles.sequenceItem}>
                <View style={styles.sequenceBadge}>
                  <Text style={styles.sequenceBadgeText}>#{id}</Text>
                </View>
                {index < manualConnections.length - 1 && (
                  <Text style={styles.sequenceArrow}>→</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#1e3a8a',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  info: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  modeToggleButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minWidth: 90,
  },
  modeToggleButtonActive: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  modeToggleText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeToggleTextActive: {
    color: '#000',
  },
  mapContainer: {
    flex: 1,
    margin: 6,
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
  sequenceBox: {
    backgroundColor: '#f8fafc',
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sequenceTitle: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  sequenceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sequenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sequenceBadge: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sequenceBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  sequenceArrow: {
    color: '#94a3b8',
    fontSize: 12,
    marginHorizontal: 4,
  },
});

export default ManualMapConnection;
