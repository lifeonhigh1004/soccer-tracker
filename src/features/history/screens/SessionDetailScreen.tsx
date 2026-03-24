import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Dimensions,
} from 'react-native';
import MapView, { Polyline, Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing, Radius } from '../../../core/theme/spacing';
import { Sport, SessionType } from '../../../core/types/session';
import type { LocationPoint } from '../../../core/types/session';
import type { SessionSummary } from '../../../core/types/session';
import type { HistoryStackParamList } from '../../../core/navigation/types';
import { loadSessionPoints } from '../../../shared/services/storageService';
import {
  formatDuration, formatDistanceKm, formatPace, formatFullDate,
} from '../../../shared/utils/formatters';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - Spacing.lg * 2;
const CHART_H = 80;
const CHART_PADDING_LEFT = 32; // space for Y-axis labels
const CHART_INNER_W = CHART_W - CHART_PADDING_LEFT;

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B6B6B' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2E2E2E' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#242424' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1117' }] },
];

const HEATMAP_GRADIENT = {
  colors: ['#2979FF', '#00E5FF', '#69FF47', '#FFFF00', '#FF6D00', '#FF1744'],
  startPoints: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
  colorMapSize: 256,
};

const SPORT_INFO: Record<Sport, { emoji: string; label: string; color: string }> = {
  [Sport.Soccer]: { emoji: '⚽', label: '축구', color: Colors.soccer },
  [Sport.Futsal]: { emoji: '🏟️', label: '풋살', color: '#9B59FF' },
};

const TYPE_INFO: Record<SessionType, { emoji: string; label: string; color: string }> = {
  [SessionType.Match]: { emoji: '🏆', label: '경기', color: Colors.match },
  [SessionType.Training]: { emoji: '🏃', label: '훈련', color: Colors.training },
};

// Build smooth speed path for SVG chart (0-based x coordinates for CHART_INNER_W)
function buildSpeedPath(
  points: LocationPoint[],
  maxSpeedKph: number,
  filled: boolean,
): string {
  const valid = points.filter((p) => p.speed !== null && p.speed >= 0);
  if (valid.length < 2) return '';

  // Apply 5-point moving average
  const smoothed: number[] = valid.map((_, i) => {
    const window = valid.slice(Math.max(0, i - 2), i + 3);
    const avg = window.reduce((s, p) => s + (p.speed ?? 0) * 3.6, 0) / window.length;
    return avg;
  });

  const startTs = valid[0].timestamp;
  const endTs = valid[valid.length - 1].timestamp;
  const duration = endTs - startTs || 1;
  const capSpeed = Math.max(maxSpeedKph, 1);

  const toX = (ts: number) => ((ts - startTs) / duration) * CHART_INNER_W;
  const toY = (kph: number) => CHART_H - Math.min(kph / capSpeed, 1) * (CHART_H - 4);

  let d = '';
  smoothed.forEach((kph, i) => {
    const x = toX(valid[i].timestamp);
    const y = toY(kph);
    d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  if (filled) {
    const lastX = toX(valid[valid.length - 1].timestamp);
    const firstX = toX(valid[0].timestamp);
    d += ` L ${lastX.toFixed(1)} ${CHART_H} L ${firstX.toFixed(1)} ${CHART_H} Z`;
  }

  return d;
}

export function SessionDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<HistoryStackParamList, 'SessionDetail'>>();
  const { session } = route.params;

  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    loadSessionPoints(session.id).then((pts) => {
      setPoints(pts);
      setLoading(false);
    });
  }, [session.id]);

  // Fit map to route after points load
  useEffect(() => {
    if (points.length < 2 || !mapRef.current) return;
    const coords = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: false,
      });
    }, 300);
  }, [points]);

  const routeCoords = useMemo(
    () => points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [points],
  );

  const heatmapPoints = useMemo(
    () => routeCoords.map((p) => ({ ...p, weight: 1 })),
    [routeCoords],
  );

  const linePath = useMemo(
    () => buildSpeedPath(points, session.maxSpeedKph, false),
    [points, session.maxSpeedKph],
  );
  const fillPath = useMemo(
    () => buildSpeedPath(points, session.maxSpeedKph, true),
    [points, session.maxSpeedKph],
  );

  const sportInfo = SPORT_INFO[session.sport];
  const typeInfo = TYPE_INFO[session.type];
  const avgSpeedKph = session.avgSpeedKph;
  const dur = session.activeDurationSeconds;

  // Y-axis labels for speed chart
  const yLabels = [0, Math.round(session.maxSpeedKph / 2), Math.round(session.maxSpeedKph)];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* 지도 영역 */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={DARK_MAP_STYLE}
          scrollEnabled={true}
          zoomEnabled={true}
          rotateEnabled={false}
          pitchEnabled={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {showHeatmap && heatmapPoints.length >= 20 && (
            <Heatmap
              points={heatmapPoints}
              radius={28}
              opacity={0.75}
              gradient={HEATMAP_GRADIENT}
            />
          )}
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={showHeatmap ? `${Colors.primary}44` : Colors.primary}
              strokeWidth={showHeatmap ? 2 : 3}
              lineCap="round"
              lineJoin="round"
            />
          )}
          {routeCoords.length > 0 && (
            <>
              {/* 시작점 */}
              <Marker coordinate={routeCoords[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={styles.startMarker}>
                  <Text style={styles.startMarkerText}>S</Text>
                </View>
              </Marker>
              {/* 종료점 */}
              <Marker coordinate={routeCoords[routeCoords.length - 1]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={styles.endMarker}>
                  <Text style={styles.endMarkerText}>E</Text>
                </View>
              </Marker>
            </>
          )}
        </MapView>

        {loading && (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}

        {/* 뒤로 가기 */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>

        {/* 히트맵 토글 */}
        {routeCoords.length >= 20 && (
          <TouchableOpacity
            style={[styles.heatmapBtn, showHeatmap && styles.heatmapBtnActive]}
            onPress={() => setShowHeatmap((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.heatmapBtnText}>🔥</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 내용 스크롤 */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 세션 제목 행 */}
        <View style={styles.titleRow}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { borderColor: sportInfo.color }]}>
              <Text style={[styles.badgeText, { color: sportInfo.color }]}>
                {sportInfo.emoji} {sportInfo.label}
              </Text>
            </View>
            <View style={[styles.badge, { borderColor: typeInfo.color }]}>
              <Text style={[styles.badgeText, { color: typeInfo.color }]}>
                {typeInfo.emoji} {typeInfo.label}
              </Text>
            </View>
          </View>
          <Text style={styles.dateText}>{formatFullDate(session.startedAt)}</Text>
        </View>

        {/* 핵심 통계 */}
        <Text style={styles.bigDuration}>{formatDuration(dur)}</Text>

        <View style={styles.statsGrid}>
          <StatBox label="이동 거리" value={formatDistanceKm(session.distanceMeters)} unit="km" color={Colors.primary} />
          <StatBox label="평균 속도" value={avgSpeedKph.toFixed(1)} unit="km/h" color={Colors.training} />
          <StatBox label="최고 속도" value={session.maxSpeedKph.toFixed(1)} unit="km/h" color={Colors.match} />
          <StatBox label="페이스" value={formatPace(session.pace)} unit="" color={Colors.warning} />
          <StatBox label="GPS 포인트" value={String(points.length)} unit="개" color={Colors.textSecondary} />
          <StatBox label="이동 경로" value={routeCoords.length > 1 ? '있음' : '없음'} unit="" color={Colors.textSecondary} />
        </View>

        {/* 속도 차트 */}
        {linePath ? (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>속도 변화</Text>
            <View style={styles.chartContainer}>
              {/* Y축 레이블 */}
              <View style={styles.yAxis}>
                {yLabels.slice().reverse().map((v, i) => (
                  <Text key={i} style={styles.yLabel}>{v}</Text>
                ))}
              </View>
              <Svg width={CHART_INNER_W} height={CHART_H}>
                <Defs>
                  <LinearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={Colors.primary} stopOpacity="0.4" />
                    <Stop offset="1" stopColor={Colors.primary} stopOpacity="0.02" />
                  </LinearGradient>
                </Defs>
                {/* 채우기 */}
                {fillPath ? (
                  <Path d={fillPath} fill="url(#speedGrad)" />
                ) : null}
                {/* 선 */}
                <Path
                  d={linePath}
                  stroke={Colors.primary}
                  strokeWidth={1.5}
                  fill="none"
                />
              </Svg>
            </View>
            <View style={styles.xAxisRow}>
              <Text style={styles.xLabel}>0:00</Text>
              <Text style={styles.xLabel}>{formatDuration(Math.floor(dur / 2))}</Text>
              <Text style={styles.xLabel}>{formatDuration(dur)}</Text>
            </View>
          </View>
        ) : null}

        {/* 메모 */}
        {session.notes ? (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>메모</Text>
            <Text style={styles.notesText}>{session.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  mapContainer: {
    height: 280,
    position: 'relative',
  },
  map: { flex: 1 },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },

  backBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.surface}EE`,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: { color: Colors.textPrimary, fontSize: 20, lineHeight: 24 },

  heatmapBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.surface}EE`,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heatmapBtnActive: {
    backgroundColor: `${Colors.warning}33`,
    borderColor: Colors.warning,
  },
  heatmapBtnText: { fontSize: 18 },

  startMarker: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  startMarkerText: { color: Colors.background, fontSize: 10, fontWeight: '800' },
  endMarker: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.danger,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  endMarkerText: { color: Colors.white, fontSize: 10, fontWeight: '800' },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  badge: {
    borderWidth: 1.5, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 3,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  dateText: { ...Typography.caption, color: Colors.textDisabled },

  bigDuration: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    letterSpacing: -1,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statBox: {
    width: '31%',
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minWidth: 90,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '700' },
  statUnit: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 2 },
  statLabel: { ...Typography.caption, color: Colors.textSecondary },

  chartSection: { marginBottom: Spacing.xl },
  sectionTitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  yAxis: {
    width: CHART_PADDING_LEFT - Spacing.md,
    height: CHART_H,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  yLabel: { ...Typography.caption, color: Colors.textDisabled, fontSize: 9 },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginTop: 4,
  },
  xLabel: { ...Typography.caption, color: Colors.textDisabled, fontSize: 9 },

  notesSection: { marginBottom: Spacing.xl },
  notesText: {
    ...Typography.body,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    lineHeight: 20,
  },
});
