import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { colors } from '../../theme/colors';
import { Waypoint } from './types';
import {
  generateExcel,
  generatePDFHTML,
  ExportData,
  MissionStats,
} from '../../utils/exportHelpers';
import { downloadFileToDevice, getMimeType } from '../../utils/downloadHelper';

export type MissionReportExportProps = {
  waypoints: Waypoint[];
  statusMap?: Record<
    number,
    {
      reached?: boolean;
      marked?: boolean;
      status?:
        | 'completed'
        | 'loading'
        | 'skipped'
        | 'reached'
        | 'marked'
        | 'pending';
      timestamp?: string;
      pile?: string | number;
      rowNo?: string | number;
      remark?: string;
      // Accuracy fields
      hrms?: number;
      vrms?: number;
      lat_achieved?: number;
      lon_achieved?: number;
      accuracy_level?: string;
      position_error_mm?: number;
    }
  >;
  missionMode?: string | null;
  onExport: () => void;
  onExportComplete?: () => void;
};

const MissionReportExport: React.FC<MissionReportExportProps> = ({
  waypoints,
  statusMap = {},
  missionMode,
  onExport,
  onExportComplete,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [exportMethod, setExportMethod] = useState<'share' | 'save'>('save');
  const [isDownloading, setIsDownloading] = useState(false);

  // Calculate mission statistics
  const totalPoints = waypoints.length;
  const completedPoints = Object.values(statusMap).filter(
    s => s.status === 'completed', // Only count actually completed waypoints, not skipped ones
  ).length;
  const pendingPoints = Object.values(statusMap).filter(
    s => !s.status || s.status === 'pending',
  ).length;
  const errorPoints = Object.values(statusMap).filter(
    s => s.status === 'skipped',
  ).length;
  const successRate =
    totalPoints > 0 ? ((completedPoints / totalPoints) * 100).toFixed(1) : '0.0';

  // Calculate mission timing
  const timestamps = Object.values(statusMap)
    .map(s => s.timestamp)
    .filter(t => t && t !== '-');

  let missionDuration = 'N/A';
  if (timestamps.length >= 2) {
    const sortedTimes = timestamps.sort();
    const startTime = sortedTimes[0];
    const endTime = sortedTimes[sortedTimes.length - 1];
    missionDuration = `${startTime} - ${endTime}`;
  }

  // Fallback share since Expo managed workflow doesn't support SAF
  // Files are saved to app storage and user can share/export via sharing
  const saveToAppStorage = async (
    fileUri: string,
    filename: string,
    mimeType: string,
  ) => {
    try {
      // In Expo managed workflow, files are saved to app's cache directory
      // Users can access via Share menu or file sharing on their device
      return fileUri;
    } catch (err) {
      console.error("[SAVE ERROR]", err);
      throw err;
    }
  };

  // Download file directly to device storage
  const saveToDeviceStorage = async (
    fileUri: string,
    filename: string,
    mimeType: string,
  ) => {
    try {
      const success = await downloadFileToDevice(fileUri, filename, mimeType);
      return success;
    } catch (err) {
      console.error("[DEVICE SAVE ERROR]", err);
      throw err;
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      // Prepare export data
      const data: ExportData[] = waypoints.map((waypoint, idx) => {
        const wpStatus = statusMap[waypoint.sn];
        const row = waypoint.row || wpStatus?.rowNo || '-';
        const block = waypoint.block || '-';
        const pile = waypoint.pile || wpStatus?.pile || '-';

        let statusDisplay = 'Pending';
        if (wpStatus?.status === 'completed') {
          statusDisplay = 'Completed';
        } else if (wpStatus?.marked) {
          statusDisplay = 'Marked';
        } else if (wpStatus?.reached) {
          statusDisplay = 'Reached';
        } else if (wpStatus?.status === 'loading') {
          statusDisplay = 'Loading';
        } else if (wpStatus?.status === 'skipped') {
          statusDisplay = 'Skipped';
        }

        // Format accuracy display if available
        const accuracyDisplay = wpStatus?.position_error_mm 
          ? `${wpStatus.accuracy_level ? wpStatus.accuracy_level.charAt(0).toUpperCase() + wpStatus.accuracy_level.slice(1) : 'Unknown'} - ${(wpStatus.position_error_mm < 10 ? wpStatus.position_error_mm.toFixed(1) : Math.round(wpStatus.position_error_mm))}mm`
          : '-';

        return {
          'S/N': idx + 1,
          ROW: String(row),
          BLOCK: String(block),
          PILE: pile,
          Latitude: parseFloat(waypoint.lat.toFixed(7)),
          Longitude: parseFloat(waypoint.lon.toFixed(7)),
          Altitude: parseFloat(waypoint.alt.toFixed(2)),
          Status: statusDisplay,
          Timestamp: wpStatus?.timestamp ?? '-',
          Accuracy: accuracyDisplay,
          Remark: wpStatus?.remark ?? '-',
        };
      });

      // Find error locations
      const errorLocations: string[] = [];
      waypoints.forEach((wp, idx) => {
        const wpStatus = statusMap[wp.sn];
        if (wpStatus?.status === 'skipped') {
          const row = wp.row || wpStatus?.rowNo || '-';
          const block = wp.block || '-';
          const pile = wp.pile || wpStatus?.pile || '-';
          errorLocations.push(
            `Row ${row}, Block ${block}, Pile ${pile} (WP #${idx + 1})`,
          );
        }
      });

      // Build mission statistics
      const stats: MissionStats = {
        totalPoints,
        completedPoints,
        pendingPoints,
        errorPoints,
        successRate,
        missionDuration,
        errorLocations,
      };

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5);
      let fileUri: string;
      let filename: string;
      let mimeType: string;
      let formatName: string;

      if (exportFormat === 'excel') {
        // Generate Excel file using ExcelJS
        console.log('[Export] Generating Excel file...');
        const buffer = await generateExcel(data, stats, missionMode ?? null);

        // In React Native, generateExcel may fall back to CSV for compatibility
        const isReactNative =
          typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
        filename = `mission_report_${timestamp}.${
          isReactNative ? 'csv' : 'xlsx'
        }`;

        // Write to file system
        fileUri = `${FileSystem.documentDirectory}${filename}`;
        if (isReactNative) {
          // Buffer contains CSV. Write as UTF-8 text.
          const csvText =
            typeof TextDecoder !== 'undefined'
              ? new TextDecoder().decode(new Uint8Array(buffer))
              : String.fromCharCode.apply(
                  null,
                  Array.from(new Uint8Array(buffer)) as any,
                );
          // Write UTF-8 text; default encoding is UTF-8 in Expo FileSystem
          await FileSystem.writeAsStringAsync(fileUri, csvText);
        } else {
          // Web/Node: buffer is XLSX; convert to base64
          const uint8Array = new Uint8Array(buffer);
          let binary = '';
          uint8Array.forEach(byte => {
            binary += String.fromCharCode(byte);
          });
          const base64 = btoa(binary);
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        mimeType = isReactNative
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        formatName = isReactNative ? 'CSV' : 'Excel';

        console.log('[Export] Excel file created:', fileUri);
      } else {
        // Generate PDF using expo-print
        console.log('[Export] Generating PDF file...');
        const htmlContent = generatePDFHTML(data, stats, missionMode ?? null);

        filename = `mission_report_${timestamp}.pdf`;

        // Generate PDF from HTML (expo-print already saves to a shareable location)
        const { uri } = await Print.printToFileAsync({
          html: htmlContent,
        });

        // Use the generated URI directly (no need to copy)
        fileUri = uri;

        mimeType = 'application/pdf';
        formatName = 'PDF';

        console.log('[Export] PDF file created:', fileUri);
      }

      // Handle export based on selected method
      if (exportMethod === 'save') {
        // SAVE: Open save dialog to save to Downloads/Files
        console.log('[Export] Opening save dialog:', filename);
        try {
          const saved = await saveToDeviceStorage(fileUri, filename, mimeType);

          if (saved) {
            console.log('[Export] Save dialog opened successfully');
            onExport();
            onExportComplete?.();
            setIsModalOpen(false);
          } else {
            // User cancelled - just close modal quietly
            console.log('[Export] User cancelled save dialog');
            setIsModalOpen(false);
          }
        } catch (saveError) {
          console.error('[Export] Save error:', saveError);
          Alert.alert(
            'Save Failed',
            'Could not open save dialog. Try the "Share" option instead.',
            [
              {
                text: 'Use Share Instead',
                onPress: async () => {
                  try {
                    const canShare = await Sharing.isAvailableAsync();
                    if (canShare) {
                      await Sharing.shareAsync(fileUri, {
                        mimeType,
                        dialogTitle: 'Export Mission Report',
                      });
                    }
                  } catch (shareError) {
                    console.error('[Export] Share fallback error:', shareError);
                  }
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }
      } else {
        // SHARE: Open sharing menu for apps, cloud, email, etc.
        console.log('[Export] Opening share menu for:', filename);
        try {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, {
              mimeType,
              dialogTitle: 'Export Mission Report',
            });

            Alert.alert(
              'File Ready to Share',
              `${formatName} file ready!\n\nFilename: ${filename}`,
            );
          } else {
            Alert.alert(
              'Sharing Not Available',
              `File saved locally.\n\nFilename: ${filename}`,
            );
          }

          onExport();
          onExportComplete?.();
          setIsModalOpen(false);
        } catch (shareError) {
          console.error('[Export] Share error:', shareError);
          // Don't throw - just log and close
          if (
            shareError instanceof Error &&
            !shareError.message.includes('cancel')
          ) {
            Alert.alert(
              'Share Failed',
              'Could not open share dialog. File is saved locally in app cache.',
            );
          }
          setIsModalOpen(false);
        }
      }

      setIsDownloading(false);
    } catch (error) {
      console.error('[Export] Error:', error);
      console.error(
        '[Export] Stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      );
      Alert.alert(
        'Export Error',
        `Failed to generate report: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      setIsDownloading(false);
    }
  };

  return (
    <>
      {/* Export Button */}
      <TouchableOpacity
        style={styles.exportButton}
        onPress={() => setIsModalOpen(true)}
      >
        <Text style={styles.exportIcon}>📊</Text>
        <Text style={styles.exportButtonText}>Export Report</Text>
      </TouchableOpacity>

      {/* Export Modal */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export Mission Report</Text>
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Preview Section */}
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>Report Preview</Text>
                <View style={styles.previewGrid}>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewLabel}>Total Waypoints:</Text>
                    <Text style={styles.previewValue}>{totalPoints}</Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewLabel}>Completed:</Text>
                    <Text style={[styles.previewValue, styles.successText]}>
                      {completedPoints}
                    </Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewLabel}>Pending:</Text>
                    <Text style={[styles.previewValue, styles.warningText]}>
                      {pendingPoints}
                    </Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewLabel}>Errors:</Text>
                    <Text style={[styles.previewValue, styles.errorText]}>
                      {errorPoints}
                    </Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewLabel}>Success Rate:</Text>
                    <Text style={[styles.previewValue, styles.successText]}>
                      {successRate}%
                    </Text>
                  </View>
                  <View style={styles.previewItem}>
                    <Text style={styles.previewLabel}>Duration:</Text>
                    <Text style={styles.previewValue}>{missionDuration}</Text>
                  </View>
                </View>
              </View>

              {/* Export Method Selection */}
              <View style={styles.formatSection}>
                <Text style={styles.sectionTitle}>
                  How would you like to export?
                </Text>

                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    exportMethod === 'save' && styles.formatOptionSelected,
                  ]}
                  onPress={() => setExportMethod('save')}
                  disabled={isDownloading}
                >
                  <View style={styles.formatRadio}>
                    {exportMethod === 'save' && (
                      <View style={styles.formatRadioInner} />
                    )}
                  </View>
                  <View style={styles.formatInfo}>
                    <View style={styles.formatHeader}>
                      <Text style={styles.formatIcon}>💾</Text>
                      <Text style={styles.formatTitle}>
                        Save to File Manager
                      </Text>
                    </View>
                    <Text style={styles.formatDescription}>
                      Download directly to your device storage (Downloads folder on Android, Documents on iOS)
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    exportMethod === 'share' && styles.formatOptionSelected,
                  ]}
                  onPress={() => setExportMethod('share')}
                  disabled={isDownloading}
                >
                  <View style={styles.formatRadio}>
                    {exportMethod === 'share' && (
                      <View style={styles.formatRadioInner} />
                    )}
                  </View>
                  <View style={styles.formatInfo}>
                    <View style={styles.formatHeader}>
                      <Text style={styles.formatIcon}>📤</Text>
                      <Text style={styles.formatTitle}>Share with Apps</Text>
                    </View>
                    <Text style={styles.formatDescription}>
                      Send to WhatsApp, Email, Google Drive, or any installed
                      app
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Format Selection */}
              <View style={styles.formatSection}>
                <Text style={styles.sectionTitle}>Select Export Format</Text>

                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    exportFormat === 'excel' && styles.formatOptionSelected,
                  ]}
                  onPress={() => setExportFormat('excel')}
                  disabled={isDownloading}
                >
                  <View style={styles.formatRadio}>
                    {exportFormat === 'excel' && (
                      <View style={styles.formatRadioInner} />
                    )}
                  </View>
                  <View style={styles.formatInfo}>
                    <View style={styles.formatHeader}>
                      <Text style={styles.formatIcon}>📊</Text>
                      <Text style={styles.formatTitle}>
                        Excel Format (.xlsx)
                      </Text>
                    </View>
                    <Text style={styles.formatDescription}>
                      Professional report with formatting - opens in
                      Excel/Sheets
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    exportFormat === 'pdf' && styles.formatOptionSelected,
                  ]}
                  onPress={() => setExportFormat('pdf')}
                  disabled={isDownloading}
                >
                  <View style={styles.formatRadio}>
                    {exportFormat === 'pdf' && (
                      <View style={styles.formatRadioInner} />
                    )}
                  </View>
                  <View style={styles.formatInfo}>
                    <View style={styles.formatHeader}>
                      <Text style={styles.formatIcon}>📄</Text>
                      <Text style={styles.formatTitle}>PDF Format (.pdf)</Text>
                    </View>
                    <Text style={styles.formatDescription}>
                      Professional printable document - ready to share
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setIsModalOpen(false)}
                  disabled={isDownloading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.downloadButton,
                    (isDownloading || waypoints.length === 0) &&
                      styles.downloadButtonDisabled,
                  ]}
                  onPress={handleDownload}
                  disabled={isDownloading || waypoints.length === 0}
                >
                  {isDownloading ? (
                    <View style={styles.downloadContent}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.downloadButtonText}>
                        Generating {exportFormat === 'excel' ? 'Excel' : 'PDF'}
                        ...
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.downloadContent}>
                      <Text style={styles.downloadIcon}>
                        {exportMethod === 'save' ? '💾' : '📤'}
                      </Text>
                      <Text style={styles.downloadButtonText}>
                        {exportMethod === 'save' ? 'Save' : 'Share'}{' '}
                        {exportFormat === 'excel' ? 'Excel' : 'PDF'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  exportButton: {
    flexDirection: 'row',
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    gap: 8,
  },
  exportIcon: {
    fontSize: 14,
  },
  exportButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#001F3F',
    borderRadius: 12,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.3)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(103, 232, 249, 0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 28,
    color: colors.textSecondary,
    lineHeight: 28,
  },
  previewSection: {
    margin: 20,
    backgroundColor: '#002244',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.2)',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#67E8F9',
    marginBottom: 12,
  },
  previewGrid: {
    gap: 12,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  successText: {
    color: '#10B981',
  },
  warningText: {
    color: '#F59E0B',
  },
  errorText: {
    color: '#EF4444',
  },
  formatSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#002244',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(103, 232, 249, 0.3)',
    marginBottom: 12,
  },
  formatOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  formatRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formatRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  formatInfo: {
    flex: 1,
  },
  formatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  formatIcon: {
    fontSize: 16,
  },
  formatTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  formatDescription: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#003366',
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  downloadButton: {
    backgroundColor: '#10B981',
  },
  downloadButtonDisabled: {
    backgroundColor: '#003366',
    opacity: 0.5,
  },
  downloadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadIcon: {
    fontSize: 16,
  },
  downloadButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MissionReportExport;
