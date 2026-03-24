import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';

import { Colors } from '../../../core/theme/colors';
import { Typography } from '../../../core/theme/typography';
import { Spacing, Radius } from '../../../core/theme/spacing';

export function ProfileScreen() {
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
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>편집</Text>
          </TouchableOpacity>
        </View>

        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <Text style={styles.avatarEmoji}>⚽</Text>
          </View>
          <Text style={styles.playerName}>이름을 설정해주세요</Text>
          <View style={styles.tagRow}>
            <Tag label="포지션 미설정" />
            <Tag label="오른발잡이" />
          </View>
        </View>

        {/* 누적 통계 */}
        <Text style={styles.sectionTitle}>누적 통계</Text>
        <View style={styles.statsGrid}>
          <StatCard emoji="🏃" label="총 세션" value="0회" />
          <StatCard emoji="📍" label="총 거리" value="0.0km" />
          <StatCard emoji="⏱️" label="총 시간" value="0분" />
          <StatCard emoji="🔥" label="소모 칼로리" value="0kcal" />
          <StatCard emoji="⚡" label="최고 속도" value="0.0km/h" />
          <StatCard emoji="🏆" label="경기 횟수" value="0회" />
        </View>

        {/* 설정 섹션 */}
        <Text style={styles.sectionTitle}>설정</Text>
        <View style={styles.settingsGroup}>
          <SettingsRow label="신체 정보" subtitle="키, 몸무게, 생년월일" />
          <SettingsRow label="주간 목표" subtitle="미설정" />
          <SettingsRow label="단위 설정" subtitle="미터법 (km)" />
          <SettingsRow label="알림" subtitle="켜짐" isLast />
        </View>

        {/* 앱 정보 */}
        <Text style={styles.sectionTitle}>앱 정보</Text>
        <View style={styles.settingsGroup}>
          <SettingsRow label="버전" subtitle="1.0.0" />
          <SettingsRow label="개인정보 처리방침" isLast />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── 서브 컴포넌트 ──────────────────────────────────────────────────────────

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statCardEmoji}>{emoji}</Text>
      <Text style={styles.statCardValue}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </View>
  );
}

function SettingsRow({
  label,
  subtitle,
  isLast = false,
}: {
  label: string;
  subtitle?: string;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.settingsRow, !isLast && styles.settingsRowBorder]}
      activeOpacity={0.7}
    >
      <View style={styles.settingsRowLeft}>
        <Text style={styles.settingsRowLabel}>{label}</Text>
        {subtitle && <Text style={styles.settingsRowSubtitle}>{subtitle}</Text>}
      </View>
      <Text style={styles.settingsRowArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── 스타일 ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },

  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    marginTop: Spacing.sm,
  },
  headerTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  editButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButtonText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },

  // 프로필 카드
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarEmoji: {
    fontSize: 36,
  },
  playerName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },

  // 섹션
  sectionTitle: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  // 통계 그리드
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    width: '30.5%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCardEmoji: {
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  statCardValue: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  statCardLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // 설정 그룹
  settingsGroup: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xxl,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingsRowLeft: {
    flex: 1,
  },
  settingsRowLabel: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  settingsRowSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  settingsRowArrow: {
    fontSize: 20,
    color: Colors.textDisabled,
    marginLeft: Spacing.sm,
  },
});
