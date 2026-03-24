/**
 * 백그라운드 위치 태스크
 * - 홈 화면 이동, 앱 전환, 화면 잠금 중에도 GPS 데이터를 수집합니다.
 * - 수집된 데이터는 AsyncStorage에 저장되어 앱 재시작 시에도 복원됩니다.
 */
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haversineDistance } from '../utils/geoUtils';
import type { LocationPoint } from '../../core/types/session';

export const LOCATION_TASK = 'soccer-tracker-bg-location';

export interface TrackingRecord {
  isActive: boolean;
  isPaused: boolean;
  startedAt: number;
  distanceMeters: number;
  maxSpeedKph: number;
  maxSpeedTimestamp: number | null;
  speedBuffer: number[];
  lastLat: number | null;
  lastLng: number | null;
}

export interface TaskResult {
  distanceMeters: number;
  maxSpeedKph: number;
  maxSpeedTimestamp: number | null;
  smoothedKph: number;
  latitude: number;
  longitude: number;
  gpsReady: boolean;
}

const RECORD_KEY = '@soccer_tracker:tracking_record';
const POINTS_KEY  = '@soccer_tracker:tracking_points';

const SPEED_BUFFER_SIZE  = 5;
const MIN_MOVE_KPH       = 1.5;
const MIN_MAX_KPH        = 3.0;
const MIN_BUFFER_FOR_MAX = 3;

// ── AsyncStorage 헬퍼 ───────────────────────────────────────────────────────

export async function getTrackingRecord(): Promise<TrackingRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(RECORD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveTrackingRecord(record: TrackingRecord): Promise<void> {
  await AsyncStorage.setItem(RECORD_KEY, JSON.stringify(record));
}

export async function getTrackingPoints(): Promise<LocationPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(POINTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function appendTrackingPoints(points: LocationPoint[]): Promise<void> {
  const existing = await getTrackingPoints();
  await AsyncStorage.setItem(POINTS_KEY, JSON.stringify([...existing, ...points]));
}

export async function clearTrackingData(): Promise<void> {
  await AsyncStorage.multiRemove([RECORD_KEY, POINTS_KEY]);
}

// ── 포그라운드 콜백 ─────────────────────────────────────────────────────────
// 앱이 포그라운드일 때 태스크 결과를 UI에 즉시 전달하기 위한 콜백입니다.
// 백그라운드 상태에서는 null이므로 AsyncStorage만 업데이트합니다.

let _resultCallback: ((result: TaskResult) => void) | null = null;

export function setTaskResultCallback(cb: typeof _resultCallback): void {
  _resultCallback = cb;
}

// ── 태스크 정의 (모듈 최상위에서 반드시 호출) ──────────────────────────────

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.warn('[LocationTask] error:', error.message);
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  const record = await getTrackingRecord();
  if (!record?.isActive || record.isPaused) return;

  const newPoints: LocationPoint[] = [];
  let lastResult: TaskResult | null = null;

  for (const loc of locations) {
    const accuracy = loc.coords.accuracy ?? 999;
    const isGoodFix = accuracy <= 30;

    if (!isGoodFix) {
      _resultCallback?.({
        distanceMeters: record.distanceMeters,
        maxSpeedKph: record.maxSpeedKph,
        maxSpeedTimestamp: record.maxSpeedTimestamp,
        smoothedKph: 0,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        gpsReady: false,
      });
      continue;
    }

    const rawSpeed = loc.coords.speed;
    const speed = rawSpeed !== null && rawSpeed >= 0 ? rawSpeed : null;
    const rawKph = speed !== null ? speed * 3.6 : 0;

    const point: LocationPoint = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude,
      speed,
      accuracy,
      timestamp: loc.timestamp,
    };

    // 속도 이동 평균
    const buf = record.speedBuffer;
    buf.push(rawKph);
    if (buf.length > SPEED_BUFFER_SIZE) buf.shift();
    const smoothedKph = buf.reduce((a: number, b: number) => a + b, 0) / buf.length;

    // 거리 누적
    if (record.lastLat !== null && record.lastLng !== null) {
      const dist = haversineDistance(record.lastLat, record.lastLng, point.latitude, point.longitude);
      if (dist < 200 && smoothedKph >= MIN_MOVE_KPH) {
        record.distanceMeters += dist;
      }
    }

    // 최고 속도
    if (buf.length >= MIN_BUFFER_FOR_MAX && smoothedKph > record.maxSpeedKph && smoothedKph >= MIN_MAX_KPH) {
      record.maxSpeedKph = smoothedKph;
      record.maxSpeedTimestamp = point.timestamp;
    }

    record.lastLat = point.latitude;
    record.lastLng = point.longitude;
    record.speedBuffer = buf;

    newPoints.push(point);
    lastResult = {
      distanceMeters: record.distanceMeters,
      maxSpeedKph: record.maxSpeedKph,
      maxSpeedTimestamp: record.maxSpeedTimestamp,
      smoothedKph,
      latitude: point.latitude,
      longitude: point.longitude,
      gpsReady: true,
    };
  }

  if (newPoints.length > 0) {
    await Promise.all([
      saveTrackingRecord(record),
      appendTrackingPoints(newPoints),
    ]);
    if (lastResult) _resultCallback?.(lastResult);
  }
});
