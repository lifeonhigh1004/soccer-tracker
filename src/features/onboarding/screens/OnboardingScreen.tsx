import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../../core/theme/colors';
import { Spacing, Radius } from '../../../core/theme/spacing';
import { Typography } from '../../../core/theme/typography';
import {
  saveProfile,
  markOnboarded,
  DEFAULT_PROFILE,
  PlayerProfile,
} from '../../../shared/services/profileService';
import { RootStackParamList } from '../../../core/navigation/types';

type OnboardingNavProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Slide data ──────────────────────────────────────────────────────────────

interface Slide {
  id: string;
  emoji: string;
  accentColor: string;
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    emoji: '⚽',
    accentColor: Colors.primary,
    title: 'Soccer Tracker에\n오신 걸 환영합니다',
    subtitle: '경기와 훈련의 모든 순간을\n데이터로 기록하세요',
  },
  {
    id: 'gps',
    emoji: '📍',
    accentColor: Colors.training,
    title: 'GPS로 실시간 추적',
    subtitle: '이동 경로, 속도, 거리를\n정밀하게 기록합니다\n앱을 닫아도 계속 추적돼요',
  },
  {
    id: 'heatmap',
    emoji: '🔥',
    accentColor: Colors.match,
    title: '활동 히트맵',
    subtitle: '자주 뛰는 구역을 색으로 확인해요\n포지션별 활동 패턴을 분석하세요',
  },
  {
    id: 'sprint',
    emoji: '⚡',
    accentColor: Colors.futsal,
    title: '스프린트 감지',
    subtitle: '가속도 센서로 스프린트를\n자동으로 감지합니다\n매 경기 스프린트 횟수를 확인하세요',
  },
];

// ─── Position data ────────────────────────────────────────────────────────────

const POSITIONS = [
  { value: 'GK', label: 'GK', color: Colors.warning },
  { value: 'CB', label: 'CB', color: Colors.training },
  { value: 'LB', label: 'LB', color: Colors.training },
  { value: 'RB', label: 'RB', color: Colors.training },
  { value: 'DM', label: 'DM', color: Colors.primary },
  { value: 'CM', label: 'CM', color: Colors.primary },
  { value: 'AM', label: 'AM', color: Colors.primary },
  { value: 'LW', label: 'LW', color: Colors.match },
  { value: 'RW', label: 'RW', color: Colors.match },
  { value: 'SS', label: 'SS', color: Colors.match },
  { value: 'ST', label: 'ST', color: Colors.danger },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function OnboardingScreen() {
  const navigation = useNavigation<OnboardingNavProp>();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSetupStep, setIsSetupStep] = useState(false);

  // Setup step state
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [saving, setSaving] = useState(false);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      setIsSetupStep(true);
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handleSkipToSetup = () => {
    setIsSetupStep(true);
  };

  const handleStart = async (overrideName?: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const profile: PlayerProfile = {
        ...DEFAULT_PROFILE,
        name: (overrideName ?? name).trim() || '익명',
        position,
      };
      await saveProfile(profile);
      await markOnboarded();
      navigation.replace('Main');
    } catch {
      setSaving(false);
    }
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  if (isSetupStep) {
    return <SetupStep name={name} setName={setName} position={position} setPosition={setPosition} onStart={handleStart} saving={saving} />;
  }

  return (
    <View style={styles.root}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => <SlideItem slide={item} />}
      />

      {/* Bottom controls */}
      <View style={styles.controls}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity onPress={handleSkipToSetup} style={styles.skipBtn}>
            <Text style={styles.skipText}>건너뛰기</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNext} style={styles.nextBtn}>
            <Text style={styles.nextText}>{isLastSlide ? '시작하기' : '다음'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Slide Item ───────────────────────────────────────────────────────────────

function SlideItem({ slide }: { slide: Slide }) {
  return (
    <View style={[styles.slide]}>
      {/* Glow circle */}
      <View style={[styles.glowCircle, { backgroundColor: slide.accentColor + '18' }]} />

      <View style={[styles.emojiCircle, { backgroundColor: slide.accentColor + '22', borderColor: slide.accentColor + '44' }]}>
        <Text style={styles.emoji}>{slide.emoji}</Text>
      </View>

      <Text style={[styles.slideTitle, { color: slide.accentColor }]}>{slide.title}</Text>
      <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
    </View>
  );
}

// ─── Setup Step ───────────────────────────────────────────────────────────────

interface SetupStepProps {
  name: string;
  setName: (v: string) => void;
  position: string;
  setPosition: (v: string) => void;
  onStart: (overrideName?: string) => void;
  saving: boolean;
}

function SetupStep({ name, setName, position, setPosition, onStart, saving }: SetupStepProps) {
  const canStart = name.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.setupContainer}>
        <Text style={styles.setupTitle}>프로필 설정</Text>
        <Text style={styles.setupSubtitle}>나중에 설정 탭에서 변경할 수 있어요</Text>

        {/* Name */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>이름 또는 닉네임</Text>
          <TextInput
            style={styles.textInput}
            placeholder="예: 홍길동"
            placeholderTextColor={Colors.textDisabled}
            value={name}
            onChangeText={setName}
            maxLength={20}
            returnKeyType="done"
          />
        </View>

        {/* Position */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>포지션 (선택)</Text>
          <View style={styles.positionGrid}>
            {POSITIONS.map((p) => (
              <Pressable
                key={p.value}
                style={[
                  styles.positionChip,
                  position === p.value && { backgroundColor: p.color + '33', borderColor: p.color },
                ]}
                onPress={() => setPosition(position === p.value ? '' : p.value)}
              >
                <Text
                  style={[
                    styles.positionLabel,
                    position === p.value && { color: p.color },
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Start button */}
        <TouchableOpacity
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          onPress={() => onStart()}
          disabled={!canStart || saving}
          activeOpacity={0.8}
        >
          <Text style={styles.startBtnText}>{saving ? '저장 중...' : '⚽  트래킹 시작하기'}</Text>
        </TouchableOpacity>

        {/* Skip name */}
        {!canStart && (
          <TouchableOpacity onPress={() => onStart('익명')} style={styles.anonymousBtn}>
            <Text style={styles.anonymousText}>이름 없이 시작하기</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Slides
  slide: {
    width: SCREEN_W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: 160,
  },
  glowCircle: {
    position: 'absolute',
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    borderRadius: SCREEN_W * 0.4,
    top: SCREEN_H * 0.15,
  },
  emojiCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxxl,
  },
  emoji: {
    fontSize: 56,
  },
  slideTitle: {
    ...Typography.headline,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  slideSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Controls
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 48,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    backgroundColor: Colors.background,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtn: {
    padding: Spacing.md,
  },
  skipText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  nextBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  nextText: {
    ...Typography.bodyMedium,
    color: Colors.textInverse,
    fontWeight: '700',
  },

  // Setup
  setupContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 72,
    paddingBottom: 40,
  },
  setupTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  setupSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxxl,
  },
  inputSection: {
    marginBottom: Spacing.xxl,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.title,
    color: Colors.textPrimary,
  },
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  positionChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  positionLabel: {
    ...Typography.captionBold,
    color: Colors.textSecondary,
  },
  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  startBtnDisabled: {
    opacity: 0.4,
  },
  startBtnText: {
    ...Typography.title,
    color: Colors.textInverse,
    fontWeight: '700',
  },
  anonymousBtn: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    padding: Spacing.sm,
  },
  anonymousText: {
    ...Typography.body,
    color: Colors.textDisabled,
    textDecorationLine: 'underline',
  },
});
