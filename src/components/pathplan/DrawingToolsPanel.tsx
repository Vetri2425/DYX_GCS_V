import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface DrawingToolsPanelProps {
  activeDrawingTool: string | null;
  onToolSelect: (tool: string | null) => void;
  onShowCircleTool: () => void;
  onShowSurveyGridTool: () => void;
  onShowTextTool: () => void;
  onShowDrawTool: () => void;
}

export const DrawingToolsPanel: React.FC<DrawingToolsPanelProps> = ({
  activeDrawingTool,
  onToolSelect,
  onShowCircleTool,
  onShowSurveyGridTool,
  onShowTextTool,
  onShowDrawTool,
}) => {
  const drawingTools = [
    { name: 'line', icon: '📍', title: 'Points', color: colors.greenBtn },
    { name: 'draw', icon: '✏️', title: 'Draw', color: colors.greenBtn },
    { name: 'rectangle', icon: '⬜', title: 'Rectangle', color: colors.blueBtn },
    { name: 'circle', icon: '⭕', title: 'Circle', color: colors.blueBtn },
    { name: 'hexagon', icon: '⬡', title: 'Hexagon', color: colors.blueBtn },
    { name: 'text', icon: '📝', title: 'Text', color: colors.accent },
    { name: 'measure', icon: '📏', title: 'Measure', color: colors.accent },
  ];

  const handleToolPress = (toolName: string) => {
    if (toolName === 'text') {
      onShowTextTool();
      return;
    }
    if (toolName === 'draw') {
      onShowDrawTool();
      return;
    }
    if (activeDrawingTool === toolName) {
      onToolSelect(null); // Deactivate if already active
    } else {
      onToolSelect(toolName);
    }
  };

  // Split drawing and generator tools for type safety
  type GeneratorTool = {
    name: string;
    icon: string;
    title: string;
    color: string;
    onPress: () => void;
  };
  const generatorTools: GeneratorTool[] = [
    { name: 'auto-circle', icon: '🌀', title: 'Auto Circle', color: colors.blueBtn, onPress: onShowCircleTool },
    { name: 'survey-grid', icon: '📐', title: 'Survey Grid', color: colors.blueBtn, onPress: onShowSurveyGridTool },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>✏️</Text>
        <Text style={styles.headerText}>Drawing Tools</Text>
      </View>

      {/* Tool Buttons in Grid */}
      <View style={styles.toolsGrid3Cols}>
        {[...drawingTools, ...generatorTools].map((tool, idx) => {
          const isGenerator = (tool as GeneratorTool).onPress !== undefined;
          return (
            <TouchableOpacity
              key={tool.name}
              style={[
                styles.toolBtn,
                activeDrawingTool === tool.name && styles.toolBtnActive,
                activeDrawingTool === tool.name && { borderColor: tool.color },
                isGenerator && styles.generatorBtn,
              ]}
              onPress={() => isGenerator ? (tool as GeneratorTool).onPress() : handleToolPress(tool.name)}
              activeOpacity={0.7}
            >
              <Text style={styles.toolIcon}>{tool.icon}</Text>
              <Text
                style={[styles.toolLabel, activeDrawingTool === tool.name && styles.toolLabelActive]}
              >
                {tool.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Instructions */}
      {activeDrawingTool && (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            {activeDrawingTool === 'line' && '📍 Click to place points. Double-tap to finish.'}
            {activeDrawingTool === 'draw' && '✏️ Click and drag to draw freehand path.'}
            {activeDrawingTool === 'rectangle' && '📍 Click first corner, then drag to second corner.'}
            {activeDrawingTool === 'circle' && '📍 Click center, then drag to set radius.'}
            {activeDrawingTool === 'hexagon' && '📍 Click center, then drag to set size.'}
            {activeDrawingTool === 'text' && '📝 Click to place text annotation on map.'}
            {activeDrawingTool === 'measure' && '📍 Click points to measure distance.'}
          </Text>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onToolSelect(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.panelBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  toolsGrid3Cols: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  toolBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    width: '31%',
    minHeight: 70,
    marginBottom: 6,
  },
  toolBtnActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: colors.greenBtn,
  },
  generatorBtn: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolIcon: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 4,
  },
  toolLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 12,
  },
  toolLabelActive: {
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  instructions: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
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
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
