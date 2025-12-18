# Mission Report Export - Quick Reference

## 🎯 Overview
The mission report export feature allows users to download comprehensive mission data in two formats: CSV (Excel-compatible) and HTML (PDF-printable).

## 📊 Export Formats

### 1. Excel Format (.csv)
**Best For:** Data analysis, spreadsheets, record keeping

**Contains:**
- Mission summary with statistics
- Complete waypoints table
- Error location details
- Mission metadata (date, mode, duration)

**Opens In:** Microsoft Excel, Google Sheets, Numbers, any spreadsheet app

**Usage:**
1. Click "Export Report" button
2. Select "Excel Format (.csv)"
3. Click "Export CSV"
4. Open in your preferred spreadsheet application

### 2. PDF Format (.html)
**Best For:** Professional reports, printing, sharing

**Contains:**
- Styled mission report with branding
- Summary cards with statistics
- Color-coded waypoint status
- Professional layout

**Opens In:** Any web browser (Chrome, Safari, Firefox, Edge)

**Usage:**
1. Click "Export Report" button
2. Select "PDF Format (.html)"
3. Click "Export HTML"
4. Open file in browser
5. Click "Print / Save as PDF" button
6. Use browser's print dialog to save as PDF

## 📋 Report Contents

### Mission Summary
- **Total Waypoints:** Total number of waypoints in mission
- **Completed:** Successfully completed waypoints
- **Pending:** Waypoints not yet reached
- **Errors:** Skipped or failed waypoints
- **Success Rate:** Percentage of completed waypoints
- **Mission Duration:** Time from first to last waypoint

### Waypoint Data
For each waypoint:
- S/N (Serial Number)
- Row, Block, Pile identifiers
- GPS coordinates (Latitude, Longitude)
- Altitude
- Status (Completed, Pending, Reached, Skipped)
- Timestamp
- Remarks

### Error Locations
Detailed list of any skipped waypoints with their:
- Row, Block, Pile location
- Waypoint number
- Full coordinates

## 🎨 Status Color Coding

| Status | Color | Meaning |
|--------|-------|---------|
| Completed | 🟢 Green | Waypoint successfully completed |
| Marked | 🔵 Blue | Waypoint marked as done |
| Reached | 🟡 Amber | Waypoint reached, marking in progress |
| Skipped | 🔴 Red | Waypoint skipped or error occurred |
| Pending | ⚪ Gray | Waypoint not yet reached |

## 💡 Tips & Best Practices

### When to Export
- ✅ After mission completion for final report
- ✅ During mission for progress tracking
- ✅ Before mission as planning reference
- ✅ After errors to document issues

### Which Format to Choose
**CSV (Excel):**
- Need to analyze data
- Want to sort/filter waypoints
- Creating charts or graphs
- Sharing with analysts

**HTML (PDF):**
- Need professional document
- Printing physical copies
- Sharing with stakeholders
- Official record keeping

### File Naming
Files are automatically named with timestamp:
- `mission_report_2025-12-02T10-30-15.csv`
- `mission_report_2025-12-02T10-30-15.html`

### Sharing Options
After export, native share dialog offers:
- Save to Files/Downloads
- Share via email
- Send to cloud storage (Drive, Dropbox, etc.)
- Share to messaging apps

## 🔧 Technical Details

### Data Format
All exports use consistent data structure:
- Coordinates: 7 decimal places (Lat/Lng)
- Altitude: 2 decimal places
- Timestamps: Local time format
- Status: Standardized values

### File Storage
- Temporary files stored in app cache
- Automatically cleaned up by system
- No permanent storage used
- Privacy-friendly (user controls sharing)

### Compatibility
**CSV Format:**
- ✅ Microsoft Excel (all versions)
- ✅ Google Sheets
- ✅ Apple Numbers
- ✅ LibreOffice Calc
- ✅ Any text editor

**HTML Format:**
- ✅ Chrome, Safari, Firefox, Edge
- ✅ Mobile browsers
- ✅ Desktop browsers
- ✅ Print to PDF from any browser

## 📱 Platform Support

### iOS
- Share to Files app
- AirDrop to other devices
- Open in Pages, Numbers
- Email as attachment

### Android
- Share to any app
- Save to Downloads
- Open in Google Sheets
- Email as attachment

## ⚠️ Troubleshooting

### Export fails
- Check storage permissions
- Ensure waypoints are loaded
- Try again with fewer waypoints
- Check available storage space

### File won't open
- Verify correct app selected
- Try different app (e.g., different spreadsheet app)
- For HTML, ensure browser is default for HTML files

### Missing data
- Ensure mission has been started
- Check that waypoints have status updates
- Verify timestamps are being recorded

### Formatting issues in CSV
- Open with recommended app (Excel, Sheets)
- Check encoding (should be UTF-8)
- Try importing instead of direct open

## 📞 Support

For issues or questions:
1. Check this guide
2. Review mission data completeness
3. Verify waypoints are properly loaded
4. Contact support with error details

## 🔄 Updates

**Current Version:** 1.0.0
**Last Updated:** December 2, 2025
**Web App Parity:** ✅ Matched

### Recent Changes
- ✅ Added comprehensive mission summary
- ✅ Implemented error location tracking
- ✅ Added success rate calculation
- ✅ Professional HTML formatting
- ✅ Color-coded status indicators
- ✅ Improved CSV structure

---

**Note:** This export feature matches the web application functionality, ensuring consistency across platforms.
