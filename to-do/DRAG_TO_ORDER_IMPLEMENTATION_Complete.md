# Drag-to-Order Waypoints - Practical Implementation Guide

**Status:** Ready for Implementation  
**Complexity:** Medium  
**Estimated Time:** 3-4 hours  

---

## What We're Building

Add drag-to-reorder functionality to waypoints in the full-screen table view. Users long-press a row and drag it to a new position. Distances auto-recalculate.

---

## Prerequisites Check

### 1. Verify Existing Dependencies
```bash
# Check if these exist in package.json
- react-native-reanimated: ^4.1.5 ✓
- react-native-gesture-handler: ? (check this)
```

### 2. Verify Distance Calculation Utility
**CRITICAL:** Verify `src/utils/missionCalculator.ts` exists and has `haversineDistance` function.  
We'll add `recalculateWaypointDistances` to this existing file.

---

## Installation Steps

```bash
# 1. Install drag library
npm install react-native-draggable-flatlist

# 2. Install gesture handler (if missing)
npm install react-native-gesture-handler

# 3. Clear cache and rebuild
npm start -- --clear
```

### Create babel.config.js (if it doesn't exist)
**Note:** Expo managed projects may not have this file. Check if it exists first.

**If babel.config.js doesn't exist, create it:**
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',  // MUST BE LAST
    ],
  };
};
```

**If it already exists, add the reanimated plugin as the LAST item in the plugins array.**

---

## Implementation Plan

### Phase 0: Setup GestureHandlerRootView (5 min) - REQUIRED
**File:** `src/App.tsx`

**CRITICAL:** This is not optional. Without this, drag gestures will not work.

**Find the root component** (currently wrapped with ErrorBoundary):
```typescript
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Inside ErrorBoundary, wrap everything with GestureHandlerRootView:
export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ComponentReadinessProvider>
          <RoverProvider>
            {/* Rest of your app */}
          </RoverProvider>
        </ComponentReadinessProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
```

**Why this is Phase 0:** Without GestureHandlerRootView, all gesture handling will fail silently. This must be done before implementing drag functionality.

---

### Phase 1: Add Utility Function (5 min)
**File:** `src/utils/missionCalculator.ts` (EXTEND existing file)

**Add this function to the existing file:**

```typescript
import { PathPlanWaypoint } from '../types/pathplan';

export const recalculateWaypointDistances = (
  waypoints: PathPlanWaypoint[]
): PathPlanWaypoint[] => {
  return waypoints.map((wp, idx) => {
    if (idx === 0) return { ...wp, distance: 0 };
    const prev = waypoints[idx - 1];
    const dist = haversineDistance(
      { lat: prev.lat, lon: prev.lon },
      { lat: wp.lat, lon: wp.lon }
    );
    return { ...wp, distance: dist };
  });
};
```

**Why:** Extends existing `missionCalculator.ts` instead of creating new file. Uses proper TypeScript types.

---

### Phase 2: Draggable Table Component (1-2 hours)
**File:** `src/components/pathplan/DraggableWaypointsTable.tsx` (NEW)

```typescript
import React, { useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { PathPlanWaypoint } from '../../types/pathplan';

interface Props {
  waypoints: PathPlanWaypoint[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDelete?: (id: number) => void;
}

const WaypointRow = memo(({ 
  item, 
  drag, 
  isActive,
  onDelete,
  isDragDisabled,
  getIndex
}: RenderItemParams<PathPlanWaypoint> & { 
  onDelete?: (id: number) => void;
  isDragDisabled?: boolean;
  getIndex: () => number;
}) => {
  const index = getIndex();
  
  return (
    <ScaleDecorator>
      <TouchableOpacity
        onLongPress={isDragDisabled ? undefined : drag}
        disabled={isActive || isDragDisabled}
        style={[
          styles.row,
          index % 2 === 0 && styles.rowAlt,
          isActive && styles.rowActive,
        ]}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandle}>
          <Ionicons 
            name="swap-vertical-outline" 
            size={20} 
            color={isDragDisabled ? '#4a5568' : '#67E8F9'} 
          />
        </View>
        
        {/* Data Cells */}
        <Text style={[styles.cell, styles.colSeq]}>{index + 1}</Text>
        <Text style={[styles.cell, styles.colBlock]}>{item.block || '-'}</Text>
        <Text style={[styles.cell, styles.colRow]}>{item.row || '-'}</Text>
        <Text style={[styles.cell, styles.colPile]}>{item.pile || '-'}</Text>
        <Text style={[styles.cell, styles.colLat]}>{item.lat?.toFixed(7) ?? '0.0000000'}</Text>
        <Text style={[styles.cell, styles.colLon]}>{item.lon?.toFixed(7) ?? '0.0000000'}</Text>
        <Text style={[styles.cell, styles.colAlt]}>{item.alt?.toFixed(2) || '0.00'}</Text>
        <Text style={[styles.cell, styles.colDist]}>{item.distance?.toFixed(2) || '0.00'}</Text>
        
        {/* Delete Button */}
        {onDelete && (
          <TouchableOpacity 
            style={styles.deleteBtn}
            onPress={() => onDelete(item.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </ScaleDecorator>
  );
});

WaypointRow.displayName = 'WaypointRow';

export const DraggableWaypointsTable: React.FC<Props> = ({
  waypoints,
  onReorder,
  onDelete,
}) => {
  const isDragDisabled = waypoints.length <= 1;

  const renderItem = useCallback(
    (params: RenderItemParams<PathPlanWaypoint>) => {
      const { item, drag, isActive, getIndex } = params;
      return (
        <WaypointRow 
          item={item}
          drag={drag}
          isActive={isActive}
          getIndex={getIndex}
          onDelete={onDelete}
          isDragDisabled={isDragDisabled}
        />
      );
    },
    [onDelete, isDragDisabled]
  );

  const handleDragEnd = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      if (from !== to) {
        onReorder(from, to);
      }
    },
    [onReorder]
  );

  if (waypoints.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No waypoints yet</Text>
        <Text style={styles.emptyHint}>Tap on map to add</Text>
      </View>
    );
  }

  const ITEM_HEIGHT = 50;
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.dragHandlePlaceholder} />
        <Text style={[styles.headerCell, styles.colSeq]}>#</Text>
        <Text style={[styles.headerCell, styles.colBlock]}>Block</Text>
        <Text style={[styles.headerCell, styles.colRow]}>Row</Text>
        <Text style={[styles.headerCell, styles.colPile]}>Pile</Text>
        <Text style={[styles.headerCell, styles.colLat]}>Latitude</Text>
        <Text style={[styles.headerCell, styles.colLon]}>Longitude</Text>
        <Text style={[styles.headerCell, styles.colAlt]}>Alt</Text>
        <Text style={[styles.headerCell, styles.colDist]}>Dist</Text>
        <View style={styles.colAction} />
      </View>

      {/* Draggable List */}
      <DraggableFlatList
        data={waypoints}
        renderItem={renderItem}
        keyExtractor={(item) => `wp-${item.id}`}
        onDragEnd={handleDragEnd}
        activationDistance={10}
        containerStyle={styles.listContainer}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={21}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    backgroundColor: '#0a2540',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  headerCell: {
    color: '#67E8F9',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 14,
  },
  dragHandle: {
    width: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandlePlaceholder: { width: 30 },
  listContainer: { flex: 1 },
  row: {
    flexDirection: 'row',
    backgroundColor: '#112e4a',
    paddingVertical: 10,
    minHeight: 50,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34, 211, 238, 0.1)',
  },
  rowAlt: { backgroundColor: '#0a2540' },
  rowActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cell: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 14,
  },
  colSeq: { flex: 0.5, fontWeight: 'bold' },
  colBlock: { flex: 0.8 },
  colRow: { flex: 0.8 },
  colPile: { flex: 0.8 },
  colLat: { flex: 1.4, fontFamily: 'monospace' },
  colLon: { flex: 1.4, fontFamily: 'monospace' },
  colAlt: { flex: 0.8 },
  colDist: { flex: 0.8 },
  colAction: { flex: 0.5 },
  deleteBtn: { padding: 4, alignItems: 'center' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 18,
    marginBottom: 8,
  },
  emptyHint: {
    color: colors.textSecondary,
    fontSize: 14,
    opacity: 0.7,
  },
});
```

**Key Changes from Original:**
- ✅ Uses `Ionicons` instead of emojis
- ✅ Proper empty state handling
- ✅ Single waypoint drag disabled with visual feedback
- ✅ Performance optimizations (getItemLayout, removeClippedSubviews)
- ✅ Proper TypeScript types
- ✅ Uses getIndex() from RenderItemParams (v4 compatibility)

---

### Phase 3: Update PathSequenceSidebar (30 min)
**File:** `src/components/pathplan/PathSequenceSidebar.tsx`

#### Step 3.1: Add Imports (top of file)
```typescript
// Add useCallback to existing React import:
import React, { useState, useCallback } from 'react';

// Alert and Modal should already be imported - verify they exist:
import { Modal, Alert } from 'react-native';

// Add these NEW imports:
import { DraggableWaypointsTable } from './DraggableWaypointsTable';
import { recalculateWaypointDistances } from '../../utils/missionCalculator';
```

#### Step 3.2: Verify Props Interface (NO CHANGES NEEDED)
The Props interface already has `onUpdateWaypoints`. Just verify it exists:
```typescript
interface Props {
  // ... other props ...
  onUpdateWaypoints?: (waypoints: PathPlanWaypoint[]) => void;  // ← Should already exist
}
```

#### Step 3.3: Add Reorder Handler (inside component)
```typescript
const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
  if (!onUpdateWaypoints) return;
  
  try {
    // Reorder array
    const reordered = [...waypoints];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    
    // Recalculate distances
    const updated = recalculateWaypointDistances(reordered);
    
    // Update state
    onUpdateWaypoints(updated);
    
    console.log(`Waypoint moved: ${fromIndex + 1} → ${toIndex + 1}`);
  } catch (error) {
    console.error('Reorder failed:', error);
    Alert.alert('Error', 'Failed to reorder waypoints');
  }
}, [waypoints, onUpdateWaypoints]);
```

#### Step 3.4: Replace Full-Screen Modal Content
**Find this section** (around line 280-322):
```typescript
<ScrollView horizontal={false} style={{ flex: 1 }}>
  <View style={{ flex: 1, width: '100%' }}>
    {/* OLD TABLE CODE */}
  </View>
</ScrollView>
```

**Replace with:**
```typescript
<DraggableWaypointsTable
  waypoints={waypoints}
  onReorder={handleReorder}
  onDelete={onDeleteWaypoint}
/>
```

---

### Phase 4: Verify PathPlanScreen (5 min)
**File:** `src/screens/PathPlanScreen.tsx`

**NO CODE CHANGES NEEDED**

The reorder logic is self-contained in `PathSequenceSidebar`. Just verify that `PathSequenceSidebar` is receiving `onUpdateWaypoints` prop:

```typescript
<PathSequenceSidebar
  waypoints={waypoints}
  onUpdateWaypoints={handleUpdateWaypoints}  // ← Verify this exists
  // ... other props
/>
```

**Why no changes:** Single responsibility - `PathSequenceSidebar` owns the drag behavior and calls `onUpdateWaypoints` with the reordered array. No duplicate logic.

---

## Testing Checklist

### Basic Functionality
- [ ] Long-press activates drag mode
- [ ] Row follows finger during drag
- [ ] Drop places row at correct position
- [ ] Sequence numbers update correctly
- [ ] Distances recalculate correctly
- [ ] First waypoint always has distance = 0

### Edge Cases
- [ ] Drag first waypoint to last position
- [ ] Drag last waypoint to first position
- [ ] Single waypoint (drag should do nothing)
- [ ] Empty list shows empty state
- [ ] Delete button works during/after drag

### Performance
- [ ] Smooth with 20 waypoints
- [ ] Smooth with 50 waypoints
- [ ] No lag on rapid reorders

### Error Handling
- [ ] App doesn't crash on failed reorder
- [ ] User sees error message if something breaks

---

## Common Issues & Fixes

### Issue: "Cannot find module 'react-native-draggable-flatlist'"
**Fix:** 
```bash
npm install react-native-draggable-flatlist
npm start -- --clear
```

### Issue: Drag doesn't activate
**Fix:** Check babel.config.js has reanimated plugin as LAST item. Then:
```bash
npm start -- --clear
```

### Issue: App crashes on drag
**This should NOT happen if you completed Phase 0.** If it does:

**Fix:** Verify `GestureHandlerRootView` is wrapping your app in App.tsx:
```typescript
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Your app */}
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
```

### Issue: Distances are wrong after reorder
**Fix:** Check that `recalculateWaypointDistances` is being called in `PathSequenceSidebar.handleReorder` before calling `onUpdateWaypoints`.

### Issue: Wrong waypoint gets deleted after reorder
**Fix:** Ensure you're using `item.id` not `index` in delete handler.

---

## What's NOT Included (Intentionally)

- ❌ Undo/Redo - Add later if users request it
- ❌ Multi-select drag - Overkill for v1
- ❌ Haptic feedback - Nice-to-have, not critical
- ❌ Drag in compact view - Full-screen only for now
- ❌ Keyboard shortcuts - Mobile-first

---

## Success Criteria

✅ User can long-press and drag waypoints  
✅ Distances auto-recalculate correctly  
✅ No crashes or performance issues  
✅ Works with 50+ waypoints smoothly  
✅ Code is maintainable (single distance calc function)  

---

## Time Estimate Breakdown

| Phase | Time | Notes |
|-------|------|-------|
| Phase 0: GestureHandler Setup | 5 min | REQUIRED - Add to App.tsx |
| Setup & Install | 15 min | Dependencies + babel config |
| Utility Function | 5 min | Add to existing file |
| DraggableWaypointsTable | 1-2 hours | New component |
| PathSequenceSidebar | 30 min | Integration |
| PathPlanScreen | 5 min | Verification only |
| Testing | 1 hour | Manual testing |
| **Total** | **3-4 hours** | Realistic estimate |

---

## Final Notes

This is a **minimal viable implementation**. It works, it's maintainable, and it doesn't over-engineer things. 

If users love it, we can add:
- Undo/redo
- Haptic feedback  
- Drag in compact view
- Animations

But let's ship the basics first and iterate based on real feedback.

**Questions? Issues? Check the "Common Issues" section first.**
# ✅ COMPLETED