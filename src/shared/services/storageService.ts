import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionSummary } from '../../core/types/session';

const SESSIONS_KEY = '@soccer_tracker:sessions';

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
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
}
