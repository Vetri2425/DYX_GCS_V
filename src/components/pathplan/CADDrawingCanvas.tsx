import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface CADDrawingCanvasProps {
  visible: boolean;
  onClose: () => void;
  onSaveWaypoints: (waypoints: Array<{ lat: number; lng: number }>) => void;
  currentPosition: { lat: number; lng: number };
}

type CADTool = 
  | 'select' | 'line' | 'rectangle' | 'circle' | 'arc' 
  | 'spline' | 'point' | 'text' | 'polygon' | 'ellipse'
  | 'fillet' | 'chamfer' | 'dimension';

interface CADEntity {
  id: string;
  type: CADTool;
  points: Array<{ x: number; y: number }>;
  properties?: any;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const CADDrawingCanvas: React.FC<CADDrawingCanvasProps> = ({
  visible,
  onClose,
  onSaveWaypoints,
  currentPosition,
}) => {
  const [activeTool, setActiveTool] = useState<CADTool>('select');
  const [entities, setEntities] = useState<CADEntity[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Array<{ x: number; y: number }>>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const canvasRef = useRef<View>(null);
  const panRef = useRef(new Animated.ValueXY()).current;
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // SolidWorks-style toolbar tools
  const cadTools = [
    { name: 'select' as CADTool, icon: 'cursor-default', title: 'Select', group: 'basic' },
    { name: 'line' as CADTool, icon: 'vector-line', title: 'Line', group: 'sketch' },
    { name: 'rectangle' as CADTool, icon: 'rectangle-outline', title: 'Rectangle', group: 'sketch' },
    { name: 'circle' as CADTool, icon: 'circle-outline', title: 'Circle', group: 'sketch' },
    { name: 'arc' as CADTool, icon: 'vector-curve', title: 'Arc', group: 'sketch' },
    { name: 'spline' as CADTool, icon: 'vector-spline', title: 'Spline', group: 'sketch' },
    { name: 'point' as CADTool, icon: 'circle-small', title: 'Point', group: 'sketch' },
    { name: 'text' as CADTool, icon: 'text-box-outline', title: 'Text', group: 'annotation' },
    { name: 'polygon' as CADTool, icon: 'hexagon-outline', title: 'Polygon', group: 'sketch' },
    { name: 'ellipse' as CADTool, icon: 'ellipse-outline', title: 'Ellipse', group: 'sketch' },
    { name: 'dimension' as CADTool, icon: 'ruler', title: 'Dimension', group: 'annotation' },
  ];

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => activeTool !== 'select',
    onMoveShouldSetPanResponder: () => activeTool !== 'select',
    
    onPanResponderGrant: (evt) => {
      if (activeTool === 'select') return;
      
      const { locationX, locationY } = evt.nativeEvent;
      setIsDrawing(true);
      setCurrentPath([{ x: locationX, y: locationY }]);
      lastPointRef.current = { x: locationX, y: locationY };
    },
    
    onPanResponderMove: (evt) => {
      if (!isDrawing || activeTool === 'select') return;
      
      const { locationX, locationY } = evt.nativeEvent;
      const currentPoint = { x: locationX, y: locationY };
      
      // For line and spline, add points with minimum distance threshold to avoid too many points
      if (activeTool === 'line' || activeTool === 'spline') {
        const lastPoint = lastPointRef.current;
        if (lastPoint) {
        const distance = Math.hypot(
          currentPoint.x - lastPoint.x,
          currentPoint.y - lastPoint.y
        );
          
          // Only add point if distance > 5 pixels (reduces waypoint density)
          if (distance > 5) {
            setCurrentPath(prev => [...prev, currentPoint]);
            lastPointRef.current = currentPoint;
            setRefreshKey(k => k + 1);
          }
        }
      } else if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'ellipse') {
        // For shapes, only store start and end points
        setCurrentPath(prev => [prev[0], currentPoint]);
      } else if (activeTool === 'arc') {
        // For arc, track points
        setCurrentPath(prev => [...prev, currentPoint]);
      }
    },
    
    onPanResponderRelease: () => {
      if (!isDrawing || currentPath.length === 0) {
        setIsDrawing(false);
        setCurrentPath([]);
        lastPointRef.current = null;
        return;
      }
      
      // Create entity from current path
      const newEntity: CADEntity = {
        id: Date.now().toString(),
        type: activeTool,
        points: [...currentPath],
      };
      
      setEntities(prev => [...prev, newEntity]);
      setCurrentPath([]);
      setIsDrawing(false);
      lastPointRef.current = null;
      setRefreshKey(k => k + 1);
    },
  });

  const handleToolSelect = (tool: CADTool) => {
    setActiveTool(tool);
    setIsDrawing(false);
    setCurrentPath([]);
  };

  const handleSave = () => {
    // Convert CAD entities to waypoints relative to current position
    const waypoints = entities.flatMap(entity => {
      if (entity.type === 'line' || entity.type === 'spline') {
        // For lines and splines, use all points
        return entity.points.map(point => ({
          lat: currentPosition.lat + (point.y - screenHeight/2) * 0.00001,
          lng: currentPosition.lng + (point.x - screenWidth/2) * 0.00001,
        }));
      } else if (entity.type === 'rectangle' && entity.points.length >= 2) {
        // For rectangle, create 4 corner points
        const p1 = entity.points[0];
        const p2 = entity.points[1];
        return [
          { lat: currentPosition.lat + (p1.y - screenHeight/2) * 0.00001, lng: currentPosition.lng + (p1.x - screenWidth/2) * 0.00001 },
          { lat: currentPosition.lat + (p2.y - screenHeight/2) * 0.00001, lng: currentPosition.lng + (p1.x - screenWidth/2) * 0.00001 },
          { lat: currentPosition.lat + (p2.y - screenHeight/2) * 0.00001, lng: currentPosition.lng + (p2.x - screenWidth/2) * 0.00001 },
          { lat: currentPosition.lat + (p1.y - screenHeight/2) * 0.00001, lng: currentPosition.lng + (p2.x - screenWidth/2) * 0.00001 },
        ];
      } else if (entity.type === 'circle' && entity.points.length >= 2) {
        // For circle, generate points along the circumference
        const center = entity.points[0];
        const edge = entity.points[1];
        const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
        const circlePoints = [];
        
        // Generate 24 points for smooth circle
        for (let i = 0; i < 24; i++) {
          const angle = (i * Math.PI * 2) / 24;
          const x = center.x + radius * Math.cos(angle);
          const y = center.y + radius * Math.sin(angle);
          circlePoints.push({
            lat: currentPosition.lat + (y - screenHeight/2) * 0.00001,
            lng: currentPosition.lng + (x - screenWidth/2) * 0.00001,
          });
        }
        
        // Close the circle - reuse the first point
        circlePoints.push(circlePoints[0]);
        
        return circlePoints;
      } else {
        // For other shapes, use all points
        return entity.points.map(point => ({
          lat: currentPosition.lat + (point.y - screenHeight/2) * 0.00001,
          lng: currentPosition.lng + (point.x - screenWidth/2) * 0.00001,
        }));
      }
    });
    
    if (waypoints.length === 0) {
      Alert.alert('No Drawing', 'Please draw something before saving.');
      return;
    }
    
    onSaveWaypoints(waypoints);
    onClose();
  };

  const renderEntity = (entity: CADEntity) => {
    if (entity.points.length === 0) return null;
    
    // For line tool - render actual line with points
    if (entity.type === 'line') {
      return (
        <View key={entity.id} style={styles.entityContainer}>
          {/* Draw line segments */}
          {entity.points.map((point, idx) => {
            if (idx === 0) return null;
            const prevPoint = entity.points[idx - 1];
            const dx = point.x - prevPoint.x;
            const dy = point.y - prevPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            
            return (
              <View
                key={`line-${entity.id}-${idx}`}
                style={[
                  styles.lineSegment,
                  {
                    left: prevPoint.x,
                    top: prevPoint.y,
                    width: distance,
                    transform: [{ rotate: `${angle}deg` }],
                    transformOrigin: '0 0',
                  },
                ]}
              />
            );
          })}
          
          {/* Draw points along the line */}
          {entity.points.map((point, idx) => (
            <View
              key={`point-${entity.id}-${idx}`}
              style={[
                styles.linePoint,
                {
                  left: point.x - 4,
                  top: point.y - 4,
                },
              ]}
            />
          ))}
        </View>
      );
    }
    
    // For circle tool - render actual circle
    if (entity.type === 'circle' && entity.points.length >= 2) {
      const center = entity.points[0];
      const edge = entity.points[1];
      const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
      
      return (
        <View key={entity.id} style={styles.entityContainer}>
          <View
            style={[
              styles.circle,
              {
                left: center.x - radius,
                top: center.y - radius,
                width: radius * 2,
                height: radius * 2,
                borderRadius: radius,
              }
            ]}
          />
          <View
            style={[
              styles.circleCenter,
              {
                left: center.x - 3,
                top: center.y - 3,
              }
            ]}
          />
          <View
            style={[
              styles.circleEdge,
              {
                left: edge.x - 2,
                top: edge.y - 2,
              }
            ]}
          />
        </View>
      );
    }
    
    // For other shapes - simplified rendering
    return (
      <View key={entity.id} style={styles.entity}>
        <Text style={styles.entityText}>{entity.type}</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* SolidWorks-style Top Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <Text style={styles.toolbarTitle}>CAD Drawing - Waypoint Generator</Text>
          </View>
          
          <View style={styles.toolbarCenter}>
            {cadTools.map((tool) => (
              <TouchableOpacity
                key={tool.name}
                style={[
                  styles.toolBtn,
                  activeTool === tool.name && styles.toolBtnActive
                ]}
                onPress={() => handleToolSelect(tool.name)}
              >
                <MaterialCommunityIcons
                  name={tool.icon as any}
                  size={20}
                  color={activeTool === tool.name ? colors.accent : colors.textSecondary}
                />
                <Text style={[
                  styles.toolBtnText,
                  activeTool === tool.name && styles.toolBtnTextActive
                ]}>
                  {tool.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.toolbarRight}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <MaterialCommunityIcons name="check" size={20} color={colors.text} />
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Drawing Canvas */}
        <View 
          style={styles.canvas}
          ref={canvasRef}
          {...panResponder.panHandlers}
        >
          {/* Grid Background */}
          <View style={styles.grid}>
            {/* Render grid lines */}
            {Array.from({ length: 20 }, (_, i) => (
              <View
                key={`h-${i}`}
                style={[
                  styles.gridLine,
                  {
                    top: (i * screenHeight) / 20,
                    left: 0,
                    right: 0,
                    height: 1,
                  },
                ]}
              />
            ))}
            {Array.from({ length: 20 }, (_, i) => (
              <View
                key={`v-${i}`}
                style={[
                  styles.gridLine,
                  {
                    left: (i * screenWidth) / 20,
                    top: 0,
                    bottom: 0,
                    width: 1,
                  },
                ]}
              />
            ))}
          </View>
          
          {/* Render existing entities */}
          {entities.map(renderEntity)}
          
          {/* Current drawing path - real-time preview */}
          {isDrawing && currentPath.length > 0 && activeTool === 'line' && (
            <View key="current-line">
              {/* Draw line segments */}
              {currentPath.map((point, idx) => {
                if (idx === 0) return null;
                const prevPoint = currentPath[idx - 1];
                const dx = point.x - prevPoint.x;
                const dy = point.y - prevPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                
                return (
                  <View
                    key={`current-line-${idx}`}
                    style={[
                      styles.currentLineSegment,
                      {
                        left: prevPoint.x,
                        top: prevPoint.y,
                        width: distance,
                        transform: [{ rotate: `${angle}deg` }],
                        transformOrigin: '0 0',
                      },
                    ]}
                  />
                );
              })}
              
              {/* Draw preview points */}
              {currentPath.map((point, idx) => (
                <View
                  key={`current-point-${idx}`}
                  style={[
                    styles.currentLinePoint,
                    {
                      left: point.x - 3,
                      top: point.y - 3,
                    },
                  ]}
                />
              ))}
            </View>
          )}
          
          {/* Current drawing path - circle preview */}
          {isDrawing && currentPath.length >= 2 && activeTool === 'circle' && (
            <View
              style={[
                styles.circle,
                {
                  left: currentPath[0].x - Math.hypot(currentPath[1].x - currentPath[0].x, currentPath[1].y - currentPath[0].y),
                  top: currentPath[0].y - Math.hypot(currentPath[1].x - currentPath[0].x, currentPath[1].y - currentPath[0].y),
                  width: Math.hypot(currentPath[1].x - currentPath[0].x, currentPath[1].y - currentPath[0].y) * 2,
                  height: Math.hypot(currentPath[1].x - currentPath[0].x, currentPath[1].y - currentPath[0].y) * 2,
                  borderRadius: Math.hypot(currentPath[1].x - currentPath[0].x, currentPath[1].y - currentPath[0].y),
                  opacity: 0.6,
                }
              ]}
            />
          )}

          {/* Current drawing path - other tools */}
          {isDrawing && currentPath.length > 0 && activeTool !== 'line' && activeTool !== 'circle' && (
            <View style={styles.currentPath}>
              <Text style={styles.pathText}>Drawing {activeTool}...</Text>
            </View>
          )}
          
          {/* Center reference point */}
          <View style={styles.centerPoint}>
            <MaterialCommunityIcons name="crosshairs-gps" size={24} color={colors.accent} />
            <Text style={styles.centerText}>Rover Position</Text>
          </View>
        </View>

        {/* Status Bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            Tool: {activeTool} | Entities: {entities.length} | Position: {currentPosition.lat.toFixed(6)}, {currentPosition.lng.toFixed(6)}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 60,
  },
  toolbarLeft: {
    flex: 1,
  },
  toolbarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  toolbarCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 3,
    justifyContent: 'center',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  toolBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 60,
  },
  toolBtnActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: colors.greenBtn,
  },
  toolBtnText: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  toolBtnTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.greenBtn,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  closeBtn: {
    backgroundColor: colors.redBtn,
    padding: 8,
    borderRadius: 6,
  },
  canvas: {
    flex: 1,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  grid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#e5e7eb',
    opacity: 0.5,
  },
  entity: {
    position: 'absolute',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 2,
    borderColor: colors.greenBtn,
    borderRadius: 4,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  entityContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  lineSegment: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.greenBtn,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  linePoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.greenBtn,
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  currentLineSegment: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  currentLinePoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: '#ffffff',
    opacity: 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  entityText: {
    fontSize: 10,
    color: colors.greenBtn,
  },
  currentPath: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  pathText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '600',
  },
  circle: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.blueBtn,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  circleCenter: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.blueBtn,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  circleEdge: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  centerPoint: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  centerText: {
    fontSize: 10,
    color: colors.accent,
    marginTop: 2,
    fontWeight: '600',
  },
  statusBar: {
    backgroundColor: colors.panelBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
});