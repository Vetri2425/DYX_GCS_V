import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { MaterialCommunityIcons, Fontisto, Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { PathPlanWaypoint } from '../../types/pathplan';
import { optimizePath, PathAxis, PathDirection } from '../../utils/optimizePath';
import { vincentyDistance } from '../../utils/missionCalculator';

// ─── Precise Path Axis / Direction Options ───────────────────

const AXIS_OPTIONS: { value: PathAxis; shortLabel: string; icon: string }[] = [
  { value: 'EAST_WEST', shortLabel: 'E\u2194W', icon: 'arrow-left-right' },
  { value: 'WEST_EAST', shortLabel: 'W\u2194E', icon: 'arrow-left-right' },
  { value: 'NORTH_SOUTH', shortLabel: 'N\u2194S', icon: 'arrow-up-down' },
  { value: 'SOUTH_NORTH', shortLabel: 'S\u2194N', icon: 'arrow-up-down' },
];

const DIRECTION_OPTIONS: { value: PathDirection; label: string }[] = [
  { value: 'LEFT_RIGHT', label: 'Left \u2192 Right' },
  { value: 'RIGHT_LEFT', label: 'Right \u2192 Left' },
];

// ─── Props ───────────────────────────────────────────────────

interface DrawingToolsPanelProps {
  activeDrawingTool: string | null;
  onToolSelect: (tool: string | null) => void;
  onShowCircleTool: () => void;
  onShowTextTool: () => void;
  onShowCADDrawing: () => void;
  onShowManualConnection: () => void;
  onShowReverseTool: () => void;
  onShowCornerExtension: () => void;
  onShowSolarTableTool: () => void;
  onShowTemplateManager: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  // Precise path props — when isPrecisePathActive=true, panel shows controls inline
  isPrecisePathActive?: boolean;
  precisePathWaypoints?: PathPlanWaypoint[];
  onPrecisePathPreviewChange?: (preview: PathPlanWaypoint[]) => void;
  onPrecisePathApply?: (optimized: PathPlanWaypoint[]) => void;
  onPrecisePathClose?: () => void;
  onPrecisePathActivate?: () => void;
  onClearAll?: () => void;
  /** Injected by DraggableCard (handleType="custom") — gesture object for the drag handle button */
  dragGesture?: any;
  /** True while the card is being dragged — injected by DraggableCard */
  isDraggingActive?: boolean;
  onClose?: () => void;
}

export const DrawingToolsPanel: React.FC<DrawingToolsPanelProps> = ({
  activeDrawingTool,
  onToolSelect,
  onShowCircleTool,
  onShowTextTool,
  onShowCADDrawing,
  onShowManualConnection,
  onShowReverseTool,
  onShowCornerExtension,
  onShowSolarTableTool,
  onShowTemplateManager,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  isCollapsed = false,
  onToggleCollapse,
  isPrecisePathActive = false,
  precisePathWaypoints = [],
  onPrecisePathPreviewChange,
  onPrecisePathApply,
  onPrecisePathClose,
  onPrecisePathActivate,
  onClearAll,
  dragGesture,
  isDraggingActive,
  onClose,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = onToggleCollapse ? isCollapsed : internalCollapsed;
  const [showLinesMenu, setShowLinesMenu] = useState(false);
  const [showShapesMenu, setShowShapesMenu] = useState(false);

  // Precise path local state
  const [axis, setAxis] = useState<PathAxis>('EAST_WEST');
  const [direction, setDirection] = useState<PathDirection>('LEFT_RIGHT');

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  // Memoized optimization preview
  const preview = useMemo(() => {
    if (!isPrecisePathActive || precisePathWaypoints.length < 2) return null;
    return optimizePath(precisePathWaypoints, { axis, direction });
  }, [isPrecisePathActive, precisePathWaypoints, axis, direction]);

  // Stats for the preview
  const stats = useMemo(() => {
    if (!preview || precisePathWaypoints.length < 2) return null;
    let originalDist = 0;
    let optimizedDist = 0;
    for (let i = 1; i < precisePathWaypoints.length; i++) {
      originalDist += vincentyDistance(
        { lat: precisePathWaypoints[i - 1].lat, lon: precisePathWaypoints[i - 1].lon },
        { lat: precisePathWaypoints[i].lat, lon: precisePathWaypoints[i].lon },
      );
    }
    for (let i = 1; i < preview.length; i++) {
      optimizedDist += vincentyDistance(
        { lat: preview[i - 1].lat, lon: preview[i - 1].lon },
        { lat: preview[i].lat, lon: preview[i].lon },
      );
    }
    const savings = originalDist > 0 ? Math.max(0, ((originalDist - optimizedDist) / originalDist) * 100) : 0;

    const groupKey = axis === 'EAST_WEST' || axis === 'WEST_EAST' ? 'lat' : 'lon';
    const sorted = [...precisePathWaypoints].sort((a, b) => a[groupKey] - b[groupKey]);
    let groupCount = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i][groupKey] - sorted[i - 1][groupKey]) > 0.00001) {
        groupCount++;
      }
    }

    return { optimizedDist, savings, groupCount };
  }, [precisePathWaypoints, preview, axis]);

  // Push preview to parent
  React.useEffect(() => {
    if (preview && onPrecisePathPreviewChange) {
      onPrecisePathPreviewChange(preview);
    }
  }, [preview, onPrecisePathPreviewChange]);

  const formatDist = (m: number): string => {
    if (m < 1000) return `${Math.round(m)}m`;
    return `${(m / 1000).toFixed(2)}km`;
  };

  const handleApply = useCallback(() => {
    if (!preview || !onPrecisePathApply) return;
    onPrecisePathApply(preview);
  }, [preview, onPrecisePathApply]);

  const handlePreciseClose = useCallback(() => {
    onPrecisePathClose?.();
  }, [onPrecisePathClose]);

  const drawingTools = [
    { name: 'line', mdiIcon: 'star-three-points-outline', title: 'Points', color: colors.greenBtn },
    { name: 'cad-draw', mdiIcon: 'draw-pen', title: 'CAD Draw', color: colors.accent },
    { name: 'precise', mdiIcon: 'map-marker-path', title: 'Precise\nPath', color: colors.blueBtn },
    { name: 'text', mdiIcon: 'text-box-edit-outline', title: 'Text', color: colors.accent },
    { name: 'measure', mdiIcon: 'ruler', title: 'Measure', color: colors.accent },
    { name: 'manual-connection', mdiIcon: 'vector-polyline-edit', title: 'Manual\nConnection', color: colors.orangeBtn },
    { name: 'reverse', mdiIcon: 'swap-vertical', title: 'Reverse', color: colors.accent },
  ];

  type GeneratorTool = {
    name: string;
    mdiIcon?: string;
    fontistoIcon?: string;
    title: string;
    color: string;
    onPress: () => void;
  };

  const generatorTools: GeneratorTool[] = [
    { name: 'auto-circle', mdiIcon: 'circle-outline', title: 'Auto Circle', color: colors.accent, onPress: onShowCircleTool },
    { name: 'corner-extension', mdiIcon: 'arrow-expand-all', title: 'Corner\nExtend', color: '#f59e0b', onPress: onShowCornerExtension },
    { name: 'solar-table', mdiIcon: 'solar-panel', title: 'Solar\nTable', color: colors.accent, onPress: onShowSolarTableTool },
    { name: 'templates', mdiIcon: 'file-document-outline', title: 'Templates', color: colors.greenBtn, onPress: onShowTemplateManager },
  ];

  const handleToolPress = (toolName: string) => {
    if (toolName === 'text') { onShowTextTool(); return; }
    if (toolName === 'cad-draw') { onShowCADDrawing(); return; }
    if (toolName === 'manual-connection') { onShowManualConnection(); return; }
    if (toolName === 'reverse') { onShowReverseTool(); return; }
    if (toolName === 'precise') {
      if (isPrecisePathActive) {
        handlePreciseClose();
      } else {
        onPrecisePathActivate?.();
      }
      return;
    }
    onToolSelect(activeDrawingTool === toolName ? null : toolName);
  };

  const allTools = [...drawingTools, ...generatorTools];

  return (
    <View style={styles.container}>
      {/* Mode Capsule */}
      <View style={styles.capsule}>
        {/* Points Button */}
        <TouchableOpacity
          style={[styles.capsuleBtn, activeDrawingTool === 'line' && styles.capsuleBtnActive]}
          onPress={() => {
            setShowLinesMenu(false);
            setShowShapesMenu(false);
            onToolSelect(activeDrawingTool === 'line' ? null : 'line');
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons 
            name="map-marker-radius" 
            size={18} 
            color={activeDrawingTool === 'line' ? '#67E8F9' : '#94A3B8'} 
          />
          <Text style={[styles.capsuleBtnText, activeDrawingTool === 'line' && styles.capsuleBtnTextActive]}>Points</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Lines Button */}
        <TouchableOpacity
          style={[
            styles.capsuleBtn, 
            (activeDrawingTool === 'cad-draw' || activeDrawingTool === 'manual-connection') && styles.capsuleBtnActive
          ]}
          onPress={() => {
            setShowShapesMenu(false);
            setShowLinesMenu(!showLinesMenu);
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons 
            name="vector-polyline" 
            size={18} 
            color={(activeDrawingTool === 'cad-draw' || activeDrawingTool === 'manual-connection') ? '#67E8F9' : '#94A3B8'} 
          />
          <Text style={[
            styles.capsuleBtnText, 
            (activeDrawingTool === 'cad-draw' || activeDrawingTool === 'manual-connection') && styles.capsuleBtnTextActive
          ]}>Lines</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Shapes Button */}
        <TouchableOpacity
          style={[styles.capsuleBtn, showShapesMenu && styles.capsuleBtnActive]}
          onPress={() => {
            setShowLinesMenu(false);
            setShowShapesMenu(!showShapesMenu);
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons 
            name="shape-outline" 
            size={18} 
            color={showShapesMenu ? '#67E8F9' : '#94A3B8'} 
          />
          <Text style={[styles.capsuleBtnText, showShapesMenu && styles.capsuleBtnTextActive]}>Shapes</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Undo */}
        <TouchableOpacity
          style={[styles.capsuleBtn, !canUndo && styles.capsuleBtnDisabled]}
          onPress={onUndo}
          disabled={!canUndo}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons 
            name="undo" 
            size={18} 
            color={canUndo ? '#E5F1FF' : '#475569'} 
          />
          <Text style={[styles.capsuleBtnText, !canUndo && { color: '#475569' }]}>Undo</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Redo */}
        <TouchableOpacity
          style={[styles.capsuleBtn, !canRedo && styles.capsuleBtnDisabled]}
          onPress={onRedo}
          disabled={!canRedo}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons 
            name="redo" 
            size={18} 
            color={canRedo ? '#E5F1FF' : '#475569'} 
          />
          <Text style={[styles.capsuleBtnText, !canRedo && { color: '#475569' }]}>Redo</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Clear */}
        <TouchableOpacity
          style={styles.capsuleBtn}
          onPress={onClearAll}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
          <Text style={[styles.capsuleBtnText, { color: '#EF4444' }]}>Clear</Text>
        </TouchableOpacity>

        {dragGesture && (
          <>
            <View style={styles.divider} />
            {/* Drag Handle */}
            <GestureDetector gesture={dragGesture}>
              <View style={[styles.capsuleBtn, isDraggingActive && styles.capsuleBtnDragging]}>
                <MaterialCommunityIcons name="drag" size={18} color={isDraggingActive ? '#67E8F9' : 'rgba(103,232,249,0.5)'} />
                <Text style={[styles.capsuleBtnText, isDraggingActive && { color: '#67E8F9' }]}>Drag</Text>
              </View>
            </GestureDetector>
          </>
        )}

        {onClose && (
          <>
            <View style={styles.divider} />
            {/* Close Panel */}
            <TouchableOpacity style={styles.capsuleBtn} onPress={onClose} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={18} color="#EF4444" />
              <Text style={[styles.capsuleBtnText, { color: '#EF4444' }]}>Close</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Lines Dropdown Sub-menu */}
      {showLinesMenu && (
        <View style={[styles.dropdownMenu, { top: 96 }]}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowLinesMenu(false);
              onShowCADDrawing();
            }}
          >
            <MaterialCommunityIcons name="draw" size={16} color="#E5F1FF" />
            <Text style={styles.dropdownItemText}>CAD Draw</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowLinesMenu(false);
              onShowManualConnection();
            }}
          >
            <MaterialCommunityIcons name="vector-line" size={16} color="#E5F1FF" />
            <Text style={styles.dropdownItemText}>Manual Connect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Shapes Dropdown Sub-menu */}
      {showShapesMenu && (
        <View style={[styles.dropdownMenu, { top: 152 }]}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowShapesMenu(false);
              onShowCircleTool();
            }}
          >
            <MaterialCommunityIcons name="circle-outline" size={16} color="#E5F1FF" />
            <Text style={styles.dropdownItemText}>Auto Circle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowShapesMenu(false);
              onShowCornerExtension();
            }}
          >
            <MaterialCommunityIcons name="arrow-expand-all" size={16} color="#E5F1FF" />
            <Text style={styles.dropdownItemText}>Corner Extend</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowShapesMenu(false);
              onShowSolarTableTool();
            }}
          >
            <MaterialCommunityIcons name="solar-panel" size={16} color="#E5F1FF" />
            <Text style={styles.dropdownItemText}>Solar Table</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setShowShapesMenu(false);
              onShowTemplateManager();
            }}
          >
            <MaterialCommunityIcons name="file-document-outline" size={16} color="#E5F1FF" />
            <Text style={styles.dropdownItemText}>Templates</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    padding: 0,
    width: 60,
    alignItems: 'center',
  },
  capsule: {
    backgroundColor: '#07111be6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.15)',
    paddingVertical: 6,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  capsuleBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'column',
  },
  capsuleBtnActive: {
    backgroundColor: 'rgba(103, 232, 249, 0.12)',
    borderWidth: 1,
    borderColor: '#67E8F9',
  },
  capsuleBtnDragging: {
    backgroundColor: 'rgba(103, 232, 249, 0.18)',
    borderWidth: 1,
    borderColor: '#67E8F9',
  },
  capsuleBtnDisabled: {
    opacity: 0.3,
  },
  capsuleBtnText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
  capsuleBtnTextActive: {
    color: '#67E8F9',
  },
  divider: {
    width: '60%',
    height: 1,
    backgroundColor: 'rgba(103, 232, 249, 0.1)',
    marginVertical: 4,
  },
  dropdownMenu: {
    position: 'absolute',
    left: 68,
    backgroundColor: '#08101a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.2)',
    padding: 4,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    zIndex: 2000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  dropdownItemText: {
    color: '#E5F1FF',
    fontSize: 11,
    fontWeight: '600',
  },
});