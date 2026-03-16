import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { PathPlanWaypoint } from '../../types/pathplan';

interface Props {
    waypoints: PathPlanWaypoint[];
}

// Card accent colors
const CARD_COLORS = {
    points: '#3b82f6',
    rows: '#a855f7',
    blocks: '#06b6d4',
    distance: '#10b981',
    duration: '#f59e0b',
    status: '#22c55e',
};

export const MissionStatistics: React.FC<Props> = ({ waypoints }) => {
    const totalWaypoints = waypoints.length;
    const totalRows = new Set(waypoints.map(wp => wp.row).filter(Boolean)).size;
    const totalBlocks = new Set(waypoints.map(wp => wp.block).filter(Boolean)).size;

    const totalDistance = waypoints.reduce((sum, wp) => sum + (wp.distance || 0), 0);
    const totalDistanceM = totalDistance.toFixed(2);

    const totalTimeSeconds = totalDistance / 1;
    const hours = Math.floor(totalTimeSeconds / 3600);
    const minutes = Math.floor((totalTimeSeconds % 3600) / 60);
    const seconds = Math.floor(totalTimeSeconds % 60);

    const isReady = totalWaypoints > 0;
    const statusColor = isReady ? CARD_COLORS.status : '#6B7280';

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconWrap}>
                        <Ionicons name="stats-chart" size={16} color={colors.accent} />
                    </View>
                    <Text style={styles.headerTitle}>STATISTICS</Text>
                </View>
                <View style={[styles.headerBadge, { borderColor: statusColor + '50', backgroundColor: statusColor + '15' }]}>
                    <View style={[styles.headerBadgeDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.headerBadgeText, { color: statusColor }]}>
                        {isReady ? `${totalWaypoints} PTS` : 'EMPTY'}
                    </Text>
                </View>
            </View>

            {/* Stats Grid - 2 columns × 3 rows */}
            <View style={styles.grid}>
                <View style={styles.gridRow}>
                    <View style={styles.statCard}>
                        <View style={[styles.cardAccent, { backgroundColor: CARD_COLORS.points }]} />
                        <View style={styles.cardInner}>
                            <View style={styles.cardTopRow}>
                                <Text style={styles.cardLabel}>MARKING POINTS</Text>
                                <View style={[styles.iconWrap, { borderColor: CARD_COLORS.points + '40' }]}>
                                    <Ionicons name="location" size={14} color={CARD_COLORS.points} />
                                </View>
                            </View>
                            <Text style={styles.cardValue}>{totalWaypoints}</Text>
                        </View>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.cardAccent, { backgroundColor: CARD_COLORS.rows }]} />
                        <View style={styles.cardInner}>
                            <View style={styles.cardTopRow}>
                                <Text style={styles.cardLabel}>TOTAL ROWS</Text>
                                <View style={[styles.iconWrap, { borderColor: CARD_COLORS.rows + '40' }]}>
                                    <Ionicons name="reorder-three" size={14} color={CARD_COLORS.rows} />
                                </View>
                            </View>
                            <Text style={styles.cardValue}>{totalRows}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.gridRow}>
                    <View style={styles.statCard}>
                        <View style={[styles.cardAccent, { backgroundColor: CARD_COLORS.blocks }]} />
                        <View style={styles.cardInner}>
                            <View style={styles.cardTopRow}>
                                <Text style={styles.cardLabel}>TOTAL BLOCKS</Text>
                                <View style={[styles.iconWrap, { borderColor: CARD_COLORS.blocks + '40' }]}>
                                    <Ionicons name="grid" size={14} color={CARD_COLORS.blocks} />
                                </View>
                            </View>
                            <Text style={styles.cardValue}>{totalBlocks}</Text>
                        </View>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.cardAccent, { backgroundColor: CARD_COLORS.distance }]} />
                        <View style={styles.cardInner}>
                            <View style={styles.cardTopRow}>
                                <Text style={styles.cardLabel}>TOTAL DISTANCE</Text>
                                <View style={[styles.iconWrap, { borderColor: CARD_COLORS.distance + '40' }]}>
                                    <Ionicons name="speedometer" size={14} color={CARD_COLORS.distance} />
                                </View>
                            </View>
                            <View style={styles.valueRow}>
                                <Text style={styles.cardValue}>{totalDistanceM}</Text>
                                <Text style={[styles.unitText, { color: CARD_COLORS.distance }]}>m</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.gridRow}>
                    <View style={styles.statCard}>
                        <View style={[styles.cardAccent, { backgroundColor: CARD_COLORS.duration }]} />
                        <View style={styles.cardInner}>
                            <View style={styles.cardTopRow}>
                                <Text style={styles.cardLabel}>EST. DURATION</Text>
                                <View style={[styles.iconWrap, { borderColor: CARD_COLORS.duration + '40' }]}>
                                    <Ionicons name="time" size={14} color={CARD_COLORS.duration} />
                                </View>
                            </View>
                            <Text style={styles.cardValue}>{hours}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</Text>
                        </View>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.cardAccent, { backgroundColor: statusColor }]} />
                        <View style={styles.cardInner}>
                            <View style={styles.cardTopRow}>
                                <Text style={styles.cardLabel}>MISSION STATUS</Text>
                                <View style={[styles.iconWrap, { borderColor: statusColor + '40' }]}>
                                    <Ionicons name={isReady ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={statusColor} />
                                </View>
                            </View>
                            <Text style={[styles.cardValue, { color: statusColor, fontSize: 16 }]}>
                                {isReady ? 'Mission Ready' : 'No Data'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.panelBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 12,
    },

    // ── HEADER ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: colors.accent,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 3,
    },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    headerBadgeDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    headerBadgeText: {
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 1.5,
    },

    // ── GRID ──
    grid: {
        flex: 1,
        gap: 8,
    },
    gridRow: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
    },

    // ── STAT CARD (uniform for all 6) ──
    statCard: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: colors.cardBg,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardAccent: {
        width: 3,
        alignSelf: 'stretch',
    },
    cardInner: {
        flex: 1,
        padding: 10,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    iconWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardValue: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        textAlign: 'center',
    },
    cardLabel: {
        color: 'rgba(103, 232, 249, 0.7)',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: 3,
    },
    unitText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
