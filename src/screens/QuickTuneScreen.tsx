/**
 * QuickTuneScreen — Modal wrapper for the QuickTune Wizard
 *
 * Renders the real 6-step QuickTuneWizard inside a full-screen modal.
 * Called from DashboardScreen.
 */

import React from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import QuickTuneWizard from '../components/quicktune/QuickTuneWizard';

export default function QuickTuneScreen({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <QuickTuneWizard onClose={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
});
