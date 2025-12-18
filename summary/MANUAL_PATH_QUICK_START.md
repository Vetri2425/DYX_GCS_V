# Manual Path Assignment - Quick Start Guide

## 🎯 What It Does
Allows you to create **custom waypoint connection paths** instead of following sequential order. Perfect for corner-only routes, specific patterns, or priority-based missions.

## 🚀 How to Use

### Step 1: Upload Mission File
```
Tap "Upload" → Select your mission file (.csv, .json, .waypoint, etc.)
```

### Step 2: Choose Path Mode in Import Preview
```
┌─────────────────────────────────┐
│  Path Assignment Mode:          │
│                                  │
│  [✓ 🤖 Auto]  [ ✏️ Manual]      │
│     ↑              ↑             │
│   Sequential   Custom Path       │
└─────────────────────────────────┘
```

### Step 3a: Auto Mode (Traditional)
```
✓ Proceed → Waypoints imported sequentially → Done!
Path: WP1 → WP2 → WP3 → ... → WPn
```

### Step 3b: Manual Mode (Custom Path)
```
✓ Proceed → Manual Connection Panel appears → Click waypoints to connect
```

### Step 4: Build Your Path (Manual Mode)
```
┌──────────────────────────────────────┐
│ ✏️ Manual Path Connection       ✕   │
├──────────────────────────────────────┤
│ Connected: 4/48      [↶ Undo]      │
│                                      │
│ Connection Sequence:                 │
│  #1 → #16 → #25 → #48 → #1         │
│                                      │
│ [Clear All]         [✓ Finish]     │
└──────────────────────────────────────┘

🖱️ Click waypoints on map in desired order
```

### Step 5: Finish
```
Tap "✓ Finish" → Path saved → Waypoints reordered → Ready to execute!
```

---

## 📋 Example Use Cases

### Corner-Only Field Pattern
**Problem:** 48 waypoints cover entire field, but you only want corners
**Solution:** Upload all 48 → Manual mode → Connect corners: 1→12→36→48→1

### Priority Inspection
**Problem:** Need to inspect high-risk areas first
**Solution:** Upload all points → Manual mode → Connect priority points first

### Skip Specific Rows
**Problem:** Only need to inspect rows 2, 5, 8 from 10-row grid
**Solution:** Upload full grid → Manual mode → Connect only desired row waypoints

---

## ⌨️ Controls

| Control | Action |
|---------|--------|
| **Click Waypoint** | Add to path sequence |
| **↶ Undo** | Remove last waypoint |
| **Clear All** | Reset all connections |
| **✓ Finish** | Save and apply path (min 2 waypoints) |
| **✕ Exit** | Exit with confirmation |

---

## ⚠️ Important Notes

- **Minimum 2 waypoints** required to create a path
- Clicking an **already-connected waypoint** shows an alert
- **Unconnected waypoints** are automatically appended at the end
- Path can be **edited before finishing** using Undo/Clear All
- **Exit confirmation** saves your current connections

---

## 🎨 Visual Example

### Sequential (Auto Mode)
```
1 → 2 → 3 → 4
↓           ↑
8 ← 7 ← 6 ← 5
```

### Custom (Manual Mode) - Same waypoints, different path
```
1 ———————→ 4
↑           ↓
↑           ↓
8 ←——————— 5
```
*Connected only corners: 1→4→5→8→1 (skipped 2,3,6,7)*

---

## 🔧 Technical Details

**Connection Method:** Array-based reordering
**State Management:** React state with real-time updates
**Visual Feedback:** Connection sequence display with arrows
**Validation:** Duplicate detection, minimum count check

**Files Modified:**
- `src/screens/PathPlanScreen.tsx` - Main logic
- `src/components/pathplan/PathPlanMap.tsx` - Click handling

---

## 💡 Pro Tips

1. **Plan ahead:** Know which waypoints you need before starting
2. **Use Undo freely:** Easy to correct mistakes
3. **Check sequence display:** Verify connection order before finishing
4. **Save templates:** Take screenshots of your connection patterns for reuse
5. **Test first:** Try manual mode with small missions first

---

**Ready to create custom paths? Upload a mission and select Manual mode!** ✏️🚀
