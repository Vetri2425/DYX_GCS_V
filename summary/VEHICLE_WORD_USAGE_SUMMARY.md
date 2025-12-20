# "VEHICLE" WORD USAGE IN APPLICATION UI

## Summary
The word **"Vehicle"** appears **4 times** as displayed text in the UI across the application.

---

## Detailed Breakdown of "Vehicle" Displays in UI

### 1. **Dashboard Screen - Vehicle Status Title** (1 occurrence)
- **File:** [src/screens/DashboardScreen.tsx](src/screens/DashboardScreen.tsx#L58)
- **Location:** Line 58
- **Display Text:** `🤖 VEHICLE STATUS`
- **Context:** Card title showing vehicle status information
- **Type:** Dashboard card heading

---

### 2. **Telemetry Display Component - Section Title** (1 occurrence)
- **File:** [src/components/TelemetryDisplay.tsx](src/components/TelemetryDisplay.tsx#L80)
- **Location:** Line 80
- **Display Text:** `VEHICLE STATE`
- **Context:** Section title for telemetry display
- **Type:** Section header

---

### 3. **Mission Report - Vehicle Status Card Title** (1 occurrence)
- **File:** [src/components/missionreport/VehicleStatusCard.tsx](src/components/missionreport/VehicleStatusCard.tsx#L384)
- **Location:** Line 384
- **Display Text:** `Vehicle Status`
- **Context:** Card title in mission control panel
- **Type:** Card heading

---

## Related Code References (Not UI Text)

### Component Names & Interfaces:
- `VehicleStatusCard` - Component file name
- `VehicleStatus` - TypeScript interface
- `VEHICLE_CARD_LAYOUT` - Constant for card styling

### Methods:
- `armVehicle()` - Service method for arming vehicle
- `disarmVehicle()` - Service method for disarming vehicle

### Variables:
- `vehicleStatus` - State variable in multiple screens

---

## Summary Table

| Location | File | Line | Display Text | Type |
|----------|------|------|--------------|------|
| Dashboard | DashboardScreen.tsx | 58 | `🤖 VEHICLE STATUS` | Card Heading |
| Telemetry | TelemetryDisplay.tsx | 80 | `VEHICLE STATE` | Section Header |
| Mission Control | VehicleStatusCard.tsx | 384 | `Vehicle Status` | Card Heading |

---

## UI Context Usage

### Display Format Analysis:
- **"🤖 VEHICLE STATUS"** - Used as dashboard card title with robot emoji
- **"VEHICLE STATE"** - Used as telemetry section header
- **"Vehicle Status"** - Used as mission control card title

### Screens Where "Vehicle" Appears:
1. **Dashboard Screen** - "🤖 VEHICLE STATUS" card (1 display)
2. **Telemetry Display** - "VEHICLE STATE" section (1 display)
3. **Mission Report Screen** - "Vehicle Status" card (1 display)

---

## Conclusion

**Total "Vehicle" words displayed as UI text: 3 occurrences**

These are spread across:
- 1 Dashboard card title
- 1 Telemetry section header
- 1 Mission control card title
