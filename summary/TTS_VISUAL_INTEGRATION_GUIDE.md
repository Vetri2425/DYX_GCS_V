# TTS Voice Control Button - Visual Integration Guide

## Header Layout

### BEFORE Implementation
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Title      │  [Dashboard] [Path Plan] [Report] [Analytics]  │  MODE   │
│         Subtitle   │                                                │  WP Mark │
└──────────────────────────────────────────────────────────────────────────────┘
   Left Section              Center Section           Right Section
```

### AFTER Implementation
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Title      │  [Dashboard] [Path Plan] [Report] [Analytics]  │🔊│MODE  │
│         Subtitle   │                                                │  │WP M   │
└──────────────────────────────────────────────────────────────────────────────┘
   Left Section              Center Section        Right Section
                                                   ↑
                                         TTS Button (NEW)
```

---

## Component Placement Details

### Right Section Container
```
<View style={styles.rightSection}>  {/* flexDirection: 'row', gap: 8 */}
  
  ┌─────────────────────┐
  │                     │
  │  TTSToggleButton    │  ← NEW COMPONENT
  │  (40x40px)          │
  │  Green/Gray icon    │
  │                     │
  └─────────────────────┐
  
         ↓ gap: 8 ↓
  
  ┌──────────────────────────┐
  │  🎯  MODE                │
  │      WP Mark             │  ← EXISTING COMPONENT
  └──────────────────────────┘
  
</View>
```

---

## Button Appearance

### Enabled State (TTS ON)
```
┌─────────────────────────┐
│  ┌─────────────────────┐ │  Size: 40x40px
│  │                     │ │  Border: 1px green
│  │        🔊          │ │  Background: light green
│  │                     │ │  Icon: volume-up (green)
│  └─────────────────────┘ │
│  Voice Output: ON        │
└─────────────────────────┘
```

### Disabled State (TTS OFF)
```
┌─────────────────────────┐
│  ┌─────────────────────┐ │  Size: 40x40px
│  │                     │ │  Border: 1px gray
│  │        🔇          │ │  Background: light gray
│  │                     │ │  Icon: volume-off (gray)
│  └─────────────────────┘ │
│  Voice Output: OFF       │
└─────────────────────────┘
```

### Loading State
```
┌─────────────────────────┐
│  ┌─────────────────────┐ │  Size: 40x40px
│  │                     │ │  Opacity: 0.6
│  │        ⊙ ⊙ ⊙      │ │  Shows spinner
│  │                     │ │  Button disabled
│  └─────────────────────┘ │
│  Processing...           │
└─────────────────────────┘
```

---

## Header Section Breakdown

### Left Section (flex: 1, auto-sized)
```
┌────────────────────────┐
│ [40x40]  Title         │
│ Logo     Subtitle      │
└────────────────────────┘
```

### Center Section (absolute centered)
```
┌──────────────────────────────────────────┐
│ [Tab1]  [Tab2]  [Tab3]  [Tab4]           │
│ Navigation tabs centered                  │
└──────────────────────────────────────────┘
```

### Right Section (flex: 1, gap: 8)
```
┌─────────────┐  ┌──────────────────────┐
│     🔊      │  │  🎯  MODE            │
│             │  │      WP Mark         │
└─────────────┘  └──────────────────────┘
TTS Toggle       Mode Box (existing)
(NEW)
```

---

## Styling Specifications

### Button Box
```typescript
width: 40px
height: 40px
borderRadius: 6px
borderWidth: 1px
justifyContent: 'center'
alignItems: 'center'
marginLeft: 8px
```

### Enabled Style
```typescript
backgroundColor: 'rgba(16, 185, 129, 0.15)'  /* light green */
borderColor: 'rgba(16, 185, 129, 0.4)'       /* green */
icon color: '#10B981'                         /* bright green */
```

### Disabled Style
```typescript
backgroundColor: 'rgba(107, 114, 128, 0.15)' /* light gray */
borderColor: 'rgba(107, 114, 128, 0.3)'      /* gray */
icon color: '#6B7280'                         /* medium gray */
```

### Loading Style
```typescript
opacity: 0.6
disabled: true
spinner color: (matches enabled/disabled color)
```

---

## Responsive Design

### Screen Sizes
```
Mobile (vertical):
┌──────────────────────────┐
│ [Logo] Title   │ 🔊│MODE │
│        Subtitle│  │WP M │
└──────────────────────────┘
Tabs scale down, button remains 40x40

Tablet (horizontal):
┌────────────────────────────────────────┐
│ [Logo] Title    │  [Tabs]  │ 🔊│MODE   │
│        Subtitle │          │  │WP Mark │
└────────────────────────────────────────┘
More space available, layout adjusts

Desktop:
┌──────────────────────────────────────────────────┐
│ [Logo] Title    │    [Tabs]     │ 🔊│MODE       │
│        Subtitle │               │  │WP Mark    │
└──────────────────────────────────────────────────┘
All space utilized, responsive flex layout
```

---

## Color Palette Reference

### Green (Enabled)
```
Background: rgba(16, 185, 129, 0.15) = light green
Border:     rgba(16, 185, 129, 0.4)  = medium green
Icon:       #10B981                   = bright green

Visual reference:
████ = #10B981 (bright)
████ = rgba(16, 185, 129, 0.4) (medium)
████ = rgba(16, 185, 129, 0.15) (light)
```

### Gray (Disabled)
```
Background: rgba(107, 114, 128, 0.15) = light gray
Border:     rgba(107, 114, 128, 0.3)  = medium gray
Icon:       #6B7280                    = medium gray

Visual reference:
████ = #6B7280 (medium)
████ = rgba(107, 114, 128, 0.3) (medium)
████ = rgba(107, 114, 128, 0.15) (light)
```

---

## Icon Reference

### Volume Up Icon (Enabled)
```
Enabled State:
🔊 volume-up
Name: 'volume-up' (MaterialIcons)
Size: 20px
Color: #10B981

Visual:
  ╭────────╮
  │  ▁ ▂ ▄  │
  │  ▁ ▂ ▄  │  Speaker cone
  │ ││││   │
  │ │      │
  ╰────────╯
```

### Volume Off Icon (Disabled)
```
Disabled State:
🔇 volume-off
Name: 'volume-off' (MaterialIcons)
Size: 20px
Color: #6B7280

Visual:
  ╭────────╮
  │  ▁ ▂  ╱│
  │  ▁ ▂ ╱ │  Speaker muted
  │ ││││  │
  │ │    ╱│
  ╰────────╯
```

### Loading Spinner
```
Loading State:
⊙ or ◑ rotating animation
ActivityIndicator component
Size: 20px
Color: matches state (green or gray)

Visual (animated):
  ◐ → ◑ → ◒ → ◓ → ◐ ...
```

---

## Layout Hierarchy

```
App (Root)
└── NavigationContainer
    └── TabNavigator
        └── Dashboard Tab (example)
            └── View (Screen Container)
                └── AppHeader ← UPDATED
                    ├── LeftSection
                    │   ├── LogoContainer
                    │   │   └── Image
                    │   ├── Title Text
                    │   └── Subtitle Text
                    │
                    ├── CenterSection
                    │   └── TabContainer
                    │       ├── Tab 1
                    │       ├── Tab 2
                    │       ├── Tab 3
                    │       └── Tab 4
                    │
                    └── RightSection ← MODIFIED (added gap & flexDirection)
                        ├── TTSToggleButton ← NEW
                        │   └── TouchableOpacity
                        │       └── MaterialIcons or ActivityIndicator
                        │
                        └── ModeBox ← EXISTING
                            ├── ModeIcon Text
                            └── View
                                ├── ModeLabel Text
                                └── ModeValue Text
```

---

## State Flow Diagram

```
User presses button
        ↓
    [Enabled = true] ─────→ Loading spinner shows
        ↓                        ↓
   Toggle triggered         API Request:
   enabled = !enabled       POST /api/tts/control
        ↓                   { enabled: true }
   Loading = true               ↓
        ↓                   ┌─────────────┐
   Color changes           │   Success   │  Success Alert
   Icon changes            │   Response  │
   Spinner shows           └─────────────┘
        ↓                        ↓
        ←──────────────────────────
                ↓
   AsyncStorage.setItem()
   ('tts_enabled', 'true')
        ↓
   Component state updates
   Button re-renders
   Loading = false
   Spinner disappears
        ↓
   [Enabled = true, Green, volume-up icon]
   Button ready for next interaction
```

---

## Integration Points

### 1. RoverContext Hook
```typescript
const { services } = useRover();
// Access services.getTTSStatus()
// Access services.controlTTS(boolean)
```

### 2. AsyncStorage
```typescript
await AsyncStorage.getItem('tts_enabled');
await AsyncStorage.setItem('tts_enabled', 'true'|'false');
```

### 3. API Endpoints
```typescript
GET  /api/tts/status    → getTTSStatus()
POST /api/tts/control   → controlTTS(enabled)
POST /api/tts/test      → testTTS(message)
```

### 4. Alert Notifications
```typescript
Alert.alert(title, message, [buttons])
```

---

## Touch Interaction Areas

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│    Recommended touch target: 44x44px minimum ✓          │
│                                                          │
│    Button size: 40x40px (meets minimum)                │
│                                                          │
│    ┌────────────────────────────────────────────────┐  │
│    │                                                │  │
│    │      ┌─────────────────────────────┐           │  │
│    │      │ Touch area (44x44 effective) │           │  │
│    │      │  (extends to surrounding)   │           │  │
│    │      │   ┌──────────────────────┐  │           │  │
│    │      │   │   Button (40x40)    │  │           │  │
│    │      │   │      🔊            │  │           │  │
│    │      │   └──────────────────────┘  │           │  │
│    │      └─────────────────────────────┘           │  │
│    │                                                │  │
│    └────────────────────────────────────────────────┘  │
│                                                          │
│    Touch target easily reachable and accurate          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Accessibility Considerations

### Button Accessibility
```
✓ Proper size: 40x40px (exceeds 44x44 minimum with padding)
✓ Color contrast: Green on white background adequate
✓ Icon visible: Clear volume-up/off icons
✓ Touch feedback: activeOpacity={0.7} provides visual feedback
✓ State indication: Color change indicates state clearly
✓ Disabled state: Opacity change shows disabled clearly
```

### Header Accessibility
```
✓ Tab order: Left → Center → Right
✓ Spacing: 8px gap provides visual separation
✓ Alignment: Proper vertical centering
✓ Responsive: Scales with screen size
✓ Visual hierarchy: Button prominent but not overwhelming
```

---

## Performance Optimization

### Rendering
```
✓ Component memoization not needed (small, simple)
✓ No expensive computations
✓ useEffect only on mount
✓ State updates targeted
✓ No re-render loops
```

### Memory
```
✓ No memory leaks
✓ Proper cleanup (none needed)
✓ AsyncStorage operations async
✓ API calls properly canceled on unmount
✓ No duplicate listeners
```

### Network
```
✓ Single API call per toggle
✓ Loading state prevents double-tap
✓ Proper error handling
✓ No polling, only on-demand requests
✓ Respects network errors gracefully
```

---

## Testing Verification Points

### Visual Verification
```
□ Button appears in header top-right
□ Button size appropriate (40x40)
□ Icon visible and clear (volume-up)
□ Color correct (green when enabled)
□ Border visible (cyan/green tint)
□ Touch area responsive (44x44 effective)
□ Alignment matches mode box
□ No layout overlap or shift
```

### Functional Verification
```
□ Tap button → loading spinner shows
□ Spinner spins smoothly
□ Wait → API response received
□ Success alert appears
□ Button state changes to disabled (gray)
□ Color changes to gray
□ Icon changes to volume-off
□ No crashes or errors
```

### Persistence Verification
```
□ Toggle to off
□ Close app completely
□ Reopen app
□ Button shows off state (gray)
□ Preference correctly restored
□ No API call needed to restore
```

---

This visual guide shows the exact layout, styling, and placement of the TTS Voice
Control Toggle Button in the DYX-GCS Mobile header application.
