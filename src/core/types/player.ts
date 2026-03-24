import { Sport } from './session';

export type Position = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
export type DominantFoot = 'left' | 'right' | 'both';

export interface PlayerProfile {
  id: string;
  name: string;
  avatarUri: string | null;
  position: Position | null;
  dominantFoot: DominantFoot | null;
  weightKg: number | null;
  heightCm: number | null;
  dateOfBirth: string | null;
  preferredSport: Sport | null;
  createdAt: number;
  updatedAt: number;
}

export interface SportStats {
  totalSessions: number;
  totalDistanceMeters: number;
  totalActiveDurationSeconds: number;
  totalMatchSessions: number;
  totalTrainingSessions: number;
  bestSpeedKph: number;
  longestSessionMeters: number;
  longestSessionDurationSeconds: number;
  avgSessionDistanceMeters: number;
  avgSessionDurationSeconds: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastSessionAt: number | null;
}

export interface PlayerStats {
  playerId: string;
  updatedAt: number;
  soccer: SportStats;
  futsal: SportStats;
  combined: SportStats;
  weeklyGoalDistanceMeters: number;
  thisWeekDistanceMeters: number;
  monthlySessionCounts: Record<string, number>;
}

export interface AppSettings {
  units: 'km' | 'miles';
  weeklyGoalKm: number;
  theme: 'dark' | 'light';
}
