import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Polyline, Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing, Radius } from '../../../core/theme/spacing';
import { Sport, SessionType, SessionStatus } from '../../../core/types/session';
import type { SessionSummary } from '../../../core/types/session';
import type { TrackingNavProp, RootTabParamList } from '../../../core/navigation/types';
import { useLocationTracking, FinalTrackingData, LatLng } from '../../../shared/hooks/useLocationTracking';
import { useIMU } from '../../../shared/hooks/useIMU';
import { useCompass } from '../../../shared/hooks/useCompass';
import { saveSession, saveSessionPoints } from '../../../shared/services/storageService';
import { calculateBounds } from '../../../shared/utils/geoUtils';
import {
  formatDuration,
  formatDistanceKm,
  formatPace,
} from '../../../shared/utils/formatters';

type ScreenState = 'idle' | 'active' | 'paused' | 'saving';

const SPRINT_BANNER_MS = 2000; // 스프린트 배너 표시 시간

const SPORT_INFO: Record<Sport, { emoji: string; label: string; color: string }> = {
  [Sport.Soccer]: { emoji: '⚽', label: '축구', color: Colors.soccer },
  [Sport.Futsal]: { emoji: '🏟️', label: '풋살', color: Colors.futsal },
};

const TYPE_INFO: Record<SessionType, { emoji: string; label: string; color: string }> = {
  [SessionType.Match]: { emoji: '🏆', label: '경기', color: Colors.match },
  [SessionType.Training]: { emoji: '🏃', label: '훈련', color: Colors.training },
};

// 다크 지도 스타일
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B6B6B' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2E2E2E' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2E2E2E' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#242424' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A3A3A' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1117' }] },
];

export function TrackingScreen() {
  const navigation = useNavigation<TrackingNavProp>();
  const route = useRoute<RouteProp<RootTabParamList, 'Tracking'>>();

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [selectedSport, setSelectedSport] = useState<Sport>(Sport.Soccer);
  const [selectedType, setSelectedType] = useState<SessionType>(SessionType.Training);

  // 대시보드 빠른 시작에서 넘어올 때 sport/type 자동 선택
  useEffect(() => {
    if (screenState !== 'idle') return;
    if (route.params?.sport) setSelectedSport(route.params.sport);
    if (route.params?.type) setSelectedType(route.params.type);
  }, [route.params]);
  const [notes, setNotes] = useState('');
  const [finalData, setFinalData] = useState<FinalTrackingData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sprintCount, setSprintCount] = useState(0);
  const [showSprintBanner, setShowSprintBanner] = useState(false);
  const sprintBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSprintStart = useCallback(() => {
    setSprintCount((c) => c + 1);
    setShowSprintBanner(true);
    if (sprintBannerTimerRef.current) clearTimeout(sprintBannerTimerRef.current);
    sprintBannerTimerRef.current = setTimeout(() => setShowSprintBanner(false), SPRINT_BANNER_MS);
  }, []);

  const handleSprintEnd = useCallback(() => {
    // 배너는 타이머로 자동 숨김 — 별도 처리 불필요
  }, []);

  const { getIMUState } = useIMU({
    enabled: screenState === 'active',
    onSprintStart: handleSprintStart,
    onSprintEnd: handleSprintEnd,
  });

  const heading = useCompass(screenState === 'active' || screenState === 'paused');
  const tracking = useLocationTracking({ getIMUState });

  useEffect(() => {
    return () => {
      if (sprintBannerTimerRef.current) clearTimeout(sprintBannerTimerRef.current);
    };
  }, []);

  const handleStart = async () => {
    setSprintCount(0);
    setShowSprintBanner(false);
    const success = await tracking.startTracking();
    if (success) {
      setScreenState('active');
    } else {
      Alert.alert('위치 권한 필요', '설정에서 위치 권한을 허용해주세요.', [{ text: '확인' }]);
    }
  };

  // 앱 재시작 후 진행 중인 세션이 있으면 화면 상태 복원
  useEffect(() => {
    if (!tracking.isLoading && tracking.isSessionActive) {
      setScreenState(tracking.isSessionPaused ? 'paused' : 'active');
    }
  }, [tracking.isLoading, tracking.isSessionActive, tracking.isSessionPaused]);

  const handlePause = async () => {
    await tracking.pauseTracking();
    setScreenState('paused');
  };

  const handleResume = async () => {
    await tracking.resumeTracking();
    setScreenState('active');
  };

  const handleStop = async () => {
    const data = await tracking.stopTracking();
    setFinalData(data);
    setScreenState('saving');
  };

  const handleSave = async () => {
    if (!finalData || isSaving) return;
    setIsSaving(true);
    try {
      const dur = finalData.durationSeconds;
      const dist = finalData.distanceMeters;
      const avgSpeedKph = dur > 0 ? (dist / 1000) / (dur / 3600) : 0;

      const session: SessionSummary = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        sport: selectedSport,
        type: selectedType,
        status: SessionStatus.Completed,
        startedAt: finalData.startedAt,
        endedAt: Date.now(),
        pausedDurationSeconds: 0,
        activeDurationSeconds: dur,
        distanceMeters: dist,
        avgSpeedKph,
        maxSpeedKph: finalData.maxSpeedKph,
        topSpeedTimestamp: finalData.maxSpeedTimestamp,
        pace: avgSpeedKph > 0 ? 60 / avgSpeedKph : null,
        calories: null,
        notes: notes.trim(),
        weatherCondition: null,
        pitchType: null,
        useGps: true,
        routeBounds: calculateBounds(finalData.locationPoints),
      };

      await Promise.all([
        saveSession(session),
        finalData.locationPoints.length > 0
          ? saveSessionPoints(session.id, finalData.locationPoints)
          : Promise.resolve(),
      ]);
      tracking.reset();
      setNotes('');
      setFinalData(null);
      setScreenState('idle');
      navigation.navigate('History');
    } catch {
      Alert.alert('저장 실패', '다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      '세션 삭제',
      '이 세션을 삭제하시겠습니까? 기록이 저장되지 않습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            tracking.reset();
            setNotes('');
            setFinalData(null);
            setScreenState('idle');
          },
        },
      ],
    );
  };

  const livePace =
    tracking.distanceMeters > 20 && tracking.durationSeconds > 10
      ? 60 / ((tracking.distanceMeters / 1000) / (tracking.durationSeconds / 3600))
      : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>트래킹</Text>
        {(screenState === 'active' || screenState === 'paused') && (
          <View style={[styles.badge, screenState === 'paused' && styles.badgePaused]}>
            <View style={[styles.badgeDot, screenState === 'paused' && styles.badgeDotPaused]} />
            <Text style={[styles.badgeText, screenState === 'paused' && styles.badgeTextPaused]}>
              {screenState === 'active' ? 'LIVE' : 'PAUSED'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {screenState === 'idle' ? (
          <IdleView
            selectedSport={selectedSport}
            selectedType={selectedType}
            onSelectSport={setSelectedSport}
            onSelectType={setSelectedType}
            hasPermission={tracking.hasPermission}
            onStart={handleStart}
          />
        ) : (
          <ActiveView
            state={screenState}
            durationSeconds={tracking.durationSeconds}
            distanceMeters={tracking.distanceMeters}
            currentSpeedKph={tracking.currentSpeedKph}
            maxSpeedKph={tracking.maxSpeedKph}
            pace={livePace}
            gpsReady={tracking.gpsReady}
            heading={heading}
            currentLocation={tracking.currentLocation}
            routeCoordinates={tracking.routeCoordinates}
            sprintCount={sprintCount}
            showSprintBanner={showSprintBanner}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
          />
        )}
      </View>

      <SaveModal
        visible={screenState === 'saving'}
        finalData={finalData}
        sport={selectedSport}
        sessionType={selectedType}
        notes={notes}
        isSaving={isSaving}
        sprintCount={sprintCount}
        onNotesChange={setNotes}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </SafeAreaView>
  );
}

// ─── Idle ─────────────────────────────────────────────────────────────────────

function IdleView({
  selectedSport,
  selectedType,
  onSelectSport,
  onSelectType,
  hasPermission,
  onStart,
}: {
  selectedSport: Sport;
  selectedType: SessionType;
  onSelectSport: (s: Sport) => void;
  onSelectType: (t: SessionType) => void;
  hasPermission: boolean | null;
  onStart: () => void;
}) {
  return (
    <View style={styles.idleContainer}>
      <Text style={styles.selectorLabel}>스포츠</Text>
      <View style={styles.chipRow}>
        {(Object.values(Sport) as Sport[]).map((sport) => {
          const info = SPORT_INFO[sport];
          const active = selectedSport === sport;
          return (
            <TouchableOpacity
              key={sport}
              style={[styles.chip, active && { borderColor: info.color, backgroundColor: `${info.color}18` }]}
              onPress={() => onSelectSport(sport)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipEmoji}>{info.emoji}</Text>
              <Text style={[styles.chipLabel, active && { color: info.color }]}>{info.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.selectorLabel}>종류</Text>
      <View style={[styles.chipRow, { marginBottom: Spacing.xxxl }]}>
        {(Object.values(SessionType) as SessionType[]).map((type) => {
          const info = TYPE_INFO[type];
          const active = selectedType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.chip, active && { borderColor: info.color, backgroundColor: `${info.color}18` }]}
              onPress={() => onSelectType(type)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipEmoji}>{info.emoji}</Text>
              <Text style={[styles.chipLabel, active && { color: info.color }]}>{info.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {hasPermission === false ? (
        <View style={styles.gpsStatus}>
          <View style={[styles.gpsDot, { backgroundColor: Colors.danger }]} />
          <Text style={styles.gpsText}>위치 권한이 없습니다</Text>
        </View>
      ) : (
        <View style={styles.gpsStatus}>
          <View style={[styles.gpsDot, { backgroundColor: Colors.warning }]} />
          <Text style={styles.gpsText}>시작 시 GPS 연결됩니다</Text>
        </View>
      )}

      <TouchableOpacity style={styles.startButton} onPress={onStart} activeOpacity={0.85}>
        <Text style={styles.startButtonText}>세션 시작</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Active / Paused ──────────────────────────────────────────────────────────

function ActiveView({
  state,
  durationSeconds,
  distanceMeters,
  currentSpeedKph,
  maxSpeedKph,
  pace,
  gpsReady,
  heading,
  currentLocation,
  routeCoordinates,
  sprintCount,
  showSprintBanner,
  onPause,
  onResume,
  onStop,
}: {
  state: ScreenState;
  durationSeconds: number;
  distanceMeters: number;
  currentSpeedKph: number;
  maxSpeedKph: number;
  pace: number | null;
  gpsReady: boolean;
  heading: number | null;
  currentLocation: LatLng | null;
  routeCoordinates: LatLng[];
  sprintCount: number;
  showSprintBanner: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  return (
    <View style={styles.activeContainer}>
      {/* 지도 (화면 대부분 차지) */}
      <RouteMap
        currentLocation={currentLocation}
        routeCoordinates={routeCoordinates}
        gpsReady={gpsReady}
        heading={heading}
        isPaused={state === 'paused'}
      />

      {/* 스프린트 배너 */}
      {showSprintBanner && (
        <View style={styles.sprintBanner}>
          <Text style={styles.sprintBannerText}>⚡ 스프린트!</Text>
        </View>
      )}

      {/* 하단 패널 */}
      <View style={styles.bottomPanel}>
        {/* 타이머 + GPS 상태 */}
        <View style={styles.timerRow}>
          <View>
            <Text style={styles.timerLabel}>활동 시간</Text>
            <Text style={[styles.timerValue, state === 'paused' && styles.timerValuePaused]}>
              {formatDuration(durationSeconds)}
            </Text>
          </View>
          <View style={styles.rightIndicators}>
            {sprintCount > 0 && (
              <View style={styles.sprintBadge}>
                <Text style={styles.sprintBadgeText}>⚡ {sprintCount}</Text>
              </View>
            )}
            <View style={styles.gpsIndicator}>
              <View style={[styles.gpsDot, { backgroundColor: gpsReady ? Colors.primary : Colors.warning }]} />
              <Text style={[styles.gpsIndicatorText, { color: gpsReady ? Colors.primary : Colors.warning }]}>
                {gpsReady ? 'GPS 연결됨' : 'GPS 대기 중'}
              </Text>
            </View>
          </View>
        </View>

        {/* 통계 4개 */}
        <View style={styles.statsRow}>
          <StatItem value={formatDistanceKm(distanceMeters)} unit="km" label="거리" />
          <View style={styles.statDivider} />
          <StatItem value={currentSpeedKph.toFixed(1)} unit="km/h" label="현재" />
          <View style={styles.statDivider} />
          <StatItem value={maxSpeedKph.toFixed(1)} unit="km/h" label="최고" />
          <View style={styles.statDivider} />
          <StatItem value={formatPace(pace)} unit="" label="페이스" />
        </View>

        {/* 컨트롤 */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.8}>
            <Text style={styles.stopBtnText}>종료</Text>
          </TouchableOpacity>
          {state === 'active' ? (
            <TouchableOpacity style={styles.pauseBtn} onPress={onPause} activeOpacity={0.8}>
              <Text style={styles.pauseBtnText}>일시정지</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.resumeBtn} onPress={onResume} activeOpacity={0.8}>
              <Text style={styles.resumeBtnText}>재개</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Route Map ────────────────────────────────────────────────────────────────

// 히트맵 그라디언트: 파랑(낮음) → 초록 → 노랑 → 빨강(높음)
const HEATMAP_GRADIENT = {
  colors: ['#2979FF', '#00E5FF', '#69FF47', '#FFFF00', '#FF6D00', '#FF1744'],
  startPoints: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
  colorMapSize: 256,
};

// 범례 색상 (낮음→높음 순)
const LEGEND_COLORS = ['#2979FF', '#00E5FF', '#69FF47', '#FFFF00', '#FF6D00', '#FF1744'];

const RouteMap = React.memo(function RouteMap({
  currentLocation,
  routeCoordinates,
  gpsReady,
  heading,
  isPaused,
}: {
  currentLocation: LatLng | null;
  routeCoordinates: LatLng[];
  gpsReady: boolean;
  heading: number | null;
  isPaused: boolean;
}) {
  const mapRef = useRef<MapView>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // 히트맵 포인트: 10개 단위로만 재계산 (매 GPS 업데이트마다 재렌더 방지)
  const heatmapUpdateCounter = Math.floor(routeCoordinates.length / 10);
  const heatmapPoints = useMemo(
    () => routeCoordinates.map((p) => ({ latitude: p.latitude, longitude: p.longitude, weight: 1 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heatmapUpdateCounter, showHeatmap],
  );

  useEffect(() => {
    if (currentLocation && isFollowing && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        600,
      );
    }
  }, [currentLocation, isFollowing]);

  const hasEnoughData = routeCoordinates.length >= 20;

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={
          currentLocation
            ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.003,
                longitudeDelta: 0.003,
              }
            : undefined
        }
        onPanDrag={() => setIsFollowing(false)}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
      >
        {/* 활동 히트맵 */}
        {showHeatmap && hasEnoughData && (
          <Heatmap
            points={heatmapPoints}
            radius={28}
            opacity={0.75}
            gradient={HEATMAP_GRADIENT}
          />
        )}

        {/* 이동 경로 (히트맵 켜면 반투명) */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={
              showHeatmap
                ? `${Colors.primary}44`
                : isPaused
                ? Colors.warning
                : Colors.primary
            }
            strokeWidth={showHeatmap ? 2 : 4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* 현재 위치 + 방향 마커 */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={heading !== null}
            flat
          >
            <View
              style={[
                styles.directionMarker,
                heading !== null && { transform: [{ rotate: `${heading}deg` }] },
              ]}
            >
              {/* 방향 화살표 (삼각형) */}
              <View
                style={[
                  styles.directionArrow,
                  { borderBottomColor: isPaused ? Colors.warning : Colors.primary },
                ]}
              />
              {/* 중심 원 */}
              <View
                style={[
                  styles.directionDot,
                  { backgroundColor: isPaused ? Colors.warning : Colors.primary },
                ]}
              />
            </View>
          </Marker>
        )}
      </MapView>

      {/* GPS 신호 없을 때 오버레이 */}
      {!gpsReady && (
        <View style={styles.noGpsOverlay}>
          <Text style={styles.noGpsText}>📡 GPS 신호 잡는 중...</Text>
        </View>
      )}

      {/* 히트맵 토글 버튼 */}
      {hasEnoughData && (
        <TouchableOpacity
          style={[styles.heatmapBtn, showHeatmap && styles.heatmapBtnActive]}
          onPress={() => setShowHeatmap((v) => !v)}
          activeOpacity={0.8}
        >
          <Text style={styles.heatmapBtnText}>🔥</Text>
        </TouchableOpacity>
      )}

      {/* 히트맵 범례 */}
      {showHeatmap && hasEnoughData && (
        <View style={styles.legendContainer}>
          <Text style={styles.legendLabel}>낮음</Text>
          <View style={styles.legendBar}>
            {LEGEND_COLORS.map((color) => (
              <View key={color} style={[styles.legendSegment, { backgroundColor: color }]} />
            ))}
          </View>
          <Text style={styles.legendLabel}>높음</Text>
        </View>
      )}

      {/* 현재 위치로 재이동 버튼 */}
      {!isFollowing && currentLocation && (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={() => setIsFollowing(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.recenterText}>📍</Text>
        </TouchableOpacity>
      )}

    </View>
  );
});

function StatItem({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Save Modal ───────────────────────────────────────────────────────────────

function SaveModal({
  visible,
  finalData,
  sport,
  sessionType,
  notes,
  isSaving,
  sprintCount,
  onNotesChange,
  onSave,
  onDiscard,
}: {
  visible: boolean;
  finalData: FinalTrackingData | null;
  sport: Sport;
  sessionType: SessionType;
  notes: string;
  isSaving: boolean;
  sprintCount: number;
  onNotesChange: (text: string) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!finalData) return null;

  const dur = finalData.durationSeconds;
  const dist = finalData.distanceMeters;
  const avgSpeedKph = dur > 0 ? (dist / 1000) / (dur / 3600) : 0;
  const pace = avgSpeedKph > 0 ? 60 / avgSpeedKph : null;
  const sportInfo = SPORT_INFO[sport];
  const typeInfo = TYPE_INFO[sessionType];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>세션 완료</Text>

            <View style={styles.sessionBadgeRow}>
              <View style={[styles.sessionBadge, { borderColor: sportInfo.color }]}>
                <Text style={styles.sessionBadgeText}>{sportInfo.emoji} {sportInfo.label}</Text>
              </View>
              <View style={[styles.sessionBadge, { borderColor: typeInfo.color }]}>
                <Text style={styles.sessionBadgeText}>{typeInfo.emoji} {typeInfo.label}</Text>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <SummaryStat label="활동 시간" value={formatDuration(dur)} />
              <SummaryStat label="이동 거리" value={`${formatDistanceKm(dist)} km`} />
              <SummaryStat label="평균 속도" value={`${avgSpeedKph.toFixed(1)} km/h`} />
              <SummaryStat label="최고 속도" value={`${finalData.maxSpeedKph.toFixed(1)} km/h`} />
              <SummaryStat label="페이스" value={formatPace(pace)} />
              <SummaryStat label="⚡ 스프린트" value={`${sprintCount}회`} />
            </View>

            <Text style={styles.notesLabel}>메모</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="오늘 경기 느낀 점... (선택 사항)"
              placeholderTextColor={Colors.textDisabled}
              value={notes}
              onChangeText={onNotesChange}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
              onPress={onSave}
              activeOpacity={0.85}
              disabled={isSaving}
            >
              <Text style={styles.saveBtnText}>{isSaving ? '저장 중...' : '저장하기'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.discardBtn} onPress={onDiscard} activeOpacity={0.7}>
              <Text style={styles.discardBtnText}>삭제하기</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerTitle: { ...Typography.headline, color: Colors.textPrimary },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.danger}22`,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: 6,
  },
  badgePaused: { backgroundColor: `${Colors.warning}22` },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger },
  badgeDotPaused: { backgroundColor: Colors.warning },
  badgeText: { ...Typography.label, color: Colors.danger },
  badgeTextPaused: { color: Colors.warning },

  content: { flex: 1 },

  // ── Idle ──
  idleContainer: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  selectorLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.sm },
  chipRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { ...Typography.bodyMedium, color: Colors.textSecondary },
  gpsStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { ...Typography.caption, color: Colors.textSecondary },
  startButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  startButtonText: { ...Typography.title, color: Colors.textInverse },

  // ── Active ──
  activeContainer: { flex: 1 },

  // ── Map ──
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },

  // 방향 포함 위치 마커
  directionMarker: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionArrow: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Colors.primary,  // 동적으로 덮어씌움
  },
  directionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,   // 동적으로 덮어씌움
    borderWidth: 2,
    borderColor: Colors.background,
  },

  noGpsOverlay: {
    position: 'absolute',
    top: Spacing.md,
    alignSelf: 'center',
    backgroundColor: `${Colors.background}CC`,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  noGpsText: { ...Typography.caption, color: Colors.warning },

  recenterBtn: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recenterText: { fontSize: 20 },

  // ── Heatmap ──
  heatmapBtn: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heatmapBtnActive: {
    backgroundColor: `${Colors.warning}33`,
    borderColor: Colors.warning,
  },
  heatmapBtnText: { fontSize: 20 },

  legendContainer: {
    position: 'absolute',
    bottom: Spacing.md + 52,   // 히트맵 버튼 위
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: `${Colors.surface}CC`,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  legendBar: {
    flexDirection: 'row',
    borderRadius: 3,
    overflow: 'hidden',
  },
  legendSegment: {
    width: 16,
    height: 8,
  },


  // ── Bottom Panel ──
  bottomPanel: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  // ── Sprint ──
  sprintBanner: {
    position: 'absolute',
    top: Spacing.xl,
    alignSelf: 'center',
    backgroundColor: '#FF6B0088',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: '#FF6B00',
    zIndex: 10,
  },
  sprintBannerText: { ...Typography.titleSmall, color: '#FF6B00', fontWeight: '800' },
  sprintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B0022',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FF6B00',
    marginRight: Spacing.sm,
  },
  sprintBadgeText: { ...Typography.caption, color: '#FF6B00', fontWeight: '700' },

  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  timerLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 2 },
  timerValue: { ...Typography.stat, color: Colors.primary },
  timerValuePaused: { color: Colors.warning },
  rightIndicators: { flexDirection: 'row', alignItems: 'center' },
  gpsIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  gpsIndicatorText: { ...Typography.caption },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  statValue: { ...Typography.bodyMedium, color: Colors.textPrimary, fontWeight: '700' },
  statUnit: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 1 },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  controls: { flexDirection: 'row', gap: Spacing.md },
  stopBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
  },
  stopBtnText: { ...Typography.titleSmall, color: Colors.danger },
  pauseBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
  },
  pauseBtnText: { ...Typography.titleSmall, color: Colors.textPrimary },
  resumeBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  resumeBtnText: { ...Typography.titleSmall, color: Colors.textInverse },

  // ── Save Modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  sessionBadgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  sessionBadge: {
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  sessionBadgeText: { ...Typography.bodyMedium, color: Colors.textPrimary },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  summaryStat: {
    width: '30%',
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  summaryStatValue: { ...Typography.statSmall, color: Colors.textPrimary, marginBottom: 2 },
  summaryStatLabel: { ...Typography.caption, color: Colors.textSecondary },
  notesLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.sm },
  notesInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
    minHeight: 80,
    marginBottom: Spacing.xl,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...Typography.title, color: Colors.textInverse },
  discardBtn: { paddingVertical: Spacing.md, alignItems: 'center' },
  discardBtnText: { ...Typography.bodyMedium, color: Colors.danger },
});
