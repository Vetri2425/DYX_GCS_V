import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Fontisto, Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface DrawingToolsPanelProps {
  activeDrawingTool: string | null;
  onToolSelect: (tool: string | null) => void;
  onShowCircleTool: () => void;
  onShowSurveyGridTool: () => void;
  onShowTextTool: () => void;
  onShowCADDrawing: () => void;
  onShowManualConnection: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DrawingToolsPanel: React.FC<DrawingToolsPanelProps> = ({
  activeDrawingTool,
  onToolSelect,
  onShowCircleTool,
  onShowSurveyGridTool,
  onShowTextTool,
  onShowCADDrawing,
  onShowManualConnection,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = onToggleCollapse ? isCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const drawingTools = [
    { name: 'line', mdiIcon: 'star-three-points-outline', title: 'Points', color: colors.greenBtn },
    { name: 'cad-draw', mdiIcon: 'draw-pen', title: 'CAD Draw', color: colors.accent },
    { name: 'rectangle', mdiIcon: 'rectangle-outline', title: 'Rectangle', color: colors.blueBtn },
    { name: 'text', mdiIcon: 'text-box-edit-outline', title: 'Text', color: colors.accent },
    { name: 'measure', mdiIcon: 'ruler', title: 'Measure', color: colors.accent },
    { name: 'manual-connection', mdiIcon: 'vector-polyline-edit', title: 'Manual\nConnection', color: colors.orangeBtn },
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
  ];

  const handleToolPress = (toolName: string) => {
    if (toolName === 'text') { onShowTextTool(); return; }
    if (toolName === 'cad-draw') { onShowCADDrawing(); return; }
    if (toolName === 'manual-connection') { onShowManualConnection(); return; }
    onToolSelect(activeDrawingTool === toolName ? null : toolName);
  };

  const allTools = [...drawingTools, ...generatorTools];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="pencil" size={16} color={colors.accent} />
          </View>
          <Text style={styles.headerTitle}>DRAWING TOOLS</Text>
        </View>
        <TouchableOpacity style={styles.collapseBtn} onPress={handleToggle} activeOpacity={0.7}>
          <MaterialCommunityIcons
            name={collapsed ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {!collapsed && (
        <>
          {/* Tool Grid */}
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
                {activeDrawingTool === 'line' && '✦ Click to place points. Double-tap to finish.'}
                {activeDrawingTool === 'cad-draw' && '🔧 Professional CAD drawing with precision tools.'}
                {activeDrawingTool === 'rectangle' && '✦ Click first corner, then drag to second corner.'}
                {activeDrawingTool === 'text' && '✏️ Click to place text annotation on map.'}
                {activeDrawingTool === 'measure' && '✦ Click points to measure distance.'}
              </Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => onToolSelect(null)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
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
});
