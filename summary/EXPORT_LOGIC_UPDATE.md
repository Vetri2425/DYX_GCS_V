# Mission Export Logic Update

## Overview
Updated the mobile app's mission report export logic to match the comprehensive web application implementation.

## Web App Export Logic (Reference)

### Location
`temp-react-source/src/components/report/MissionReportExport.tsx`

### Features Found in Web App
1. **Excel Export (.xlsx)** using ExcelJS library:
   - Professional header with navy blue background
   - Mission summary section with statistics
   - Error locations listing
   - Waypoint data table with color-coded status
   - Professional footer with mission stats
   - Detailed formatting (borders, colors, fonts)

2. **PDF Export** using jsPDF and autoTable:
   - Navy blue header and footer
   - Summary cards in 2x3 grid layout
   - Clean professional table
   - Status highlighting
   - Page numbering

### Data Structure
```typescript
{
  'S/N': number,
  'ROW': string,
  'BLOCK': string,
  'PILE': string | number,
  'Latitude': number (7 decimals),
  'Longitude': number (7 decimals),
  'Altitude': number (2 decimals),
  'Status': 'Completed' | 'Marked' | 'Reached' | 'Skipped' | 'Pending',
  'Timestamp': string,
  'Remark': string
}
```

### Mission Statistics
- Total Waypoints
- Completed Points
- Pending Points
- Error Points
- Success Rate (%)
- Mission Duration (start - end time)
- Error Locations (detailed list)

## Mobile App Current Implementation

### Location (Before)
`src/components/missionreport/MissionReportExport.tsx`

### Previous Implementation
- Basic CSV export only
- Minimal header with comments
- Simple comma-separated values
- No formatting or styling
- No error location tracking
- Limited statistics

## Updated Mobile App Implementation

### New Files Created

#### 1. Export Helpers (`src/utils/exportHelpers.ts`)
Reusable utility functions for generating formatted exports:

**generateCSV()**
- Matches web app data structure
- Includes mission summary section
- Lists error locations
- Professional formatting with section headers
- Footer with aggregate statistics

**generateHTML()**
- Generates printable HTML document
- Can be opened in browser and printed to PDF
- Matches web app PDF styling:
  - Navy blue header/footer
  - Summary cards in grid layout
  - Professional table styling
  - Color-coded status indicators
  - Print button for easy PDF conversion

### Updated Component

#### `MissionReportExport.tsx`
**Changes Made:**
1. Import new export helper functions
2. Calculate mission statistics matching web app:
   - Total points, completed, pending, errors
   - Success rate calculation
   - Mission duration from timestamps
   - Error locations with waypoint details

3. Format Selection:
   - **Excel (.csv)**: CSV format compatible with Excel/Sheets
   - **PDF (.html)**: HTML format that can be printed to PDF

4. Export Process:
   - Generate formatted content using helpers
   - Save to device cache directory
   - Share via native sharing dialog
   - Success/error alerts

5. Data Preparation:
   - Match web app data structure exactly
   - Track error locations per waypoint
   - Format coordinates and altitude consistently
   - Handle status mapping (completed, marked, reached, skipped, pending)

### Key Features Implemented

#### Mission Summary Section
- Total Waypoints
- Completed Count
- Pending Count
- Error Count
- Success Rate (%)
- Mission Duration (start - end timestamps)

#### Error Tracking
```typescript
errorLocations: [
  "Row R1, Block B1, Pile 3 (WP #5)",
  "Row R2, Block B2, Pile 7 (WP #12)"
]
```

#### Status Mapping
- `completed` → "Completed" (Green)
- `marked` → "Marked" (Blue)
- `reached` → "Reached" (Amber)
- `skipped` → "Skipped" (Red)
- `pending` → "Pending" (Gray)

#### Export Formats

**CSV Export:**
```csv
WAY TO MARK - MISSION REPORT
Generated: Dec 2, 2025, 10:30 AM | Mode: AUTO

=== MISSION SUMMARY ===
Total Waypoints,50
Completed,45
Pending,3
Error Count,2
Success Rate,90.0%
Mission Timing,10:15 AM - 11:45 AM

Error Locations:
"Row R1, Block B1, Pile 3 (WP #5)"
"Row R2, Block B2, Pile 7 (WP #12)"

=== MISSION WAYPOINTS LOG ===
S/N,ROW,BLOCK,PILE,Latitude,Longitude,Altitude,Status,Timestamp,Remark
1,R1,B1,1,2.9876543,101.7654321,50.00,Completed,10:15:30,—
...
```

**HTML Export:**
- Professional styled HTML document
- Navy blue header matching brand
- Summary cards with color-coded values
- Full waypoint table with alternating rows
- Status color highlighting
- Print button for PDF conversion
- Mobile and desktop responsive
- Print-optimized CSS

### Mobile-Specific Considerations

1. **No Native PDF Generation**: React Native doesn't support jsPDF/ExcelJS
   - Solution: HTML export that can be printed to PDF
   - Users can open in browser and use "Print to PDF"

2. **No Native Excel Generation**: ExcelJS requires Node.js environment
   - Solution: CSV format (Excel-compatible)
   - Opens in Excel, Google Sheets, Numbers

3. **File Sharing**: Uses Expo's FileSystem and Sharing APIs
   - Save to cache directory
   - Native share dialog
   - Works on iOS and Android

## Comparison Summary

| Feature | Web App | Mobile (Before) | Mobile (Updated) |
|---------|---------|-----------------|------------------|
| Excel Export | ✅ (.xlsx) | ❌ | ✅ (.csv) |
| PDF Export | ✅ (jsPDF) | ❌ | ✅ (.html) |
| Mission Summary | ✅ | ⚠️ Basic | ✅ Full |
| Error Locations | ✅ | ❌ | ✅ |
| Success Rate | ✅ | ❌ | ✅ |
| Mission Duration | ✅ | ❌ | ✅ |
| Status Color-Coding | ✅ | ❌ | ✅ |
| Professional Formatting | ✅ | ❌ | ✅ |
| Header/Footer Styling | ✅ | ❌ | ✅ |
| Export Preview | ✅ | ⚠️ Limited | ✅ Full |

## Testing Instructions

1. **Load Mission Data**
   - Upload waypoints via PathPlan screen
   - Navigate to Mission Report screen
   - Start mission and mark some waypoints

2. **Test CSV Export**
   - Click "Export Report" button
   - Select "Excel Format (.csv)"
   - Click "Export CSV"
   - Open file in Excel/Sheets
   - Verify: summary section, waypoints table, formatting

3. **Test HTML Export**
   - Click "Export Report" button
   - Select "PDF Format (.html)"
   - Click "Export HTML"
   - Open file in browser
   - Click "Print / Save as PDF"
   - Verify: styling, colors, layout

4. **Verify Statistics**
   - Check total waypoints count
   - Verify completed/pending/error counts
   - Confirm success rate calculation
   - Check mission duration (if timestamps available)

5. **Test Error Tracking**
   - Skip some waypoints during mission
   - Export report
   - Verify error locations are listed
   - Check waypoint numbers and locations

## Files Modified

### New Files
- `src/utils/exportHelpers.ts` - Export generation logic

### Updated Files
- `src/components/missionreport/MissionReportExport.tsx` - Main export component

## Dependencies
No new dependencies required. Uses existing:
- `expo-file-system` - File operations
- `expo-sharing` - Native sharing
- React Native core components

## Benefits

1. **Consistency**: Mobile app now matches web app export format
2. **Professional**: High-quality formatted reports
3. **Comprehensive**: Full mission statistics and error tracking
4. **Cross-Platform**: Works on iOS and Android
5. **User-Friendly**: Native sharing, works with all apps
6. **Maintainable**: Shared utility functions, clean separation

## Future Enhancements

1. **Native PDF**: Consider react-native-pdf or similar for native PDF generation
2. **Native Excel**: Explore mobile-compatible Excel generation libraries
3. **Cloud Sync**: Auto-upload reports to cloud storage
4. **Email Integration**: Direct email export option
5. **Custom Templates**: Allow users to customize report format
6. **Batch Export**: Export multiple missions at once

## Notes

- HTML export can be printed to PDF on any device with a browser
- CSV format is universally compatible with spreadsheet applications
- Export logic matches web app data structure exactly
- All calculations (success rate, duration) match web implementation
- Status color coding preserved in HTML export
- Error location tracking implemented identically to web app
