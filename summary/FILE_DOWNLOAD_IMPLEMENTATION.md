# File Download to Device Storage Implementation

## Problem Fixed
Previously, clicking "Save" in the export dialog would show the sharing menu (for apps like WhatsApp, Gmail, Drive). Now there are TWO separate options:
- **Save to File Manager** - Downloads directly to device storage
- **Share with Apps** - Opens sharing menu for cloud, email, apps

## Changes Made

### 1. **New Utility: `downloadHelper.ts`**
Created a new file `src/utils/downloadHelper.ts` that handles direct file downloads to device storage:
- `downloadFileToDevice()` - Saves files to Downloads (Android) or Documents (iOS)
- `getMimeType()` - Returns proper MIME types for file formats
- Uses `expo-media-library` for permission handling and file saving
- Shows confirmation alert with file details

**Android Behavior:**
- Files save to: `/storage/emulated/0/Downloads/`
- User can access files via file manager directly

**iOS Behavior:**
- Files save to app's Documents folder
- Accessible via Files app (iOS 11+)

### 2. **Updated Dependencies**
Added to `package.json`:
- `expo-intent-launcher` - Opens file manager/file locations

Existing (already had):
- `expo-media-library` - Saves files and manages permissions
- `expo-file-system` - Handles file reading/writing
- `expo-sharing` - Handles app-based sharing

### 3. **Modified `MissionReportExport.tsx`**
Updated the export component to properly separate Save and Share:

**Changed:**
- Removed dependency on `react-native-saf-x` (incompatible with Expo managed workflow)
- Added import for `downloadFileToDevice` from downloadHelper
- Split export logic into two paths:
  - `exportMethod === 'save'` → Calls `saveToDeviceStorage()` → Downloads to device
  - `exportMethod === 'share'` → Calls `Sharing.shareAsync()` → Opens share menu

**Updated UI Labels:**
- "Save to File Manager" - Clear that it saves directly to device storage
- "Share with Apps" - Clear that it opens the sharing menu
- Updated descriptions to explain each option

## How It Works Now

### When User Clicks "Save" (Save to File Manager):
1. File is generated (PDF or Excel)
2. `downloadFileToDevice()` is called
3. Request permission to access media library
4. File is written directly to Downloads/Documents folder
5. Success alert shows: "✅ File saved to Downloads folder!"
6. Modal closes, export is complete
7. User opens file manager and sees the file in Downloads

### When User Clicks "Share" (Share with Apps):
1. File is generated (PDF or Excel)
2. `Sharing.shareAsync()` is called
3. Native share menu opens showing available apps:
   - Email, WhatsApp, Gmail, Google Drive, OneDrive, Telegram, etc.
4. User picks an app to send/save the file
5. Modal closes after sharing

## Installation Requirements

### For Expo Go Testing:
No additional installation needed! The new libraries are already compatible with Expo Go.

### For Android Native Build (if needed):
```bash
npx eas build --platform android
```

### For iOS Native Build (if needed):
```bash
npx eas build --platform ios
```

## File Permissions

The implementation automatically requests permissions when needed:
- **Android:** `WRITE_EXTERNAL_STORAGE` (for saving to Downloads)
- **iOS:** `NSDocumentUsageDescription` (for Files app access)

## Testing Checklist

✅ Install dependencies: `expo install expo-intent-launcher`
✅ Rebuild app/restart Expo Go session
✅ Open export modal
✅ Select "Save to File Manager"
✅ Choose Excel or PDF
✅ Click "Save Excel/PDF" button
✅ File should appear in Downloads (Android) or Documents (iOS)
✅ Select "Share with Apps"
✅ Choose Excel or PDF
✅ Click "Share Excel/PDF" button
✅ Share menu should open with app list

## File Format Support

- **Excel**: `.xlsx` files (if device supports)
- **CSV**: `.csv` files (fallback for some devices)
- **PDF**: `.pdf` files

## What's Better Now

| Feature | Before | After |
|---------|--------|-------|
| Save to device | ❌ Only via share menu | ✅ Direct to Downloads folder |
| Share to apps | ✅ Works | ✅ Still works (separate option) |
| File manager access | ❌ Not clear where file goes | ✅ Clear Downloads/Documents folder |
| Expo compatibility | ⚠️ Error with react-native-saf-x | ✅ Fully compatible |
| User experience | Confusing dual options | Clear separate Save/Share |

## Notes

- Files are saved with timestamp: `mission_report_2025-12-06T06-27-20.pdf`
- Each export creates a new file (files are not overwritten)
- Files persist on device even after app closes
- User can manage files using device's file manager
