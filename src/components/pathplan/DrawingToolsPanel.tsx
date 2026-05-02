import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
  onShowSurveyGridTool: () => void;
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
}

export const DrawingToolsPanel: React.FC<DrawingToolsPanelProps> = ({
  activeDrawingTool,
  onToolSelect,
  onShowCircleTool,
  onShowSurveyGridTool,
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
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = onToggleCollapse ? isCollapsed : internalCollapsed;

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
    { name: 'survey-grid', fontistoIcon: 'nav-icon-grid-a', title: 'Survey Grid', color: colors.greenBtn, onPress: onShowSurveyGridTool },
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="pencil" size={16} color={isPrecisePathActive ? colors.blueBtn : colors.accent} />
          </View>
          <Text style={[styles.headerTitle, isPrecisePathActive && { color: colors.blueBtn }]}>
            {isPrecisePathActive ? 'PRECISE PATH' : 'DRAWING TOOLS'}
          </Text>
        </View>
        <TouchableOpacity style={styles.collapseBtn} onPress={handleToggle} activeOpacity={0.7}>
          <MaterialCommunityIcons
            name={collapsed ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Undo/Redo actions */}
      {!collapsed && (
        <View style={styles.undoRedoRow}>
          <TouchableOpacity
            style={[styles.undoRedoBtn, !canUndo && styles.undoRedoBtnDisabled]}
            onPress={onUndo}
            disabled={!canUndo}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="undo" size={18} color={canUndo ? colors.text : colors.textMuted} />
            <Text style={[styles.undoRedoText, !canUndo && styles.undoRedoTextDisabled]}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.undoRedoBtn, !canRedo && styles.undoRedoBtnDisabled]}
            onPress={onRedo}
            disabled={!canRedo}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="redo" size={18} color={canRedo ? colors.text : colors.textMuted} />
            <Text style={[styles.undoRedoText, !canRedo && styles.undoRedoTextDisabled]}>Redo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!collapsed && (
        isPrecisePathActive ? (
          /* ─── Precise Path Controls (inline) ─── */
          <View style={styles.preciseSection}>
            {/* Axis selector */}
            <View style={styles.preciseRow}>
              <Text style={styles.preciseLabel}>AXIS</Text>
              <View style={styles.axisRow}>
                {AXIS_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.axisBtn, axis === opt.value && styles.axisBtnActive]}
                    onPress={() => setAxis(opt.value)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={opt.icon as any}
                      size={14}
                      color={axis === opt.value ? '#ffffff' : colors.textSecondary}
                    />
                    <Text style={[styles.axisBtnText, axis === opt.value && styles.axisBtnTextActive]}>
                      {opt.shortLabel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Direction selector */}
            <View style={styles.preciseRow}>
              <Text style={styles.preciseLabel}>DIR</Text>
              <View style={styles.dirRow}>
                {DIRECTION_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.dirBtn, direction === opt.value && styles.dirBtnActive]}
                    onPress={() => setDirection(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dirBtnText, direction === opt.value && styles.dirBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Stats + Actions */}
            {stats && (
              <View style={styles.preciseStatsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>POINTS</Text>
                  <Text style={styles.statValue}>{preview?.length ?? precisePathWaypoints.length}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>
                    {axis === 'EAST_WEST' || axis === 'WEST_EAST' ? 'ROWS' : 'COLS'}
                  </Text>
                  <Text style={styles.statValue}>{stats.groupCount}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>DIST</Text>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {formatDist(stats.optimizedDist)}
                  </Text>
                </View>
                {stats.savings > 0.5 && (
                  <>
                    <View style={styles.statDivider} />
                    <View style={[styles.statItem, styles.savingsBadge]}>
                      <Text style={styles.savingsText}>-{stats.savings.toFixed(1)}%</Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Apply / Cancel */}
            <View style={styles.preciseActions}>
              <TouchableOpacity style={styles.preciseCancelBtn} onPress={handlePreciseClose} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={16} color={colors.textSecondary} />
                <Text style={styles.preciseCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.preciseApplyBtn, (!preview || preview.length < 2) && styles.preciseApplyBtnDisabled]}
                onPress={handleApply}
                disabled={!preview || preview.length < 2}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="check-circle" size={16} color="#ffffff" />
                <Text style={styles.preciseApplyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ─── Normal Tool Grid ─── */
          <>
            <View style={styles.toolGrid}>
              {allTools.map((tool) => {
                const isActive = activeDrawingTool === tool.name;
                const isGen = (tool as GeneratorTool).onPress !== undefined;
                return (
                  <TouchableOpacity
                    key={tool.name}
                    style={[styles.toolBtn, isActive && { borderColor: tool.color, backgroundColor: tool.color + '15' }]}
                    onPress={() => isGen ? (tool as GeneratorTool).onPress() : handleToolPress(tool.name)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.toolAccent, { backgroundColor: isActive ? tool.color : 'transparent' }]} />
                    <View style={styles.toolInner}>
                      <View style={[styles.toolIconWrap, { borderColor: (isActive ? tool.color : colors.textSecondary) + '40' }]}>
                        {(tool as any).mdiIcon ? (
                          <MaterialCommunityIcons
                            name={(tool as any).mdiIcon}
                            size={20}
                            color={isActive ? tool.color : colors.textSecondary}
                          />
                        ) : (tool as any).fontistoIcon ? (
                          <Fontisto
                            name={(tool as any).fontistoIcon}
                            size={18}
                            color={isActive ? tool.color : colors.textSecondary}
                          />
                        ) : null}
                      </View>
                      <Text style={[styles.toolLabel, isActive && { color: '#ffffff' }]}>{tool.title}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Active tool instructions */}
            {activeDrawingTool && (
              <View style={styles.instructions}>
                <Text style={styles.instructionText}>
                  {activeDrawingTool === 'line' && 'Click to place points. Double-tap to finish.'}
                  {activeDrawingTool === 'cad-draw' && 'Professional CAD drawing with precision tools.'}
                  {activeDrawingTool === 'precise' && 'Optimize waypoint sequence using boustrophedon path planning.'}
                  {activeDrawingTool === 'text' && 'Click to place text annotation on map.'}
                  {activeDrawingTool === 'measure' && 'Click points to measure distance.'}
                </Text>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => onToolSelect(null)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.panelBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // ── HEADER ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
  },
  collapseBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── TOOL GRID ──
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  toolBtn: {
    width: '31.5%',
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    height: 64,
  },
  toolAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  toolInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  toolIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 11,
  },

  // ── INSTRUCTIONS ──
  instructions: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  instructionText: {
    fontSize: 11,
    color: colors.accent,
    lineHeight: 16,
    marginBottom: 8,
  },
  cancelBtn: {
    backgroundColor: colors.redBtn,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── PRECISE PATH CONTROLS ──
  preciseSection: {
    gap: 10,
  },
  preciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  preciseLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(103, 232, 249, 0.7)',
    letterSpacing: 1.5,
    width: 30,
  },
  axisRow: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  axisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 12,
    paddingHorizontal: 4,
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  axisBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: colors.accent,
  },
  axisBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  axisBtnTextActive: {
    color: '#ffffff',
  },
  dirRow: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  dirBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dirBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: colors.success,
  },
  dirBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dirBtnTextActive: {
    color: '#ffffff',
  },
  preciseStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingLeft: 36,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(103, 232, 249, 0.7)',
    letterSpacing: 1.5,
  },
  statValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  statDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  savingsText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  preciseActions: {
    flexDirection: 'row',
    gap: 8,
  },
  preciseCancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preciseCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  preciseApplyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  preciseApplyBtnDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  preciseApplyBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── UNDO/REDO ──
  undoRedoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  undoRedoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  undoRedoBtnDisabled: {
    opacity: 0.35,
  },
  undoRedoText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  undoRedoTextDisabled: {
    color: colors.textMuted,
  },
});