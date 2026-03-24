import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { HistoryListNavProp } from '../../../core/navigation/types';

import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing, Radius } from '../../../core/theme/spacing';
import { Sport, SessionType } from '../../../core/types/session';
import type { SessionSummary } from '../../../core/types/session';
import { loadSessions, deleteSession } from '../../../shared/services/storageService';
import {
  formatDuration,
  formatDistanceKm,
  formatPace,
  formatFullDate,
  formatRelativeDate,
} from '../../../shared/utils/formatters';

type FilterType = 'all' | Sport | SessionType;

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: Sport.Soccer, label: '⚽ 축구' },
  { key: Sport.Futsal, label: '🏟️ 풋살' },
  { key: SessionType.Match, label: '🏆 경기' },
  { key: SessionType.Training, label: '🏃 훈련' },
];

const SPORT_COLOR: Record<Sport, string> = {
  [Sport.Soccer]: Colors.soccer,
  [Sport.Futsal]: Colors.futsal,
};

const TYPE_COLOR: Record<SessionType, string> = {
  [SessionType.Match]: Colors.match,
  [SessionType.Training]: Colors.training,
};

export function HistoryScreen() {
  const navigation = useNavigation<HistoryListNavProp>();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
    }, []),
  );

  const filtered = sessions.filter((s) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === Sport.Soccer || activeFilter === Sport.Futsal) {
      return s.sport === activeFilter;
    }
    return s.type === activeFilter;
  });

  const handleDelete = (id: string) => {
    Alert.alert('세션 삭제', '이 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteSession(id);
          setSessions((prev) => prev.filter((s) => s.id !== id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기록</Text>
        <Text style={styles.headerCount}>{sessions.length}개</Text>
      </View>

      {/* 필터 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={String(f.key)}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 세션 목록 */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, filtered.length === 0 && styles.scrollEmpty]}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <EmptyState hasData={sessions.length > 0} />
        ) : (
          filtered.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onPress={() => navigation.navigate('SessionDetail', { session })}
              onDelete={() => handleDelete(session.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onPress,
  onDelete,
}: {
  session: SessionSummary;
  onPress: () => void;
  onDelete: () => void;
}) {
  const sportColor = SPORT_COLOR[session.sport];
  const typeColor = TYPE_COLOR[session.type];

  const sportLabel = session.sport === Sport.Soccer ? '축구' : '풋살';
  const typeLabel = session.type === SessionType.Match ? '경기' : '훈련';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onDelete}
      activeOpacity={0.85}
      delayLongPress={500}
    >
      {/* 카드 상단 */}
      <View style={styles.cardTop}>
        <View style={styles.cardBadgeRow}>
          <View style={[styles.cardBadge, { borderColor: sportColor }]}>
            <Text style={[styles.cardBadgeText, { color: sportColor }]}>{sportLabel}</Text>
          </View>
          <View style={[styles.cardBadge, { borderColor: typeColor }]}>
            <Text style={[styles.cardBadgeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
        </View>
        <Text style={styles.cardDate}>{formatRelativeDate(session.startedAt)}</Text>
      </View>

      {/* 시간 */}
      <Text style={styles.cardDuration}>{formatDuration(session.activeDurationSeconds)}</Text>

      {/* 스탯 행 */}
      <View style={styles.cardStats}>
        <CardStat
          value={`${formatDistanceKm(session.distanceMeters)} km`}
          label="거리"
        />
        <View style={styles.cardStatDivider} />
        <CardStat
          value={`${session.avgSpeedKph.toFixed(1)} km/h`}
          label="평균 속도"
        />
        <View style={styles.cardStatDivider} />
        <CardStat
          value={`${session.maxSpeedKph.toFixed(1)} km/h`}
          label="최고 속도"
        />
        <View style={styles.cardStatDivider} />
        <CardStat
          value={formatPace(session.pace)}
          label="페이스"
        />
      </View>

      {/* 날짜 */}
      <Text style={styles.cardFullDate}>{formatFullDate(session.startedAt)}</Text>

      {/* 메모 */}
      {session.notes ? (
        <Text style={styles.cardNotes} numberOfLines={2}>{session.notes}</Text>
      ) : null}

    </TouchableOpacity>
  );
}

function CardStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.cardStat}>
      <Text style={styles.cardStatValue}>{value}</Text>
      <Text style={styles.cardStatLabel}>{label}</Text>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasData }: { hasData: boolean }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🏟️</Text>
      <Text style={styles.emptyTitle}>
        {hasData ? '해당 필터에 기록이 없어요' : '아직 기록이 없어요'}
      </Text>
      <Text style={styles.emptySubtext}>
        {hasData
          ? '다른 필터를 선택해보세요'
          : '트래킹 탭에서 첫 세션을 시작하면\n여기에 기록이 쌓여요!'}
      </Text>
    </View>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerTitle: { ...Typography.headline, color: Colors.textPrimary },
  headerCount: { ...Typography.bodyMedium, color: Colors.textSecondary },

  filterRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: `${Colors.primary}18`,
    borderColor: Colors.primary,
  },
  filterChipText: { ...Typography.bodyMedium, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.primary },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.md },
  scrollEmpty: { flexGrow: 1 },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardBadgeRow: { flexDirection: 'row', gap: Spacing.xs },
  cardBadge: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  cardBadgeText: { ...Typography.caption, fontWeight: '600' },
  cardDate: { ...Typography.caption, color: Colors.textSecondary },

  cardDuration: {
    ...Typography.stat,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardStat: { flex: 1, alignItems: 'center' },
  cardStatDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  cardStatValue: { ...Typography.bodyMedium, color: Colors.textPrimary },
  cardStatLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  cardFullDate: { ...Typography.caption, color: Colors.textDisabled, marginBottom: 4 },
  cardNotes: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  cardHint: {
    ...Typography.caption,
    color: Colors.textDisabled,
    textAlign: 'right',
    marginTop: Spacing.xs,
    fontSize: 10,
  },

  // Empty
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyEmoji: { fontSize: 56, marginBottom: Spacing.lg },
  emptyTitle: { ...Typography.title, color: Colors.textSecondary, marginBottom: Spacing.sm },
  emptySubtext: {
    ...Typography.body,
    color: Colors.textDisabled,
    textAlign: 'center',
    lineHeight: 20,
  },
});
