import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionSummary } from '../../core/types/session';
import type { LocationPoint } from '../../core/types/session';

const SESSIONS_KEY = '@soccer_tracker:sessions';
const POINTS_PREFIX = '@soccer_tracker:points:';

export async function loadSessions(): Promise<SessionSummary[]> {
  try {
    const json = await AsyncStorage.getItem(SESSIONS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveSession(session: SessionSummary): Promise<void> {
  const sessions = await loadSessions();
  sessions.unshift(session);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await loadSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  await Promise.all([
    AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered)),
    AsyncStorage.removeItem(`${POINTS_PREFIX}${id}`),
  ]);
}

export async function saveSessionPoints(sessionId: string, points: LocationPoint[]): Promise<void> {
  await AsyncStorage.setItem(`${POINTS_PREFIX}${sessionId}`, JSON.stringify(points));
}

export async function loadSessionPoints(sessionId: string): Promise<LocationPoint[]> {
  try {
    const json = await AsyncStorage.getItem(`${POINTS_PREFIX}${sessionId}`);
    return json ? JSON.parse(json) : [];
  } catch { return []; }
}
