import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, PanResponder, GestureResponderEvent } from 'react-native';
import Svg, { Line, G, Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { PathPlanWaypoint } from '../../types/pathplan';

interface Props {
  visible: boolean;
  waypoints: PathPlanWaypoint[];
  onConnectionsComplete: (connectedWaypointIds: number[]) => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface CanvasWaypoint {
  id: number;
  x: number;
  y: number;
  lat: number;
  lon: number;
}

export const ManualPathConnectionCanvas: React.FC<Props> = ({
  visible,
  waypoints,
  onConnectionsComplete,
  onCancel,
}) => {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [connectedWaypoints, setConnectedWaypoints] = useState<number[]>([]);
  const [connectionMode, setConnectionMode] = useState<'tap' | 'drag'>('tap');
  const [isDragging, setIsDragging] = useState(false);
  const [currentDragPos, setCurrentDragPos] = useState<Point | null>(null);
  const [dragStartWaypointId, setDragStartWaypointId] = useState<number | null>(null);
  const canvasRef = useRef<View>(null);

  // Convert lat/lng to canvas coordinates
  const latLngToCanvas = useCallback((lat: number, lon: number): Point => {
    if (waypoints.length === 0 || canvasSize.width === 0) {
      return { x: 0, y: 0 };
    }

    // Find bounding box of waypoints
    const lats = waypoints.map(wp => wp.lat);
    const lons = waypoints.map(wp => wp.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // Add padding (10% on each side)
    const latRange = maxLat - minLat || 0.001;
    const lonRange = maxLon - minLon || 0.001;
    const padding = 0.1;

    const normalizedLat = (lat - minLat) / latRange;
    const normalizedLon = (lon - minLon) / lonRange;

    const x = (normalizedLon * (1 - 2 * padding) + padding) * canvasSize.width;
    const y = ((1 - normalizedLat) * (1 - 2 * padding) + padding) * canvasSize.height; // Flip Y

    return { x, y };
  }, [waypoints, canvasSize]);

  // Get waypoints with canvas coordinates (memoized to prevent infinite re-renders)
  const canvasWaypoints: CanvasWaypoint[] = useMemo(() => {
    return waypoints.map(wp => {
      const pos = latLngToCanvas(wp.lat, wp.lon);
      return {
        id: wp.id,
        x: pos.x,
        y: pos.y,
        lat: wp.lat,
        lon: wp.lon,
      };
    });
  }, [waypoints, latLngToCanvas, canvasSize]);


  // Handle waypoint tap to connect
  const handleWaypointTap = (waypointId: number) => {
    setConnectedWaypoints(prev => {
      // Don't add if already the last connected waypoint
      if (prev.length > 0 && prev[prev.length - 1] === waypointId) {
        return prev;
      }
      // Add to connection sequence
      return [...prev, waypointId];
    });
  };

  const handleFinish = () => {
    if (connectedWaypoints.length < 2) {
      alert('Please connect at least 2 waypoints by tapping them');
      return;
    }

    onConnectionsComplete(connectedWaypoints);
  };

  const handleClear = () => {
    setConnectedWaypoints([]);
  };

  const handleUndo = () => {
    // Remove last connected waypoint
    setConnectedWaypoints(prev => prev.slice(0, -1));
  };

  // Check if a point is near a waypoint (within 60px radius)
  const findWaypointNearPoint = useCallback((x: number, y: number): CanvasWaypoint | null => {
    const threshold = 60; // 60 pixels for easier touch
    console.log('[FindWP] Checking point:', x, y, 'Canvas waypoints:', canvasWaypoints.length);

    for (const wp of canvasWaypoints) {
      const dx = wp.x - x;
      const dy = wp.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      console.log(`[FindWP] WP${wp.id} at (${wp.x},${wp.y}) dist=${distance.toFixed(1)}`);
      if (distance <= threshold) {
        console.log(`[FindWP] ✓ Found WP${wp.id}!`);
        return wp;
      }
    }
    console.log('[FindWP] No waypoint found within threshold');
    return null;
  }, [canvasWaypoints]);

  // Simplified Pan Responder for drag mode
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => {
        console.log('[Drag] onStartShouldSetPanResponder, mode:', connectionMode);
        return connectionMode === 'drag';
      },
      onMoveShouldSetPanResponder: () => connectionMode === 'drag',

      onPanResponderGrant: (evt) => {
        if (connectionMode !== 'drag') return;

        // Try both locationX/Y and pageX/Y
        let x = evt.nativeEvent.locationX;
        let y = evt.nativeEvent.locationY;

        console.log('[Drag] Grant - locationX:', x, 'locationY:', y);
        console.log('[Drag] Grant - pageX:', evt.nativeEvent.pageX, 'pageY:', evt.nativeEvent.pageY);

        // Must start on a waypoint
        const wp = findWaypointNearPoint(x, y);
        console.log('[Drag] Found waypoint:', wp?.id);

        if (wp) {
          // Start dragging from this waypoint
          setIsDragging(true);
          setDragStartWaypointId(wp.id);
          setCurrentDragPos({ x, y });

          // Add to connected list if not already there
          if (!connectedWaypoints.includes(wp.id)) {
            setConnectedWaypoints(prev => [...prev, wp.id]);
          }
        }
      },

      onPanResponderMove: (evt) => {
        if (connectionMode !== 'drag' || !isDragging || !dragStartWaypointId) return;

        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;

        // Update current drag position
        setCurrentDragPos({ x, y });

        // Check if finger is over a new waypoint
        const wp = findWaypointNearPoint(x, y);
        if (wp && wp.id !== dragStartWaypointId && !connectedWaypoints.includes(wp.id)) {
          console.log('[Drag] Connecting waypoint:', wp.id);
          // Connect this waypoint!
          setConnectedWaypoints(prev => [...prev, wp.id]);
          // This waypoint becomes the new start point
          setDragStartWaypointId(wp.id);
        }
      },

      onPanResponderRelease: () => {
        console.log('[Drag] Release');
        setIsDragging(false);
        setCurrentDragPos(null);
        setDragStartWaypointId(null);
      },

      onPanResponderTerminate: () => {
        console.log('[Drag] Terminate');
        setIsDragging(false);
        setCurrentDragPos(null);
        setDragStartWaypointId(null);
      },
    });
  }, [connectionMode, isDragging, dragStartWaypointId, connectedWaypoints, findWaypointNearPoint]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>✏️ Manual Path Connection</Text>
            <Text style={styles.subtitle}>
              {connectionMode === 'tap' ? 'Tap waypoints in order to connect them' : 'Drag through waypoints to connect them'}
            </Text>
            <Text style={styles.info}>
              Connected: {connectedWaypoints.length} / {waypoints.length} waypoints
            </Text>
          </View>

          {/* Mode Toggle Button */}
          <View style={{ gap: 6 }}>
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
              ]}>👆 Tap Mode</Text>
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
              ]}>✍️ Drag Mode</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Canvas View */}
      <View
        ref={canvasRef}
        style={styles.canvas}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCanvasSize({ width, height });
        }}
      >
        <Svg style={StyleSheet.absoluteFill}>
          {/* Grid lines (subtle) */}
          <G key="vertical-grid">
            {Array.from({ length: 21 }).map((_, i) => {
              const x = (canvasSize.width / 20) * i;
              return (
                <Line
                  key={`v-${i}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={canvasSize.height}
                  stroke="#f0f0f0"
                  strokeWidth={1}
                />
              );
            })}
          </G>
          <G key="horizontal-grid">
            {Array.from({ length: 21 }).map((_, i) => {
              const y = (canvasSize.height / 20) * i;
              return (
                <Line
                  key={`h-${i}`}
                  x1={0}
                  y1={y}
                  x2={canvasSize.width}
                  y2={y}
                  stroke="#f0f0f0"
                  strokeWidth={1}
                />
              );
            })}
          </G>

          {/* Connection lines between connected waypoints */}
          {connectedWaypoints.length > 1 && connectedWaypoints.map((id, index) => {
            if (index === 0) return null;
            const fromWp = canvasWaypoints.find(wp => wp.id === connectedWaypoints[index - 1]);
            const toWp = canvasWaypoints.find(wp => wp.id === id);
            if (!fromWp || !toWp) return null;

            return (
              <Line
                key={`conn-${index}-${connectedWaypoints[index - 1]}-${id}`}
                x1={fromWp.x}
                y1={fromWp.y}
                x2={toWp.x}
                y2={toWp.y}
                stroke="#4ADE80"
                strokeWidth={3}
                strokeDasharray="5, 5"
              />
            );
          })}

          {/* Drag line - simple line from start waypoint to current finger position */}
          {isDragging && dragStartWaypointId && currentDragPos && (() => {
            const startWp = canvasWaypoints.find(wp => wp.id === dragStartWaypointId);
            if (!startWp) return null;

            return (
              <>
                <Line
                  key="drag-line"
                  x1={startWp.x}
                  y1={startWp.y}
                  x2={currentDragPos.x}
                  y2={currentDragPos.y}
                  stroke="#60A5FA"
                  strokeWidth={4}
                  strokeDasharray="8, 4"
                  opacity={0.8}
                />
                {/* Finger position indicator */}
                <Circle
                  cx={currentDragPos.x}
                  cy={currentDragPos.y}
                  r={12}
                  fill="#60A5FA"
                  opacity={0.5}
                />
              </>
            );
          })()}
        </Svg>

        {/* Waypoint markers - using TouchableOpacity for tap events */}
        {canvasWaypoints.map((wp, wpIndex) => {
          const isConnected = connectedWaypoints.includes(wp.id);
          const connectionIndex = connectedWaypoints.indexOf(wp.id);

          // Larger size in drag mode for easier targeting
          const baseSize = connectionMode === 'drag' ? 40 : 24;
          const circleSize = isConnected ? baseSize + 8 : baseSize;
          const markerSize = circleSize + 20;

          return (
            <TouchableOpacity
              key={`wp-${wpIndex}-${wp.id}`}
              style={[
                styles.waypointMarker,
                {
                  left: wp.x - markerSize / 2,
                  top: wp.y - markerSize / 2,
                  width: markerSize,
                  height: markerSize,
                },
              ]}
              onPress={() => handleWaypointTap(wp.id)}
              activeOpacity={0.7}
              disabled={connectionMode === 'drag'} // Disable tap in drag mode
            >
              <View
                style={[
                  styles.waypointCircle,
                  {
                    backgroundColor: isConnected ? '#4ADE80' : '#f97316',
                    width: circleSize,
                    height: circleSize,
                  },
                ]}
              >
                <Text style={[styles.waypointIdText, { fontSize: connectionMode === 'drag' ? 14 : 10 }]}>
                  {wp.id}
                </Text>
              </View>
              {isConnected && (
                <View style={styles.connectionBadge}>
                  <Text style={styles.connectionBadgeText}>{connectionIndex + 1}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Transparent gesture overlay for drag mode */}
        {connectionMode === 'drag' && (
          <View
            style={StyleSheet.absoluteFill}
            {...panResponder.panHandlers}
            pointerEvents="box-only"
          />
        )}
      </View>

      {/* Instructions overlay */}
      <View style={styles.instructionBox}>
        <Text style={styles.instructionText}>
          {connectionMode === 'tap'
            ? '💡 Tap waypoints in order to connect them'
            : '💡 Touch a waypoint, drag to next waypoint. Line will connect when you touch it.'}
        </Text>
      </View>

      {/* Connection Sequence Display */}
      {connectedWaypoints.length > 0 && (
        <View style={styles.sequenceBox}>
          <Text style={styles.sequenceTitle}>Connection Sequence:</Text>
          <View style={styles.sequenceList}>
            {connectedWaypoints.map((id, index) => (
              <View key={`seq-${index}-${id}`} style={styles.sequenceItem}>
                <View style={styles.sequenceBadge}>
                  <Text style={styles.sequenceBadgeText}>#{id}</Text>
                </View>
                {index < connectedWaypoints.length - 1 && (
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
          disabled={connectedWaypoints.length === 0}
        >
          <Text style={[styles.secondaryButtonText, connectedWaypoints.length === 0 && { opacity: 0.5 }]}>
            ↶ Undo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleClear}
          disabled={connectedWaypoints.length === 0}
        >
          <Text style={[styles.secondaryButtonText, connectedWaypoints.length === 0 && { opacity: 0.5 }]}>
            🗑️ Clear
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, connectedWaypoints.length < 2 && { opacity: 0.5 }]}
          onPress={handleFinish}
          disabled={connectedWaypoints.length < 2}
        >
          <Text style={styles.primaryButtonText}>✓ Finish ({connectedWaypoints.length})</Text>
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
    backgroundColor: colors.headerBlue,
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
  },
  canvas: {
    flex: 1,
    backgroundColor: '#ffffff',
    margin: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionBox: {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: [{ translateX: -150 }],
    width: 300,
    backgroundColor: 'rgba(74, 222, 128, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  instructionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  sequenceBox: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sequenceTitle: {
    color: colors.accent,
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
    color: colors.textSecondary,
    fontSize: 12,
    marginHorizontal: 4,
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
  waypointMarker: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waypointCircle: {
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  waypointIdText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  connectionBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#22c55e',
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  connectionBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  modeToggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 100,
  },
  modeToggleButtonActive: {
    backgroundColor: '#4ADE80',
    borderColor: '#22c55e',
  },
  modeToggleText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeToggleTextActive: {
    color: '#000',
    fontWeight: '700',
  },
});

export default ManualPathConnectionCanvas;
