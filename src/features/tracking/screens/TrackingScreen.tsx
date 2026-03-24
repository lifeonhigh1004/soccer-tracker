import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing, Radius } from '../../../core/theme/spacing';
import { Sport, SessionType, SessionStatus } from '../../../core/types/session';
import type { SessionSummary } from '../../../core/types/session';
import type { TrackingNavProp } from '../../../core/navigation/types';
import { useLocationTracking, FinalTrackingData } from '../../../shared/hooks/useLocationTracking';
import { saveSession } from '../../../shared/services/storageService';
import { calculateBounds } from '../../../shared/utils/geoUtils';
import {
  formatDuration,
  formatDistanceKm,
  formatPace,
} from '../../../shared/utils/formatters';

type ScreenState = 'idle' | 'active' | 'paused' | 'saving';

const SPORT_INFO: Record<Sport, { emoji: string; label: string; color: string }> = {
  [Sport.Soccer]: { emoji: '⚽', label: '축구', color: Colors.soccer },
  [Sport.Futsal]: { emoji: '🏟️', label: '풋살', color: Colors.futsal },
};

const TYPE_INFO: Record<SessionType, { emoji: string; label: string; color: string }> = {
  [SessionType.Match]: { emoji: '🏆', label: '경기', color: Colors.match },
  [SessionType.Training]: { emoji: '🏃', label: '훈련', color: Colors.training },
};

export function TrackingScreen() {
  const navigation = useNavigation<TrackingNavProp>();
  const tracking = useLocationTracking();

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [selectedSport, setSelectedSport] = useState<Sport>(Sport.Soccer);
  const [selectedType, setSelectedType] = useState<SessionType>(SessionType.Training);
  const [notes, setNotes] = useState('');
  const [finalData, setFinalData] = useState<FinalTrackingData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleStart = async () => {
    const success = await tracking.startTracking();
    if (success) {
      setScreenState('active');
    } else {
      Alert.alert(
        '위치 권한 필요',
        '설정에서 위치 권한을 허용해주세요.',
        [{ text: '확인' }],
      );
    }
  };

  const handlePause = () => {
    tracking.pauseTracking();
    setScreenState('paused');
  };

  const handleResume = () => {
    tracking.resumeTracking();
    setScreenState('active');
  };

  const handleStop = () => {
    const data = tracking.stopTracking();
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

      await saveSession(session);
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

  // 실시간 페이스 계산
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
        onNotesChange={setNotes}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </SafeAreaView>
  );
}

// ─── Idle ────────────────────────────────────────────────────────────────────

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
      {/* 스포츠 선택 */}
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

      {/* 세션 타입 선택 */}
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

      {/* GPS 상태 */}
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

      {/* 시작 버튼 */}
      <TouchableOpacity style={styles.startButton} onPress={onStart} activeOpacity={0.85}>
        <Text style={styles.startButtonText}>세션 시작</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Active / Paused ─────────────────────────────────────────────────────────

function ActiveView({
  state,
  durationSeconds,
  distanceMeters,
  currentSpeedKph,
  maxSpeedKph,
  pace,
  gpsReady,
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
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  return (
    <View style={styles.activeContainer}>
      {/* GPS 신호 표시 */}
      {!gpsReady && (
        <View style={styles.gpsWarning}>
          <View style={[styles.gpsDot, { backgroundColor: Colors.warning }]} />
          <Text style={styles.gpsWarningText}>GPS 신호 잡는 중...</Text>
        </View>
      )}

      {/* 타이머 */}
      <View style={styles.timerBlock}>
        <Text style={styles.timerLabel}>활동 시간</Text>
        <Text style={[styles.timerValue, state === 'paused' && styles.timerValuePaused]}>
          {formatDuration(durationSeconds)}
        </Text>
      </View>

      {/* 실시간 스탯 */}
      <View style={styles.statsGrid}>
        <StatCard value={formatDistanceKm(distanceMeters)} unit="km" label="거리" />
        <StatCard value={currentSpeedKph.toFixed(1)} unit="km/h" label="현재 속도" />
        <StatCard value={maxSpeedKph.toFixed(1)} unit="km/h" label="최고 속도" />
        <StatCard value={formatPace(pace)} unit="" label="페이스" />
      </View>

      {/* 지도 플레이스홀더 */}
      <View style={styles.mapArea}>
        <Text style={styles.mapEmoji}>🗺️</Text>
        <Text style={styles.mapText}>경로 지도</Text>
        <Text style={styles.mapSub}>GPS 포인트 {distanceMeters > 0 ? '수집 중' : '대기 중'}</Text>
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
  );
}

function StatCard({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={styles.statCard}>
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

            {/* 세션 타입 뱃지 */}
            <View style={styles.sessionBadgeRow}>
              <View style={[styles.sessionBadge, { borderColor: sportInfo.color }]}>
                <Text style={styles.sessionBadgeText}>
                  {sportInfo.emoji} {sportInfo.label}
                </Text>
              </View>
              <View style={[styles.sessionBadge, { borderColor: typeInfo.color }]}>
                <Text style={styles.sessionBadgeText}>
                  {typeInfo.emoji} {typeInfo.label}
                </Text>
              </View>
            </View>

            {/* 요약 스탯 */}
            <View style={styles.summaryGrid}>
              <SummaryStat label="활동 시간" value={formatDuration(dur)} />
              <SummaryStat label="이동 거리" value={`${formatDistanceKm(dist)} km`} />
              <SummaryStat label="평균 속도" value={`${avgSpeedKph.toFixed(1)} km/h`} />
              <SummaryStat label="최고 속도" value={`${finalData.maxSpeedKph.toFixed(1)} km/h`} />
              <SummaryStat label="페이스" value={formatPace(pace)} />
              <SummaryStat label="GPS 포인트" value={`${finalData.locationPoints.length}개`} />
            </View>

            {/* 메모 입력 */}
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

            {/* 버튼 */}
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
  idleContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  selectorLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
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
  activeContainer: { flex: 1, paddingHorizontal: Spacing.lg },

  gpsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: `${Colors.warning}18`,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  gpsWarningText: { ...Typography.caption, color: Colors.warning },

  timerBlock: { alignItems: 'center', marginBottom: Spacing.xl },
  timerLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  timerValue: { ...Typography.statLarge, color: Colors.primary },
  timerValuePaused: { color: Colors.warning },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 4,
  },
  statValue: { ...Typography.statSmall, color: Colors.textPrimary },
  statUnit: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 3 },
  statLabel: { ...Typography.caption, color: Colors.textSecondary },

  mapArea: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    minHeight: 120,
  },
  mapEmoji: { fontSize: 32, marginBottom: Spacing.sm },
  mapText: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: 4 },
  mapSub: { ...Typography.caption, color: Colors.textDisabled },

  controls: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  stopBtn: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
  },
  stopBtnText: { ...Typography.titleSmall, color: Colors.danger },
  pauseBtn: {
    flex: 2,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
  },
  pauseBtnText: { ...Typography.titleSmall, color: Colors.textPrimary },
  resumeBtn: {
    flex: 2,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  resumeBtnText: { ...Typography.titleSmall, color: Colors.textInverse },

  // ── Save Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.overlay,
  },
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

  notesLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
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

  discardBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  discardBtnText: { ...Typography.bodyMedium, color: Colors.danger },
});
