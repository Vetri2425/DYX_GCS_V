import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { PathPlanWaypoint } from '../../types/pathplan';

interface Props {
    waypoints: PathPlanWaypoint[];
}

export const MissionStatistics: React.FC<Props> = ({ waypoints }) => {
    // Calculate stats
    const totalWaypoints = waypoints.length;
    const totalRows = new Set(waypoints.map(wp => wp.row).filter(Boolean)).size;
    const totalBlocks = new Set(waypoints.map(wp => wp.block).filter(Boolean)).size;

    const totalDistance = waypoints.reduce((sum, wp) => sum + (wp.distance || 0), 0);
    const totalDistanceKm = (totalDistance / 1000).toFixed(3);

    // Estimate time (assuming 1.5 m/s)
    const totalTimeSeconds = totalDistance / 1.5;
    const hours = Math.floor(totalTimeSeconds / 3600);
    const minutes = Math.floor((totalTimeSeconds % 3600) / 60);
    const seconds = Math.floor(totalTimeSeconds % 60);

    const altitudes = waypoints.map(wp => wp.alt).filter(a => a !== undefined);
    const minAlt = altitudes.length ? Math.min(...altitudes) : 0;
    const maxAlt = altitudes.length ? Math.max(...altitudes) : 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerIcon}>
                    <Text style={styles.iconText}>📊</Text>
                </View>
                <Text style={styles.headerTitle}>Mission Statistics</Text>
            </View>

            <View style={styles.grid}>
                {/* Total Waypoints */}
                <LinearGradient
                    colors={['rgba(37, 99, 235, 0.2)', 'rgba(30, 64, 175, 0.2)']}
                    style={styles.card}
                >
                    <View style={styles.cardContent}>
                        <View>
                            <Text style={styles.cardLabel}>TOTAL WAYPOINTS</Text>
                            <Text style={styles.cardValue}>{totalWaypoints}</Text>
                        </View>
                        <Text style={styles.cardIcon}>📍</Text>
                    </View>
                </LinearGradient>

                {/* Total Rows */}
                <LinearGradient
                    colors={['rgba(147, 51, 234, 0.2)', 'rgba(107, 33, 168, 0.2)']}
                    style={styles.card}
                >
                    <View style={styles.cardContent}>
                        <View>
                            <Text style={styles.cardLabel}>TOTAL ROWS</Text>
                            <Text style={styles.cardValue}>{totalRows}</Text>
                        </View>
                        <Text style={styles.cardIcon}>📊</Text>
                    </View>
                </LinearGradient>

                {/* Total Blocks */}
                <LinearGradient
                    colors={['rgba(8, 145, 178, 0.2)', 'rgba(21, 94, 117, 0.2)']}
                    style={styles.card}
                >
                    <View style={styles.cardContent}>
                        <View>
                            <Text style={styles.cardLabel}>TOTAL BLOCKS</Text>
                            <Text style={styles.cardValue}>{totalBlocks}</Text>
                        </View>
                        <Text style={styles.cardIcon}>🏗️</Text>
                    </View>
                </LinearGradient>

                {/* Total Distance */}
                <LinearGradient
                    colors={['rgba(22, 163, 74, 0.2)', 'rgba(21, 128, 61, 0.2)']}
                    style={styles.card}
                >
                    <View style={styles.cardContent}>
                        <View>
                            <Text style={styles.cardLabel}>TOTAL DISTANCE</Text>
                            <View style={styles.valueRow}>
                                <Text style={styles.cardValue}>{totalDistanceKm}</Text>
                                <Text style={styles.unit}>km</Text>
                            </View>
                        </View>
                        <Text style={styles.cardIcon}>📏</Text>
                    </View>
                </LinearGradient>

                {/* Est Duration */}
                <LinearGradient
                    colors={['rgba(234, 88, 12, 0.2)', 'rgba(154, 52, 18, 0.2)']}
                    style={[styles.card, styles.wideCard]}
                >
                    <View style={styles.cardContent}>
                        <View style={styles.timeContainer}>
                            <Text style={styles.cardLabel}>EST. DURATION (@ 1.5 m/s)</Text>
                            <View style={styles.timeRow}>
                                <View style={styles.timeBlock}>
                                    <Text style={styles.timeValue}>{hours}</Text>
                                    <Text style={styles.timeUnit}>Hr</Text>
                                </View>
                                <Text style={styles.timeSeparator}>:</Text>
                                <View style={styles.timeBlock}>
                                    <Text style={styles.timeValue}>{minutes}</Text>
                                    <Text style={styles.timeUnit}>Min</Text>
                                </View>
                                <Text style={styles.timeSeparator}>:</Text>
                                <View style={styles.timeBlock}>
                                    <Text style={styles.timeValue}>{seconds}</Text>
                                    <Text style={styles.timeUnit}>Sec</Text>
                                </View>
                            </View>
                        </View>
                        <Text style={styles.cardIcon}>⏱️</Text>
                    </View>
                </LinearGradient>

                {/* Mission Status */}
                <LinearGradient
                    colors={['rgba(22, 163, 74, 0.2)', 'rgba(21, 128, 61, 0.2)']}
                    style={[styles.card, styles.wideCard]}
                >
                    <View style={styles.cardContent}>
                        <View>
                            <Text style={styles.cardLabel}>MISSION STATUS</Text>
                            <View style={styles.statusRow}>
                                <View style={[styles.statusDot, totalWaypoints > 0 && styles.statusDotActive]} />
                                <Text style={[styles.statusText, totalWaypoints > 0 && styles.statusTextActive]}>
                                    {totalWaypoints > 0 ? 'Mission Ready' : 'No Data'}
                                </Text>
                            </View>
                            <Text style={styles.statusSubtext}>
                                {totalWaypoints > 0 ? 'Mission valid' : 'Add waypoints to begin'}
                            </Text>
                        </View>
                        <Text style={styles.cardIcon}>{totalWaypoints > 0 ? '✅' : '⚪'}</Text>
                    </View>
                </LinearGradient>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#001F3F', // Darker blue background
        borderRadius: 12,
        padding: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    headerIcon: {
        backgroundColor: 'rgba(6, 182, 212, 0.2)',
        padding: 6,
        borderRadius: 6,
    },
    iconText: {
        fontSize: 10,
    },
    headerTitle: {
        color: '#67E8F9',
        fontSize: 12,
        fontWeight: 'bold',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
        height: '88%',
    },
    card: {
        width: '48%',
        height: '30%',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 8,
    },
    wideCard: {
        flexBasis: '48%',
    },
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        overflow: 'hidden',
    },
    cardLabel: {
        color: 'rgba(103, 232, 249, 0.8)',
        fontSize: 8,
        fontWeight: '600',
        marginBottom: 4,
        letterSpacing: 0.3,
        flexShrink: 1,
    },
    cardValue: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        flexShrink: 1,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    unit: {
        color: 'rgba(103, 232, 249, 0.7)',
        fontSize: 10,
    },
    cardIcon: {
        fontSize: 16,
        opacity: 0.5,
        flexShrink: 0,
        marginLeft: 4,
    },
    timeContainer: {
        flex: 1,
        flexShrink: 1,
        overflow: 'hidden',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeBlock: {
        alignItems: 'center',
    },
    timeValue: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    timeUnit: {
        color: 'rgba(251, 146, 60, 0.7)',
        fontSize: 7,
    },
    timeSeparator: {
        color: '#FFFFFF',
        fontSize: 12,
        marginBottom: 8,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#6B7280',
    },
    statusDotActive: {
        backgroundColor: '#22C55E',
    },
    statusText: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: 'bold',
        flexShrink: 1,
    },
    statusTextActive: {
        color: '#4ADE80',
    },
    statusSubtext: {
        color: 'rgba(74, 222, 128, 0.6)',
        fontSize: 8,
    },
});
