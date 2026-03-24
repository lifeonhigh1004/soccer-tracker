import { useState, useRef, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import type { LocationPoint } from '../../core/types/session';
import type { IMUState } from './useIMU';
import {
  LOCATION_TASK,
  TrackingRecord,
  TaskResult,
  getTrackingRecord,
  saveTrackingRecord,
  getTrackingPoints,
  clearTrackingData,
  setTaskResultCallback,
} from '../services/trackingTask';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface FinalTrackingData {
  startedAt: number;
  locationPoints: LocationPoint[];
  distanceMeters: number;
  maxSpeedKph: number;
  maxSpeedTimestamp: number | null;
  durationSeconds: number;
}

interface TrackingStats {
  hasPermission: boolean | null;
  gpsReady: boolean;
  distanceMeters: number;
  currentSpeedKph: number;
  maxSpeedKph: number;
  durationSeconds: number;
  currentLocation: LatLng | null;
  routeCoordinates: LatLng[];
  /** 복원된 세션이 있는지 (앱 재시작 후 세션 화면 복귀용) */
  isSessionActive: boolean;
  isSessionPaused: boolean;
  /** AsyncStorage에서 세션 복원 중인지 */
  isLoading: boolean;
}

const INITIAL_STATS: TrackingStats = {
  hasPermission: null,
  gpsReady: false,
  distanceMeters: 0,
  currentSpeedKph: 0,
  maxSpeedKph: 0,
  durationSeconds: 0,
  currentLocation: null,
  routeCoordinates: [],
  isSessionActive: false,
  isSessionPaused: false,
  isLoading: true,
};

export function useLocationTracking(options?: {
  getIMUState?: () => IMUState;
}) {
  const getIMUState = options?.getIMUState;
  const [stats, setStats] = useState<TrackingStats>(INITIAL_STATS);

  const isActiveRef   = useRef(false);
  const startedAtRef  = useRef(0);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const warmupRef     = useRef<Location.LocationSubscription | null>(null);

  // ── 태스크 결과 콜백 ─────────────────────────────────────────────────────
  const handleResult = useCallback((result: TaskResult) => {
    const imuState = getIMUState?.();
    const imuOk = imuState ? imuState.isMoving : true;
    const displaySpeed = result.gpsReady && imuOk ? result.smoothedKph : 0;
    const latLng: LatLng = { latitude: result.latitude, longitude: result.longitude };

    if (isActiveRef.current) {
      setStats((prev) => ({
        ...prev,
        distanceMeters: result.distanceMeters,
        maxSpeedKph: result.maxSpeedKph,
        currentSpeedKph: displaySpeed,
        gpsReady: result.gpsReady,
        currentLocation: latLng,
        routeCoordinates: result.gpsReady
          ? [...prev.routeCoordinates, latLng]
          : prev.routeCoordinates,
      }));
    } else {
      setStats((prev) => ({ ...prev, currentLocation: latLng, gpsReady: result.gpsReady }));
    }
  }, [getIMUState]);

  // 콜백 등록/해제
  useEffect(() => {
    setTaskResultCallback(handleResult);
    return () => setTaskResultCallback(null);
  }, [handleResult]);

  // ── 마운트 시 초기화 ──────────────────────────────────────────────────────
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      const granted = status === 'granted';
      setStats((prev) => ({ ...prev, hasPermission: granted }));
      // 권한이 있으면 즉시 GPS 예열 시작 (세션 시작 전 위성 연결 확보)
      if (granted) startWarmup();
    });

    restoreSession();

    const sub = AppState.addEventListener('change', handleAppState);
    return () => {
      sub.remove();
      stopTimer();
      stopWarmup();
    };
  }, []);

  async function handleAppState(next: AppStateStatus) {
    if (next === 'active') {
      // 포그라운드 복귀 시 스토리지 동기화
      await syncFromStorage();
    }
  }

  // ── 세션 복원 (앱 재시작 / 컴포넌트 재마운트 대응) ──────────────────────
  async function restoreSession() {
    const record = await getTrackingRecord();

    if (!record?.isActive) {
      setStats((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    const points = await getTrackingPoints();
    const route: LatLng[] = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    const last = points[points.length - 1];
    const elapsed = Math.floor((Date.now() - record.startedAt) / 1000);

    isActiveRef.current  = !record.isPaused;
    startedAtRef.current = record.startedAt;

    setStats((prev) => ({
      ...prev,
      isLoading: false,
      isSessionActive: true,
      isSessionPaused: record.isPaused,
      distanceMeters: record.distanceMeters,
      maxSpeedKph: record.maxSpeedKph,
      durationSeconds: elapsed,
      routeCoordinates: route,
      currentLocation: last ? { latitude: last.latitude, longitude: last.longitude } : null,
    }));

    if (!record.isPaused) startTimer();
  }

  // ── 포그라운드 복귀 시 스토리지 동기화 ──────────────────────────────────
  async function syncFromStorage() {
    const [record, points] = await Promise.all([getTrackingRecord(), getTrackingPoints()]);
    if (!record?.isActive) return;

    const route: LatLng[] = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    const last = points[points.length - 1];

    setStats((prev) => ({
      ...prev,
      distanceMeters: record.distanceMeters,
      maxSpeedKph: record.maxSpeedKph,
      routeCoordinates: route,
      currentLocation: last
        ? { latitude: last.latitude, longitude: last.longitude }
        : prev.currentLocation,
    }));
  }

  // ── 타이머 ───────────────────────────────────────────────────────────────
  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (startedAtRef.current > 0) {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setStats((prev) => ({ ...prev, durationSeconds: elapsed }));
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // ── GPS 예열 (세션 시작 전 위성 신호 미리 확보) ──────────────────────────
  async function startWarmup() {
    if (warmupRef.current) return; // 이미 실행 중
    try {
      warmupRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 2000,
          distanceInterval: 0,
        },
        (loc) => {
          // 세션이 활성화되면 예열 콜백은 무시 (백그라운드 태스크가 처리)
          if (isActiveRef.current) return;
          const accuracy = loc.coords.accuracy ?? 999;
          const isGoodFix = accuracy <= 30;
          const latLng: LatLng = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setStats((prev) => ({
            ...prev,
            gpsReady: isGoodFix,
            currentLocation: latLng,
          }));
        },
      );
    } catch {
      // 예열 실패는 무시 (세션 시작 시 다시 시도)
    }
  }

  function stopWarmup() {
    warmupRef.current?.remove();
    warmupRef.current = null;
  }

  // ── 공개 API ─────────────────────────────────────────────────────────────

  async function startTracking(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setStats((prev) => ({ ...prev, hasPermission: granted }));
    if (!granted) return false;

    // 백그라운드 권한 요청 (거부해도 포그라운드 트래킹은 작동)
    await Location.requestBackgroundPermissionsAsync().catch(() => {});

    // GPS 예열 구독 종료 (백그라운드 태스크로 전환)
    stopWarmup();

    const now = Date.now();
    startedAtRef.current = now;
    isActiveRef.current  = true;

    const record: TrackingRecord = {
      isActive: true,
      isPaused: false,
      startedAt: now,
      distanceMeters: 0,
      maxSpeedKph: 0,
      maxSpeedTimestamp: null,
      speedBuffer: [],
      lastLat: null,
      lastLng: null,
    };
    await saveTrackingRecord(record);

    // 기존 태스크 정리
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 3,
      // Android 포그라운드 서비스 알림 (화면 꺼져도 GPS 유지)
      foregroundService: {
        notificationTitle: '⚽ 축구 트래커',
        notificationBody: '세션 진행 중 — 탭하면 앱으로 돌아갑니다',
        notificationColor: '#00E676',
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
    });

    startTimer();
    setStats((prev) => ({
      ...prev,
      isSessionActive: true,
      isSessionPaused: false,
      isLoading: false,
      distanceMeters: 0,
      maxSpeedKph: 0,
      durationSeconds: 0,
      currentSpeedKph: 0,
      routeCoordinates: [],
    }));
    return true;
  }

  async function pauseTracking() {
    isActiveRef.current = false;
    stopTimer();

    const record = await getTrackingRecord();
    if (record) {
      record.isPaused = true;
      await saveTrackingRecord(record);
    }

    setStats((prev) => ({ ...prev, isSessionPaused: true, currentSpeedKph: 0 }));
  }

  async function resumeTracking() {
    isActiveRef.current = true;

    const record = await getTrackingRecord();
    if (record) {
      record.isPaused = false;
      await saveTrackingRecord(record);
    }

    startTimer();
    setStats((prev) => ({ ...prev, isSessionPaused: false }));
  }

  async function stopTracking(): Promise<FinalTrackingData> {
    isActiveRef.current = false;
    stopTimer();

    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});

    const [record, points] = await Promise.all([getTrackingRecord(), getTrackingPoints()]);
    const startedAt = record?.startedAt ?? startedAtRef.current;
    const finalDuration = Math.floor((Date.now() - startedAt) / 1000);

    setStats((prev) => ({ ...prev, isSessionActive: false, isSessionPaused: false }));

    return {
      startedAt,
      locationPoints: points,
      distanceMeters: record?.distanceMeters ?? 0,
      maxSpeedKph: record?.maxSpeedKph ?? 0,
      maxSpeedTimestamp: record?.maxSpeedTimestamp ?? null,
      durationSeconds: finalDuration,
    };
  }

  async function reset() {
    isActiveRef.current  = false;
    startedAtRef.current = 0;
    stopTimer();

    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});

    await clearTrackingData();
    setStats((prev) => ({
      ...INITIAL_STATS,
      hasPermission: prev.hasPermission,
      isLoading: false,
    }));

    // 세션 종료 후 GPS 예열 재시작 (다음 세션 준비)
    startWarmup();
  }

  return {
    ...stats,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    reset,
  };
}
