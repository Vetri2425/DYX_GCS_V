# Drag-to-Draw Manual Path - Quick Reference Card

## 🎯 Quick Start

### 1. Activate Manual Mode
```
Upload File → Import Preview → Select "✏️ Manual" → ✓ Proceed
```

### 2. Connect Waypoints
```
┌─────────────────────────────────┐
│ CLICK + HOLD on waypoint #1     │
│        ↓                         │
│ DRAG to waypoint #16            │
│        ↓                         │
│ RELEASE = Connection made! ✅    │
└─────────────────────────────────┘
```

### 3. Visual Feedback
```
Before:  ○ ○ ○ ○  (no lines)
During:  ○╌╌╌○ ○ ○  (preview line - light green dashed)
After:   ○═══○ ○ ○  (permanent line - green dashed)
```

---

## 🖱️ Mouse Controls

| Action | Result |
|--------|--------|
| **Click + Hold** on waypoint | Start connection |
| **Drag** over waypoint | Preview line snaps to waypoint |
| **Release** on waypoint | Create connection ✅ |
| **Release** on same waypoint | Cancel (no connection) |

---

## 📊 What Updates in Real-Time

### Left Sidebar (Waypoint List)
```
Connected: 0 → Shows nothing
Connected: 1 → Shows 1st connected waypoint
Connected: 2 → Shows 1st + 2nd connected waypoints
Connected: 3 → Shows 1st + 2nd + 3rd...
```

### Statistics Panel
```
Before: 0 WPs, 0 m, 0 min
After:  3 WPs, 450 m, 2.5 min (only connected waypoints)
```

### Map
```
Green dashed lines appear connecting ONLY your selected waypoints
Unconnected waypoints remain as orange markers (no lines)
```

---

## 🎨 Visual Guide

### Drag Workflow
```
Step 1: Press on WP #1          Step 2: Drag to WP #16
┌─────────────────┐             ┌─────────────────┐
│  ●  ○  ○  ○    │             │  ●╌╌╌○  ○  ○   │
│  ↓              │             │       ↑         │
│  ○  ○  ○  ○    │             │  ○  ○  ○  ○    │
└─────────────────┘             └─────────────────┘
  Press down                      Preview line


Step 3: Hover WP #25            Step 4: Release
┌─────────────────┐             ┌─────────────────┐
│  ●═══○  ○  ○   │             │  ●═══○  ○  ○   │
│       ╲         │             │       ║         │
│  ○  ○ ╲○  ○    │             │  ○  ○ ●  ○    │
└─────────────────┘             └─────────────────┘
  Snap to point                   Connection made!
```

### Custom Path Example
```
Want corner-only path from 48 waypoints:

Full Grid:                  Manual Connections:
○ ○ ○ ○ ○ ○                ●═══════════════●
○ ○ ○ ○ ○ ○                ║               ║
○ ○ ○ ○ ○ ○                ║               ║
○ ○ ○ ○ ○ ○                ●═══════════════●
○ ○ ○ ○ ○ ○                (4 waypoints, perfect square)
```

---

## 🎮 Manual Path Connection Panel

```
┌──────────────────────────────────────────┐
│ ✏️ Manual Path Connection            ✕  │
├──────────────────────────────────────────┤
│ Tap waypoints in order to connect them.  │
│                                           │
│ Connected: 4/48          [↶ Undo]       │
│                                           │
│ Connection Sequence:                      │
│ ┌────────────────────────────────────┐   │
│ │ #1 → #16 → #25 → #48              │   │
│ └────────────────────────────────────┘   │
│                                           │
│ [Clear All]              [✓ Finish]     │
└──────────────────────────────────────────┘
```

**Controls:**
- **↶ Undo**: Remove last connection
- **Clear All**: Remove all connections
- **✓ Finish**: Save and apply path
- **✕ Exit**: Close with confirmation

---

## 🔍 Differences: Auto vs Manual Mode

| Feature | Auto Mode 🤖 | Manual Mode ✏️ |
|---------|-------------|----------------|
| **Line Color** | Orange | Green |
| **Line Style** | Solid | Dashed |
| **Marker Drag** | ✅ Yes (reposition) | ❌ No (locked) |
| **Connection** | Automatic (sequential) | Manual (drag) |
| **Sidebar Shows** | All waypoints | Connected only |
| **Statistics** | All waypoints | Connected only |

---

## 💡 Pro Tips

### 1. Build Complex Patterns
```
Start from any point, connect in any order:
#5 → #23 → #7 → #45 → #2 → #5 (closed loop)
```

### 2. Preview Before Committing
```
Drag slowly over multiple waypoints to preview different paths
Release only when you see the right connection
```

### 3. Use Undo Freely
```
Made a mistake? Click ↶ Undo
The last connection disappears instantly
```

### 4. Check Progress
```
Watch "Connected: X/Total" counter
Watch sidebar fill with connected waypoints
Watch statistics update with path distance
```

### 5. Close Loops
```
Drag last waypoint back to first waypoint
Creates circular patrol/survey paths
```

---

## ⚙️ Technical Specs

### Line Rendering
| Type | Color | Dash | Weight | Opacity |
|------|-------|------|--------|---------|
| **Preview** | #4ADE80 | 10, 10 | 3px | 60% |
| **Connected** | #4ADE80 | 5, 10 | 3px | 100% |
| **Auto Mode** | #f97316 | Solid | 2px | 100% |

### Event Flow
```
mousedown → Start drag
  ↓
mouseover → Update preview
  ↓
mouseup → Create connection
  ↓
Message to React Native → Update state
  ↓
Re-render map + sidebar + stats
```

---

## 🚨 Important Notes

### ✅ DO:
- Drag from one waypoint to another
- Watch for preview line before releasing
- Use Undo to correct mistakes
- Finish when path is complete

### ❌ DON'T:
- Try to drag map while connecting (disabled during drag)
- Drag to the same waypoint (cancels connection)
- Forget to click Finish (connections not saved until you finish)

---

## 📱 Common Workflows

### Corner-Only Pattern
```
1. Upload grid → Manual mode
2. Drag: Top-left → Top-right → Bottom-right → Bottom-left → Top-left
3. Finish
Result: 5-point perimeter path
```

### Row-Specific Inspection
```
1. Upload full grid → Manual mode
2. Drag connections only in rows 2, 5, 8
3. Finish
Result: 3-row inspection path
```

### Priority-First Survey
```
1. Upload all points → Manual mode
2. Connect high-priority zones first
3. Then connect medium-priority
4. Finally connect low-priority
5. Finish
Result: Priority-ordered mission
```

---

## 🎓 Learning Curve

```
Beginner:  Connect 2-3 waypoints to see how it works
           ↓
Practice:  Build 5-10 point path
           ↓
Advanced:  Create complex custom patterns
           ↓
Expert:    Optimize paths for minimum distance/time
```

---

## 🔧 Troubleshooting

### "Preview line not appearing"
- Make sure you're pressing and holding on a waypoint
- Map dragging should be disabled during drag

### "Connection not created"
- Release mouse button while hovering over target waypoint
- Don't release on map background

### "Sidebar still empty after connections"
- Check "Connected: X/Total" counter in panel
- Sidebar shows waypoints in connection order

### "Can't drag waypoints to reposition"
- Waypoint position dragging is disabled in manual mode
- Finish manual mode first, then reposition in auto mode

---

**Ready to create custom paths? Just drag and draw!** 🎨✨
