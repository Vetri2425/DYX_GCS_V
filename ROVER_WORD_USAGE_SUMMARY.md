# "ROVER" WORD USAGE IN APPLICATION UI

## Summary
The word **"Rover"** appears **6 times** as displayed text in the UI across the application.

---

## Detailed Breakdown of "Rover" Displays in UI

### 1. **Dashboard Summary Cards** (1 occurrence)
- **File:** [src/components/DashboardSummaryCards.tsx](src/components/DashboardSummaryCards.tsx#L12)
- **Location:** Line 12
- **Display Text:** `'Rover Utilization %'`
- **Context:** Summary card title showing rover utilization percentage
- **Type:** Card title in dashboard grid

---

### 2. **Map Component Example** (1 occurrence)
- **File:** [src/components/examples/MapComponentExample.tsx](src/components/examples/MapComponentExample.tsx#L98)
- **Location:** Line 98
- **Display Text:** `title="Rover"`
- **Context:** Marker title on the map showing rover position
- **Type:** Map marker popup/tooltip

---

### 3. **Mission Report Map** (1 occurrence)
- **File:** [src/components/missionreport/MissionMap.tsx](src/components/missionreport/MissionMap.tsx#L212)
- **Location:** Line 212
- **Display Text:** `"Rover Position"`
- **Context:** Position overlay title showing current rover location
- **Type:** Web map overlay title

---

### 4. **Path Plan Map** (2 occurrences)

#### 4a. Position Overlay Title
- **File:** [src/components/pathplan/PathPlanMap.tsx](src/components/pathplan/PathPlanMap.tsx#L189)
- **Location:** Line 189
- **Display Text:** `"Rover Position"`
- **Context:** Position overlay title on path planning map
- **Type:** Web map overlay title

#### 4b. Marker Popup
- **File:** [src/components/pathplan/PathPlanMap.tsx](src/components/pathplan/PathPlanMap.tsx#L614)
- **Location:** Line 614
- **Display Text:** `"<strong>Rover</strong>"`
- **Context:** Popup when clicking rover marker showing heading, lat/lon
- **Context HTML:** `<strong>Rover</strong><br>Heading: [°]<br>Lat: [coords]<br>Lon: [coords]`
- **Type:** Map marker popup (clickable)

---

### 5. **App Header Logo** (Additional Reference - Not UI Text)
- **File:** [src/components/shared/AppHeader.tsx](src/components/shared/AppHeader.tsx#L40)
- **Location:** Line 40
- **Display Text:** `rover-icon.png` (filename reference)
- **Note:** This is an image file name, not displayed text. The app header shows "DYX Autonomous" title instead.

---

## Summary Table

| Location | File | Line | Display Text | Type |
|----------|------|------|--------------|------|
| Dashboard Cards | DashboardSummaryCards.tsx | 12 | `Rover Utilization %` | Card Title |
| Map Example | MapComponentExample.tsx | 98 | `Rover` | Marker Title |
| Mission Map | MissionMap.tsx | 212 | `Rover Position` | Overlay Title |
| Path Plan Map (1) | PathPlanMap.tsx | 189 | `Rover Position` | Overlay Title |
| Path Plan Map (2) | PathPlanMap.tsx | 614 | `Rover` (in popup) | Marker Popup |

---

## UI Context Usage

### Display Format Analysis:
- **"Rover Utilization %"** - Used as a metric card in dashboard
- **"Rover Position"** - Used as header for coordinate display (appears 2 times)
- **"Rover"** - Used as marker title/popup label (appears 2 times)

### Screens Where "Rover" Appears:
1. **Dashboard Screen** - "Rover Utilization %" card (1 display)
2. **Mission Report Screen** - "Rover Position" overlay (1 display)
3. **Path Plan Screen** - "Rover Position" overlay + marker popup (2 displays)
4. **Map Examples** - Test/example component (1 display)

---

## Code Usage Notes

### Context Hook References (Not UI Text):
The `useRover()` context hook is imported and used throughout the app for accessing rover data:
- [src/screens/DashboardScreen.tsx](src/screens/DashboardScreen.tsx#L4)
- [src/screens/PathPlanScreen.tsx](src/screens/PathPlanScreen.tsx#L5)
- [src/screens/MissionReportScreen.tsx](src/screens/MissionReportScreen.tsx#L12)
- [src/components/TelemetryDisplay.tsx](src/components/TelemetryDisplay.tsx#L17)
- [src/components/common/VoiceSettingsModal.tsx](src/components/common/VoiceSettingsModal.tsx#L5)

### Context Provider:
- [App.tsx](App.tsx#L5) - `<RoverProvider>` wraps entire application

---

## Conclusion

**Total "Rover" words displayed as UI text: 6 occurrences**

These are spread across:
- 1 Dashboard metric card
- 2 Map position overlay titles
- 2 Map marker references (title + popup)
- 1 Test/example component
