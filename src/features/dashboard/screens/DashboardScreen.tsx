import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing, Radius } from '../../../core/theme/spacing';
import { Sport, SessionType } from '../../../core/types/session';
import type { SessionSummary } from '../../../core/types/session';
import type { DashboardNavProp } from '../../../core/navigation/types';
import { loadSessions } from '../../../shared/services/storageService';
import {
  formatDuration,
  formatDistanceKm,
  formatRelativeDate,
  formatPace,
} from '../../../shared/utils/formatters';

interface WeeklyStats {
  sessionCount: number;
  totalDistanceM: number;
  totalActiveSeconds: number;
}

function getWeeklyStats(sessions: SessionSummary[]): WeeklyStats {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekly = sessions.filter((s) => s.startedAt >= weekAgo);
  return {
    sessionCount: weekly.length,
    totalDistanceM: weekly.reduce((sum, s) => sum + s.distanceMeters, 0),
    totalActiveSeconds: weekly.reduce((sum, s) => sum + s.activeDurationSeconds, 0),
  };
}

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNavProp>();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSessions().then(setSessions);
    }, []),
  );

  const weekly = getWeeklyStats(sessions);
  const recentSessions = sessions.slice(0, 3);

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
          <View>
            <Text style={styles.greeting}>안녕하세요 👋</Text>
            <Text style={styles.headerTitle}>오늘도 뛰어볼까요?</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>⚽</Text>
          </View>
        </View>

        {/* 이번 주 요약 */}
        <View style={styles.weeklyCard}>
          <Text style={styles.cardLabel}>이번 주</Text>
          <View style={styles.statsRow}>
            <StatItem value={String(weekly.sessionCount)} unit="회" label="세션" />
            <StatDivider />
            <StatItem
              value={formatDistanceKm(weekly.totalDistanceM)}
              unit="km"
              label="총 거리"
            />
            <StatDivider />
            <StatItem
              value={String(Math.floor(weekly.totalActiveSeconds / 60))}
              unit="분"
              label="활동 시간"
            />
          </View>
        </View>

        {/* 빠른 시작 */}
        <Text style={styles.sectionTitle}>빠른 시작</Text>
        <View style={styles.quickStartRow}>
          <QuickStartCard
            emoji="⚽"
            title="축구 경기"
            subtitle="경기 기록 시작"
            color={Colors.match}
            onPress={() => navigation.navigate('Tracking')}
          />
          <QuickStartCard
            emoji="🏃"
            title="훈련"
            subtitle="훈련 기록 시작"
            color={Colors.training}
            onPress={() => navigation.navigate('Tracking')}
          />
        </View>
        <View style={[styles.quickStartRow, { marginBottom: Spacing.xxl }]}>
          <QuickStartCard
            emoji="🏟️"
            title="풋살 경기"
            subtitle="풋살 기록 시작"
            color={Colors.futsal}
            onPress={() => navigation.navigate('Tracking')}
          />
          <View style={styles.quickStartEmpty} />
        </View>

        {/* 최근 세션 */}
        <Text style={styles.sectionTitle}>최근 세션</Text>
        {recentSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>아직 기록된 세션이 없어요</Text>
            <Text style={styles.emptySubtext}>트래킹 탭에서 첫 세션을 시작해보세요!</Text>
          </View>
        ) : (
          <>
            {recentSessions.map((session) => (
              <RecentSessionRow key={session.id} session={session} />
            ))}
            {sessions.length > 3 && (
              <TouchableOpacity
                style={styles.seeAllBtn}
                onPress={() => navigation.navigate('History')}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>전체 기록 보기 →</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub Components ───────────────────────────────────────────────────────────

function RecentSessionRow({ session }: { session: SessionSummary }) {
  const isMatch = session.type === SessionType.Match;
  const isSoccer = session.sport === Sport.Soccer;
  const color = isMatch ? Colors.match : Colors.training;
  const emoji = isSoccer ? '⚽' : '🏟️';
  const typeLabel = isMatch ? '경기' : '훈련';

  return (
    <View style={styles.recentRow}>
      <View style={[styles.recentIcon, { backgroundColor: `${color}22` }]}>
        <Text style={styles.recentIconText}>{emoji}</Text>
      </View>
      <View style={styles.recentInfo}>
        <Text style={styles.recentTitle}>
          {isSoccer ? '축구' : '풋살'} {typeLabel}
        </Text>
        <Text style={styles.recentMeta}>
          {formatRelativeDate(session.startedAt)} · {formatDuration(session.activeDurationSeconds)}
        </Text>
      </View>
      <View style={styles.recentStats}>
        <Text style={styles.recentDist}>{formatDistanceKm(session.distanceMeters)} km</Text>
        <Text style={styles.recentSpeed}>{session.avgSpeedKph.toFixed(1)} km/h</Text>
      </View>
    </View>
  );
}

function StatItem({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statUnit}>{unit}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatDivider() {
  return <View style={styles.statDivider} />;
}

function QuickStartCard({
  emoji,
  title,
  subtitle,
  color,
  onPress,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.quickStartCard, { borderLeftColor: color }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.quickStartEmoji}>{emoji}</Text>
      <Text style={styles.quickStartTitle}>{title}</Text>
      <Text style={styles.quickStartSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    marginTop: Spacing.sm,
  },
  greeting: { ...Typography.body, color: Colors.textSecondary, marginBottom: 2 },
  headerTitle: { ...Typography.headline, color: Colors.textPrimary },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 22 },

  weeklyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.xl,
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.lg },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  statValue: { ...Typography.stat, color: Colors.textPrimary },
  statUnit: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: 4 },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.border, marginHorizontal: Spacing.sm },

  sectionTitle: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  quickStartRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  quickStartCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
  },
  quickStartEmpty: { flex: 1 },
  quickStartEmoji: { fontSize: 24, marginBottom: Spacing.sm },
  quickStartTitle: { ...Typography.bodyMedium, color: Colors.textPrimary, marginBottom: 2 },
  quickStartSubtitle: { ...Typography.caption, color: Colors.textSecondary },

  // Recent
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  recentIconText: { fontSize: 20 },
  recentInfo: { flex: 1 },
  recentTitle: { ...Typography.bodyMedium, color: Colors.textPrimary },
  recentMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  recentStats: { alignItems: 'flex-end' },
  recentDist: { ...Typography.bodyMedium, color: Colors.textPrimary },
  recentSpeed: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  seeAllBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  seeAllText: { ...Typography.bodyMedium, color: Colors.primary },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxxl },
  emptyEmoji: { fontSize: 40, marginBottom: Spacing.md },
  emptyText: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: Spacing.sm },
  emptySubtext: { ...Typography.caption, color: Colors.textDisabled, textAlign: 'center' },
});
