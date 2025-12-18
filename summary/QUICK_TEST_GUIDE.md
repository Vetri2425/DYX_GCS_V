# Quick Test Guide - File Upload Feature

## 🎯 Quick Start Testing

### 1. **Test CSV Upload (Most Common)**

Create a test file `waypoints.csv`:
```csv
latitude,longitude,altitude,block,row,pile
13.082700,80.270700,50.0,B1,R1,1
13.082750,80.270800,50.0,B1,R1,2
13.082800,80.270900,50.0,B1,R2,1
13.082850,80.271000,50.0,B1,R2,2
13.082900,80.271100,50.0,B2,R1,1
```

**Steps:**
1. Click "📤 Upload" button in Mission Ops Panel
2. Select `waypoints.csv` file
3. Wait for preview modal to appear
4. Verify:
   - ✓ 5 waypoints shown in table
   - ✓ No validation errors (clean upload)
   - ✓ Block/Row columns populated (B1/R1, B1/R1, etc.)
   - ✓ All distances calculated
5. Click "✓ Proceed" button
6. Verify waypoints appear in the main table

---

### 2. **Test CSV with Warnings (Duplicate Waypoints)**

Create `waypoints_dup.csv`:
```csv
latitude,longitude,altitude
13.082700,80.270700,50.0
13.082700,80.270700,50.0
13.082750,80.270800,50.0
```

**Expected:**
- Preview modal shows ⚠️ "Issues Found" section
- Warning: "Duplicate waypoint detected"
- Can still proceed with "Proceed Anyway"

---

### 3. **Test CSV with Negative Altitude**

Create `waypoints_neg_alt.csv`:
```csv
latitude,longitude,altitude
13.082700,80.270700,-50.0
13.082750,80.270800,100.0
```

**Expected:**
- Preview modal shows ⚠️ "1 Issue(s) Found"
- Warning: "Negative altitude detected"
- After proceeding, altitude auto-corrected to 50.0

---

### 4. **Test CSV with Missing Required Column**

Create `waypoints_bad.csv`:
```csv
latitude,altitude
13.082700,50.0
13.082750,50.0
```

**Expected:**
- Alert: "CSV must contain "latitude" and "longitude" columns"
- No preview modal shown
- Can try again with different file

---

### 5. **Test JSON Upload**

Create `waypoints.json`:
```json
[
  {
    "id": 1,
    "lat": 13.082700,
    "lon": 80.270700,
    "alt": 50.0,
    "block": "B1",
    "row": "R1",
    "pile": "1"
  },
  {
    "id": 2,
    "lat": 13.082750,
    "lon": 80.270800,
    "alt": 50.0,
    "block": "B1",
    "row": "R1",
    "pile": "2"
  }
]
```

**Steps:**
1. Click "📤 Upload"
2. Select `waypoints.json`
3. Verify:
   - ✓ 2 waypoints shown
   - ✓ Block/Row populated
   - ✓ No errors

---

### 6. **Test QGC Format (.waypoints)**

Create `mission.waypoints`:
```
QGC WPL 110
0	1	0	16	0	0	0	0	13.082700	80.270700	0	1
1	0	3	16	0	0	0	0	13.082750	80.270800	50.0	1
2	0	3	16	0	0	0	0	13.082800	80.270900	50.0	1
```

**Expected:**
- 3 waypoints parsed correctly
- All coordinates extracted properly

---

## 🔍 Debugging - Check Console Logs

When testing, watch for these logs:

```
✓ [PathPlan] handleRequestUpload called - opening file picker dialog
✓ [PathPlan] DocumentPicker response full: { type: 'success', ... }
✓ [PathPlan] Using new DocumentPicker format: { uri: '...', name: '...' }
✓ [PathPlan] Parsed waypoints: 5 [...]
✓ [PathPlan] Validation result: { total: 0, critical: 0, warnings: 0 }
✓ [PathPlan] setShowUploadPreview(true) called - modal should now be visible
```

If you see:
```
✓ [PathPlan] DocumentPicker cancelled or failed - type: cancel
```
→ User clicked cancel, modal won't appear (this is normal)

---

## 📋 Preview Modal Checklist

When modal appears, verify:

```
✓ Title: "Import Preview"
✓ Filename and waypoint count displayed
✓ [If errors] Red ⚠️ section with issues listed
✓ [If no errors] Just shows "Waypoint Details:"
✓ Table headers: #, Latitude, Longitude, Alt(m), Dist(m), Block/Row
✓ Each waypoint row visible
✓ Three buttons at bottom:
  - "✓ Proceed" (green)
  - "📤 Upload New" (blue)
  - "Cancel" (gray)
```

---

## ✅ All Tests Passed When:

1. ✓ CSV files with required columns parse correctly
2. ✓ CSV files with optional block/row/pile extract those columns
3. ✓ JSON files with any coordinate field names (lat/latitude, lon/lng/longitude) work
4. ✓ Validation warnings appear for duplicates, negative altitudes, (0,0) coordinates
5. ✓ Critical errors prevent upload (missing columns, invalid coordinates)
6. ✓ Preview modal shows all waypoints with correct formatting
7. ✓ Distances calculated correctly (non-zero between waypoints)
8. ✓ Proceed button applies waypoints to map and sidebar
9. ✓ Upload New button allows selecting different file
10. ✓ Cancel button closes modal without changes

---

## 🐛 Troubleshooting

**Problem:** Preview modal doesn't appear after file selection

**Debug:**
1. Check console for: `[PathPlan] DocumentPicker response full:`
2. Verify response has correct structure
3. Confirm parsing logs appear: `[PathPlan] Parsed waypoints:`
4. Look for error: `[PathPlan] Import error:`

**Solution:**
- Try different file type
- Ensure file has valid content
- Check file extension is lowercase

---

**Problem:** Waypoints appear but no validation errors

**Debug:**
- This is GOOD! No errors means clean data

---

**Problem:** Modal appears but empty

**Debug:**
1. Check: `uploadPreviewWaypoints` state populated
2. Verify: waypoint count shows `n waypoints` in title
3. If table empty but count > 0:
   - Possible rendering issue
   - Try refreshing app

---

## 📊 Sample Test Results

### ✓ Test 1: Clean CSV Upload
```
Input: 5 waypoints with lat/lon/alt/block/row/pile
Output: 
  - Modal appears with 5 rows
  - 0 validation issues
  - Distances: 0m, 12.4m, 12.3m, 12.4m, 12.3m (approx)
  - Proceed successful
```

### ⚠ Test 2: CSV with Duplicate
```
Input: 3 waypoints, first two identical
Output:
  - Modal appears
  - ⚠️ 1 Warning shown: "Duplicate waypoint detected"
  - Still allows proceed
  - Import successful with all 3 (including duplicate)
```

### ✗ Test 3: Missing Longitude Column
```
Input: CSV with only latitude and altitude
Output:
  - Alert: "CSV must contain "latitude" and "longitude" columns"
  - No modal shown
  - Can select different file
```

---

## 🎓 Understanding the Flow

1. **Click Upload** → DocumentPicker dialog opens
2. **Select File** → Uploaded to temp cache
3. **Parse Content** → Extract waypoints based on file type
4. **Calculate Distances** → Between consecutive waypoints
5. **Validate Data** → Check for errors/warnings
6. **Show Preview** → User reviews data
7. **Confirm/Cancel** → Apply or reject
8. **Update Mission** → Waypoints appear on map

---

## 📞 Getting Help

If upload isn't working:
1. Check all console logs with `[PathPlan]` prefix
2. Verify file format matches CSV/JSON/QGC specifications
3. Ensure required columns exist
4. Try with simpler test file first
5. Check file encoding is UTF-8

