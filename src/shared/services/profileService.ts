import AsyncStorage from '@react-native-async-storage/async-storage';

export type PreferredFoot = 'right' | 'left' | 'both';

export interface PlayerProfile {
  name: string;
  position: string;           // 'GK' | 'CB' | ... | 'ST' | ''
  preferredFoot: PreferredFoot;
  weeklyGoalSessions: number; // 0 = 목표 없음
  weeklyGoalDistanceKm: number; // 0 = 목표 없음
}

export const DEFAULT_PROFILE: PlayerProfile = {
  name: '',
  position: '',
  preferredFoot: 'right',
  weeklyGoalSessions: 0,
  weeklyGoalDistanceKm: 0,
};

const PROFILE_KEY = '@soccer_tracker:profile';
const ONBOARDED_KEY = '@soccer_tracker:onboarded';

export async function loadProfile(): Promise<PlayerProfile> {
  try {
    const json = await AsyncStorage.getItem(PROFILE_KEY);
    return json ? { ...DEFAULT_PROFILE, ...JSON.parse(json) } : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(profile: PlayerProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function isOnboarded(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ONBOARDED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markOnboarded(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
}
