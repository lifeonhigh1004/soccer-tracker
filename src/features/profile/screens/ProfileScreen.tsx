import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing, Radius } from '../../../core/theme/spacing';
import { Sport, SessionType } from '../../../core/types/session';
import type { SessionSummary } from '../../../core/types/session';
import { loadSessions } from '../../../shared/services/storageService';
import {
  loadProfile, saveProfile,
  PlayerProfile, DEFAULT_PROFILE, PreferredFoot,
} from '../../../shared/services/profileService';
import { formatDuration, formatDistanceKm } from '../../../shared/utils/formatters';

// ── 포지션 정의 ──────────────────────────────────────────────────────────────

const POSITIONS: { key: string; label: string; desc: string }[] = [
  { key: 'GK',  label: 'GK',  desc: '골키퍼' },
  { key: 'CB',  label: 'CB',  desc: '센터백' },
  { key: 'LB',  label: 'LB',  desc: '왼쪽 풀백' },
  { key: 'RB',  label: 'RB',  desc: '오른쪽 풀백' },
  { key: 'CDM', label: 'CDM', desc: '수비형 미드' },
  { key: 'CM',  label: 'CM',  desc: '중앙 미드' },
  { key: 'CAM', label: 'CAM', desc: '공격형 미드' },
  { key: 'LW',  label: 'LW',  desc: '왼쪽 윙' },
  { key: 'RW',  label: 'RW',  desc: '오른쪽 윙' },
  { key: 'CF',  label: 'CF',  desc: '센터포워드' },
  { key: 'ST',  label: 'ST',  desc: '스트라이커' },
];

const WEEKLY_GOAL_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];
const DISTANCE_GOAL_OPTIONS = [0, 5, 10, 15, 20, 30, 40, 50];

// ── 통계 계산 ─────────────────────────────────────────────────────────────────

interface ComputedStats {
  totalSessions: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  allTimeMaxSpeedKph: number;
  matchCount: number;
  trainingCount: number;
  thisWeekSessions: number;
  thisWeekDistanceKm: number;
}

function computeStats(sessions: SessionSummary[]): ComputedStats {
  const now = Date.now();
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;

  return sessions.reduce<ComputedStats>(
    (acc, s) => {
      acc.totalSessions += 1;
      acc.totalDistanceKm += s.distanceMeters / 1000;
      acc.totalDurationSeconds += s.activeDurationSeconds;
      acc.allTimeMaxSpeedKph = Math.max(acc.allTimeMaxSpeedKph, s.maxSpeedKph);
      if (s.type === SessionType.Match) acc.matchCount += 1;
      else acc.trainingCount += 1;
      if (s.startedAt >= weekStart) {
        acc.thisWeekSessions += 1;
        acc.thisWeekDistanceKm += s.distanceMeters / 1000;
      }
      return acc;
    },
    {
      totalSessions: 0,
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
      allTimeMaxSpeedKph: 0,
      matchCount: 0,
      trainingCount: 0,
      thisWeekSessions: 0,
      thisWeekDistanceKm: 0,
    },
  );
}

// ── 메인 화면 ────────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const [profile, setProfile] = useState<PlayerProfile>({ ...DEFAULT_PROFILE });
  const [stats, setStats] = useState<ComputedStats | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [goalVisible, setGoalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([loadProfile(), loadSessions()]).then(([p, sessions]) => {
        setProfile(p);
        setStats(computeStats(sessions));
      });
    }, []),
  );

  const handleSaveProfile = async (updated: PlayerProfile) => {
    await saveProfile(updated);
    setProfile(updated);
    setEditVisible(false);
  };

  const handleSaveGoal = async (sessions: number, distanceKm: number) => {
    const updated = { ...profile, weeklyGoalSessions: sessions, weeklyGoalDistanceKm: distanceKm };
    await saveProfile(updated);
    setProfile(updated);
    setGoalVisible(false);
  };

  const positionInfo = POSITIONS.find((p) => p.key === profile.position);
  const footLabel =
    profile.preferredFoot === 'left' ? '왼발잡이'
    : profile.preferredFoot === 'both' ? '양발잡이'
    : '오른발잡이';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>프로필</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditVisible(true)} activeOpacity={0.7}>
            <Text style={styles.editBtnText}>편집</Text>
          </TouchableOpacity>
        </View>

        {/* 프로필 카드 */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => setEditVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.name ? profile.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {profile.name || '이름을 설정해주세요'}
            </Text>
            <View style={styles.tagRow}>
              {positionInfo ? (
                <View style={[styles.tag, { borderColor: Colors.primary }]}>
                  <Text style={[styles.tagText, { color: Colors.primary }]}>
                    {positionInfo.label} · {positionInfo.desc}
                  </Text>
                </View>
              ) : (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>포지션 미설정</Text>
                </View>
              )}
              <View style={styles.tag}>
                <Text style={styles.tagText}>{footLabel}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* 주간 목표 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>주간 목표</Text>
          <TouchableOpacity onPress={() => setGoalVisible(true)} activeOpacity={0.7}>
            <Text style={styles.sectionAction}>설정</Text>
          </TouchableOpacity>
        </View>
        <WeeklyGoalCard
          profile={profile}
          stats={stats}
          onPress={() => setGoalVisible(true)}
        />

        {/* 누적 통계 */}
        <Text style={[styles.sectionTitle, { marginBottom: Spacing.md }]}>누적 통계</Text>
        <View style={styles.statsGrid}>
          <StatCard
            emoji="📅"
            label="총 세션"
            value={`${stats?.totalSessions ?? 0}회`}
          />
          <StatCard
            emoji="📍"
            label="총 거리"
            value={`${formatDistanceKm(( stats?.totalDistanceKm ?? 0) * 1000)} km`}
          />
          <StatCard
            emoji="⏱️"
            label="총 시간"
            value={formatTotalTime(stats?.totalDurationSeconds ?? 0)}
          />
          <StatCard
            emoji="⚡"
            label="최고 속도"
            value={`${(stats?.allTimeMaxSpeedKph ?? 0).toFixed(1)} km/h`}
            highlight
          />
          <StatCard
            emoji="🏆"
            label="경기"
            value={`${stats?.matchCount ?? 0}회`}
          />
          <StatCard
            emoji="🏃"
            label="훈련"
            value={`${stats?.trainingCount ?? 0}회`}
          />
        </View>
      </ScrollView>

      {/* 편집 모달 */}
      <EditProfileModal
        visible={editVisible}
        profile={profile}
        onSave={handleSaveProfile}
        onClose={() => setEditVisible(false)}
      />

      {/* 주간 목표 모달 */}
      <GoalModal
        visible={goalVisible}
        profile={profile}
        onSave={handleSaveGoal}
        onClose={() => setGoalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── 주간 목표 카드 ────────────────────────────────────────────────────────────

function WeeklyGoalCard({
  profile,
  stats,
  onPress,
}: {
  profile: PlayerProfile;
  stats: ComputedStats | null;
  onPress: () => void;
}) {
  const hasGoal = profile.weeklyGoalSessions > 0 || profile.weeklyGoalDistanceKm > 0;

  if (!hasGoal) {
    return (
      <TouchableOpacity style={styles.goalEmpty} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.goalEmptyText}>+ 주간 목표를 설정해보세요</Text>
        <Text style={styles.goalEmptySubtext}>세션 횟수 또는 목표 거리를 설정할 수 있어요</Text>
      </TouchableOpacity>
    );
  }

  const weekSessions = stats?.thisWeekSessions ?? 0;
  const weekDistKm = stats?.thisWeekDistanceKm ?? 0;

  return (
    <TouchableOpacity style={styles.goalCard} onPress={onPress} activeOpacity={0.85}>
      {profile.weeklyGoalSessions > 0 && (
        <GoalRow
          label="세션"
          current={weekSessions}
          goal={profile.weeklyGoalSessions}
          unit="회"
          color={Colors.primary}
        />
      )}
      {profile.weeklyGoalDistanceKm > 0 && (
        <GoalRow
          label="거리"
          current={parseFloat(weekDistKm.toFixed(1))}
          goal={profile.weeklyGoalDistanceKm}
          unit="km"
          color={Colors.training}
        />
      )}
    </TouchableOpacity>
  );
}

function GoalRow({
  label, current, goal, unit, color,
}: {
  label: string; current: number; goal: number; unit: string; color: string;
}) {
  const progress = Math.min(current / goal, 1);
  const done = current >= goal;

  return (
    <View style={styles.goalRow}>
      <View style={styles.goalRowHeader}>
        <Text style={styles.goalLabel}>{label}</Text>
        <Text style={[styles.goalValue, done && { color }]}>
          {current}{unit} / {goal}{unit}
          {done ? '  ✓' : ''}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, backgroundColor: done ? color : `${color}99` },
          ]}
        />
      </View>
    </View>
  );
}

// ── 통계 카드 ─────────────────────────────────────────────────────────────────

function StatCard({
  emoji, label, value, highlight = false,
}: {
  emoji: string; label: string; value: string; highlight?: boolean;
}) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statCardEmoji}>{emoji}</Text>
      <Text style={[styles.statCardValue, highlight && { color: Colors.primary }]}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </View>
  );
}

// ── 편집 모달 ─────────────────────────────────────────────────────────────────

function EditProfileModal({
  visible, profile, onSave, onClose,
}: {
  visible: boolean;
  profile: PlayerProfile;
  onSave: (p: PlayerProfile) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [position, setPosition] = useState(profile.position);
  const [foot, setFoot] = useState<PreferredFoot>(profile.preferredFoot);

  // 열릴 때마다 현재 값으로 초기화
  React.useEffect(() => {
    if (visible) {
      setName(profile.name);
      setPosition(profile.position);
      setFoot(profile.preferredFoot);
    }
  }, [visible, profile]);

  const handleSave = () => {
    onSave({ ...profile, name: name.trim(), position, preferredFoot: foot });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>프로필 편집</Text>

            {/* 이름 */}
            <Text style={styles.fieldLabel}>이름</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="이름 또는 닉네임"
              placeholderTextColor={Colors.textDisabled}
              maxLength={20}
              returnKeyType="done"
            />

            {/* 포지션 */}
            <Text style={styles.fieldLabel}>포지션</Text>
            <View style={styles.positionGrid}>
              {POSITIONS.map((p) => {
                const active = position === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.positionChip, active && styles.positionChipActive]}
                    onPress={() => setPosition(active ? '' : p.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.positionKey, active && styles.positionKeyActive]}>
                      {p.label}
                    </Text>
                    <Text style={[styles.positionDesc, active && styles.positionDescActive]}>
                      {p.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 주발 */}
            <Text style={styles.fieldLabel}>주발</Text>
            <View style={styles.footRow}>
              {(['right', 'left', 'both'] as PreferredFoot[]).map((f) => {
                const label = f === 'right' ? '오른발' : f === 'left' ? '왼발' : '양발';
                const active = foot === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.footChip, active && styles.footChipActive]}
                    onPress={() => setFoot(f)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.footChipText, active && styles.footChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>저장하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── 주간 목표 모달 ────────────────────────────────────────────────────────────

function GoalModal({
  visible, profile, onSave, onClose,
}: {
  visible: boolean;
  profile: PlayerProfile;
  onSave: (sessions: number, distanceKm: number) => void;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState(profile.weeklyGoalSessions);
  const [distanceKm, setDistanceKm] = useState(profile.weeklyGoalDistanceKm);

  React.useEffect(() => {
    if (visible) {
      setSessions(profile.weeklyGoalSessions);
      setDistanceKm(profile.weeklyGoalDistanceKm);
    }
  }, [visible, profile]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>주간 목표 설정</Text>

          {/* 세션 횟수 목표 */}
          <Text style={styles.fieldLabel}>주간 세션 횟수</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionScroll}>
            <View style={styles.optionRow}>
              {WEEKLY_GOAL_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.optionChip, sessions === n && styles.optionChipActive]}
                  onPress={() => setSessions(n)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionChipText, sessions === n && styles.optionChipTextActive]}>
                    {n === 0 ? '없음' : `${n}회`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* 거리 목표 */}
          <Text style={styles.fieldLabel}>주간 목표 거리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionScroll}>
            <View style={styles.optionRow}>
              {DISTANCE_GOAL_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.optionChip, distanceKm === n && styles.optionChipActive]}
                  onPress={() => setDistanceKm(n)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionChipText, distanceKm === n && styles.optionChipTextActive]}>
                    {n === 0 ? '없음' : `${n} km`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: Spacing.xl }]}
            onPress={() => onSave(sessions, distanceKm)}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>저장하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function formatTotalTime(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

// ── 스타일 ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.giant },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.sm,
  },
  headerTitle: { ...Typography.headline, color: Colors.textPrimary },
  editBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editBtnText: { ...Typography.bodyMedium, color: Colors.textSecondary },

  // 프로필 카드
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  profileInfo: { flex: 1 },
  profileName: { ...Typography.title, color: Colors.textPrimary, marginBottom: Spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  tagText: { ...Typography.caption, color: Colors.textSecondary },

  // 섹션
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: { ...Typography.titleSmall, color: Colors.textPrimary },
  sectionAction: { ...Typography.bodyMedium, color: Colors.primary },

  // 주간 목표 카드
  goalEmpty: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  goalEmptyText: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: 4 },
  goalEmptySubtext: { ...Typography.caption, color: Colors.textDisabled, textAlign: 'center' },

  goalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  goalRow: { gap: Spacing.xs },
  goalRowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  goalLabel: { ...Typography.bodyMedium, color: Colors.textSecondary },
  goalValue: { ...Typography.bodyMedium, color: Colors.textPrimary, fontWeight: '600' },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },

  // 통계 그리드
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    width: '31%',
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    minWidth: 90,
  },
  statCardHighlight: { borderColor: `${Colors.primary}55` },
  statCardEmoji: { fontSize: 20, marginBottom: Spacing.xs },
  statCardValue: { ...Typography.bodyMedium, color: Colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  statCardLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },

  // 모달 공통
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: Spacing.giant,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 40, height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },

  // 텍스트 입력
  textInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },

  // 포지션 그리드
  positionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  positionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    minWidth: 64,
  },
  positionChipActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}18`,
  },
  positionKey: { ...Typography.bodyMedium, color: Colors.textSecondary, fontWeight: '700' },
  positionKeyActive: { color: Colors.primary },
  positionDesc: { ...Typography.caption, color: Colors.textDisabled, fontSize: 10 },
  positionDescActive: { color: `${Colors.primary}AA` },

  // 주발 선택
  footRow: { flexDirection: 'row', gap: Spacing.sm },
  footChip: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
  },
  footChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}18` },
  footChipText: { ...Typography.bodyMedium, color: Colors.textSecondary },
  footChipTextActive: { color: Colors.primary, fontWeight: '600' },

  // 목표 옵션
  optionScroll: { marginBottom: Spacing.sm },
  optionRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 4 },
  optionChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  optionChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}18` },
  optionChipText: { ...Typography.bodyMedium, color: Colors.textSecondary },
  optionChipTextActive: { color: Colors.primary, fontWeight: '600' },

  // 버튼
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  saveBtnText: { ...Typography.title, color: Colors.textInverse },
  cancelBtn: { paddingVertical: Spacing.md, alignItems: 'center' },
  cancelBtnText: { ...Typography.bodyMedium, color: Colors.textSecondary },
});
