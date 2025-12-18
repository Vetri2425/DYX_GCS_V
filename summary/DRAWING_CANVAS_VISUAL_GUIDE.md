# Manual Path Drawing Canvas - Visual Guide 🎨

## 🖼️ Screen Flow

### Step 1: Upload & Select Manual Mode
```
┌──────────────────────────────────┐
│  📤 Import Preview               │
├──────────────────────────────────┤
│  sample_mission.csv              │
│  48 waypoints                    │
│                                  │
│  Path Assignment Mode:           │
│  ┌──────────┐  ┌──────────┐    │
│  │ 🤖 Auto  │  │ ✏️Manual │✓   │
│  └──────────┘  └──────────┘    │
│                                  │
│         [✓ Proceed]              │
└──────────────────────────────────┘
```

### Step 2: Drawing Canvas Opens (Fullscreen)
```
┌────────────────────────────────────────────────┐
│  ✏️ Manual Path Connection                     │
│  Draw lines through waypoints to connect them  │
│  Connected: 0 / 48 waypoints                   │
├────────────────────────────────────────────────┤
│  💡 Draw lines through waypoints to connect   │
├────────────────────────────────────────────────┤
│                                                │
│   ○3   ○7   ○11  ○15  ○19  ○23  ○27          │
│                                                │
│   ○2   ○6   ○10  ○14  ○18  ○22  ○26          │
│                                                │
│   ○1   ○5   ○9   ○13  ○17  ○21  ○25          │
│                                                │
│   ○4   ○8   ○12  ○16  ○20  ○24  ○28          │
│                                                │
│  (Grid lines in background)                    │
│                                                │
├────────────────────────────────────────────────┤
│  [✕ Cancel] [↶ Undo] [🗑️ Clear] [✓ Finish]   │
└────────────────────────────────────────────────┘
```

### Step 3: Drawing Corner Path
```
┌────────────────────────────────────────────────┐
│  ✏️ Manual Path Connection                     │
│  Draw lines through waypoints to connect them  │
│  Connected: 4 / 48 waypoints                   │
├────────────────────────────────────────────────┤
│                                                │
│   ●3════════╗                   ╔════●27       │
│   (1)       ║                   ║    (2)       │
│   ○2   ○6   ○10  ○14  ○18  ○22  ○26          │
│                                                │
│   ○1   ○5   ○9   ○13  ○17  ○21  ○25          │
│                                                │
│   ●4════════╝                   ╚════●28       │
│   (4)                                (3)       │
│                                                │
├────────────────────────────────────────────────┤
│  Connection Sequence:                          │
│  #3  →  #27  →  #28  →  #4                    │
├────────────────────────────────────────────────┤
│  [✕ Cancel] [↶ Undo] [🗑️ Clear] [✓ Finish(4)]│
└────────────────────────────────────────────────┘

Legend:
  ○ = Unconnected waypoint (orange)
  ● = Connected waypoint (green)
  (1) = Connection order badge
  ═ = Connection line (green dashed)
  ╌ = Your drawn stroke (light green)
```

---

## 🎨 Drawing Techniques

### Technique 1: Single Continuous Stroke
```
Draw one continuous line through multiple waypoints:

Start ○ → ○ → ○ → ○ → End
      ═════════════════

Result: All 5 waypoints connected in one sequence
```

### Technique 2: Multiple Strokes
```
Draw separate strokes for different sections:

Stroke 1:  ○═══○═══○
Stroke 2:      ○═══○═══○

Result: Two separate path segments
        Can be used for branching patterns
```

### Technique 3: Close the Loop
```
Draw back to starting point for circular path:

    ○═══○
    ║   ║
    ○═══○

Result: 4-point closed loop (A→B→C→D→A)
```

---

## 🎯 Visual States

### Waypoint States
```
┌──────────────────────────────────────────┐
│ State         │ Appearance                │
├───────────────┼───────────────────────────┤
│ Unconnected   │  ○  Orange, 12px radius   │
│               │   5  White ID number      │
├───────────────┼───────────────────────────┤
│ Connected     │  ●  Green, 16px radius    │
│               │   5  White ID number      │
│               │ (2)  Order badge (green)  │
└──────────────────────────────────────────┘
```

### Line States
```
┌─────────────────────────────────────────────┐
│ Type          │ Style                        │
├───────────────┼──────────────────────────────┤
│ Connection    │ Green, dashed (5,5), 3px    │
│ Line          │ Permanent, solid green       │
├───────────────┼──────────────────────────────┤
│ Drawn Stroke  │ Light green, 30% opacity    │
│ (after draw)  │ Semi-transparent overlay    │
├───────────────┼──────────────────────────────┤
│ Current Draw  │ Light green, 60% opacity    │
│ (while drag)  │ Following your finger       │
└─────────────────────────────────────────────┘
```

---

## 📱 Touch Gestures

### Drawing a Path
```
1. Touch down on screen
   ↓
2. Drag finger through waypoints
   ↓ (Real-time path preview)
3. Lift finger to complete stroke
   ↓ (Waypoints detected & connected)
4. Repeat for more connections
```

### Visual Feedback During Drawing
```
Before touch:
  ○   ○   ○   ○

While dragging:
  ○╌╌╌○╌╌╌○   ○
     (Light green preview)

After release:
  ●═══●═══●   ○
  (1) (2) (3)
  (Green connections + badges)
```

---

## 🎮 Button States

```
┌────────────────────────────────────────────────┐
│ Button        │ Enabled When                   │
├───────────────┼────────────────────────────────┤
│ ✕ Cancel      │ Always                         │
│ ↶ Undo        │ Has drawn strokes              │
│ 🗑️ Clear      │ Has drawn strokes              │
│ ✓ Finish (#)  │ 2+ waypoints connected         │
└────────────────────────────────────────────────┘

Disabled appearance: 50% opacity
Enabled appearance: Full color
```

---

## 💡 User Tips Overlay

```
┌─────────────────────────────────────────────┐
│  💡 Draw lines through waypoints to connect │
│     them in your desired order              │
└─────────────────────────────────────────────┘
        (Appears at top of canvas)
```

---

## 🔢 Connection Sequence Box

```
When connections exist:

┌───────────────────────────────────────────┐
│ Connection Sequence:                      │
│  ┌──┐    ┌──┐    ┌──┐    ┌──┐    ┌──┐   │
│  │#1│ →  │#5│ →  │#9│ →  │#13│ →  │#1│  │
│  └──┘    └──┘    └──┘    └──┘    └──┘   │
│ (Green badges, arrows between)            │
└───────────────────────────────────────────┘

Features:
- Scrollable horizontally if many waypoints
- Real-time updates as you draw
- Shows complete path sequence
```

---

## 🎨 Example Patterns

### Pattern 1: Perimeter Only
```
Before:                After drawing:
○ ○ ○ ○ ○ ○           ●═●═●═●═●═●
○ ○ ○ ○ ○ ○           ║         ║
○ ○ ○ ○ ○ ○           ●         ●
○ ○ ○ ○ ○ ○           ║         ║
○ ○ ○ ○ ○ ○           ●═●═●═●═●═●

Action: Draw rectangle around edges
Result: 16 connected waypoints (perimeter)
```

### Pattern 2: Zigzag Pattern
```
Before:                After drawing:
○ ○ ○ ○ ○ ○           ●═●   ●═●
○ ○ ○ ○ ○ ○             ╲   ╱
○ ○ ○ ○ ○ ○               ●
○ ○ ○ ○ ○ ○             ╱   ╲
○ ○ ○ ○ ○ ○           ●═●   ●═●

Action: Draw Z-shaped path
Result: 7 connected waypoints
```

### Pattern 3: Spiral Pattern
```
Before:                After drawing:
○ ○ ○ ○ ○              ●═●═●═●
○ ○ ○ ○ ○              ║   ╔═●
○ ○ ○ ○ ○              ●═●═╝
○ ○ ○ ○ ○

Action: Draw spiral from outside to center
Result: 12 connected waypoints
```

---

## 📊 Progress Indicators

### Header Status
```
Connected: 0 / 48 waypoints    (0% - Red/Orange)
Connected: 12 / 48 waypoints   (25% - Yellow)
Connected: 24 / 48 waypoints   (50% - Light Green)
Connected: 48 / 48 waypoints   (100% - Bright Green)
```

### Finish Button Counter
```
✓ Finish (0)    - Disabled (gray, 50% opacity)
✓ Finish (1)    - Disabled (need 2+)
✓ Finish (2)    - Enabled (green)
✓ Finish (12)   - Enabled (green)
```

---

## 🎯 Common Use Case Workflows

### Workflow 1: Quick Corners (10 seconds)
```
1. Canvas opens → See full grid
2. Touch top-left corner
3. Drag to top-right corner
4. Lift, touch again
5. Drag to bottom-right
6. Drag to bottom-left
7. Drag back to top-left
8. Tap "✓ Finish (5)"
   ↓
Done! 5-point corner path created
```

### Workflow 2: Row Selection (15 seconds)
```
1. Canvas opens → See full grid
2. Draw stroke through row 3 (left to right)
3. Draw stroke through row 7 (left to right)
4. Draw stroke through row 11 (left to right)
5. Tap "✓ Finish (24)"
   ↓
Done! 3 rows connected (8 waypoints each)
```

### Workflow 3: Custom Shape (20 seconds)
```
1. Canvas opens → See scattered waypoints
2. Draw figure-8 pattern through desired points
3. Check "Connection Sequence" box
4. Draw additional stroke to refine
5. Tap "✓ Finish (15)"
   ↓
Done! Custom figure-8 path created
```

---

## ⚡ Quick Reference

```
┌────────────────────────────────────────────┐
│ ACTION              │ GESTURE               │
├─────────────────────┼───────────────────────┤
│ Connect waypoints   │ Draw line through them│
│ See connections     │ Green lines + badges  │
│ Remove last stroke  │ Tap "Undo"           │
│ Start over          │ Tap "Clear"          │
│ Save and exit       │ Tap "Finish"         │
│ Cancel without save │ Tap "Cancel"         │
└────────────────────────────────────────────┘
```

---

**The drawing canvas provides a fast, intuitive way to create custom waypoint paths!** 🎨✨
